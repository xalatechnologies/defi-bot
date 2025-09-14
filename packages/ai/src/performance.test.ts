import { AIModel } from './model';
import { extractFeatures, normalizeFeatures, extractTrainingFeatures } from './features';
import type { FeatureVector, Snapshot, Route } from '@pkg/shared';

describe('AI Model Performance and Robustness', () => {
  let model: AIModel;

  beforeEach(async () => {
    model = new AIModel('/tmp/perf-test-model.json');
    
    // Mock fs for consistency
    jest.doMock('fs/promises', () => ({
      readFile: jest.fn().mockRejectedValue(new Error('File not found')),
      writeFile: jest.fn().mockResolvedValue(undefined),
      mkdir: jest.fn().mockResolvedValue(undefined)
    }));
    
    await model.load();
  });

  describe('Large Dataset Performance', () => {
    it('should handle large training datasets efficiently', async () => {
      const startTime = performance.now();
      
      // Generate large training dataset
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({
        features: [
          Math.random(), // spreadBps normalized
          Math.random(), // depthUsd normalized
          Math.random(), // volatility normalized
          Math.random(), // sizeTier normalized
          Math.random(), // gasPrice normalized
          Math.random(), // timeOfDay normalized
          Math.random()  // dayOfWeek normalized
        ],
        label: Math.random() > 0.5 ? 1 : 0
      }));

      await model.train(largeDataset);
      
      const endTime = performance.now();
      const trainingTime = endTime - startTime;
      
      // Training should complete within reasonable time (< 30 seconds for 5000 samples)
      expect(trainingTime).toBeLessThan(30000);
      
      const stats = model.getStats();
      expect(stats.sampleCount).toBe(5000);
      expect(stats.accuracy).toBeGreaterThanOrEqual(0);
      expect(stats.accuracy).toBeLessThanOrEqual(1);
    }, 35000); // 35 second timeout

    it('should handle massive feature extraction efficiently', () => {
      const mockSnapshot: Snapshot = {
        timestamp: new Date(),
        pairAddress: '0x1234567890123456789012345678901234567890',
        reserve0: '1000000000000000000000',
        reserve1: '2000000000000000000000',
        token0: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        token1: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        dex: 'quickswap'
      };

      const mockRoute: Route = {
        id: 'test-route',
        path: ['0x123', '0x456', '0x789'],
        symbols: ['USDC', 'WETH', 'USDC'],
        dexA: 'quickswap',
        dexB: 'sushiswap'
      };

      const startTime = performance.now();
      
      // Extract features for many trade scenarios
      const features: FeatureVector[] = [];
      for (let i = 0; i < 10000; i++) {
        const feature = extractFeatures(mockSnapshot, mockRoute, 100 + i);
        features.push(feature);
      }
      
      const endTime = performance.now();
      const extractionTime = endTime - startTime;
      
      expect(features).toHaveLength(10000);
      expect(extractionTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Verify all features are valid
      features.forEach(feature => {
        expect(feature.spreadBps).toBeGreaterThanOrEqual(0);
        expect(feature.depthUsd).toBeGreaterThanOrEqual(0);
        expect(feature.volatility).toBeGreaterThanOrEqual(0);
        expect(feature.sizeTier).toBeGreaterThanOrEqual(1);
        expect(feature.sizeTier).toBeLessThanOrEqual(4);
      });
    });

    it('should handle massive scoring operations efficiently', async () => {
      const testFeatures: FeatureVector[] = Array.from({ length: 50000 }, () => ({
        spreadBps: Math.random() * 100,
        depthUsd: Math.random() * 100000,
        volatility: Math.random() * 50,
        sizeTier: Math.floor(Math.random() * 4) + 1,
        gasPrice: Math.random() * 100,
        timeOfDay: Math.random() * 24,
        dayOfWeek: Math.floor(Math.random() * 7)
      }));

      const startTime = performance.now();
      
      const scores = await Promise.all(
        testFeatures.map(feature => model.score(feature))
      );
      
      const endTime = performance.now();
      const scoringTime = endTime - startTime;
      
      expect(scores).toHaveLength(50000);
      expect(scoringTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Verify all scores are valid probabilities
      scores.forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
        expect(isFinite(score)).toBe(true);
      });
      
      // Calculate average scoring time per operation
      const avgScoringTime = scoringTime / 50000;
      expect(avgScoringTime).toBeLessThan(1); // Less than 1ms per score on average
    }, 15000);
  });

  describe('Memory Usage and Resource Management', () => {
    it('should not leak memory during repeated training', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform multiple training cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        const trainingData = Array.from({ length: 1000 }, () => ({
          features: Array.from({ length: 7 }, () => Math.random()),
          label: Math.random() > 0.5 ? 1 : 0
        }));
        
        await model.train(trainingData);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (< 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }, 30000);

    it('should handle concurrent scoring operations', async () => {
      const testFeatures: FeatureVector = {
        spreadBps: 50,
        depthUsd: 10000,
        volatility: 20,
        sizeTier: 3,
        gasPrice: 30,
        timeOfDay: 14,
        dayOfWeek: 2
      };

      const concurrentOperations = 1000;
      const startTime = performance.now();
      
      // Run many scoring operations concurrently
      const promises = Array.from({ length: concurrentOperations }, () => 
        model.score(testFeatures)
      );
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(results).toHaveLength(concurrentOperations);
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      // All results should be identical (deterministic)
      const firstResult = results[0];
      results.forEach(result => {
        expect(result).toBe(firstResult);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle malformed feature vectors gracefully', async () => {
      const malformedFeatures = [
        { ...createValidFeature(), spreadBps: NaN },
        { ...createValidFeature(), depthUsd: Infinity },
        { ...createValidFeature(), volatility: -Infinity },
        { ...createValidFeature(), sizeTier: -1 },
        { ...createValidFeature(), gasPrice: undefined as any },
        { ...createValidFeature(), timeOfDay: null as any }
      ];

      for (const feature of malformedFeatures) {
        try {
          const score = await model.score(feature);
          // If it doesn't throw, score should still be valid
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(1);
          expect(isFinite(score)).toBe(true);
        } catch (error) {
          // Error is acceptable for malformed input
          expect(error).toBeInstanceOf(Error);
        }
      }
    });

    it('should handle training with invalid data', async () => {
      const invalidTrainingData = [
        { features: [NaN, 0.5, 0.3, 0.8, 0.2, 0.6, 0.4], label: 1 },
        { features: [0.5, Infinity, 0.3, 0.8, 0.2, 0.6, 0.4], label: 0 },
        { features: [0.5, 0.3, -Infinity, 0.8, 0.2, 0.6, 0.4], label: 1 },
        { features: [], label: 0 }, // Empty features
        { features: [0.5, 0.3, 0.8], label: 1 }, // Insufficient features
        { features: Array(20).fill(0.5), label: 0 } // Too many features
      ];

      // Should not crash, but may not improve accuracy much
      await expect(model.train(invalidTrainingData)).resolves.not.toThrow();
    });

    it('should handle extreme training scenarios', async () => {
      const extremeScenarios = [
        // All positive labels
        Array.from({ length: 100 }, () => ({
          features: Array.from({ length: 7 }, () => Math.random()),
          label: 1
        })),
        // All negative labels
        Array.from({ length: 100 }, () => ({
          features: Array.from({ length: 7 }, () => Math.random()),
          label: 0
        })),
        // Single sample
        [{ features: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], label: 1 }],
        // Identical features with different labels
        [
          { features: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], label: 1 },
          { features: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5], label: 0 }
        ]
      ];

      for (const scenario of extremeScenarios) {
        await expect(model.train(scenario)).resolves.not.toThrow();
        
        const stats = model.getStats();
        expect(stats.accuracy).toBeGreaterThanOrEqual(0);
        expect(stats.accuracy).toBeLessThanOrEqual(1);
        expect(isFinite(stats.accuracy)).toBe(true);
      }
    });

    it('should maintain consistency under stress', async () => {
      const testFeature: FeatureVector = {
        spreadBps: 75,
        depthUsd: 25000,
        volatility: 15,
        sizeTier: 2,
        gasPrice: 25,
        timeOfDay: 10.5,
        dayOfWeek: 1
      };

      // Train model
      const trainingData = Array.from({ length: 1000 }, () => ({
        features: Array.from({ length: 7 }, () => Math.random()),
        label: Math.random() > 0.5 ? 1 : 0
      }));
      
      await model.train(trainingData);

      // Get initial prediction
      const initialScore = await model.score(testFeature);
      const initialStats = model.getStats();

      // Perform many operations
      const operations = [];
      for (let i = 0; i < 1000; i++) {
        operations.push(model.score(testFeature));
      }
      
      await Promise.all(operations);

      // Verify consistency
      const finalScore = await model.score(testFeature);
      const finalStats = model.getStats();

      expect(finalScore).toBe(initialScore);
      expect(finalStats.accuracy).toBe(initialStats.accuracy);
      expect(finalStats.sampleCount).toBe(initialStats.sampleCount);
    });
  });

  describe('Feature Processing Performance', () => {
    it('should normalize features efficiently at scale', () => {
      const features: FeatureVector[] = Array.from({ length: 100000 }, () => ({
        spreadBps: Math.random() * 1000,
        depthUsd: Math.random() * 1000000,
        volatility: Math.random() * 100,
        sizeTier: Math.floor(Math.random() * 4) + 1,
        gasPrice: Math.random() * 200,
        timeOfDay: Math.random() * 24,
        dayOfWeek: Math.floor(Math.random() * 7)
      }));

      const startTime = performance.now();
      
      const normalized = features.map(f => normalizeFeatures(f));
      
      const endTime = performance.now();
      const normalizationTime = endTime - startTime;
      
      expect(normalized).toHaveLength(100000);
      expect(normalizationTime).toBeLessThan(2000); // Should complete within 2 seconds
      
      // Verify normalization correctness
      normalized.forEach(norm => {
        expect(norm).toHaveLength(7);
        norm.forEach(value => {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(isFinite(value)).toBe(true);
        });
      });
    });

    it('should extract training features efficiently', () => {
      const mockSnapshot: Snapshot = {
        timestamp: new Date(),
        pairAddress: '0x1234567890123456789012345678901234567890',
        reserve0: '1000000000000000000000',
        reserve1: '2000000000000000000000',
        token0: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        token1: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        dex: 'quickswap'
      };

      const mockRoute: Route = {
        id: 'test-route',
        path: ['0x123', '0x456', '0x789'],
        symbols: ['USDC', 'WETH', 'USDC'],
        dexA: 'quickswap',
        dexB: 'sushiswap'
      };

      const startTime = performance.now();
      
      const trainingFeatures = [];
      for (let i = 0; i < 10000; i++) {
        const tradeSizeUsd = 100 + Math.random() * 1000;
        const actualProfit = (Math.random() - 0.5) * 20; // -10 to +10
        
        const features = extractTrainingFeatures(
          mockSnapshot,
          mockRoute,
          tradeSizeUsd,
          actualProfit
        );
        
        trainingFeatures.push(features);
      }
      
      const endTime = performance.now();
      const extractionTime = endTime - startTime;
      
      expect(trainingFeatures).toHaveLength(10000);
      expect(extractionTime).toBeLessThan(3000); // Should complete within 3 seconds
      
      // Verify all training features are valid
      trainingFeatures.forEach(tf => {
        expect(tf.features).toHaveLength(7);
        expect([0, 1]).toContain(tf.label);
        tf.features.forEach(value => {
          expect(isFinite(value)).toBe(true);
        });
      });
    });
  });

  describe('Real-world Scenario Testing', () => {
    it('should handle realistic trading scenarios efficiently', async () => {
      // Simulate a day of trading with varying market conditions
      const tradingScenarios = [
        // High volatility market
        { spreadBps: 20, depthUsd: 5000, volatility: 45, sizeTier: 1, gasPrice: 80, timeOfDay: 2, dayOfWeek: 0 },
        // Liquid market, good conditions
        { spreadBps: 60, depthUsd: 100000, volatility: 15, sizeTier: 3, gasPrice: 25, timeOfDay: 14, dayOfWeek: 2 },
        // Weekend trading
        { spreadBps: 30, depthUsd: 20000, volatility: 25, sizeTier: 2, gasPrice: 40, timeOfDay: 20, dayOfWeek: 6 },
        // High gas period
        { spreadBps: 80, depthUsd: 50000, volatility: 20, sizeTier: 4, gasPrice: 120, timeOfDay: 9, dayOfWeek: 1 },
        // Low liquidity
        { spreadBps: 90, depthUsd: 2000, volatility: 35, sizeTier: 1, gasPrice: 30, timeOfDay: 16, dayOfWeek: 4 }
      ];

      const startTime = performance.now();
      
      const predictions = await Promise.all(
        tradingScenarios.map(scenario => model.score(scenario))
      );
      
      const endTime = performance.now();
      const predictionTime = endTime - startTime;
      
      expect(predictions).toHaveLength(5);
      expect(predictionTime).toBeLessThan(100); // Should be very fast for real-time usage
      
      // Predictions should make sense relative to market conditions
      expect(predictions[1]).toBeGreaterThan(predictions[0]); // Good conditions > high volatility
      expect(predictions[1]).toBeGreaterThan(predictions[4]); // High liquidity > low liquidity
      
      predictions.forEach(prediction => {
        expect(prediction).toBeGreaterThanOrEqual(0);
        expect(prediction).toBeLessThanOrEqual(1);
      });
    });

    it('should handle rapid decision making for arbitrage', async () => {
      // Simulate rapid arbitrage opportunity evaluation
      const opportunities: FeatureVector[] = Array.from({ length: 1000 }, (_, i) => ({
        spreadBps: 10 + Math.random() * 90, // 10-100 bps spread
        depthUsd: 1000 + Math.random() * 99000, // $1k-$100k depth
        volatility: Math.random() * 50, // 0-50% volatility
        sizeTier: Math.floor(Math.random() * 4) + 1, // 1-4 size tier
        gasPrice: 10 + Math.random() * 90, // 10-100 gwei
        timeOfDay: Math.random() * 24, // Any time
        dayOfWeek: Math.floor(Math.random() * 7) // Any day
      }));

      const startTime = performance.now();
      
      // Evaluate all opportunities
      const scores = await Promise.all(
        opportunities.map(opp => model.score(opp))
      );
      
      const endTime = performance.now();
      const evaluationTime = endTime - startTime;
      
      expect(scores).toHaveLength(1000);
      expect(evaluationTime).toBeLessThan(1000); // Should complete within 1 second for real-time trading
      
      // Find best opportunities (top 10%)
      const scoredOpportunities = opportunities.map((opp, i) => ({
        opportunity: opp,
        score: scores[i]
      }));
      
      scoredOpportunities.sort((a, b) => b.score - a.score);
      const topOpportunities = scoredOpportunities.slice(0, 100);
      
      // Top opportunities should generally have better characteristics
      const avgTopSpread = topOpportunities.reduce((sum, item) => sum + item.opportunity.spreadBps, 0) / 100;
      const avgBottomSpread = scoredOpportunities.slice(-100).reduce((sum, item) => sum + item.opportunity.spreadBps, 0) / 100;
      
      expect(avgTopSpread).toBeGreaterThan(avgBottomSpread);
    });
  });

  // Helper function to create valid feature vectors
  function createValidFeature(): FeatureVector {
    return {
      spreadBps: 50,
      depthUsd: 10000,
      volatility: 20,
      sizeTier: 3,
      gasPrice: 30,
      timeOfDay: 14,
      dayOfWeek: 2
    };
  }
});