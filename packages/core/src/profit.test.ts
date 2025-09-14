import {
  netProfitUSD,
  isProfitable,
  calculateOptimalSize,
  expectedProfit,
  maxProfitableSize,
  calculatePositionSize,
  ProfitCalculation
} from './profit';
import { Params } from '@pkg/shared/types';

describe('Profit Module - Basic Calculations', () => {
  describe('netProfitUSD', () => {
    it('should calculate net profit correctly', () => {
      const grossProfitUsd = 150;
      const gasCostUsd = 25;
      const slippageCostUsd = 15;
      const tradeSizeUsd = 10000;
      
      const result = netProfitUSD(grossProfitUsd, gasCostUsd, slippageCostUsd, tradeSizeUsd);
      
      expect(result.grossProfitUsd).toBe(150);
      expect(result.gasCostUsd).toBe(25);
      expect(result.slippageCostUsd).toBe(15);
      expect(result.netProfitUsd).toBe(110); // 150 - 25 - 15
      expect(result.profitMarginBps).toBe(110); // (110/10000) * 10000
      expect(result.breakEvenAmountUsd).toBe(40); // 25 + 15
    });

    it('should handle negative net profit', () => {
      const grossProfitUsd = 50;
      const gasCostUsd = 75;
      const slippageCostUsd = 25;
      const tradeSizeUsd = 5000;
      
      const result = netProfitUSD(grossProfitUsd, gasCostUsd, slippageCostUsd, tradeSizeUsd);
      
      expect(result.netProfitUsd).toBe(-50); // 50 - 75 - 25
      expect(result.profitMarginBps).toBe(-100); // (-50/5000) * 10000
    });

    it('should handle zero trade size', () => {
      const result = netProfitUSD(100, 25, 15, 0);
      
      expect(result.netProfitUsd).toBe(60);
      expect(result.profitMarginBps).toBe(0);
    });

    it('should handle zero costs', () => {
      const result = netProfitUSD(100, 0, 0, 5000);
      
      expect(result.netProfitUsd).toBe(100);
      expect(result.profitMarginBps).toBe(200); // (100/5000) * 10000
      expect(result.breakEvenAmountUsd).toBe(0);
    });

    it('should handle large numbers correctly', () => {
      const result = netProfitUSD(10000, 500, 300, 1000000);
      
      expect(result.netProfitUsd).toBe(9200);
      expect(result.profitMarginBps).toBe(92); // (9200/1000000) * 10000
    });
  });

  describe('isProfitable', () => {
    const mockParams: Params = {
      minProfitUsd: 50,
      maxDailyLossUsd: 1000,
      maxNotionalUsd: 100000,
      slippageBps: 50,
      gasPriceMultiplier: 1.2,
      aiThreshold: 0.7
    };

    it('should return true for profitable trades', () => {
      const calculation: ProfitCalculation = {
        grossProfitUsd: 150,
        gasCostUsd: 30,
        slippageCostUsd: 20,
        netProfitUsd: 100,
        profitMarginBps: 100,
        breakEvenAmountUsd: 50
      };
      
      expect(isProfitable(calculation, mockParams)).toBe(true);
    });

    it('should return false for unprofitable trades', () => {
      const calculation: ProfitCalculation = {
        grossProfitUsd: 80,
        gasCostUsd: 40,
        slippageCostUsd: 20,
        netProfitUsd: 20,
        profitMarginBps: 40,
        breakEvenAmountUsd: 60
      };
      
      expect(isProfitable(calculation, mockParams)).toBe(false);
    });

    it('should handle edge case at minimum profit', () => {
      const calculation: ProfitCalculation = {
        grossProfitUsd: 100,
        gasCostUsd: 25,
        slippageCostUsd: 25,
        netProfitUsd: 50, // Exactly at minimum
        profitMarginBps: 50,
        breakEvenAmountUsd: 50
      };
      
      expect(isProfitable(calculation, mockParams)).toBe(true);
    });

    it('should handle negative profits', () => {
      const calculation: ProfitCalculation = {
        grossProfitUsd: 30,
        gasCostUsd: 50,
        slippageCostUsd: 20,
        netProfitUsd: -40,
        profitMarginBps: -80,
        breakEvenAmountUsd: 70
      };
      
      expect(isProfitable(calculation, mockParams)).toBe(false);
    });
  });
});

