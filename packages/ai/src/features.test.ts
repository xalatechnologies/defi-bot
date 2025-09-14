import {
  extractFeatures,
  normalizeFeatures,
  extractTrainingFeatures,
  calculateFeatureImportance,
  selectTopFeatures,
  FEATURE_WEIGHTS
} from './features';
import type { Snapshot, Route, FeatureVector } from '@pkg/shared';

describe('Feature Extraction', () => {
  // Mock data for testing
  const mockSnapshot: Snapshot = {
    timestamp: new Date('2025-01-20T14:30:00Z'),
    pairAddress: '0x1234567890123456789012345678901234567890',
    reserve0: '1000000000000000000000', // 1000 tokens
    reserve1: '2000000000000000000000', // 2000 tokens  
    token0: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    token1: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    dex: 'quickswap'
  };

  const mockRoute: Route = {
    id: 'USDC-WETH-quickswap-sushiswap',
    path: [
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
      '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
    ],
    symbols: ['USDC', 'WETH', 'USDC'],
    dexA: 'quickswap',
    dexB: 'sushiswap'
  };

  describe('extractFeatures', () => {
    it('should extract all required features', () => {
      const tradeSizeUsd = 500;
      const features = extractFeatures(mockSnapshot, mockRoute, tradeSizeUsd);

      expect(features).toHaveProperty('spreadBps');
      expect(features).toHaveProperty('depthUsd');
      expect(features).toHaveProperty('volatility');
      expect(features).toHaveProperty('sizeTier');
      expect(features).toHaveProperty('gasPrice');
      expect(features).toHaveProperty('timeOfDay');
      expect(features).toHaveProperty('dayOfWeek');

      expect(typeof features.spreadBps).toBe('number');
      expect(typeof features.depthUsd).toBe('number');
      expect(typeof features.volatility).toBe('number');
      expect(typeof features.sizeTier).toBe('number');
      expect(typeof features.gasPrice).toBe('number');
      expect(typeof features.timeOfDay).toBe('number');
      expect(typeof features.dayOfWeek).toBe('number');
    });

    it('should categorize trade sizes correctly', () => {
      const testCases = [
        { size: 50, expectedTier: 1 },
        { size: 100, expectedTier: 1 },
        { size: 300, expectedTier: 2 },
        { size: 500, expectedTier: 2 },
        { size: 800, expectedTier: 3 },
        { size: 1000, expectedTier: 3 },
        { size: 2000, expectedTier: 4 }
      ];

      testCases.forEach(({ size, expectedTier }) => {
        const features = extractFeatures(mockSnapshot, mockRoute, size);
        expect(features.sizeTier).toBe(expectedTier);
      });
    });

    it('should calculate time features correctly', () => {
      const features = extractFeatures(mockSnapshot, mockRoute, 500);
      
      expect(features.timeOfDay).toBeGreaterThanOrEqual(0);
      expect(features.timeOfDay).toBeLessThan(24);
      expect(features.dayOfWeek).toBeGreaterThanOrEqual(0);
      expect(features.dayOfWeek).toBeLessThanOrEqual(6);
    });

    it('should calculate depth estimation', () => {
      const features = extractFeatures(mockSnapshot, mockRoute, 500);
      
      // Depth should be based on minimum of reserves * 2
      const reserve0 = parseFloat(mockSnapshot.reserve0);
      const reserve1 = parseFloat(mockSnapshot.reserve1);
      const expectedDepth = Math.min(reserve0, reserve1) * 2;
      
      expect(features.depthUsd).toBe(expectedDepth);
    });

    it('should handle edge cases', () => {
      const edgeSnapshot = {
        ...mockSnapshot,
        reserve0: '0',
        reserve1: '1000000000000000000'
      };

      const features = extractFeatures(edgeSnapshot, mockRoute, 1);
      expect(features.depthUsd).toBe(0);
      expect(features.sizeTier).toBe(1);
    });
  });

  describe('normalizeFeatures', () => {
    it('should normalize all features to proper ranges', () => {
      const testFeature: FeatureVector = {
        spreadBps: 50,
        depthUsd: 10000,
        volatility: 25,
        sizeTier: 2,
        gasPrice: 50,
        timeOfDay: 12,
        dayOfWeek: 3
      };

      const normalized = normalizeFeatures(testFeature);

      expect(normalized).toHaveLength(7);
      
      // Check each feature is in expected range
      expect(normalized[0]).toBeGreaterThanOrEqual(0); // spreadBps / 1000
      expect(normalized[0]).toBeLessThanOrEqual(1);
      
      expect(normalized[1]).toBeGreaterThanOrEqual(0); // log(depthUsd) / 20
      expect(normalized[2]).toBeGreaterThanOrEqual(0); // volatility / 100
      expect(normalized[2]).toBeLessThanOrEqual(1);
      
      expect(normalized[3]).toBeGreaterThanOrEqual(0); // sizeTier / 4
      expect(normalized[3]).toBeLessThanOrEqual(1);
      
      expect(normalized[4]).toBeGreaterThanOrEqual(0); // gasPrice / 100
      expect(normalized[4]).toBeLessThanOrEqual(1);
      
      expect(normalized[5]).toBeGreaterThanOrEqual(0); // timeOfDay / 24
      expect(normalized[5]).toBeLessThanOrEqual(1);
      
      expect(normalized[6]).toBeGreaterThanOrEqual(0); // dayOfWeek / 7
      expect(normalized[6]).toBeLessThanOrEqual(1);
    });

    it('should handle extreme values correctly', () => {
      const extremeFeature: FeatureVector = {
        spreadBps: 1000,
        depthUsd: 0.1,
        volatility: 100,
        sizeTier: 4,
        gasPrice: 100,
        timeOfDay: 23.99,
        dayOfWeek: 6
      };

      const normalized = normalizeFeatures(extremeFeature);
      
      expect(normalized[0]).toBe(1); // spreadBps at max
      expect(normalized[2]).toBe(1); // volatility at max
      expect(normalized[3]).toBe(1); // sizeTier at max
      expect(normalized[4]).toBe(1); // gasPrice at max
      expect(normalized[5]).toBeLessThan(1); // timeOfDay just under max
      expect(normalized[6]).toBeCloseTo(6/7); // dayOfWeek
    });

    it('should be deterministic', () => {
      const testFeature: FeatureVector = {
        spreadBps: 30,
        depthUsd: 5000,
        volatility: 15,
        sizeTier: 3,
        gasPrice: 25,
        timeOfDay: 18.5,
        dayOfWeek: 1
      };

      const normalized1 = normalizeFeatures(testFeature);
      const normalized2 = normalizeFeatures(testFeature);

      expect(normalized1).toEqual(normalized2);
    });
  });

  describe('extractTrainingFeatures', () => {
    it('should extract features and binary labels correctly', () => {
      const profitableResult = extractTrainingFeatures(
        mockSnapshot,
        mockRoute,
        500,
        15.50 // profitable
      );

      const unprofitableResult = extractTrainingFeatures(
        mockSnapshot,
        mockRoute,
        500,
        -5.25 // unprofitable
      );

      expect(profitableResult.features).toHaveLength(7);
      expect(profitableResult.label).toBe(1);

      expect(unprofitableResult.features).toHaveLength(7);
      expect(unprofitableResult.label).toBe(0);
    });

    it('should handle zero profit correctly', () => {
      const zeroResult = extractTrainingFeatures(
        mockSnapshot,
        mockRoute,
        500,
        0 // break-even
      );

      expect(zeroResult.label).toBe(0); // Zero profit should be labeled as unprofitable
    });

    it('should handle very small profits correctly', () => {
      const smallProfitResult = extractTrainingFeatures(
        mockSnapshot,
        mockRoute,
        500,
        0.01 // very small profit
      );

      expect(smallProfitResult.label).toBe(1); // Any positive profit should be labeled as profitable
    });
  });

  describe('calculateFeatureImportance', () => {
    it('should return score between 0 and 1', () => {
      const testFeature: FeatureVector = {
        spreadBps: 50,
        depthUsd: 10000,
        volatility: 20,
        sizeTier: 3,
        gasPrice: 30,
        timeOfDay: 14,
        dayOfWeek: 2
      };

      const importance = calculateFeatureImportance(testFeature);
      expect(importance).toBeGreaterThanOrEqual(0);
      expect(importance).toBeLessThanOrEqual(1);
    });

    it('should weight features according to defined importance', () => {
      // High spread should increase importance
      const highSpreadFeature: FeatureVector = {
        spreadBps: 100,
        depthUsd: 10000,
        volatility: 10,
        sizeTier: 3,
        gasPrice: 20,
        timeOfDay: 14,
        dayOfWeek: 2
      };

      // Low spread should decrease importance
      const lowSpreadFeature: FeatureVector = {
        spreadBps: 5,
        depthUsd: 10000,
        volatility: 10,
        sizeTier: 3,
        gasPrice: 20,
        timeOfDay: 14,
        dayOfWeek: 2
      };

      const highSpreadImportance = calculateFeatureImportance(highSpreadFeature);
      const lowSpreadImportance = calculateFeatureImportance(lowSpreadFeature);

      expect(highSpreadImportance).toBeGreaterThan(lowSpreadImportance);
    });

    it('should penalize high volatility and gas prices', () => {
      const lowVolatilityFeature: FeatureVector = {
        spreadBps: 50,
        depthUsd: 10000,
        volatility: 5,
        sizeTier: 3,
        gasPrice: 10,
        timeOfDay: 14,
        dayOfWeek: 2
      };

      const highVolatilityFeature: FeatureVector = {
        spreadBps: 50,
        depthUsd: 10000,
        volatility: 45,
        sizeTier: 3,
        gasPrice: 90,
        timeOfDay: 14,
        dayOfWeek: 2
      };

      const lowVolImportance = calculateFeatureImportance(lowVolatilityFeature);
      const highVolImportance = calculateFeatureImportance(highVolatilityFeature);

      expect(lowVolImportance).toBeGreaterThan(highVolImportance);
    });
  });

  describe('selectTopFeatures', () => {
    it('should select top features by correlation', () => {
      // Create mock training data with clear correlations
      const trainingData = [
        { features: [1, 0, 0, 0, 0, 0, 0], label: 1 },
        { features: [0.8, 0.2, 0.1, 0.3, 0.2, 0.5, 0.1], label: 1 },
        { features: [0.1, 0.9, 0.8, 0.7, 0.8, 0.2, 0.9], label: 0 },
        { features: [0, 1, 1, 0.8, 1, 0.1, 1], label: 0 }
      ];

      const topFeatures = selectTopFeatures(trainingData, 3);
      
      expect(topFeatures).toHaveLength(3);
      expect(topFeatures.every(idx => idx >= 0 && idx < 7)).toBe(true);
    });

    it('should handle edge cases', () => {
      const emptyData: Array<{ features: number[]; label: number }> = [];
      const topFeatures = selectTopFeatures(emptyData, 5);
      // The function should return indices for default features (7 features) even with empty data
      expect(topFeatures.length).toBeLessThanOrEqual(5);
    });

    it('should limit to available features when k > feature count', () => {
      const trainingData = [
        { features: [1, 0, 0], label: 1 },
        { features: [0, 1, 0], label: 0 }
      ];

      const topFeatures = selectTopFeatures(trainingData, 10);
      expect(topFeatures.length).toBeLessThanOrEqual(3);
    });
  });

  describe('FEATURE_WEIGHTS', () => {
    it('should have all required weights', () => {
      expect(FEATURE_WEIGHTS).toHaveProperty('spreadBps');
      expect(FEATURE_WEIGHTS).toHaveProperty('depthUsd');
      expect(FEATURE_WEIGHTS).toHaveProperty('volatility');
      expect(FEATURE_WEIGHTS).toHaveProperty('sizeTier');
      expect(FEATURE_WEIGHTS).toHaveProperty('gasPrice');
      expect(FEATURE_WEIGHTS).toHaveProperty('timeOfDay');
      expect(FEATURE_WEIGHTS).toHaveProperty('dayOfWeek');
    });

    it('should have weights that sum to approximately 1', () => {
      const totalWeight = Object.values(FEATURE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
      expect(totalWeight).toBeCloseTo(1, 2);
    });

    it('should prioritize spread as most important feature', () => {
      const weights = Object.entries(FEATURE_WEIGHTS);
      const spreadWeight = FEATURE_WEIGHTS.spreadBps;
      
      const otherWeights = weights
        .filter(([key]) => key !== 'spreadBps')
        .map(([, weight]) => weight);
      
      expect(spreadWeight).toBeGreaterThan(Math.max(...otherWeights));
    });
  });
});