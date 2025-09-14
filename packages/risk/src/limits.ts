import type { RiskLimits } from './controls.js';

/**
 * Risk limit presets for different trading strategies
 */
export const RISK_PRESETS: Record<string, RiskLimits> = {
  conservative: {
    maxDailyLossUsd: 25,
    maxNotionalUsd: 100,
    maxTradesPerHour: 20,
    maxConsecutiveLosses: 3,
    cooldownAfterLossMs: 300000, // 5 minutes
    minTimeBetweenTradesMs: 30000 // 30 seconds
  },
  
  moderate: {
    maxDailyLossUsd: 50,
    maxNotionalUsd: 200,
    maxTradesPerHour: 50,
    maxConsecutiveLosses: 5,
    cooldownAfterLossMs: 60000, // 1 minute
    minTimeBetweenTradesMs: 10000 // 10 seconds
  },
  
  aggressive: {
    maxDailyLossUsd: 100,
    maxNotionalUsd: 500,
    maxTradesPerHour: 100,
    maxConsecutiveLosses: 7,
    cooldownAfterLossMs: 30000, // 30 seconds
    minTimeBetweenTradesMs: 5000 // 5 seconds
  }
};

/**
 * Dynamic risk adjustment based on market conditions
 */
export function adjustLimitsForVolatility(
  baseLimits: RiskLimits,
  volatilityScore: number // 0-1, where 1 is highest volatility
): RiskLimits {
  const volatilityMultiplier = 1 - (volatilityScore * 0.5); // Reduce limits by up to 50% in high vol
  
  return {
    maxDailyLossUsd: baseLimits.maxDailyLossUsd * volatilityMultiplier,
    maxNotionalUsd: baseLimits.maxNotionalUsd * volatilityMultiplier,
    maxTradesPerHour: Math.floor(baseLimits.maxTradesPerHour * volatilityMultiplier),
    maxConsecutiveLosses: Math.max(2, Math.floor(baseLimits.maxConsecutiveLosses * volatilityMultiplier)),
    cooldownAfterLossMs: baseLimits.cooldownAfterLossMs * (1 + volatilityScore), // Longer cooldown in high vol
    minTimeBetweenTradesMs: baseLimits.minTimeBetweenTradesMs * (1 + volatilityScore * 2)
  };
}

/**
 * Risk adjustment based on recent performance
 */
export function adjustLimitsForPerformance(
  baseLimits: RiskLimits,
  recentWinRate: number, // 0-1
  recentPnl: number
): RiskLimits {
  // If performing poorly, reduce limits
  const performanceMultiplier = Math.max(0.5, Math.min(1.5, recentWinRate * 2));
  const pnlAdjustment = recentPnl > 0 ? 1.1 : 0.9;
  
  const finalMultiplier = performanceMultiplier * pnlAdjustment;
  
  return {
    maxDailyLossUsd: baseLimits.maxDailyLossUsd * finalMultiplier,
    maxNotionalUsd: baseLimits.maxNotionalUsd * finalMultiplier,
    maxTradesPerHour: Math.floor(baseLimits.maxTradesPerHour * finalMultiplier),
    maxConsecutiveLosses: baseLimits.maxConsecutiveLosses,
    cooldownAfterLossMs: baseLimits.cooldownAfterLossMs / finalMultiplier,
    minTimeBetweenTradesMs: baseLimits.minTimeBetweenTradesMs / finalMultiplier
  };
}

/**
 * Time-based risk adjustments
 */
export function adjustLimitsForTimeOfDay(
  baseLimits: RiskLimits,
  hour: number // 0-23
): RiskLimits {
  // Reduce limits during low-liquidity hours (e.g., weekends, late night)
  let timeMultiplier = 1.0;
  
  if (hour >= 22 || hour <= 6) {
    // Night hours - reduce activity
    timeMultiplier = 0.7;
  } else if (hour >= 14 && hour <= 18) {
    // Peak trading hours - allow higher limits
    timeMultiplier = 1.2;
  }
  
  return {
    maxDailyLossUsd: baseLimits.maxDailyLossUsd,
    maxNotionalUsd: baseLimits.maxNotionalUsd * timeMultiplier,
    maxTradesPerHour: Math.floor(baseLimits.maxTradesPerHour * timeMultiplier),
    maxConsecutiveLosses: baseLimits.maxConsecutiveLosses,
    cooldownAfterLossMs: baseLimits.cooldownAfterLossMs / timeMultiplier,
    minTimeBetweenTradesMs: baseLimits.minTimeBetweenTradesMs
  };
}

/**
 * Position sizing based on Kelly Criterion
 */
export function calculateKellyPositionSize(
  totalCapital: number,
  winProbability: number,
  avgWinAmount: number,
  avgLossAmount: number
): number {
  if (avgLossAmount === 0 || winProbability === 0) return 0;
  
  const kellyFraction = (winProbability * avgWinAmount - (1 - winProbability) * avgLossAmount) / avgLossAmount;
  
  // Apply conservative cap (max 10% of capital per trade)
  const cappedFraction = Math.max(0, Math.min(0.1, kellyFraction));
  
  return totalCapital * cappedFraction;
}

/**
 * Portfolio heat calculation (total risk across all positions)
 */
export function calculatePortfolioHeat(
  positions: Array<{ size: number; risk: number }>,
  totalCapital: number
): number {
  const totalRisk = positions.reduce((sum, pos) => sum + pos.size * pos.risk, 0);
  return totalRisk / totalCapital;
}

/**
 * Maximum adverse excursion (MAE) tracking
 */
export interface MAETracker {
  maxDrawdown: number;
  maxDrawdownDate: Date;
  currentDrawdown: number;
  peakValue: number;
}

export function updateMAE(
  tracker: MAETracker,
  currentValue: number
): MAETracker {
  // Update peak
  if (currentValue > tracker.peakValue) {
    tracker.peakValue = currentValue;
    tracker.currentDrawdown = 0;
  } else {
    tracker.currentDrawdown = (tracker.peakValue - currentValue) / tracker.peakValue;
    
    // Update max drawdown
    if (tracker.currentDrawdown > tracker.maxDrawdown) {
      tracker.maxDrawdown = tracker.currentDrawdown;
      tracker.maxDrawdownDate = new Date();
    }
  }
  
  return tracker;
}

/**
 * Risk-adjusted return metrics
 */
export function calculateSharpeRatio(
  returns: number[],
  riskFreeRate: number = 0.02 // 2% annual risk-free rate
): number {
  if (returns.length < 2) return 0;
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  
  if (stdDev === 0) return 0;
  
  return (avgReturn - riskFreeRate) / stdDev;
}

export function calculateSortinoRatio(
  returns: number[],
  riskFreeRate: number = 0.02
): number {
  if (returns.length < 2) return 0;
  
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const downside = returns.filter(r => r < 0);
  
  if (downside.length === 0) return Infinity;
  
  const downsideVariance = downside.reduce((sum, r) => sum + r * r, 0) / downside.length;
  const downsideStdDev = Math.sqrt(downsideVariance);
  
  return (avgReturn - riskFreeRate) / downsideStdDev;
}

/**
 * Value at Risk (VaR) calculation
 */
export function calculateVaR(
  returns: number[],
  confidenceLevel: number = 0.95
): number {
  if (returns.length === 0) return 0;
  
  const sortedReturns = [...returns].sort((a, b) => a - b);
  const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
  
  return sortedReturns[index] || 0;
}
