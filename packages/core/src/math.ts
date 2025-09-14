import { ethers } from 'ethers';

/**
 * Calculate mid-price from reserves
 */
export function calculateMidPrice(reserve0: bigint, reserve1: bigint): number {
  if (reserve0 === 0n || reserve1 === 0n) return 0;
  return Number(reserve1) / Number(reserve0);
}

/**
 * Calculate price from reserves with decimals handling
 */
export function priceFromReserves(
  reserve0: bigint, 
  reserve1: bigint, 
  decimals0: number = 18, 
  decimals1: number = 18
): number {
  if (reserve0 === 0n || reserve1 === 0n) return 0;
  
  const adjusted0 = Number(ethers.formatUnits(reserve0, decimals0));
  const adjusted1 = Number(ethers.formatUnits(reserve1, decimals1));
  
  return adjusted1 / adjusted0;
}

/**
 * Calculate spread in basis points between DEX prices
 */
export function calculateSpreadBps(priceA: number, priceB: number, priceC?: number): number {
  if (priceC !== undefined) {
    // Triangular arbitrage: A->B->C->A
    const composite = priceA * priceB * priceC;
    return Math.abs(1 - composite) * 10000;
  } else {
    // Simple arbitrage: price difference between DEXes
    const diff = Math.abs(priceA - priceB);
    const avg = (priceA + priceB) / 2;
    return (diff / avg) * 10000;
  }
}

/**
 * Calculate slippage impact for a trade
 */
export function calculateSlippage(amountUsd: number, slippageBps: number): number {
  return (amountUsd * slippageBps) / 10000;
}

/**
 * UniswapV2 formula: getAmountOut
 */
export function getAmountOut(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number = 30 // 0.3% fee
): bigint {
  if (amountIn === 0n || reserveIn === 0n || reserveOut === 0n) {
    return 0n;
  }

  const feeFactor = 10000 - feeBps;
  const amountInWithFee = amountIn * BigInt(feeFactor);
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 10000n + amountInWithFee;
  
  return numerator / denominator;
}

/**
 * UniswapV2 formula: getAmountIn
 */
export function getAmountIn(
  amountOut: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  feeBps: number = 30
): bigint {
  if (amountOut === 0n || reserveIn === 0n || reserveOut === 0n) {
    return 0n;
  }

  if (amountOut >= reserveOut) {
    throw new Error('Insufficient liquidity');
  }

  const feeFactor = 10000 - feeBps;
  const numerator = reserveIn * amountOut * 10000n;
  const denominator = (reserveOut - amountOut) * BigInt(feeFactor);
  
  return numerator / denominator + 1n; // Add 1 for rounding
}

/**
 * Calculate optimal arbitrage amount using binary search
 */
export function findOptimalAmount(
  reservesA: { reserve0: bigint; reserve1: bigint },
  reservesB: { reserve0: bigint; reserve1: bigint },
  maxAmount: bigint,
  iterations: number = 10
): bigint {
  let low = 0n;
  let high = maxAmount;
  let bestAmount = 0n;
  let bestProfit = 0n;

  for (let i = 0; i < iterations; i++) {
    const mid = (low + high) / 2n;
    
    // Calculate profit for this amount
    const out1 = getAmountOut(mid, reservesA.reserve0, reservesA.reserve1);
    const out2 = getAmountOut(out1, reservesB.reserve1, reservesB.reserve0);
    const profit = out2 > mid ? out2 - mid : 0n;
    
    if (profit > bestProfit) {
      bestProfit = profit;
      bestAmount = mid;
    }
    
    // Binary search logic
    if (profit > 0n) {
      low = mid;
    } else {
      high = mid;
    }
  }
  
  return bestAmount;
}

/**
 * Calculate price impact for a trade
 */
export function calculatePriceImpact(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint
): number {
  const priceBefore = Number(reserveOut) / Number(reserveIn);
  const amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
  const newReserveIn = reserveIn + amountIn;
  const newReserveOut = reserveOut - amountOut;
  const priceAfter = Number(newReserveOut) / Number(newReserveIn);
  
  return ((priceAfter - priceBefore) / priceBefore) * 100;
}
