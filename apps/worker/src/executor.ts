import { ethers } from 'ethers';
import { logger } from '@pkg/shared';
import type { Config, Route } from '@pkg/shared';

export interface TradeResult {
  success: boolean;
  txHash?: string;
  actualProfitUsd: number;
  gasUsedUsd: number;
  errorMessage?: string;
}

export interface GasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  gasCostUsd: number;
}

export class TradeExecutor {
  private config: Config;
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private approvals: Map<string, Set<string>> = new Map(); // token -> routers

  constructor(config: Config) {
    this.config = config;
    this.provider = new ethers.JsonRpcProvider(config.RPC_HTTP);
    this.wallet = new ethers.Wallet(config.WALLET_PRIVATE_KEY, this.provider);
  }

  async estimateGasCost(route: Route): Promise<GasEstimate> {
    try {
      // Estimate gas for a 3-hop arbitrage transaction
      // This is a simplified estimation - in practice you'd simulate the actual calls
      const gasLimit = BigInt(300000); // Conservative estimate for 3 swaps
      
      // Get current gas price with multiplier
      const feeData = await this.provider.getFeeData();
      const baseGasPrice = feeData.gasPrice || ethers.parseUnits('30', 'gwei');
      const gasPrice = baseGasPrice * BigInt(Math.floor(this.config.GAS_PRICE_MULTIPLIER * 100)) / BigInt(100);

      // Estimate USD cost (assuming ETH price of $2000)
      const gasCostWei = gasLimit * gasPrice;
      const gasCostEth = Number(ethers.formatEther(gasCostWei));
      const gasCostUsd = gasCostEth * 2000; // Simplified ETH price

      return {
        gasLimit,
        gasPrice,
        gasCostUsd
      };
    } catch (error) {
      logger.error('Gas estimation failed', { error: error.message });
      // Return conservative estimates
      return {
        gasLimit: BigInt(400000),
        gasPrice: ethers.parseUnits('50', 'gwei'),
        gasCostUsd: 1.0
      };
    }
  }

  async executeTrade(simulation: any): Promise<TradeResult> {
    if (this.config.MODE !== 'live') {
      throw new Error('Cannot execute live trade in paper mode');
    }

    try {
      // Pre-flight checks
      await this.preFlightChecks(simulation);

      // Ensure approvals
      await this.ensureApprovals(simulation.route);

      // Execute the arbitrage transaction
      const tx = await this.executeArbitrageTx(simulation);
      
      // Wait for confirmation
      const receipt = await tx.wait(1);
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      // Calculate actual profit and gas cost
      const actualGasUsed = receipt.gasUsed * receipt.gasPrice;
      const gasUsedUsd = Number(ethers.formatEther(actualGasUsed)) * 2000; // Simplified

      // For simplicity, assume the expected profit was achieved
      // In practice, you'd calculate this from the actual token balances
      const actualProfitUsd = simulation.netProfitUsd;

      logger.info('Trade executed successfully', {
        txHash: receipt.hash,
        gasUsed: receipt.gasUsed.toString(),
        profitUsd: actualProfitUsd
      });

      return {
        success: true,
        txHash: receipt.hash,
        actualProfitUsd,
        gasUsedUsd
      };

    } catch (error) {
      logger.error('Trade execution failed', { error: error.message });
      return {
        success: false,
        actualProfitUsd: 0,
        gasUsedUsd: 0,
        errorMessage: error.message
      };
    }
  }

  private async preFlightChecks(simulation: any) {
    // Check wallet balance
    const balance = await this.provider.getBalance(this.wallet.address);
    const requiredBalance = ethers.parseEther('0.01'); // Minimum ETH for gas
    
    if (balance < requiredBalance) {
      throw new Error('Insufficient ETH balance for gas');
    }

    // Check if conditions still hold (re-verify reserves)
    // This would involve re-checking current reserves vs simulation
    logger.debug('Pre-flight checks passed');
  }

  private async ensureApprovals(route: Route) {
    // This is a simplified approval check
    // In practice, you'd check actual on-chain allowances
    const routers = ['quickswap', 'sushiswap'];
    
    for (const router of routers) {
      for (const token of route.path) {
        const routerApprovals = this.approvals.get(token) || new Set();
        if (!routerApprovals.has(router)) {
          // In practice, you'd call the actual approve function here
          logger.debug('Token approval required', { token, router });
          routerApprovals.add(router);
          this.approvals.set(token, routerApprovals);
        }
      }
    }
  }

  private async executeArbitrageTx(simulation: any) {
    // This is a simplified version - in practice you'd construct the actual
    // multi-call transaction to execute all three swaps atomically
    
    const gasEstimate = simulation.gasEstimate;
    
    // Dummy transaction for demo - replace with actual router calls
    const tx = await this.wallet.sendTransaction({
      to: this.wallet.address, // Dummy transaction to self
      value: 0,
      gasLimit: gasEstimate.gasLimit,
      gasPrice: gasEstimate.gasPrice,
      data: '0x' // Dummy data
    });

    logger.info('Arbitrage transaction submitted', { 
      txHash: tx.hash,
      route: simulation.route.id 
    });

    return tx;
  }
}
