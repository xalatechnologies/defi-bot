import { ethers } from 'ethers';
import {
  estimateArbitrageGas,
  getGasPriceTrends,
  calculateDynamicGasPrice,
  isGasCostAcceptable,
  GasEstimate
} from './gas';

// Mock ethers provider for testing
const createMockProvider = (overrides: Partial<any> = {}) => {
  return {
    getFeeData: jest.fn().mockResolvedValue({
      gasPrice: ethers.parseUnits('25', 'gwei'),
      maxFeePerGas: ethers.parseUnits('30', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('2', 'gwei'),
      ...overrides
    })
  } as unknown as ethers.JsonRpcProvider;
};

describe('Gas Module - Gas Estimation', () => {
  describe('estimateArbitrageGas', () => {
    it('should estimate gas for standard arbitrage transaction', async () => {
      const mockProvider = createMockProvider();
      const ethPriceUsd = 2500;
      
      const gasEstimate = await estimateArbitrageGas(mockProvider, ethPriceUsd);
      
      expect(gasEstimate.gasLimit).toBeGreaterThan(BigInt(350000));
      expect(gasEstimate.maxFeePerGas).toBeGreaterThan(0n);
      expect(gasEstimate.maxPriorityFeePerGas).toBeGreaterThan(0n);
      expect(gasEstimate.estimatedCostUsd).toBeGreaterThan(0);
      
      // Verify relationships
      expect(gasEstimate.estimatedCostWei).toBe(
        gasEstimate.gasLimit * gasEstimate.maxFeePerGas
      );
    });

    it('should apply safety multiplier correctly', async () => {
      const mockProvider = createMockProvider();
      const ethPriceUsd = 2000;
      const multiplier = 1.5;
      
      const gasEstimate = await estimateArbitrageGas(mockProvider, ethPriceUsd, multiplier);
      
      // Gas limit should be increased by multiplier
      expect(gasEstimate.gasLimit).toBeGreaterThan(BigInt(Math.floor(350000 * 1.4)));
    });

    it('should handle different ETH prices', async () => {
      const mockProvider = createMockProvider();
      
      const lowEthPrice = await estimateArbitrageGas(mockProvider, 1500);
      const highEthPrice = await estimateArbitrageGas(mockProvider, 3000);
      
      expect(highEthPrice.estimatedCostUsd).toBeGreaterThan(lowEthPrice.estimatedCostUsd);
    });

    it('should handle provider errors gracefully', async () => {
      const mockProvider = createMockProvider();
      mockProvider.getFeeData = jest.fn().mockRejectedValue(new Error('Network error'));
      
      const gasEstimate = await estimateArbitrageGas(mockProvider);
      
      // Should return fallback values
      expect(gasEstimate.gasLimit).toBe(BigInt(400000));
      expect(gasEstimate.maxFeePerGas).toBe(ethers.parseUnits('50', 'gwei'));
      expect(gasEstimate.estimatedCostUsd).toBe(40);
    });

    it('should handle missing EIP-1559 fee data', async () => {
      const mockProvider = createMockProvider({
        maxFeePerGas: null,
        maxPriorityFeePerGas: null
      });
      
      const gasEstimate = await estimateArbitrageGas(mockProvider);
      
      // Should use fallback values
      expect(gasEstimate.maxFeePerGas).toBe(ethers.parseUnits('30', 'gwei'));
      expect(gasEstimate.maxPriorityFeePerGas).toBe(ethers.parseUnits('2', 'gwei'));
    });

    it('should calculate USD cost correctly', async () => {
      const mockProvider = createMockProvider({
        maxFeePerGas: ethers.parseUnits('50', 'gwei')
      });
      const ethPriceUsd = 2000;
      const expectedGasLimit = BigInt(Math.floor(350000 * 1.1)); // Default multiplier
      
      const gasEstimate = await estimateArbitrageGas(mockProvider, ethPriceUsd);
      
      const expectedCostEth = Number(ethers.formatEther(expectedGasLimit * ethers.parseUnits('50', 'gwei')));
      const expectedCostUsd = expectedCostEth * ethPriceUsd;
      
      expect(gasEstimate.estimatedCostUsd).toBeCloseTo(expectedCostUsd, 2);
    });
  });

  describe('getGasPriceTrends', () => {
    it('should classify congestion levels correctly', async () => {
      // Low congestion
      const lowProvider = createMockProvider({
        gasPrice: ethers.parseUnits('15', 'gwei')
      });
      const lowTrends = await getGasPriceTrends(lowProvider);
      expect(lowTrends.congestion).toBe('low');
      
      // Medium congestion
      const mediumProvider = createMockProvider({
        gasPrice: ethers.parseUnits('35', 'gwei')
      });
      const mediumTrends = await getGasPriceTrends(mediumProvider);
      expect(mediumTrends.congestion).toBe('medium');
      
      // High congestion
      const highProvider = createMockProvider({
        gasPrice: ethers.parseUnits('75', 'gwei')
      });
      const highTrends = await getGasPriceTrends(highProvider);
      expect(highTrends.congestion).toBe('high');
    });

    it('should calculate fast and safe prices correctly', async () => {
      const mockProvider = createMockProvider({
        gasPrice: ethers.parseUnits('30', 'gwei')
      });
      
      const trends = await getGasPriceTrends(mockProvider);
      
      expect(trends.fast).toBe(ethers.parseUnits('30', 'gwei') * 130n / 100n);
      expect(trends.safe).toBe(ethers.parseUnits('30', 'gwei') * 110n / 100n);
      expect(trends.current).toBe(ethers.parseUnits('30', 'gwei'));
    });

    it('should handle provider errors with fallbacks', async () => {
      const mockProvider = createMockProvider();
      mockProvider.getFeeData = jest.fn().mockRejectedValue(new Error('RPC Error'));
      
      const trends = await getGasPriceTrends(mockProvider);
      
      expect(trends.current).toBe(ethers.parseUnits('25', 'gwei'));
      expect(trends.congestion).toBe('medium');
    });

    it('should handle null gas price', async () => {
      const mockProvider = createMockProvider({
        gasPrice: null
      });
      
      const trends = await getGasPriceTrends(mockProvider);
      
      expect(trends.current).toBe(ethers.parseUnits('20', 'gwei'));
    });
  });

  describe('calculateDynamicGasPrice', () => {
    const baseGasPrice = ethers.parseUnits('30', 'gwei');
    
    it('should apply urgency multipliers correctly', () => {
      const lowUrgency = calculateDynamicGasPrice(baseGasPrice, 'low', 0, 100);
      const mediumUrgency = calculateDynamicGasPrice(baseGasPrice, 'medium', 0, 100);
      const highUrgency = calculateDynamicGasPrice(baseGasPrice, 'high', 0, 100);
      
      expect(lowUrgency).toBeLessThan(mediumUrgency);
      expect(mediumUrgency).toBeLessThan(highUrgency);
      
      expect(lowUrgency).toBe(BigInt(Math.floor(Number(baseGasPrice) * 1.05)));
      expect(mediumUrgency).toBe(BigInt(Math.floor(Number(baseGasPrice) * 1.15)));
      expect(highUrgency).toBe(BigInt(Math.floor(Number(baseGasPrice) * 1.3)));
    });

    it('should adjust for market volatility', () => {
      const lowVolatility = calculateDynamicGasPrice(baseGasPrice, 'medium', 0.1, 100);
      const highVolatility = calculateDynamicGasPrice(baseGasPrice, 'medium', 0.5, 100);
      
      expect(highVolatility).toBeGreaterThan(lowVolatility);
    });

    it('should adjust for profit margin', () => {
      const lowProfit = calculateDynamicGasPrice(baseGasPrice, 'medium', 0.1, 200); // 2%
      const highProfit = calculateDynamicGasPrice(baseGasPrice, 'medium', 0.1, 800); // 8%
      
      expect(highProfit).toBeGreaterThan(lowProfit);
    });

    it('should cap multiplier at 2x', () => {
      const extremeGasPrice = calculateDynamicGasPrice(
        baseGasPrice, 
        'high',     // 1.3x
        1.0,        // +0.1x
        1000        // +0.1x 
      ); // Total would be 1.5x, within cap
      
      const reallyExtremeGasPrice = calculateDynamicGasPrice(
        baseGasPrice,
        'high',     // 1.3x  
        5.0,        // +0.5x
        1000        // +0.1x
      ); // Total would be 1.9x, within cap
      
      expect(Number(extremeGasPrice)).toBeLessThanOrEqual(Number(baseGasPrice) * 2);
      expect(Number(reallyExtremeGasPrice)).toBeLessThanOrEqual(Number(baseGasPrice) * 2);
    });

    it('should handle zero volatility and profit margins', () => {
      const gasPrice = calculateDynamicGasPrice(baseGasPrice, 'low', 0, 0);
      expect(gasPrice).toBe(BigInt(Math.floor(Number(baseGasPrice) * 1.05)));
    });

    it('should handle extreme input values', () => {
      const gasPrice = calculateDynamicGasPrice(baseGasPrice, 'high', 10, 10000);
      expect(Number(gasPrice)).toBeLessThanOrEqual(Number(baseGasPrice) * 2);
    });
  });

  describe('isGasCostAcceptable', () => {
    it('should accept reasonable gas costs', () => {
      const gasCostUsd = 50;
      const expectedProfitUsd = 200;
      const result = isGasCostAcceptable(gasCostUsd, expectedProfitUsd);
      
      expect(result).toBe(true); // 25% ratio is acceptable
    });

    it('should reject excessive gas costs', () => {
      const gasCostUsd = 150;
      const expectedProfitUsd = 200;
      const result = isGasCostAcceptable(gasCostUsd, expectedProfitUsd);
      
      expect(result).toBe(false); // 75% ratio is too high
    });

    it('should use custom gas ratio', () => {
      const gasCostUsd = 100;
      const expectedProfitUsd = 200;
      
      const strict = isGasCostAcceptable(gasCostUsd, expectedProfitUsd, 0.2); // 20% max
      const lenient = isGasCostAcceptable(gasCostUsd, expectedProfitUsd, 0.6); // 60% max
      
      expect(strict).toBe(false); // 50% > 20%
      expect(lenient).toBe(true);  // 50% < 60%
    });

    it('should reject negative or zero profit', () => {
      expect(isGasCostAcceptable(50, 0)).toBe(false);
      expect(isGasCostAcceptable(50, -100)).toBe(false);
    });

    it('should handle zero gas cost', () => {
      expect(isGasCostAcceptable(0, 100)).toBe(true);
    });

    it('should handle edge case where gas cost equals profit', () => {
      const gasCostUsd = 100;
      const expectedProfitUsd = 100;
      const result = isGasCostAcceptable(gasCostUsd, expectedProfitUsd);
      
      expect(result).toBe(false); // 100% ratio exceeds 30% default
    });

    it('should handle very small amounts', () => {
      const gasCostUsd = 0.01;
      const expectedProfitUsd = 0.1;
      const result = isGasCostAcceptable(gasCostUsd, expectedProfitUsd);
      
      expect(result).toBe(true); // 10% ratio is acceptable
    });
  });
});

describe('Gas Module - Integration Tests', () => {
  it('should provide consistent gas estimation workflow', async () => {
    const mockProvider = createMockProvider();
    const ethPriceUsd = 2500;
    
    // Step 1: Get base gas estimate
    const gasEstimate = await estimateArbitrageGas(mockProvider, ethPriceUsd);
    
    // Step 2: Get gas price trends
    const trends = await getGasPriceTrends(mockProvider);
    
    // Step 3: Calculate dynamic pricing
    const dynamicPrice = calculateDynamicGasPrice(
      trends.current,
      'medium',
      0.2,
      600 // 6% profit margin
    );
    
    // Step 4: Check if cost is acceptable
    const expectedProfitUsd = 150;
    const isAcceptable = isGasCostAcceptable(
      gasEstimate.estimatedCostUsd,
      expectedProfitUsd
    );
    
    expect(gasEstimate).toBeDefined();
    expect(trends).toBeDefined();
    expect(dynamicPrice).toBeGreaterThan(trends.current);
    expect(typeof isAcceptable).toBe('boolean');
  });

  it('should handle extreme market conditions', async () => {
    const mockProvider = createMockProvider({
      gasPrice: ethers.parseUnits('200', 'gwei') // Very high gas
    });
    
    const gasEstimate = await estimateArbitrageGas(mockProvider, 4000); // High ETH price
    const trends = await getGasPriceTrends(mockProvider);
    
    expect(trends.congestion).toBe('high');
    expect(gasEstimate.estimatedCostUsd).toBeGreaterThan(40);
    
    // Should still be reasonable for high-profit trades
    const highProfitAcceptable = isGasCostAcceptable(
      gasEstimate.estimatedCostUsd,
      gasEstimate.estimatedCostUsd * 5 // 5x profit
    );
    expect(highProfitAcceptable).toBe(true);
  });
});