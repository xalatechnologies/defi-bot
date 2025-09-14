import {
  RISK_PRESETS,
  adjustLimitsForVolatility,
  adjustLimitsForPerformance,
  adjustLimitsForTimeOfDay,
  calculateKellyPositionSize,
  calculatePortfolioHeat,
  updateMAE,
  calculateSharpeRatio,
  calculateSortinoRatio,
  calculateVaR,
  type MAETracker
} from './limits';
import type { RiskLimits } from './controls';

describe('Risk Presets', () => {
  describe('RISK_PRESETS Configuration', () => {
    it('should have all required preset categories', () => {
      expect(RISK_PRESETS).toHaveProperty('conservative');
      expect(RISK_PRESETS).toHaveProperty('moderate');
      expect(RISK_PRESETS).toHaveProperty('aggressive');
    });

    it('should have conservative preset with restrictive limits', () => {
      const conservative = RISK_PRESETS.conservative;
      
      expect(conservative.maxDailyLossUsd).toBe(25);
      expect(conservative.maxNotionalUsd).toBe(100);
      expect(conservative.maxTradesPerHour).toBe(20);
      expect(conservative.maxConsecutiveLosses).toBe(3);
      expect(conservative.cooldownAfterLossMs).toBe(300000); // 5 minutes
      expect(conservative.minTimeBetweenTradesMs).toBe(30000); // 30 seconds
    });

    it('should have moderate preset with balanced limits', () => {
      const moderate = RISK_PRESETS.moderate;
      
      expect(moderate.maxDailyLossUsd).toBe(50);
      expect(moderate.maxNotionalUsd).toBe(200);
      expect(moderate.maxTradesPerHour).toBe(50);
      expect(moderate.maxConsecutiveLosses).toBe(5);
      expect(moderate.cooldownAfterLossMs).toBe(60000); // 1 minute
      expect(moderate.minTimeBetweenTradesMs).toBe(10000); // 10 seconds
    });

    it('should have aggressive preset with permissive limits', () => {
      const aggressive = RISK_PRESETS.aggressive;
      
      expect(aggressive.maxDailyLossUsd).toBe(100);
      expect(aggressive.maxNotionalUsd).toBe(500);
      expect(aggressive.maxTradesPerHour).toBe(100);
      expect(aggressive.maxConsecutiveLosses).toBe(7);
      expect(aggressive.cooldownAfterLossMs).toBe(30000); // 30 seconds
      expect(aggressive.minTimeBetweenTradesMs).toBe(5000); // 5 seconds
    });

    it('should have progressively less restrictive limits across presets', () => {
      const { conservative, moderate, aggressive } = RISK_PRESETS;
      
      // Daily loss limits should increase
      expect(conservative.maxDailyLossUsd).toBeLessThan(moderate.maxDailyLossUsd);
      expect(moderate.maxDailyLossUsd).toBeLessThan(aggressive.maxDailyLossUsd);
      
      // Notional limits should increase
      expect(conservative.maxNotionalUsd).toBeLessThan(moderate.maxNotionalUsd);
      expect(moderate.maxNotionalUsd).toBeLessThan(aggressive.maxNotionalUsd);
      
      // Trade frequency should increase
      expect(conservative.maxTradesPerHour).toBeLessThan(moderate.maxTradesPerHour);
      expect(moderate.maxTradesPerHour).toBeLessThan(aggressive.maxTradesPerHour);
      
      // Consecutive losses tolerance should increase
      expect(conservative.maxConsecutiveLosses).toBeLessThan(moderate.maxConsecutiveLosses);
      expect(moderate.maxConsecutiveLosses).toBeLessThan(aggressive.maxConsecutiveLosses);
      
      // Cooldown periods should decrease
      expect(conservative.cooldownAfterLossMs).toBeGreaterThan(moderate.cooldownAfterLossMs);
      expect(moderate.cooldownAfterLossMs).toBeGreaterThan(aggressive.cooldownAfterLossMs);
      
      // Min time between trades should decrease
      expect(conservative.minTimeBetweenTradesMs).toBeGreaterThan(moderate.minTimeBetweenTradesMs);
      expect(moderate.minTimeBetweenTradesMs).toBeGreaterThan(aggressive.minTimeBetweenTradesMs);
    });

    it('should have valid limit values', () => {
      Object.values(RISK_PRESETS).forEach(preset => {
        expect(preset.maxDailyLossUsd).toBeGreaterThan(0);
        expect(preset.maxNotionalUsd).toBeGreaterThan(0);
        expect(preset.maxTradesPerHour).toBeGreaterThan(0);
        expect(preset.maxConsecutiveLosses).toBeGreaterThan(0);
        expect(preset.cooldownAfterLossMs).toBeGreaterThanOrEqual(0);
        expect(preset.minTimeBetweenTradesMs).toBeGreaterThanOrEqual(0);
      });
    });
  });
});

