import { UniswapV2Connector } from './uniswap-v2';
import { POLYGON_ADDRESSES } from './constants';
import type { Pair } from '@pkg/shared';

export class PolygonConnectors {
  public quickswap: UniswapV2Connector;
  public sushiswap: UniswapV2Connector;

  constructor(rpcUrl: string) {
    this.quickswap = new UniswapV2Connector(
      'quickswap',
      rpcUrl,
      {
        factory: POLYGON_ADDRESSES.QUICKSWAP.FACTORY,
        router: POLYGON_ADDRESSES.QUICKSWAP.ROUTER,
        initCodeHash: POLYGON_ADDRESSES.QUICKSWAP.INIT_CODE_HASH
      }
    );

    this.sushiswap = new UniswapV2Connector(
      'sushiswap',
      rpcUrl,
      {
        factory: POLYGON_ADDRESSES.SUSHISWAP.FACTORY,
        router: POLYGON_ADDRESSES.SUSHISWAP.ROUTER,
        initCodeHash: POLYGON_ADDRESSES.SUSHISWAP.INIT_CODE_HASH
      }
    );
  }

  /**
   * Get all connectors
   */
  getAllConnectors(): UniswapV2Connector[] {
    return [this.quickswap, this.sushiswap];
  }

  /**
   * Get connector by name
   */
  getConnector(name: string): UniswapV2Connector | null {
    switch (name.toLowerCase()) {
      case 'quickswap':
        return this.quickswap;
      case 'sushiswap':
        return this.sushiswap;
      default:
        return null;
    }
  }

  /**
   * Discover all pairs across all DEXes
   */
  async discoverAllPairs(): Promise<Pair[]> {
    const allPairs: Pair[] = [];
    
    for (const connector of this.getAllConnectors()) {
      try {
        const pairs = await connector.getAllPairs();
        allPairs.push(...pairs);
      } catch (error) {
        console.error(`Failed to discover pairs for ${connector.getDexName()}:`, error);
      }
    }

    return allPairs;
  }

  /**
   * Find arbitrage opportunities between DEXes
   */
  async findArbitrageOpportunities(tokenA: string, tokenB: string): Promise<{
    quickswapPrice: number;
    sushiswapPrice: number;
    spreadBps: number;
    bestBuy: string;
    bestSell: string;
  } | null> {
    try {
      const [quickswapReserves, sushiswapReserves] = await Promise.all([
        this.quickswap.getReserves(tokenA, tokenB),
        this.sushiswap.getReserves(tokenA, tokenB)
      ]);

      if (!quickswapReserves || !sushiswapReserves) {
        return null;
      }

      const quickswapPrice = Number(quickswapReserves.reserve1) / Number(quickswapReserves.reserve0);
      const sushiswapPrice = Number(sushiswapReserves.reserve1) / Number(sushiswapReserves.reserve0);

      const priceDiff = Math.abs(quickswapPrice - sushiswapPrice);
      const avgPrice = (quickswapPrice + sushiswapPrice) / 2;
      const spreadBps = (priceDiff / avgPrice) * 10000;

      const bestBuy = quickswapPrice < sushiswapPrice ? 'quickswap' : 'sushiswap';
      const bestSell = quickswapPrice > sushiswapPrice ? 'quickswap' : 'sushiswap';

      return {
        quickswapPrice,
        sushiswapPrice,
        spreadBps,
        bestBuy,
        bestSell
      };
    } catch (error) {
      console.error('Failed to find arbitrage opportunities:', error);
      return null;
    }
  }

  /**
   * Get token addresses for common tokens
   */
  getTokenAddresses() {
    return {
      WMATIC: POLYGON_ADDRESSES.WMATIC,
      WETH: POLYGON_ADDRESSES.WETH,
      USDC: POLYGON_ADDRESSES.USDC,
      USDT: POLYGON_ADDRESSES.USDT,
      DAI: POLYGON_ADDRESSES.DAI
    };
  }

  /**
   * Check if a pair exists on both DEXes
   */
  async pairExistsOnBoth(tokenA: string, tokenB: string): Promise<boolean> {
    const [quickswapPair, sushiswapPair] = await Promise.all([
      this.quickswap.getPairAddress(tokenA, tokenB),
      this.sushiswap.getPairAddress(tokenA, tokenB)
    ]);

    return quickswapPair !== null && sushiswapPair !== null;
  }
}