describe('Profit Module - Optimization Functions', () => {
  describe('calculateOptimalSize', () => {
    it('should calculate optimal size for good spread', () => {
      const spreadBps = 100; // 1%
      const gasCostUsd = 50;
      const maxSizeUsd = 100000;
      const minProfitUsd = 25;
      
      const optimalSize = calculateOptimalSize(spreadBps, gasCostUsd, maxSizeUsd, minProfitUsd);
      
      expect(optimalSize).toBeGreaterThan(0);
      expect(optimalSize).toBeLessThanOrEqual(maxSizeUsd);
      
      // Should be at least break-even size
      const breakEvenSize = ((gasCostUsd + minProfitUsd) * 10000) / spreadBps;
      expect(optimalSize).toBeGreaterThanOrEqual(breakEvenSize);
    });

    it('should return 0 for zero or negative spread', () => {
      expect(calculateOptimalSize(0, 50, 100000, 25)).toBe(0);
      expect(calculateOptimalSize(-10, 50, 100000, 25)).toBe(0);
    });

    it('should respect maximum size limit', () => {
      const spreadBps = 10; // 0.1% - very small spread
      const gasCostUsd = 10;
      const maxSizeUsd = 5000; // Small max size
      const minProfitUsd = 5;
      
      const optimalSize = calculateOptimalSize(spreadBps, gasCostUsd, maxSizeUsd, minProfitUsd);
      
      expect(optimalSize).toBeLessThanOrEqual(maxSizeUsd);
    });

    it('should handle high gas costs relative to spread', () => {
      const spreadBps = 50; // 0.5%
      const gasCostUsd = 100; // High gas cost
      const maxSizeUsd = 50000;
      const minProfitUsd = 50;
      
      const optimalSize = calculateOptimalSize(spreadBps, gasCostUsd, maxSizeUsd, minProfitUsd);
      
      // Should require large size to be profitable
      expect(optimalSize).toBeGreaterThan(20000);
    });

    it('should handle zero gas cost', () => {
      const spreadBps = 100;
      const gasCostUsd = 0;
      const maxSizeUsd = 100000;
      const minProfitUsd = 50;
      
      const optimalSize = calculateOptimalSize(spreadBps, gasCostUsd, maxSizeUsd, minProfitUsd);
      
      expect(optimalSize).toBe(5000); // (50 * 10000) / 100 = 5000, respects maxSizeUsd
    });
  });

  describe('expectedProfit', () => {
    it('should calculate expected profit correctly', () => {
      const tradeSizeUsd = 10000;
      const spreadBps = 100; // 1%
      const gasCostUsd = 30;
      const slippageBps = 20; // 0.2%
      
      const profit = expectedProfit(tradeSizeUsd, spreadBps, gasCostUsd, slippageBps);
      
      const grossProfit = (tradeSizeUsd * spreadBps) / 10000; // 100
      const slippageCost = (tradeSizeUsd * slippageBps) / 10000; // 20
      const expectedResult = grossProfit - gasCostUsd - slippageCost; // 100 - 30 - 20 = 50
      
      expect(profit).toBe(expectedResult);
    });

    it('should handle negative profits', () => {
      const tradeSizeUsd = 5000;
      const spreadBps = 50; // 0.5%
      const gasCostUsd = 50;
      const slippageBps = 30; // 0.3%
      
      const profit = expectedProfit(tradeSizeUsd, spreadBps, gasCostUsd, slippageBps);
      
      // Gross: 25, Slippage: 15, Net: 25 - 50 - 15 = -40
      expect(profit).toBe(-40);
    });

    it('should handle zero trade size', () => {
      const profit = expectedProfit(0, 100, 30, 20);
      expect(profit).toBe(-30); // Only gas cost
    });

    it('should handle zero spread', () => {
      const profit = expectedProfit(10000, 0, 30, 20);
      expect(profit).toBe(-50); // -30 gas - 20 slippage
    });

    it('should handle high slippage scenarios', () => {
      const tradeSizeUsd = 10000;
      const spreadBps = 100;
      const gasCostUsd = 30;
      const slippageBps = 80; // 0.8% - high slippage
      
      const profit = expectedProfit(tradeSizeUsd, spreadBps, gasCostUsd, slippageBps);
      
      // Gross: 100, Slippage: 80, Net: 100 - 30 - 80 = -10
      expect(profit).toBe(-10);
    });
  });

  describe('maxProfitableSize', () => {
    it('should calculate maximum profitable size', () => {
      const spreadBps = 100; // 1%
      const gasCostUsd = 50;
      const slippageBps = 20; // 0.2%
      const maxSizeUsd = 100000;
      
      const maxSize = maxProfitableSize(spreadBps, gasCostUsd, slippageBps, maxSizeUsd);
      
      expect(maxSize).toBeGreaterThan(0);
      expect(maxSize).toBeLessThanOrEqual(maxSizeUsd);
      
      // Net spread should be positive
      const netSpreadBps = spreadBps - slippageBps;
      expect(netSpreadBps).toBeGreaterThan(0);
    });

    it('should return 0 when spread <= slippage', () => {
      const spreadBps = 50;
      const gasCostUsd = 30;
      const slippageBps = 60; // Higher than spread
      const maxSizeUsd = 100000;
      
      const maxSize = maxProfitableSize(spreadBps, gasCostUsd, slippageBps, maxSizeUsd);
      expect(maxSize).toBe(0);
    });

    it('should return 0 when spread equals slippage', () => {
      const spreadBps = 50;
      const gasCostUsd = 30;
      const slippageBps = 50; // Equal to spread
      const maxSizeUsd = 100000;
      
      const maxSize = maxProfitableSize(spreadBps, gasCostUsd, slippageBps, maxSizeUsd);
      expect(maxSize).toBe(0);
    });

    it('should respect maximum size limit', () => {
      const spreadBps = 100;
      const gasCostUsd = 10;
      const slippageBps = 10;
      const maxSizeUsd = 50000; // Smaller than calculated max
      
      const maxSize = maxProfitableSize(spreadBps, gasCostUsd, slippageBps, maxSizeUsd);
      expect(maxSize).toBeLessThanOrEqual(maxSizeUsd);
    });

    it('should handle zero gas cost', () => {
      const spreadBps = 100;
      const gasCostUsd = 0;
      const slippageBps = 20;
      const maxSizeUsd = 100000;
      
      const maxSize = maxProfitableSize(spreadBps, gasCostUsd, slippageBps, maxSizeUsd);
      expect(maxSize).toBeGreaterThan(0);
    });
  });

  describe('calculatePositionSize', () => {
    it('should calculate position size with Kelly criterion', () => {
      const availableCapitalUsd = 100000;
      const maxRiskPerTradePercent = 5; // 5%
      const expectedReturnBps = 150; // 1.5%
      const volatilityBps = 100; // 1%
      
      const positionSize = calculatePositionSize(
        availableCapitalUsd,
        maxRiskPerTradePercent,
        expectedReturnBps,
        volatilityBps
      );
      
      expect(positionSize).toBeGreaterThan(0);
      expect(positionSize).toBeLessThanOrEqual(availableCapitalUsd * 0.25); // Capped at 25%
      expect(positionSize).toBeLessThanOrEqual(availableCapitalUsd * 0.05); // Respects max risk
    });

    it('should respect maximum risk limit', () => {
      const availableCapitalUsd = 50000;
      const maxRiskPerTradePercent = 2; // 2%
      const expectedReturnBps = 200;
      const volatilityBps = 50;
      
      const positionSize = calculatePositionSize(
        availableCapitalUsd,
        maxRiskPerTradePercent,
        expectedReturnBps,
        volatilityBps
      );
      
      expect(positionSize).toBeLessThanOrEqual(1000); // 2% of 50k
    });

    it('should cap Kelly sizing at 25%', () => {
      const availableCapitalUsd = 100000;
      const maxRiskPerTradePercent = 50; // Very high risk tolerance
      const expectedReturnBps = 1000; // Very high expected return
      const volatilityBps = 100;
      
      const positionSize = calculatePositionSize(
        availableCapitalUsd,
        maxRiskPerTradePercent,
        expectedReturnBps,
        volatilityBps
      );
      
      expect(positionSize).toBeLessThanOrEqual(25000); // 25% cap
    });

    it('should handle negative expected returns', () => {
      const availableCapitalUsd = 100000;
      const maxRiskPerTradePercent = 5;
      const expectedReturnBps = -50; // Negative expected return
      const volatilityBps = 100;
      
      const positionSize = calculatePositionSize(
        availableCapitalUsd,
        maxRiskPerTradePercent,
        expectedReturnBps,
        volatilityBps
      );
      
      expect(positionSize).toBeGreaterThanOrEqual(0); // May still allow small positions
    });

    it('should handle very low win probability', () => {
      const availableCapitalUsd = 100000;
      const maxRiskPerTradePercent = 5;
      const expectedReturnBps = 50;
      const volatilityBps = 500; // Very high volatility
      
      const positionSize = calculatePositionSize(
        availableCapitalUsd,
        maxRiskPerTradePercent,
        expectedReturnBps,
        volatilityBps
      );
      
      expect(positionSize).toBeGreaterThanOrEqual(0);
      expect(positionSize).toBeLessThan(5000); // Should be conservative
    });

    it('should handle zero capital', () => {
      const positionSize = calculatePositionSize(0, 5, 100, 50);
      expect(positionSize).toBe(0);
    });

    it('should handle edge case with zero volatility', () => {
      const availableCapitalUsd = 100000;
      const maxRiskPerTradePercent = 5;
      const expectedReturnBps = 100;
      const volatilityBps = 0;
      
      const positionSize = calculatePositionSize(
        availableCapitalUsd,
        maxRiskPerTradePercent,
        expectedReturnBps,
        volatilityBps
      );
      
      expect(positionSize).toBeGreaterThan(0);
      expect(positionSize).toBeLessThanOrEqual(25000); // 25% cap
    });
  });
});

