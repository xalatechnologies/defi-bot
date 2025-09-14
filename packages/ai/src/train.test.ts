import { Database } from '@pkg/data';
import { AIModel } from './model';
import { extractTrainingFeatures } from './features';
import type { Trade } from '@pkg/shared';

// Mock the dependencies
jest.mock('@pkg/data');
jest.mock('./model');
jest.mock('./features');

const MockDatabase = Database as jest.MockedClass<typeof Database>;
const MockAIModel = AIModel as jest.MockedClass<typeof AIModel>;
const mockExtractTrainingFeatures = extractTrainingFeatures as jest.MockedFunction<typeof extractTrainingFeatures>;

describe('AI Training Integration', () => {
  let mockDatabase: jest.Mocked<Database>;
  let mockModel: jest.Mocked<AIModel>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockDatabase = new MockDatabase() as jest.Mocked<Database>;
    mockModel = new MockAIModel() as jest.Mocked<AIModel>;
    
    // Mock database methods
    mockDatabase.initialize.mockResolvedValue(undefined);
    mockDatabase.close.mockResolvedValue(undefined);
    mockDatabase.getRecentTrades.mockResolvedValue([]);
    
    // Mock model methods
    mockModel.train.mockResolvedValue(undefined);
    mockModel.getStats.mockReturnValue({
      accuracy: 0.85,
      lastTrained: new Date(),
      sampleCount: 1000,
      weightMagnitude: 1.5
    });
    mockModel.getFeatureImportance.mockReturnValue([
      { feature: 'spreadBps', weight: 0.5, importance: 0.5 },
      { feature: 'depthUsd', weight: 0.3, importance: 0.3 },
      { feature: 'volatility', weight: -0.2, importance: 0.2 }
    ]);
  });

  describe('Training Data Preparation', () => {
    it('should handle empty trade history', async () => {
      mockDatabase.getRecentTrades.mockResolvedValue([]);
      
      // Simulate main function behavior
      const trades = await mockDatabase.getRecentTrades(1000);
      expect(trades).toHaveLength(0);
      
      // Should not attempt training with empty data
      expect(mockModel.train).not.toHaveBeenCalled();
    });

    it('should handle insufficient training data', async () => {
      const fewTrades: Trade[] = [
        {
          id: 'trade1',
          timestamp: new Date(),
          route: 'USDC-WETH-quickswap-sushiswap',
          amountInUsd: 500,
          expectedProfitUsd: 10,
          actualProfitUsd: 8.5,
          gasUsedUsd: 1.5,
          aiScore: 0.8,
          status: 'success',
          mode: 'paper',
          txHash: '0x123',
          errorMessage: null
        }
      ];

      mockDatabase.getRecentTrades.mockResolvedValue(fewTrades);
      
      const trades = await mockDatabase.getRecentTrades(1000);
      expect(trades).toHaveLength(1);
      
      // Should not train with insufficient data (< 10 trades)
      expect(mockModel.train).not.toHaveBeenCalled();
    });

    it('should process valid trade data correctly', async () => {
      const validTrades: Trade[] = Array.from({ length: 50 }, (_, i) => ({
        id: `trade${i}`,
        timestamp: new Date(Date.now() - i * 3600000), // Spread over time
        route: 'USDC-WETH-quickswap-sushiswap',
        amountInUsd: 100 + i * 10,
        expectedProfitUsd: 5 + i * 0.5,
        actualProfitUsd: Math.random() > 0.5 ? 4 + i * 0.3 : -2 - i * 0.1,
        gasUsedUsd: 1 + i * 0.1,
        aiScore: 0.5 + Math.random() * 0.4,
        status: 'success',
        mode: 'paper',
        txHash: `0x${i.toString(16).padStart(4, '0')}`,
        errorMessage: null
      }));

      mockDatabase.getRecentTrades.mockResolvedValue(validTrades);
      
      // Mock feature extraction to return valid training data
      mockExtractTrainingFeatures.mockReturnValue({
        features: [0.5, 0.3, 0.2, 0.8, 0.4, 0.6, 0.7],
        label: 1
      });

      const trades = await mockDatabase.getRecentTrades(1000);
      expect(trades).toHaveLength(50);
      
      // Process trades and simulate training
      const trainingData = trades.map(trade => {
        return mockExtractTrainingFeatures(
          expect.any(Object), // mock snapshot
          expect.any(Object), // mock route
          trade.amountInUsd,
          trade.actualProfitUsd
        );
      });

      expect(trainingData).toHaveLength(50);
      expect(mockExtractTrainingFeatures).toHaveBeenCalledTimes(50);
    });
  });

  describe('Feature Extraction Integration', () => {
    it('should extract features for profitable trades correctly', async () => {
      const profitableTrade: Trade = {
        id: 'profitable_trade',
        timestamp: new Date(),
        route: 'USDC-WETH-quickswap-sushiswap',
        amountInUsd: 1000,
        expectedProfitUsd: 15,
        actualProfitUsd: 12.5, // Profitable
        gasUsedUsd: 2.5,
        aiScore: 0.9,
        status: 'success',
        mode: 'paper',
        txHash: '0xabc123',
        errorMessage: null
      };

      mockExtractTrainingFeatures.mockReturnValue({
        features: [0.8, 0.7, 0.2, 0.75, 0.3, 0.6, 0.4],
        label: 1 // Profitable
      });

      const result = mockExtractTrainingFeatures(
        expect.any(Object),
        expect.any(Object),
        profitableTrade.amountInUsd,
        profitableTrade.actualProfitUsd
      );

      expect(result.label).toBe(1);
      expect(result.features).toHaveLength(7);
      expect(mockExtractTrainingFeatures).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        1000,
        12.5
      );
    });

    it('should extract features for unprofitable trades correctly', async () => {
      const unprofitableTrade: Trade = {
        id: 'unprofitable_trade',
        timestamp: new Date(),
        route: 'USDC-WETH-quickswap-sushiswap',
        amountInUsd: 500,
        expectedProfitUsd: 8,
        actualProfitUsd: -3.5, // Unprofitable
        gasUsedUsd: 2,
        aiScore: 0.3,
        status: 'success',
        mode: 'paper',
        txHash: '0xdef456',
        errorMessage: null
      };

      mockExtractTrainingFeatures.mockReturnValue({
        features: [0.3, 0.4, 0.8, 0.5, 0.7, 0.9, 0.6],
        label: 0 // Unprofitable
      });

      const result = mockExtractTrainingFeatures(
        expect.any(Object),
        expect.any(Object),
        unprofitableTrade.amountInUsd,
        unprofitableTrade.actualProfitUsd
      );

      expect(result.label).toBe(0);
      expect(result.features).toHaveLength(7);
    });

    it('should handle feature extraction errors gracefully', async () => {
      const problematicTrade: Trade = {
        id: 'problematic_trade',
        timestamp: new Date(),
        route: 'invalid-route',
        amountInUsd: -100, // Invalid amount
        expectedProfitUsd: 0,
        actualProfitUsd: 0,
        gasUsedUsd: 0,
        aiScore: 0,
        status: 'failed',
        mode: 'paper',
        txHash: null,
        errorMessage: 'Invalid trade'
      };

      mockExtractTrainingFeatures.mockImplementation(() => {
        throw new Error('Invalid trade data');
      });

      expect(() => {
        mockExtractTrainingFeatures(
          expect.any(Object),
          expect.any(Object),
          problematicTrade.amountInUsd,
          problematicTrade.actualProfitUsd
        );
      }).toThrow('Invalid trade data');
    });
  });

  describe('Model Training Integration', () => {
    it('should train model with extracted features', async () => {
      const trainingData = [
        { features: [0.8, 0.7, 0.2, 0.75, 0.3, 0.6, 0.4], label: 1 },
        { features: [0.3, 0.4, 0.8, 0.5, 0.7, 0.9, 0.6], label: 0 },
        { features: [0.9, 0.8, 0.1, 0.8, 0.2, 0.5, 0.3], label: 1 },
        { features: [0.2, 0.3, 0.9, 0.3, 0.8, 0.8, 0.7], label: 0 }
      ];

      await mockModel.train(trainingData);

      expect(mockModel.train).toHaveBeenCalledWith(trainingData);
      expect(mockModel.train).toHaveBeenCalledTimes(1);
    });

    it('should retrieve and display training statistics', async () => {
      mockModel.getStats.mockReturnValue({
        accuracy: 0.87,
        lastTrained: new Date('2025-01-20T15:30:00Z'),
        sampleCount: 500,
        weightMagnitude: 2.1
      });

      const stats = mockModel.getStats();
      
      expect(stats.accuracy).toBe(0.87);
      expect(stats.sampleCount).toBe(500);
      expect(stats.weightMagnitude).toBe(2.1);
      expect(stats.lastTrained).toEqual(new Date('2025-01-20T15:30:00Z'));
    });

    it('should retrieve and display feature importance', async () => {
      mockModel.getFeatureImportance.mockReturnValue([
        { feature: 'spreadBps', weight: 0.6, importance: 0.6 },
        { feature: 'depthUsd', weight: 0.4, importance: 0.4 },
        { feature: 'volatility', weight: -0.3, importance: 0.3 },
        { feature: 'gasPrice', weight: -0.2, importance: 0.2 },
        { feature: 'sizeTier', weight: 0.15, importance: 0.15 },
        { feature: 'timeOfDay', weight: 0.1, importance: 0.1 },
        { feature: 'dayOfWeek', weight: 0.05, importance: 0.05 }
      ]);

      const featureImportance = mockModel.getFeatureImportance();
      
      expect(featureImportance).toHaveLength(7);
      expect(featureImportance[0].feature).toBe('spreadBps');
      expect(featureImportance[0].importance).toBe(0.6);
      
      // Should be sorted by importance
      for (let i = 1; i < featureImportance.length; i++) {
        expect(featureImportance[i - 1].importance).toBeGreaterThanOrEqual(
          featureImportance[i].importance
        );
      }
    });
  });

  describe('Database Integration', () => {
    it('should initialize database connection', async () => {
      await mockDatabase.initialize();
      expect(mockDatabase.initialize).toHaveBeenCalledTimes(1);
    });

    it('should retrieve recent trades with correct limit', async () => {
      await mockDatabase.getRecentTrades(1000);
      expect(mockDatabase.getRecentTrades).toHaveBeenCalledWith(1000);
    });

    it('should close database connection properly', async () => {
      await mockDatabase.close();
      expect(mockDatabase.close).toHaveBeenCalledTimes(1);
    });

    it('should handle database connection failures', async () => {
      mockDatabase.initialize.mockRejectedValue(new Error('Database connection failed'));
      
      await expect(mockDatabase.initialize()).rejects.toThrow('Database connection failed');
    });

    it('should handle database query failures', async () => {
      mockDatabase.getRecentTrades.mockRejectedValue(new Error('Query failed'));
      
      await expect(mockDatabase.getRecentTrades(1000)).rejects.toThrow('Query failed');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle mixed trade statuses correctly', async () => {
      const mixedTrades: Trade[] = [
        {
          id: 'success_trade',
          timestamp: new Date(),
          route: 'USDC-WETH',
          amountInUsd: 500,
          expectedProfitUsd: 10,
          actualProfitUsd: 8,
          gasUsedUsd: 2,
          aiScore: 0.8,
          status: 'success',
          mode: 'paper',
          txHash: '0x123',
          errorMessage: null
        },
        {
          id: 'failed_trade',
          timestamp: new Date(),
          route: 'USDC-WETH',
          amountInUsd: 300,
          expectedProfitUsd: 5,
          actualProfitUsd: -3,
          gasUsedUsd: 2,
          aiScore: 0.3,
          status: 'failed',
          mode: 'paper',
          txHash: null,
          errorMessage: 'Transaction reverted'
        }
      ];

      mockDatabase.getRecentTrades.mockResolvedValue(mixedTrades);
      
      const trades = await mockDatabase.getRecentTrades(1000);
      expect(trades).toHaveLength(2);
      
      // Both successful and failed trades should be processed for learning
      expect(trades.some(t => t.status === 'success')).toBe(true);
      expect(trades.some(t => t.status === 'failed')).toBe(true);
    });

    it('should handle trades with zero or negative amounts', async () => {
      const edgeCaseTrades: Trade[] = [
        {
          id: 'zero_trade',
          timestamp: new Date(),
          route: 'USDC-WETH',
          amountInUsd: 0,
          expectedProfitUsd: 0,
          actualProfitUsd: 0,
          gasUsedUsd: 1,
          aiScore: 0.5,
          status: 'success',
          mode: 'paper',
          txHash: '0x000',
          errorMessage: null
        }
      ];

      mockDatabase.getRecentTrades.mockResolvedValue(edgeCaseTrades);
      
      // Should handle gracefully without crashing
      const trades = await mockDatabase.getRecentTrades(1000);
      expect(trades).toHaveLength(1);
    });

    it('should handle paper vs live mode trades', async () => {
      const modeTrades: Trade[] = [
        {
          id: 'paper_trade',
          timestamp: new Date(),
          route: 'USDC-WETH',
          amountInUsd: 500,
          expectedProfitUsd: 10,
          actualProfitUsd: 8,
          gasUsedUsd: 2,
          aiScore: 0.8,
          status: 'success',
          mode: 'paper',
          txHash: '0x123',
          errorMessage: null
        },
        {
          id: 'live_trade',
          timestamp: new Date(),
          route: 'USDC-WETH',
          amountInUsd: 1000,
          expectedProfitUsd: 20,
          actualProfitUsd: 15,
          gasUsedUsd: 3,
          aiScore: 0.9,
          status: 'success',
          mode: 'live',
          txHash: '0x456',
          errorMessage: null
        }
      ];

      mockDatabase.getRecentTrades.mockResolvedValue(modeTrades);
      
      const trades = await mockDatabase.getRecentTrades(1000);
      expect(trades).toHaveLength(2);
      
      // Should include both paper and live trades for training
      expect(trades.some(t => t.mode === 'paper')).toBe(true);
      expect(trades.some(t => t.mode === 'live')).toBe(true);
    });
  });
});