import { ethers } from 'ethers';

export interface GasEstimate {
  gasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  estimatedCostWei: bigint;
  estimatedCostUsd: number;
}

/**
 * Estimate gas cost for arbitrage transaction
 */
export async function estimateArbitrageGas(
  provider: ethers.JsonRpcProvider,
  ethPriceUsd: number = 2000,
  multiplier: number = 1.1
): Promise<GasEstimate> {
  try {
    const feeData = await provider.getFeeData();
    
    // Base gas estimate for 3-hop arbitrage (approve + 3 swaps)
    const baseGasLimit = BigInt(350000);
    
    // Apply multiplier for safety
    const gasLimit = BigInt(Math.floor(Number(baseGasLimit) * multiplier));
    
    // Use EIP-1559 if available
    const maxFeePerGas = feeData.maxFeePerGas || ethers.parseUnits('30', 'gwei');
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas || ethers.parseUnits('2', 'gwei');
    
    const estimatedCostWei = gasLimit * maxFeePerGas;
    const estimatedCostEth = Number(ethers.formatEther(estimatedCostWei));
    const estimatedCostUsd = estimatedCostEth * ethPriceUsd;
    
    return {
      gasLimit,
      maxFeePerGas,
      maxPriorityFeePerGas,
      estimatedCostWei,
      estimatedCostUsd
    };
  } catch (error) {
    // Fallback estimates
    return {
      gasLimit: BigInt(400000),
      maxFeePerGas: ethers.parseUnits('50', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
      estimatedCostWei: ethers.parseUnits('0.02', 'ether'),
      estimatedCostUsd: 40 // Conservative estimate
    };
  }
}

/**
 * Get current gas price trends
 */
export async function getGasPriceTrends(
  provider: ethers.JsonRpcProvider
): Promise<{
  current: bigint;
  fast: bigint;
  safe: bigint;
  congestion: 'low' | 'medium' | 'high';
}> {
  try {
    const feeData = await provider.getFeeData();
    const currentGasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    
    // Simple congestion estimation based on gas price
    const gasPriceGwei = Number(ethers.formatUnits(currentGasPrice, 'gwei'));
    let congestion: 'low' | 'medium' | 'high';
    
    if (gasPriceGwei < 20) {
      congestion = 'low';
    } else if (gasPriceGwei < 50) {
      congestion = 'medium';
    } else {
      congestion = 'high';
    }
    
    return {
      current: currentGasPrice,
      fast: currentGasPrice * 130n / 100n, // 30% higher
      safe: currentGasPrice * 110n / 100n, // 10% higher
      congestion
    };
  } catch (error) {
    return {
      current: ethers.parseUnits('25', 'gwei'),
      fast: ethers.parseUnits('35', 'gwei'),
      safe: ethers.parseUnits('30', 'gwei'),
      congestion: 'medium'
    };
  }
}

/**
 * Dynamic gas pricing based on urgency and market conditions
 */
export function calculateDynamicGasPrice(
  baseGasPrice: bigint,
  urgency: 'low' | 'medium' | 'high',
  marketVolatility: number,
  profitMarginBps: number
): bigint {
  let multiplier = 1.0;
  
  // Base urgency multiplier
  switch (urgency) {
    case 'low':
      multiplier = 1.05;
      break;
    case 'medium':
      multiplier = 1.15;
      break;
    case 'high':
      multiplier = 1.3;
      break;
  }
  
  // Adjust for market volatility (higher volatility = faster execution needed)
  multiplier += marketVolatility * 0.1;
  
  // Adjust for profit margin (higher profit = can afford higher gas)
  if (profitMarginBps > 500) { // > 5% profit margin
    multiplier += 0.1;
  }
  
  // Cap the multiplier to prevent excessive gas prices
  multiplier = Math.min(multiplier, 2.0);
  
  return BigInt(Math.floor(Number(baseGasPrice) * multiplier));
}

/**
 * Check if gas cost is acceptable for the trade
 */
export function isGasCostAcceptable(
  gasCostUsd: number,
  expectedProfitUsd: number,
  maxGasRatio: number = 0.3 // Max 30% of profit can go to gas
): boolean {
  if (expectedProfitUsd <= 0) return false;
  return (gasCostUsd / expectedProfitUsd) <= maxGasRatio;
}
