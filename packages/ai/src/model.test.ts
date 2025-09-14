import fs from 'fs/promises';
import path from 'path';
import { AIModel } from './model';
import type { FeatureVector, AIModelState } from '@pkg/shared';

// Mock fs module for testing
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('AIModel', () => {
  let model: AIModel;
  let tempModelPath: string;

  beforeEach(() => {
    jest.clearAllMocks();
    tempModelPath = '/tmp/test-model.json';
    model = new AIModel(tempModelPath);
  });

  describe('Model Initialization and Loading', () => {
    it('should initialize with default weights when no model file exists', async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      
      await model.load();
      
      const stats = model.getStats();
      expect(stats.accuracy).toBe(0.5); // Default baseline
      expect(stats.sampleCount).toBe(0);
    });

    it('should load existing model successfully', async () => {
      const mockModelState: AIModelState = {
        weights: [0.1, 0.2, -0.1, 0.05, -0.05, 0.02, 0.01],
        bias: 0.1,
        accuracy: 0.85,
        lastTrained: new Date('2025-01-20T12:00:00Z'),
        sampleCount: 1000
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(mockModelState));
      
      await model.load();
      
      const stats = model.getStats();
      expect(stats.accuracy).toBe(0.85);
      expect(stats.sampleCount).toBe(1000);
      expect(stats.lastTrained).toEqual(new Date('2025-01-20T12:00:00Z'));
    });

    it('should handle corrupted model files gracefully', async () => {
      mockFs.readFile.mockResolvedValue('invalid json');
      
      await expect(model.load()).rejects.toThrow();
    });
  });

  describe('Model Scoring', () => {
    beforeEach(async () => {
      // Initialize with known weights for predictable testing
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await model.load();
    });

    it('should return probabilities between 0 and 1', async () => {
      const testFeatures: FeatureVector = {
        spreadBps: 50,
        depthUsd: 10000,
        volatility: 20,
        sizeTier: 3,
        gasPrice: 30,
        timeOfDay: 14,
        dayOfWeek: 2
      };

      const score = await model.score(testFeatures);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      expect(typeof score).toBe('number');
      expect(isNaN(score)).toBe(false);
    });

    it('should be deterministic for same inputs', async () => {
      const testFeatures: FeatureVector = {
        spreadBps: 75,
        depthUsd: 25000,
        volatility: 15,
        sizeTier: 2,
        gasPrice: 25,
        timeOfDay: 10.5,
        dayOfWeek: 1
      };

      const score1 = await model.score(testFeatures);
      const score2 = await model.score(testFeatures);
      
      expect(score1).toBe(score2);
    });

    it('should handle extreme feature values', async () => {
      const extremeFeatures: FeatureVector = {
        spreadBps: 1000,
        depthUsd: 1000000,
        volatility: 100,
        sizeTier: 4,
        gasPrice: 200,
        timeOfDay: 23.99,
        dayOfWeek: 6
      };

      const score = await model.score(extremeFeatures);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      expect(isFinite(score)).toBe(true);
    });

    it('should handle zero features', async () => {
      const zeroFeatures: FeatureVector = {
        spreadBps: 0,
        depthUsd: 0,
        volatility: 0,
        sizeTier: 0,
        gasPrice: 0,
        timeOfDay: 0,
        dayOfWeek: 0
      };

      const score = await model.score(zeroFeatures);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      expect(isFinite(score)).toBe(true);
    });

    it('should load model automatically on first score call', async () => {
      const newModel = new AIModel(tempModelPath);
      mockFs.readFile.mockRejectedValue(new Error('File not found'));

      const testFeatures: FeatureVector = {
        spreadBps: 50,
        depthUsd: 10000,
        volatility: 20,
        sizeTier: 3,
        gasPrice: 30,
        timeOfDay: 14,
        dayOfWeek: 2
      };

      const score = await newModel.score(testFeatures);
      
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      expect(mockFs.readFile).toHaveBeenCalledWith(tempModelPath, 'utf-8');
    });
  });

  describe('Model Training', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await model.load();
    });

    it('should train successfully with sufficient data', async () => {
      const trainingData = [
        { features: [0.8, 0.6, 0.2, 0.5, 0.3, 0.5, 0.2], label: 1 },
        { features: [0.2, 0.3, 0.8, 0.2, 0.7, 0.8, 0.9], label: 0 },
        { features: [0.9, 0.8, 0.1, 0.8, 0.2, 0.3, 0.1], label: 1 },
        { features: [0.1, 0.2, 0.9, 0.1, 0.9, 0.7, 0.8], label: 0 },
        { features: [0.7, 0.7, 0.3, 0.6, 0.4, 0.4, 0.3], label: 1 },
        { features: [0.3, 0.4, 0.7, 0.3, 0.6, 0.6, 0.7], label: 0 },
        { features: [0.85, 0.75, 0.15, 0.7, 0.25, 0.35, 0.2], label: 1 },
        { features: [0.15, 0.25, 0.85, 0.2, 0.8, 0.65, 0.75], label: 0 },
        { features: [0.6, 0.9, 0.4, 0.9, 0.1, 0.2, 0.4], label: 1 },
        { features: [0.4, 0.1, 0.6, 0.4, 0.85, 0.9, 0.6], label: 0 }
      ];

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await model.train(trainingData);

      const stats = model.getStats();
      expect(stats.sampleCount).toBe(trainingData.length);
      expect(stats.accuracy).toBeGreaterThanOrEqual(0);
      expect(stats.accuracy).toBeLessThanOrEqual(1);
      expect(stats.lastTrained.getTime()).toBeCloseTo(Date.now(), -3); // Within last few seconds
    });

    it('should handle insufficient training data', async () => {
      const insufficientData: Array<{ features: number[]; label: number }> = [];

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await model.train(insufficientData);

      // Should complete without error but not improve much
      const stats = model.getStats();
      expect(stats.sampleCount).toBe(0);
    });

    it('should improve accuracy with good training data', async () => {
      // Create training data with clear patterns
      const perfectData = [
        { features: [1, 1, 0, 1, 0, 0.5, 0.5], label: 1 },
        { features: [1, 1, 0, 1, 0, 0.5, 0.5], label: 1 },
        { features: [1, 1, 0, 1, 0, 0.5, 0.5], label: 1 },
        { features: [1, 1, 0, 1, 0, 0.5, 0.5], label: 1 },
        { features: [1, 1, 0, 1, 0, 0.5, 0.5], label: 1 },
        { features: [0, 0, 1, 0, 1, 0.5, 0.5], label: 0 },
        { features: [0, 0, 1, 0, 1, 0.5, 0.5], label: 0 },
        { features: [0, 0, 1, 0, 1, 0.5, 0.5], label: 0 },
        { features: [0, 0, 1, 0, 1, 0.5, 0.5], label: 0 },
        { features: [0, 0, 1, 0, 1, 0.5, 0.5], label: 0 }
      ];

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await model.train(perfectData);

      const stats = model.getStats();
      expect(stats.accuracy).toBeGreaterThan(0.7); // Should achieve good accuracy with clear patterns
    });

    it('should update weights during training', async () => {
      const initialStats = model.getStats();
      const initialWeightMagnitude = initialStats.weightMagnitude;

      const trainingData = [
        { features: [0.8, 0.6, 0.2, 0.5, 0.3, 0.5, 0.2], label: 1 },
        { features: [0.2, 0.3, 0.8, 0.2, 0.7, 0.8, 0.9], label: 0 },
        { features: [0.9, 0.8, 0.1, 0.8, 0.2, 0.3, 0.1], label: 1 },
        { features: [0.1, 0.2, 0.9, 0.1, 0.9, 0.7, 0.8], label: 0 }
      ];

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await model.train(trainingData);

      const finalStats = model.getStats();
      // Weights should have changed during training
      expect(finalStats.weightMagnitude).not.toBe(initialWeightMagnitude);
    });
  });

  describe('Model Persistence', () => {
    it('should save model successfully', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await model.save();

      expect(mockFs.mkdir).toHaveBeenCalledWith(path.dirname(tempModelPath), { recursive: true });
      expect(mockFs.writeFile).toHaveBeenCalledWith(
        tempModelPath,
        expect.stringContaining('"weights"'),
        
      );
    });

    it('should preserve model state through save/load cycle', async () => {
      // Train model first
      const trainingData = [
        { features: [0.8, 0.6, 0.2, 0.5, 0.3, 0.5, 0.2], label: 1 },
        { features: [0.2, 0.3, 0.8, 0.2, 0.7, 0.8, 0.9], label: 0 },
        { features: [0.9, 0.8, 0.1, 0.8, 0.2, 0.3, 0.1], label: 1 },
        { features: [0.1, 0.2, 0.9, 0.1, 0.9, 0.7, 0.8], label: 0 }
      ];

      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await model.load();
      await model.train(trainingData);
      
      const originalStats = model.getStats();
      const originalFeatureImportance = model.getFeatureImportance();

      // Capture the saved state
      let savedState: string = '';
      mockFs.writeFile.mockImplementation(async (_, content) => {
        savedState = content as string;
      });

      await model.save();

      // Create new model and load the saved state
      const newModel = new AIModel(tempModelPath);
      mockFs.readFile.mockResolvedValue(savedState);
      
      await newModel.load();

      const loadedStats = newModel.getStats();
      const loadedFeatureImportance = newModel.getFeatureImportance();

      expect(loadedStats.accuracy).toBe(originalStats.accuracy);
      expect(loadedStats.sampleCount).toBe(originalStats.sampleCount);
      expect(loadedStats.weightMagnitude).toBeCloseTo(originalStats.weightMagnitude, 6);
      expect(loadedFeatureImportance).toEqual(originalFeatureImportance);
    });

    it('should handle save errors gracefully', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(model.save()).rejects.toThrow('Permission denied');
    });
  });

  describe('Model Statistics and Feature Importance', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await model.load();
    });

    it('should return accurate statistics', () => {
      const stats = model.getStats();

      expect(stats).toHaveProperty('accuracy');
      expect(stats).toHaveProperty('lastTrained');
      expect(stats).toHaveProperty('sampleCount');
      expect(stats).toHaveProperty('weightMagnitude');

      expect(typeof stats.accuracy).toBe('number');
      expect(stats.lastTrained instanceof Date).toBe(true);
      expect(typeof stats.sampleCount).toBe('number');
      expect(typeof stats.weightMagnitude).toBe('number');

      expect(stats.accuracy).toBeGreaterThanOrEqual(0);
      expect(stats.accuracy).toBeLessThanOrEqual(1);
      expect(stats.sampleCount).toBeGreaterThanOrEqual(0);
      expect(stats.weightMagnitude).toBeGreaterThanOrEqual(0);
    });

    it('should return feature importance ranking', () => {
      const featureImportance = model.getFeatureImportance();

      expect(Array.isArray(featureImportance)).toBe(true);
      expect(featureImportance).toHaveLength(7);

      featureImportance.forEach(feature => {
        expect(feature).toHaveProperty('feature');
        expect(feature).toHaveProperty('weight');
        expect(feature).toHaveProperty('importance');

        expect(typeof feature.feature).toBe('string');
        expect(typeof feature.weight).toBe('number');
        expect(typeof feature.importance).toBe('number');
        expect(feature.importance).toBeGreaterThanOrEqual(0);
      });

      // Should be sorted by importance (descending)
      for (let i = 1; i < featureImportance.length; i++) {
        expect(featureImportance[i - 1].importance).toBeGreaterThanOrEqual(
          featureImportance[i].importance
        );
      }
    });

    it('should have correct feature names', () => {
      const featureImportance = model.getFeatureImportance();
      const expectedFeatures = [
        'spreadBps',
        'depthUsd',
        'volatility',
        'sizeTier',
        'gasPrice',
        'timeOfDay',
        'dayOfWeek'
      ];

      const actualFeatures = featureImportance.map(f => f.feature);
      expectedFeatures.forEach(expectedFeature => {
        expect(actualFeatures).toContain(expectedFeature);
      });
    });
  });

  describe('Model Retrain Functionality', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      await model.load();
    });

    it('should retrain with mock data', async () => {
      const initialStats = model.getStats();
      
      await model.retrain();

      const newStats = model.getStats();
      expect(newStats.sampleCount).toBeGreaterThan(initialStats.sampleCount);
      expect(newStats.lastTrained.getTime()).toBeGreaterThan(initialStats.lastTrained.getTime());
    });
  });

  describe('Integration and Real-world Scenarios', () => {
    beforeEach(async () => {
      mockFs.readFile.mockRejectedValue(new Error('File not found'));
      await model.load();
    });

    it('should make consistent predictions for trading scenarios', async () => {
      const goodTradeFeatures: FeatureVector = {
        spreadBps: 80, // High spread
        depthUsd: 50000, // Good liquidity
        volatility: 10, // Low volatility
        sizeTier: 2, // Medium size
        gasPrice: 20, // Low gas
        timeOfDay: 14, // Peak trading hours
        dayOfWeek: 2 // Weekday
      };

      const badTradeFeatures: FeatureVector = {
        spreadBps: 5, // Low spread
        depthUsd: 1000, // Poor liquidity
        volatility: 45, // High volatility
        sizeTier: 4, // Large size
        gasPrice: 80, // High gas
        timeOfDay: 3, // Off-peak hours
        dayOfWeek: 6 // Weekend
      };

      const goodScore = await model.score(goodTradeFeatures);
      const badScore = await model.score(badTradeFeatures);

      // Good trade should score higher than bad trade
      expect(goodScore).toBeGreaterThan(badScore);
    });

    it('should handle typical trading feature ranges', async () => {
      const typicalFeatures: FeatureVector = {
        spreadBps: 25,
        depthUsd: 15000,
        volatility: 30,
        sizeTier: 2,
        gasPrice: 35,
        timeOfDay: 16.5,
        dayOfWeek: 3
      };

      const score = await model.score(typicalFeatures);
      
      expect(score).toBeGreaterThan(0.1); // Should not be too pessimistic
      expect(score).toBeLessThan(0.9); // Should not be too optimistic
    });
  });
});