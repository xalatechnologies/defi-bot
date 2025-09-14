import { WebSocket } from 'ws';
import { ethers } from 'ethers';
import { logger } from '@pkg/shared';
import type { Config, Trade, Route, Snapshot } from '@pkg/shared';
import { calculateMidPrice, calculateSpreadBps, calculateSlippage } from '@pkg/core';
import { UniswapV2Connector } from '@pkg/connectors';
import { WebSocketSubscriber, Database } from '@pkg/data';
import { AIModel, extractFeatures } from '@pkg/ai';
import { RiskManager } from '@pkg/risk';
import { TradeExecutor } from './executor.js';

export class ArbitrageBot {
  private config: Config;
  private database: Database;
  private wsSubscriber: WebSocketSubscriber;
  private aiModel: AIModel;
  private riskManager: RiskManager;
  private executor: TradeExecutor;
  private connectors: Map<string, UniswapV2Connector>;
  private isRunning = false;
  private routes: Route[] = [];

  constructor(config: Config) {
    this.config = config;
    this.database = new Database();
    this.wsSubscriber = new WebSocketSubscriber(config.RPC_WS);
    this.aiModel = new AIModel();
    this.riskManager = new RiskManager(config, this.database);
    this.executor = new TradeExecutor(config);
    this.connectors = new Map();

    this.initializeConnectors();
    this.initializeRoutes();
  }

  private initializeConnectors() {
    // Initialize QuickSwap connector
    this.connectors.set('quickswap', new UniswapV2Connector(
      'quickswap',
      this.config.RPC_HTTP,
      {
        factory: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
        router: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
        initCodeHash: '0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f'
      }
    ));

    // Initialize SushiSwap connector
    this.connectors.set('sushiswap', new UniswapV2Connector(
      'sushiswap', 
      this.config.RPC_HTTP,
      {
        factory: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
        router: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
        initCodeHash: '0xe18a34eb0e04b04f7a0ac29a6e80748dca96319b42c54d679cb821dca90c6303'
      }
    ));
  }