describe('Profit Module - Integration Tests', () => {
  it('should provide consistent profit analysis workflow', () => {
    // Scenario: 1% spread arbitrage opportunity
    const tradeSizeUsd = 20000;
    const spreadBps = 100;
    const gasCostUsd = 45;
    const slippageBps = 25;
    
    // Step 1: Calculate expected profit
    const expected = expectedProfit(tradeSizeUsd, spreadBps, gasCostUsd, slippageBps);
    
    // Step 2: Calculate detailed profit breakdown
    const grossProfit = (tradeSizeUsd * spreadBps) / 10000;
    const slippageCost = (tradeSizeUsd * slippageBps) / 10000;
    const profitCalc = netProfitUSD(grossProfit, gasCostUsd, slippageCost, tradeSizeUsd);
    
    // Step 3: Check profitability
    const params: Params = {
      minProfitUsd: 50,
      maxDailyLossUsd: 1000,
      maxNotionalUsd: 100000,
      slippageBps: 50,
      gasPriceMultiplier: 1.2,
      aiThreshold: 0.7
    };
    const profitable = isProfitable(profitCalc, params);
    
    // Verify consistency
    expect(profitCalc.netProfitUsd).toBe(expected);
    expect(profitCalc.grossProfitUsd).toBe(200); // 20000 * 1%
    expect(profitCalc.slippageCostUsd).toBe(50);  // 20000 * 0.25%
    expect(profitCalc.netProfitUsd).toBe(105);    // 200 - 45 - 50
    expect(profitable).toBe(true); // 105 > 50 minimum
  });

  it('should handle marginal profitability scenarios', () => {
    const tradeSizeUsd = 10000;
    const spreadBps = 60; // 0.6%
    const gasCostUsd = 35;
    const slippageBps = 15; // 0.15%
    
    const grossProfit = 60; // 10000 * 0.6%
    const slippageCost = 15; // 10000 * 0.15%
    const netProfit = 10; // 60 - 35 - 15
    
    const profitCalc = netProfitUSD(grossProfit, gasCostUsd, slippageCost, tradeSizeUsd);
    
    const params: Params = {
      minProfitUsd: 15, // Just above our net profit
      maxDailyLossUsd: 1000,
      maxNotionalUsd: 100000,
      slippageBps: 50,
      gasPriceMultiplier: 1.2,
      aiThreshold: 0.7
    };
    
    expect(profitCalc.netProfitUsd).toBe(netProfit);
    expect(isProfitable(profitCalc, params)).toBe(false); // 10 < 15 minimum
  });

  it('should optimize trade size for maximum profit', () => {
    const spreadBps = 80; // 0.8%
    const gasCostUsd = 40;
    const slippageBps = 20; // 0.2%
    const maxSizeUsd = 50000;
    const minProfitUsd = 30;
    
    // Calculate optimal size
    const optimalSize = calculateOptimalSize(spreadBps, gasCostUsd, maxSizeUsd, minProfitUsd);
    
    // Calculate maximum profitable size
    const maxSize = maxProfitableSize(spreadBps, gasCostUsd, slippageBps, maxSizeUsd);
    
    // Verify optimal size is within bounds
    expect(optimalSize).toBeGreaterThan(0);
    expect(optimalSize).toBeLessThanOrEqual(maxSize);
    expect(optimalSize).toBeLessThanOrEqual(maxSizeUsd);
    
    // Calculate actual profit at optimal size
    const profit = expectedProfit(optimalSize, spreadBps, gasCostUsd, slippageBps);
    expect(profit).toBeGreaterThanOrEqual(minProfitUsd);
  });
});