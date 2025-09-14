import { ethers } from 'ethers';
import { getAmountOut } from '@pkg/core';
import type { Pair } from '@pkg/shared';
import { 
  UNISWAP_V2_PAIR_ABI, 
  UNISWAP_V2_ROUTER_ABI, 
  UNISWAP_V2_FACTORY_ABI,
  TOKEN_DECIMALS 
} from './constants';

export interface DEXConfig {
  factory: string;
  router: string;
  initCodeHash: string;
}

export interface Reserves {
  reserve0: bigint;
  reserve1: bigint;
  blockTimestampLast: number;
}

export class UniswapV2Connector {
  private provider: ethers.JsonRpcProvider;
  private dexName: string;
  private config: DEXConfig;
  private factoryContract: ethers.Contract;
  private routerContract: ethers.Contract;
  private pairCache: Map<string, string> = new Map();

  constructor(dexName: string, rpcUrl: string, config: DEXConfig) {
    this.dexName = dexName;
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.factoryContract = new ethers.Contract(config.factory, UNISWAP_V2_FACTORY_ABI, this.provider);
    this.routerContract = new ethers.Contract(config.router, UNISWAP_V2_ROUTER_ABI, this.provider);
  }

  /**
   * Get pair address for two tokens
   */
  async getPairAddress(tokenA: string, tokenB: string): Promise<string | null> {
    const key = `${tokenA.toLowerCase()}-${tokenB.toLowerCase()}`;
    
    if (this.pairCache.has(key)) {
      return this.pairCache.get(key)!;
    }

    try {
      const pairAddress = await this.factoryContract.getPair(tokenA, tokenB);
      
      if (pairAddress === ethers.ZeroAddress) {
        return null;
      }

      this.pairCache.set(key, pairAddress);
      return pairAddress;
    } catch (error) {
      console.error(`Failed to get pair address for ${tokenA}/${tokenB}:`, error);
      return null;
    }
  }

  /**
   * Read reserves from pair contract
   */
  async getReserves(tokenA: string, tokenB: string): Promise<Reserves | null> {
    try {
      const pairAddress = await this.getPairAddress(tokenA, tokenB);
      if (!pairAddress) return null;

      const pairContract = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, this.provider);
      const [reserve0, reserve1, blockTimestampLast] = await pairContract.getReserves();

      // Determine token order
      const token0 = await pairContract.token0();
      const isToken0A = token0.toLowerCase() === tokenA.toLowerCase();

      return {
        reserve0: isToken0A ? reserve0 : reserve1,
        reserve1: isToken0A ? reserve1 : reserve0,
        blockTimestampLast: Number(blockTimestampLast)
      };
    } catch (error) {
      console.error(`Failed to get reserves for ${tokenA}/${tokenB}:`, error);
      return null;
    }
  }

  /**
   * Simulate a swap without executing
   */
  async simulateSwap(
    tokenIn: string, 
    tokenOut: string, 
    amountIn: bigint
  ): Promise<bigint | null> {
    try {
      const reserves = await this.getReserves(tokenIn, tokenOut);
      if (!reserves) return null;

      // Use UniV2 formula directly for simulation
      const amountOut = getAmountOut(amountIn, reserves.reserve0, reserves.reserve1);
      return amountOut;
    } catch (error) {
      console.error(`Simulation failed for ${tokenIn} -> ${tokenOut}:`, error);
      return null;
    }
  }

  /**
   * Get amounts out for a multi-hop path
   */
  async getAmountsOut(amountIn: bigint, path: string[]): Promise<bigint[] | null> {
    try {
      const amounts = await this.routerContract.getAmountsOut(amountIn, path);
      return amounts.map((amount: any) => BigInt(amount.toString()));
    } catch (error) {
      console.error(`getAmountsOut failed for path:`, path, error);
      return null;
    }
  }

  /**
   * Execute actual swap (requires wallet)
   */
  async executeSwap(
    wallet: ethers.Wallet,
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    amountOutMin: bigint,
    deadline: number
  ): Promise<ethers.ContractTransactionResponse> {
    const routerWithSigner = this.routerContract.connect(wallet);
    
    const path = [tokenIn, tokenOut];
    
    return await (routerWithSigner as any).swapExactTokensForTokens(
      amountIn,
      amountOutMin,
      path,
      wallet.address,
      deadline
    );
  }

  /**
   * Get all pairs for discovery
   */
  async getAllPairs(): Promise<Pair[]> {
    try {
      const pairsLength = await this.factoryContract.allPairsLength();
      const pairs: Pair[] = [];

      // Fetch pairs in batches to avoid RPC limits
      const batchSize = 100;
      for (let i = 0; i < Number(pairsLength); i += batchSize) {
        const batch = [];
        const end = Math.min(i + batchSize, Number(pairsLength));
        
        for (let j = i; j < end; j++) {
          batch.push(this.factoryContract.allPairs(j));
        }

        const pairAddresses = await Promise.all(batch);
        
        for (const pairAddress of pairAddresses) {
          try {
            const pairContract = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, this.provider);
            const [token0, token1] = await Promise.all([
              pairContract.token0(),
              pairContract.token1()
            ]);

            pairs.push({
              address: pairAddress,
              token0,
              token1,
              symbol0: this.getTokenSymbol(token0),
              symbol1: this.getTokenSymbol(token1),
              dex: this.dexName
            });
          } catch (error) {
            console.error(`Failed to fetch pair info for ${pairAddress}:`, error);
          }
        }
      }

      return pairs;
    } catch (error) {
      console.error('Failed to get all pairs:', error);
      return [];
    }
  }

  private getTokenSymbol(address: string): string {
    const symbols: Record<string, string> = {
      '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270': 'WMATIC',
      '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619': 'WETH',
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': 'USDC',
      '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': 'USDT',
      '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063': 'DAI'
    };
    return symbols[address] || address.slice(0, 8);
  }

  /**
   * Estimate gas for swap
   */
  async estimateSwapGas(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    amountOutMin: bigint,
    deadline: number,
    fromAddress: string
  ): Promise<bigint> {
    try {
      const path = [tokenIn, tokenOut];
      
      const gasEstimate = await this.routerContract.swapExactTokensForTokens.estimateGas(
        amountIn,
        amountOutMin,
        path,
        fromAddress,
        deadline
      );

      return gasEstimate;
    } catch (error) {
      console.error('Gas estimation failed:', error);
      return BigInt(150000); // Conservative fallback
    }
  }

  getDexName(): string {
    return this.dexName;
  }

  getRouterAddress(): string {
    return this.config.router;
  }

  getFactoryAddress(): string {
    return this.config.factory;
  }
}