  private initializeRoutes() {
    const tokens = [
      { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174' },
      { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619' },
      { symbol: 'WMATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' },
      { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' }
    ];

    // Generate triangular arbitrage routes
    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j < tokens.length; j++) {
        for (let k = 0; k < tokens.length; k++) {
          if (i !== j && j !== k && k !== i) {
            this.routes.push({
              id: `${tokens[i].symbol}-${tokens[j].symbol}-${tokens[k].symbol}`,
              path: [tokens[i].address, tokens[j].address, tokens[k].address],
              symbols: [tokens[i].symbol, tokens[j].symbol, tokens[k].symbol],
              dexA: 'quickswap',
              dexB: 'sushiswap'
            });
          }
        }
      }
    }

    logger.info(`Initialized ${this.routes.length} arbitrage routes`);
  }

  async start() {
    if (this.isRunning) return;

    try {
      await this.database.initialize();
      await this.aiModel.load();
      
      this.wsSubscriber.on('reserveUpdate', this.handleReserveUpdate.bind(this));
      await this.wsSubscriber.connect();

      this.isRunning = true;
      logger.info('Arbitrage bot started successfully');

      // Start main loop
      this.mainLoop();
    } catch (error) {
      logger.error('Failed to start bot', { error: error.message });
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    await this.wsSubscriber.disconnect();
    await this.database.close();
    
    logger.info('Arbitrage bot stopped');
  }

  private async handleReserveUpdate(snapshot: Snapshot) {
    if (!this.isRunning) return;

    try {
      // Check if bot is killed or risk limits exceeded
      if (await this.riskManager.shouldStop()) {
        logger.warn('Risk manager triggered stop');
        await this.stop();
        return;
      }

      // Evaluate all routes for arbitrage opportunities
      for (const route of this.routes) {
        await this.evaluateRoute(route, snapshot);
      }
    } catch (error) {
      logger.error('Error handling reserve update', { error: error.message });
    }
  }

  private async evaluateRoute(route: Route, snapshot: Snapshot) {
    try {
      const connectorA = this.connectors.get(route.dexA);
      const connectorB = this.connectors.get(route.dexB);
      
      if (!connectorA || !connectorB) return;

      // Simulate different trade sizes
      const tradeSizes = [100, 250, 500, 1000]; // USD amounts
      
      for (const sizeUsd of tradeSizes) {
        if (sizeUsd > this.config.MAX_NOTIONAL_USD) continue;

        const simulation = await this.simulateArbitrage(
          route, 
          connectorA, 
          connectorB, 
          sizeUsd
        );

        if (!simulation || simulation.netProfitUsd < this.config.MIN_PROFIT_USD) {
          continue;
        }

        // Extract features for AI scoring
        const features = extractFeatures(snapshot, route, sizeUsd);
        const aiScore = await this.aiModel.score(features);

        // AI filter: only proceed if score >= threshold
        if (aiScore < 0.7) {
          logger.debug('AI filter rejected trade', { 
            route: route.id, 
            aiScore, 
            profitUsd: simulation.netProfitUsd 
          });
          continue;
        }

        // Risk check
        if (!await this.riskManager.canTrade(sizeUsd, simulation.netProfitUsd)) {
          continue;
        }

        // Execute trade
        await this.executeTrade(route, simulation, aiScore);
        break; // Only execute one size per route per update
      }
    } catch (error) {
      logger.error('Error evaluating route', { 
        route: route.id, 
        error: error.message 
      });
    }
  }

  private async simulateArbitrage(
    route: Route, 
    connectorA: UniswapV2Connector, 
    connectorB: UniswapV2Connector, 
    amountInUsd: number
  ) {
    try {
      // Get current reserves
      const reservesA = await connectorA.getReserves(route.path[0], route.path[1]);
      const reservesB = await connectorB.getReserves(route.path[1], route.path[2]);
      const reservesC = await connectorA.getReserves(route.path[2], route.path[0]);

      if (!reservesA || !reservesB || !reservesC) return null;

      // Calculate mid prices
      const priceAB_A = calculateMidPrice(reservesA.reserve0, reservesA.reserve1);
      const priceBC_B = calculateMidPrice(reservesB.reserve0, reservesB.reserve1);
      const priceCA_A = calculateMidPrice(reservesC.reserve0, reservesC.reserve1);

      // Check for arbitrage opportunity
      const spreadBps = calculateSpreadBps(priceAB_A, priceBC_B, priceCA_A);
      if (spreadBps < 10) return null; // Minimum spread threshold

      // Simulate exact trade path
      const amountIn = ethers.parseUnits(amountInUsd.toString(), 6); // Assuming USDC decimals
      
      // A -> B on DEX A
      const amountOut1 = await connectorA.simulateSwap(
        route.path[0], 
        route.path[1], 
        amountIn
      );
      if (!amountOut1) return null;

      // B -> C on DEX B  
      const amountOut2 = await connectorB.simulateSwap(
        route.path[1], 
        route.path[2], 
        amountOut1
      );
      if (!amountOut2) return null;

      // C -> A on DEX A
      const amountOut3 = await connectorA.simulateSwap(
        route.path[2], 
        route.path[0], 
        amountOut2
      );
      if (!amountOut3) return null;

      // Calculate profit
      const profitWei = amountOut3 - amountIn;
      const profitUsd = Number(ethers.formatUnits(profitWei, 6));

      // Estimate gas costs
      const gasEstimate = await this.executor.estimateGasCost(route);
      const gasUsd = gasEstimate.gasCostUsd;

      // Calculate slippage penalty
      const slippageUsd = calculateSlippage(amountInUsd, this.config.SLIPPAGE_BPS);

      const netProfitUsd = profitUsd - gasUsd - slippageUsd;

      return {
        route,
        amountInUsd,
        profitUsd,
        gasUsd,
        slippageUsd,
        netProfitUsd,
        gasEstimate,
        amountIn,
        amountOut: amountOut3
      };
    } catch (error) {
      logger.error('Simulation failed', { error: error.message });
      return null;
    }
  }

  private async executeTrade(route: Route, simulation: any, aiScore: number) {
    const trade: Omit<Trade, 'id' | 'timestamp'> = {
      route: route.id,
      amountInUsd: simulation.amountInUsd,
      expectedProfitUsd: simulation.netProfitUsd,
      actualProfitUsd: 0,
      gasUsedUsd: simulation.gasUsd,
      aiScore,
      status: 'pending',
      mode: this.config.MODE,
      txHash: null,
      errorMessage: null
    };

    try {
      if (this.config.MODE === 'live') {
        // Execute actual trade
        const result = await this.executor.executeTrade(simulation);
        trade.txHash = result.txHash;
        trade.actualProfitUsd = result.actualProfitUsd;
        trade.gasUsedUsd = result.gasUsedUsd;
        trade.status = result.success ? 'success' : 'failed';
        trade.errorMessage = result.errorMessage;
      } else {
        // Paper trade
        trade.actualProfitUsd = simulation.netProfitUsd;
        trade.status = 'success';
      }

      // Save trade to database
      await this.database.saveTrade(trade);

      // Update risk manager
      await this.riskManager.recordTrade(trade);

      logger.info('Trade executed', {
        mode: this.config.MODE,
        route: route.id,
        profitUsd: trade.actualProfitUsd,
        aiScore,
        status: trade.status
      });

    } catch (error) {
      trade.status = 'failed';
      trade.errorMessage = error.message;
      
      await this.database.saveTrade(trade);
      
      logger.error('Trade execution failed', {
        route: route.id,
        error: error.message
      });
    }
  }

  private async mainLoop() {
    while (this.isRunning) {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Periodic health checks and maintenance
        await this.riskManager.checkLimits();
        
      } catch (error) {
        logger.error('Main loop error', { error: error.message });
      }
    }
  }
}