describe('Dynamic Risk Adjustments', () => {
  const baseLimits: RiskLimits = RISK_PRESETS.moderate;

  describe('Volatility-based Adjustments', () => {
    it('should reduce limits during high volatility', () => {
      const highVolatility = 0.8; // 80% volatility
      const adjustedLimits = adjustLimitsForVolatility(baseLimits, highVolatility);
      
      expect(adjustedLimits.maxDailyLossUsd).toBeLessThan(baseLimits.maxDailyLossUsd);
      expect(adjustedLimits.maxNotionalUsd).toBeLessThan(baseLimits.maxNotionalUsd);
      expect(adjustedLimits.maxTradesPerHour).toBeLessThan(baseLimits.maxTradesPerHour);
      expect(adjustedLimits.maxConsecutiveLosses).toBeLessThan(baseLimits.maxConsecutiveLosses);
      expect(adjustedLimits.cooldownAfterLossMs).toBeGreaterThan(baseLimits.cooldownAfterLossMs);
      expect(adjustedLimits.minTimeBetweenTradesMs).toBeGreaterThan(baseLimits.minTimeBetweenTradesMs);
    });

    it('should maintain limits during low volatility', () => {
      const lowVolatility = 0.1; // 10% volatility
      const adjustedLimits = adjustLimitsForVolatility(baseLimits, lowVolatility);
      
      expect(adjustedLimits.maxDailyLossUsd).toBeCloseTo(baseLimits.maxDailyLossUsd * 0.95, 1);
      expect(adjustedLimits.maxNotionalUsd).toBeCloseTo(baseLimits.maxNotionalUsd * 0.95, 1);
      expect(adjustedLimits.cooldownAfterLossMs).toBeGreaterThan(baseLimits.cooldownAfterLossMs);
    });

    it('should handle zero volatility', () => {
      const zeroVolatility = 0;
      const adjustedLimits = adjustLimitsForVolatility(baseLimits, zeroVolatility);
      
      expect(adjustedLimits.maxDailyLossUsd).toBe(baseLimits.maxDailyLossUsd);
      expect(adjustedLimits.maxNotionalUsd).toBe(baseLimits.maxNotionalUsd);
      expect(adjustedLimits.maxTradesPerHour).toBe(baseLimits.maxTradesPerHour);
    });

    it('should handle maximum volatility', () => {
      const maxVolatility = 1; // 100% volatility
      const adjustedLimits = adjustLimitsForVolatility(baseLimits, maxVolatility);
      
      expect(adjustedLimits.maxDailyLossUsd).toBe(baseLimits.maxDailyLossUsd * 0.5);
      expect(adjustedLimits.maxNotionalUsd).toBe(baseLimits.maxNotionalUsd * 0.5);
      expect(adjustedLimits.maxTradesPerHour).toBe(Math.floor(baseLimits.maxTradesPerHour * 0.5));
      expect(adjustedLimits.cooldownAfterLossMs).toBe(baseLimits.cooldownAfterLossMs * 2);
      expect(adjustedLimits.minTimeBetweenTradesMs).toBe(baseLimits.minTimeBetweenTradesMs * 3);
    });

    it('should maintain minimum consecutive losses', () => {
      const maxVolatility = 1;
      const adjustedLimits = adjustLimitsForVolatility(baseLimits, maxVolatility);
      
      expect(adjustedLimits.maxConsecutiveLosses).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Performance-based Adjustments', () => {
    it('should increase limits for good performance', () => {
      const highWinRate = 0.8; // 80% win rate
      const positivePnl = 100;
      
      const adjustedLimits = adjustLimitsForPerformance(baseLimits, highWinRate, positivePnl);
      
      expect(adjustedLimits.maxDailyLossUsd).toBeGreaterThan(baseLimits.maxDailyLossUsd);
      expect(adjustedLimits.maxNotionalUsd).toBeGreaterThan(baseLimits.maxNotionalUsd);
      expect(adjustedLimits.maxTradesPerHour).toBeGreaterThan(baseLimits.maxTradesPerHour);
      expect(adjustedLimits.cooldownAfterLossMs).toBeLessThan(baseLimits.cooldownAfterLossMs);
      expect(adjustedLimits.minTimeBetweenTradesMs).toBeLessThan(baseLimits.minTimeBetweenTradesMs);
    });

    it('should reduce limits for poor performance', () => {
      const lowWinRate = 0.3; // 30% win rate
      const negativePnl = -50;
      
      const adjustedLimits = adjustLimitsForPerformance(baseLimits, lowWinRate, negativePnl);
      
      expect(adjustedLimits.maxDailyLossUsd).toBeLessThan(baseLimits.maxDailyLossUsd);
      expect(adjustedLimits.maxNotionalUsd).toBeLessThan(baseLimits.maxNotionalUsd);
      expect(adjustedLimits.maxTradesPerHour).toBeLessThan(baseLimits.maxTradesPerHour);
      expect(adjustedLimits.cooldownAfterLossMs).toBeGreaterThan(baseLimits.cooldownAfterLossMs);
      expect(adjustedLimits.minTimeBetweenTradesMs).toBeGreaterThan(baseLimits.minTimeBetweenTradesMs);
    });

    it('should maintain consecutive loss limits unchanged', () => {
      const adjustedLimits = adjustLimitsForPerformance(baseLimits, 0.8, 100);
      expect(adjustedLimits.maxConsecutiveLosses).toBe(baseLimits.maxConsecutiveLosses);
    });

    it('should handle extreme win rates', () => {
      const perfectWinRate = 1.0;
      const zeroWinRate = 0.0;
      
      const perfectAdjusted = adjustLimitsForPerformance(baseLimits, perfectWinRate, 100);
      const zeroAdjusted = adjustLimitsForPerformance(baseLimits, zeroWinRate, -100);
      
      expect(perfectAdjusted.maxDailyLossUsd).toBeGreaterThan(baseLimits.maxDailyLossUsd);
      expect(zeroAdjusted.maxDailyLossUsd).toBeLessThan(baseLimits.maxDailyLossUsd);
    });

    it('should cap performance multiplier appropriately', () => {
      const highWinRate = 0.9;
      const hugePnl = 1000000;
      
      const adjustedLimits = adjustLimitsForPerformance(baseLimits, highWinRate, hugePnl);
      
      // Should not multiply limits too aggressively
      expect(adjustedLimits.maxDailyLossUsd).toBeLessThan(baseLimits.maxDailyLossUsd * 2);
    });
  });

  describe('Time-based Adjustments', () => {
    it('should reduce limits during night hours', () => {
      const nightHour = 2; // 2 AM
      const adjustedLimits = adjustLimitsForTimeOfDay(baseLimits, nightHour);
      
      expect(adjustedLimits.maxNotionalUsd).toBeLessThan(baseLimits.maxNotionalUsd);
      expect(adjustedLimits.maxTradesPerHour).toBeLessThan(baseLimits.maxTradesPerHour);
      expect(adjustedLimits.cooldownAfterLossMs).toBeGreaterThan(baseLimits.cooldownAfterLossMs);
    });

    it('should maintain limits during peak hours', () => {
      const peakHour = 16; // 4 PM
      const adjustedLimits = adjustLimitsForTimeOfDay(baseLimits, peakHour);
      
      expect(adjustedLimits.maxNotionalUsd).toBeGreaterThan(baseLimits.maxNotionalUsd);
      expect(adjustedLimits.maxTradesPerHour).toBeGreaterThan(baseLimits.maxTradesPerHour);
      expect(adjustedLimits.cooldownAfterLossMs).toBeLessThan(baseLimits.cooldownAfterLossMs);
    });

    it('should handle all 24 hours appropriately', () => {
      for (let hour = 0; hour < 24; hour++) {
        const adjustedLimits = adjustLimitsForTimeOfDay(baseLimits, hour);
        
        expect(adjustedLimits.maxDailyLossUsd).toBe(baseLimits.maxDailyLossUsd);
        expect(adjustedLimits.maxConsecutiveLosses).toBe(baseLimits.maxConsecutiveLosses);
        expect(adjustedLimits.minTimeBetweenTradesMs).toBe(baseLimits.minTimeBetweenTradesMs);
        expect(adjustedLimits.maxNotionalUsd).toBeGreaterThan(0);
        expect(adjustedLimits.maxTradesPerHour).toBeGreaterThan(0);
      }
    });

    it('should apply correct multipliers for different time periods', () => {
      const nightAdjusted = adjustLimitsForTimeOfDay(baseLimits, 23); // 11 PM
      const peakAdjusted = adjustLimitsForTimeOfDay(baseLimits, 15); // 3 PM
      const normalAdjusted = adjustLimitsForTimeOfDay(baseLimits, 10); // 10 AM
      
      expect(nightAdjusted.maxNotionalUsd).toBeLessThan(normalAdjusted.maxNotionalUsd);
      expect(peakAdjusted.maxNotionalUsd).toBeGreaterThan(normalAdjusted.maxNotionalUsd);
    });
  });
});

describe('Position Sizing Calculations', () => {
  describe('Kelly Criterion Position Size', () => {
    it('should calculate positive position size for profitable strategy', () => {
      const totalCapital = 10000;
      const winProbability = 0.6; // 60% win rate
      const avgWinAmount = 100;
      const avgLossAmount = 50;
      
      const positionSize = calculateKellyPositionSize(totalCapital, winProbability, avgWinAmount, avgLossAmount);
      
      expect(positionSize).toBeGreaterThan(0);
      expect(positionSize).toBeLessThanOrEqual(totalCapital * 0.1); // Capped at 10%
    });

    it('should return zero for unprofitable strategy', () => {
      const totalCapital = 10000;
      const winProbability = 0.4; // 40% win rate
      const avgWinAmount = 50;
      const avgLossAmount = 100; // Higher than win amount
      
      const positionSize = calculateKellyPositionSize(totalCapital, winProbability, avgWinAmount, avgLossAmount);
      
      expect(positionSize).toBe(0);
    });

    it('should handle edge cases safely', () => {
      const totalCapital = 10000;
      
      expect(calculateKellyPositionSize(totalCapital, 0, 100, 50)).toBe(0);
      expect(calculateKellyPositionSize(totalCapital, 0.5, 100, 0)).toBe(0);
      expect(calculateKellyPositionSize(0, 0.6, 100, 50)).toBe(0);
    });

    it('should cap position size at 10% of capital', () => {
      const totalCapital = 10000;
      const winProbability = 0.9; // Very high win rate
      const avgWinAmount = 1000;
      const avgLossAmount = 10;
      
      const positionSize = calculateKellyPositionSize(totalCapital, winProbability, avgWinAmount, avgLossAmount);
      
      expect(positionSize).toBe(totalCapital * 0.1); // Should be capped at 10%
    });

    it('should calculate appropriate sizing for various scenarios', () => {
      const totalCapital = 10000;
      
      const conservative = calculateKellyPositionSize(totalCapital, 0.55, 50, 45);
      const moderate = calculateKellyPositionSize(totalCapital, 0.65, 100, 60);
      const aggressive = calculateKellyPositionSize(totalCapital, 0.75, 150, 50);
      
      expect(aggressive).toBeGreaterThanOrEqual(moderate);
      expect(moderate).toBeGreaterThanOrEqual(conservative);
    });
  });

  describe('Portfolio Heat Calculation', () => {
    it('should calculate portfolio heat correctly', () => {
      const positions = [
        { size: 1000, risk: 0.05 }, // $50 risk
        { size: 2000, risk: 0.03 }, // $60 risk
        { size: 500, risk: 0.02 },  // $10 risk
      ];
      const totalCapital = 10000;
      
      const heat = calculatePortfolioHeat(positions, totalCapital);
      
      expect(heat).toBeCloseTo(0.012, 3); // (50 + 60 + 10) / 10000 = 0.012
    });

    it('should handle empty positions', () => {
      const heat = calculatePortfolioHeat([], 10000);
      expect(heat).toBe(0);
    });

    it('should handle zero capital gracefully', () => {
      const positions = [{ size: 1000, risk: 0.05 }];
      const heat = calculatePortfolioHeat(positions, 0);
      expect(heat).toBe(Infinity);
    });

    it('should calculate heat for single position', () => {
      const positions = [{ size: 5000, risk: 0.02 }];
      const totalCapital = 10000;
      
      const heat = calculatePortfolioHeat(positions, totalCapital);
      expect(heat).toBe(0.01); // 5000 * 0.02 / 10000 = 0.01
    });

    it('should aggregate risks correctly for multiple positions', () => {
      const highRiskPositions = [
        { size: 2000, risk: 0.1 },
        { size: 3000, risk: 0.08 },
        { size: 1000, risk: 0.15 },
      ];
      const totalCapital = 10000;
      
      const heat = calculatePortfolioHeat(highRiskPositions, totalCapital);
      expect(heat).toBeCloseTo(0.059, 3); // (200 + 240 + 150) / 10000
    });
  });
});

describe('Maximum Adverse Excursion (MAE) Tracking', () => {
  describe('MAE Tracker Updates', () => {
    it('should update peak value for new highs', () => {
      const tracker: MAETracker = {
        maxDrawdown: 0,
        maxDrawdownDate: new Date(),
        currentDrawdown: 0,
        peakValue: 1000
      };
      
      const updated = updateMAE(tracker, 1200); // New high
      
      expect(updated.peakValue).toBe(1200);
      expect(updated.currentDrawdown).toBe(0);
    });

    it('should calculate current drawdown correctly', () => {
      const tracker: MAETracker = {
        maxDrawdown: 0,
        maxDrawdownDate: new Date(),
        currentDrawdown: 0,
        peakValue: 1000
      };
      
      const updated = updateMAE(tracker, 800); // 20% drawdown
      
      expect(updated.currentDrawdown).toBeCloseTo(0.2, 3);
      expect(updated.peakValue).toBe(1000); // Peak unchanged
    });

    it('should update maximum drawdown when exceeded', () => {
      const tracker: MAETracker = {
        maxDrawdown: 0.1, // Previous max 10%
        maxDrawdownDate: new Date('2024-01-01'),
        currentDrawdown: 0,
        peakValue: 1000
      };
      
      const updated = updateMAE(tracker, 700); // 30% drawdown
      
      expect(updated.maxDrawdown).toBeCloseTo(0.3, 3);
      expect(updated.maxDrawdownDate.getTime()).toBeGreaterThanOrEqual(tracker.maxDrawdownDate.getTime());
    });

    it('should not update max drawdown for smaller drawdowns', () => {
      const originalDate = new Date('2024-01-01');
      const tracker: MAETracker = {
        maxDrawdown: 0.2, // Previous max 20%
        maxDrawdownDate: originalDate,
        currentDrawdown: 0,
        peakValue: 1000
      };
      
      const updated = updateMAE(tracker, 900); // 10% drawdown (smaller)
      
      expect(updated.maxDrawdown).toBe(0.2); // Unchanged
      expect(updated.maxDrawdownDate).toBe(originalDate); // Unchanged
    });

    it('should reset current drawdown after new peak', () => {
      const tracker: MAETracker = {
        maxDrawdown: 0.15,
        maxDrawdownDate: new Date(),
        currentDrawdown: 0.1, // Currently in drawdown
        peakValue: 1000
      };
      
      const updated = updateMAE(tracker, 1100); // New peak
      
      expect(updated.peakValue).toBe(1100);
      expect(updated.currentDrawdown).toBe(0);
      expect(updated.maxDrawdown).toBe(0.15); // Historical max preserved
    });

    it('should handle edge cases gracefully', () => {
      const tracker: MAETracker = {
        maxDrawdown: 0,
        maxDrawdownDate: new Date(),
        currentDrawdown: 0,
        peakValue: 0
      };
      
      // Starting from zero
      const updated = updateMAE(tracker, 100);
      expect(updated.peakValue).toBe(100);
      expect(updated.currentDrawdown).toBe(0);
    });
  });
});

describe('Risk-Adjusted Return Metrics', () => {
  describe('Sharpe Ratio Calculation', () => {
    it('should calculate Sharpe ratio for positive returns', () => {
      const returns = [0.1, 0.05, 0.08, 0.12, 0.06]; // 10%, 5%, etc.
      const riskFreeRate = 0.02; // 2%
      
      const sharpe = calculateSharpeRatio(returns, riskFreeRate);
      
      expect(sharpe).toBeGreaterThan(0);
      expect(typeof sharpe).toBe('number');
      expect(isFinite(sharpe)).toBe(true);
    });

    it('should return zero for insufficient data', () => {
      expect(calculateSharpeRatio([], 0.02)).toBe(0);
      expect(calculateSharpeRatio([0.1], 0.02)).toBe(0);
    });

    it('should handle zero standard deviation', () => {
      const constantReturns = [0.05, 0.05, 0.05, 0.05]; // No variance
      const sharpe = calculateSharpeRatio(constantReturns, 0.02);
      
      expect(sharpe).toBe(0);
    });

    it('should calculate negative Sharpe for poor performance', () => {
      const poorReturns = [-0.05, -0.03, -0.08, -0.02]; // Negative returns
      const sharpe = calculateSharpeRatio(poorReturns, 0.02);
      
      expect(sharpe).toBeLessThan(0);
    });

    it('should use default risk-free rate when not provided', () => {
      const returns = [0.1, 0.05, 0.08];
      const sharpeDefault = calculateSharpeRatio(returns);
      const sharpeExplicit = calculateSharpeRatio(returns, 0.02);
      
      expect(sharpeDefault).toBe(sharpeExplicit);
    });

    it('should be sensitive to volatility', () => {
      const lowVolReturns = [0.06, 0.064, 0.056, 0.063, 0.057]; // Low volatility
      const highVolReturns = [0.15, 0.01, 0.12, -0.02, 0.08]; // High volatility
      
      const lowVolSharpe = calculateSharpeRatio(lowVolReturns, 0.02);
      const highVolSharpe = calculateSharpeRatio(highVolReturns, 0.02);
      
      expect(lowVolSharpe).toBeGreaterThan(highVolSharpe); // Same avg, lower vol = higher Sharpe
    });
  });

  describe('Sortino Ratio Calculation', () => {
    it('should calculate Sortino ratio focusing on downside risk', () => {
      const returns = [0.1, -0.02, 0.08, -0.01, 0.06];
      const riskFreeRate = 0.02;
      
      const sortino = calculateSortinoRatio(returns, riskFreeRate);
      
      expect(sortino).toBeGreaterThan(0);
      expect(typeof sortino).toBe('number');
      expect(isFinite(sortino)).toBe(true);
    });

    it('should return zero for insufficient data', () => {
      expect(calculateSortinoRatio([], 0.02)).toBe(0);
      expect(calculateSortinoRatio([0.1], 0.02)).toBe(0);
    });

    it('should return Infinity for all positive returns', () => {
      const positiveReturns = [0.05, 0.08, 0.12, 0.06]; // No negative returns
      const sortino = calculateSortinoRatio(positiveReturns, 0.02);
      
      expect(sortino).toBe(Infinity);
    });

    it('should handle negative average returns', () => {
      const negativeReturns = [-0.05, -0.08, -0.02, -0.06];
      const sortino = calculateSortinoRatio(negativeReturns, 0.02);
      
      expect(sortino).toBeLessThan(0);
    });

    it('should be higher than Sharpe for same returns (ignores upside volatility)', () => {
      const mixedReturns = [0.15, -0.05, 0.10, -0.02, 0.08, -0.01];
      const riskFreeRate = 0.02;
      
      const sharpe = calculateSharpeRatio(mixedReturns, riskFreeRate);
      const sortino = calculateSortinoRatio(mixedReturns, riskFreeRate);
      
      expect(sortino).toBeGreaterThan(sharpe);
    });

    it('should use default risk-free rate when not provided', () => {
      const returns = [0.1, -0.02, 0.08];
      const sortinoDefault = calculateSortinoRatio(returns);
      const sortinoExplicit = calculateSortinoRatio(returns, 0.02);
      
      expect(sortinoDefault).toBe(sortinoExplicit);
    });
  });

  describe('Value at Risk (VaR) Calculation', () => {
    it('should calculate VaR at 95% confidence level', () => {
      const returns = [-0.10, -0.05, 0.02, 0.08, 0.15, -0.02, 0.06, -0.01, 0.04, 0.12];
      const var95 = calculateVaR(returns, 0.95);
      
      expect(var95).toBeLessThan(0); // VaR should be negative (loss)
      expect(typeof var95).toBe('number');
    });

    it('should return zero for empty returns', () => {
      const var95 = calculateVaR([], 0.95);
      expect(var95).toBe(0);
    });

    it('should handle different confidence levels', () => {
      const returns = Array.from({ length: 100 }, (_, i) => (Math.random() - 0.5) * 0.2); // Random returns
      
      const var90 = calculateVaR(returns, 0.90);
      const var95 = calculateVaR(returns, 0.95);
      const var99 = calculateVaR(returns, 0.99);
      
      // Higher confidence should give more extreme (negative) VaR
      expect(var99).toBeLessThanOrEqual(var95);
      expect(var95).toBeLessThanOrEqual(var90);
    });

    it('should handle all positive returns', () => {
      const positiveReturns = [0.01, 0.02, 0.05, 0.08, 0.12];
      const var95 = calculateVaR(positiveReturns, 0.95);
      
      expect(var95).toBeGreaterThanOrEqual(0);
    });

    it('should handle all negative returns', () => {
      const negativeReturns = [-0.01, -0.02, -0.05, -0.08, -0.12];
      const var95 = calculateVaR(negativeReturns, 0.95);
      
      expect(var95).toBeLessThan(0);
    });

    it('should handle single return', () => {
      const singleReturn = [0.05];
      const var95 = calculateVaR(singleReturn, 0.95);
      
      expect(var95).toBe(0.05);
    });

    it('should be consistent with percentile calculation', () => {
      const returns = [-0.15, -0.10, -0.05, 0.00, 0.02, 0.05, 0.08, 0.10, 0.12, 0.15];
      const var90 = calculateVaR(returns, 0.90); // 10th percentile
      
      // Should be close to the worst 10% of returns
      expect(var90).toBeCloseTo(-0.10, 1);
    });
  });
});

describe('Integrated Risk Calculations', () => {
  describe('Combined Risk Metrics', () => {
    it('should produce consistent metrics for the same return stream', () => {
      const returns = [0.12, -0.05, 0.08, 0.02, -0.02, 0.15, -0.03, 0.07, 0.04, -0.01];
      
      const sharpe = calculateSharpeRatio(returns, 0.02);
      const sortino = calculateSortinoRatio(returns, 0.02);
      const var95 = calculateVaR(returns, 0.95);
      
      expect(sortino).toBeGreaterThan(sharpe); // Sortino should be higher (downside focus)
      expect(var95).toBeLessThan(0); // VaR should be negative
      expect(sharpe).toBeGreaterThan(0); // Should be positive for this profitable stream
    });

    it('should handle extreme market scenarios', () => {
      const crashScenario = [0.05, 0.03, -0.25, -0.15, -0.10, 0.02, 0.08]; // Market crash
      
      const sharpe = calculateSharpeRatio(crashScenario, 0.02);
      const sortino = calculateSortinoRatio(crashScenario, 0.02);
      const var95 = calculateVaR(crashScenario, 0.95);
      
      expect(sharpe).toBeLessThan(0); // Poor risk-adjusted return
      expect(var95).toBeLessThan(-0.1); // Significant loss potential
      // In crash scenarios, both metrics should be negative, but Sortino focuses on downside
      expect(sortino).toBeDefined();
      expect(typeof sortino).toBe('number');
    });

    it('should validate steady performance scenarios', () => {
      const steadyReturns = [0.04, 0.042, 0.038, 0.041, 0.039, 0.043, 0.037, 0.045];
      
      const sharpe = calculateSharpeRatio(steadyReturns, 0.02);
      const sortino = calculateSortinoRatio(steadyReturns, 0.02);
      const var95 = calculateVaR(steadyReturns, 0.95);
      
      expect(sharpe).toBeGreaterThan(2); // Very high Sharpe for low volatility
      expect(sortino).toBe(Infinity); // No downside risk
      expect(var95).toBeGreaterThan(0.035); // Minimal loss potential
    });
  });

  describe('Risk-Return Trade-offs', () => {
    it('should demonstrate risk-return relationships', () => {
      const lowRiskReturns = [0.02, 0.025, 0.018, 0.022, 0.020]; // Low risk, low return
      const highRiskReturns = [0.15, -0.08, 0.22, -0.05, 0.18]; // High risk, high return
      
      const lowRiskSharpe = calculateSharpeRatio(lowRiskReturns, 0.01);
      const highRiskSharpe = calculateSharpeRatio(highRiskReturns, 0.01);
      
      // Risk-adjusted returns may favor low-risk strategy
      expect(lowRiskSharpe).toBeGreaterThan(highRiskSharpe);
    });

    it('should handle portfolio optimization scenarios', () => {
      // Simulate different portfolio allocations
      const conservativePortfolio = [0.03, 0.025, 0.035, 0.028, 0.032];
      const balancedPortfolio = [0.06, -0.02, 0.08, 0.01, 0.04];
      const aggressivePortfolio = [0.12, -0.08, 0.15, -0.05, 0.18];
      
      const conservativeSharpe = calculateSharpeRatio(conservativePortfolio, 0.02);
      const balancedSharpe = calculateSharpeRatio(balancedPortfolio, 0.02);
      const aggressiveSharpe = calculateSharpeRatio(aggressivePortfolio, 0.02);
      
      // Should provide meaningful differentiation
      expect(conservativeSharpe).toBeDefined();
      expect(balancedSharpe).toBeDefined();
      expect(aggressiveSharpe).toBeDefined();
      
      expect(Math.abs(conservativeSharpe - aggressiveSharpe)).toBeGreaterThan(0.1);
    });
  });
});