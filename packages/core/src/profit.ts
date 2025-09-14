import type { Params } from '@pkg/shared';

export interface ProfitCalculation {
  grossProfitUsd: number;
  gasCostUsd: number;
  slippageCostUsd: number;
  netProfitUsd: number;
  profitMarginBps: number;
  breakEvenAmountUsd: number;
}

/**
 * Calculate net profit after all costs
 */
export function netProfitUSD(
  grossProfitUsd: number,
  gasCostUsd: number,
  slippageCostUsd: number,
  tradeSizeUsd: number
): ProfitCalculation {
  const netProfitUsd = grossProfitUsd - gasCostUsd - slippageCostUsd;
  const profitMarginBps = tradeSizeUsd > 0 ? (netProfitUsd / tradeSizeUsd) * 10000 : 0;
  const breakEvenAmountUsd = gasCostUsd + slippageCostUsd;

  return {
    grossProfitUsd,
    gasCostUsd,
    slippageCostUsd,
    netProfitUsd,
    profitMarginBps,
    breakEvenAmountUsd
  };
}

/**
 * Check if trade meets minimum profit requirements
 */
export function isProfitable(
  calculation: ProfitCalculation,
  params: Params
): boolean {
  return calculation.netProfitUsd >= params.minProfitUsd;
}

/**
 * Calculate optimal trade size based on profit margins
 */
export function calculateOptimalSize(
  spreadBps: number,
  gasCostUsd: number,
  maxSizeUsd: number,
  minProfitUsd: number
): number {
  if (spreadBps <= 0) return 0;

  // Calculate minimum size needed to cover fixed costs
  const minSizeForBreakeven = (gasCostUsd * 10000) / spreadBps;
  const minSizeForProfit = ((gasCostUsd + minProfitUsd) * 10000) / spreadBps;

  // Return the minimum viable size, capped at max
  const optimalSize = Math.max(minSizeForProfit, minSizeForBreakeven);
  return Math.min(optimalSize, maxSizeUsd);
}

/**
 * Calculate expected profit for a given trade size and spread
 */
export function expectedProfit(
  tradeSizeUsd: number,
  spreadBps: number,
  gasCostUsd: number,
  slippageBps: number
): number {
  const grossProfit = (tradeSizeUsd * spreadBps) / 10000;
  const slippageCost = (tradeSizeUsd * slippageBps) / 10000;
  return grossProfit - gasCostUsd - slippageCost;
}

/**
 * Calculate maximum profitable trade size
 */
export function maxProfitableSize(
  spreadBps: number,
  gasCostUsd: number,
  slippageBps: number,
  maxSizeUsd: number
): number {
  if (spreadBps <= slippageBps) return 0;

  const netSpreadBps = spreadBps - slippageBps;
  const maxProfitableUsd = (gasCostUsd * 10000) / netSpreadBps * 10; // 10x safety margin

  return Math.min(maxProfitableUsd, maxSizeUsd);
}

/**
 * Risk-adjusted position sizing
 */
export function calculatePositionSize(
  availableCapitalUsd: number,
  maxRiskPerTradePercent: number,
  expectedReturnBps: number,
  volatilityBps: number
): number {
  const maxRiskUsd = availableCapitalUsd * (maxRiskPerTradePercent / 100);
  
  // Kelly criterion adjustment
  const winProbability = Math.min(0.8, Math.max(0.1, expectedReturnBps / (expectedReturnBps + volatilityBps)));
  const kellyFraction = (winProbability * expectedReturnBps - (1 - winProbability) * volatilityBps) / expectedReturnBps;
  
  const kellySize = availableCapitalUsd * Math.max(0, Math.min(kellyFraction, 0.25)); // Cap at 25%
  
  return Math.min(maxRiskUsd, kellySize);
}
