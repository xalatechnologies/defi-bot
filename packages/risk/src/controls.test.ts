import { RiskManager, type RiskLimits, type RiskState } from './controls';
import type { Config, Trade, DailyStats } from '@pkg/shared';

// Mock Database class
class MockDatabase {
  private trades: Trade[] = [];
  private dailyStats: DailyStats = {
    date: new Date().toISOString().split('T')[0],
    dailyPnl: 0,
    tradeCount: 0,
    winRate: 0,
    avgProfit: 0,
    gasSpent: 0
  };
  private riskEvents: Array<{eventType: string, description: string, data?: any}> = [];

  async getDailyStats(date?: Date): Promise<DailyStats> {
    return { ...this.dailyStats };
  }

  async getRecentTrades(limit: number): Promise<Trade[]> {
    return [...this.trades].slice(-limit);
  }

  async recordRiskEvent(eventType: string, description: string, data?: any): Promise<void> {
    this.riskEvents.push({ eventType, description, data });
  }

  // Test helpers
  setDailyStats(stats: Partial<DailyStats>) {
    this.dailyStats = { ...this.dailyStats, ...stats };
  }

  setTrades(trades: Trade[]) {
    this.trades = [...trades];
  }

  getRiskEvents() {
    return [...this.riskEvents];
  }

  clearRiskEvents() {
    this.riskEvents = [];
  }
}

// Mock Config
const createMockConfig = (overrides: Partial<Config> = {}): Config => ({
  NODE_ENV: 'test',
  CHAIN: 'polygon',
  RPC_HTTP: 'http://localhost:8545',
  RPC_WS: 'ws://localhost:8545',
  WALLET_PRIVATE_KEY: '0x1234567890123456789012345678901234567890123456789012345678901234',
  MIN_PROFIT_USD: 1,
  MAX_DAILY_LOSS_USD: 100,
  MAX_NOTIONAL_USD: 500,
  SLIPPAGE_BPS: 50,
  GAS_PRICE_MULTIPLIER: 1.2,
  MODE: 'paper' as const,
  PORT: 3000,
  USE_OPENAI: false,
  ...overrides
});

// Helper to create mock trades
const createMockTrade = (overrides: Partial<Trade> = {}): Trade => ({
  id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  timestamp: new Date(),
  route: 'USDC→ETH→USDC',
  amountInUsd: 100,
  expectedProfitUsd: 2,
  actualProfitUsd: 1.5,
  gasUsedUsd: 0.5,
  aiScore: 0.8,
  status: 'success' as const,
  mode: 'paper' as const,
  txHash: null,
  errorMessage: null,
  ...overrides
});

describe('RiskManager - Daily Loss Caps & PnL Tracking', () => {
  let mockDatabase: MockDatabase;
  let riskManager: RiskManager;
  let config: Config;

  beforeEach(() => {
    mockDatabase = new MockDatabase();
    config = createMockConfig();
    riskManager = new RiskManager(config, mockDatabase as any);
  });

  describe('Daily PnL Initialization', () => {
    it('should initialize daily PnL from database on startup', async () => {
      // Setup database with existing daily stats
      mockDatabase.setDailyStats({ dailyPnl: -50, tradeCount: 10 });
      
      // Create new risk manager to test initialization
      const newRiskManager = new RiskManager(config, mockDatabase as any);
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const state = newRiskManager.getState();
      expect(state.dailyPnl).toBe(-50);
    });

    it('should initialize consecutive losses from recent trades', async () => {
      const losingTrades = [
        createMockTrade({ actualProfitUsd: -2 }),
        createMockTrade({ actualProfitUsd: -1.5 }),
        createMockTrade({ actualProfitUsd: -1 }),
        createMockTrade({ actualProfitUsd: 1 }), // This breaks the streak
      ];
      mockDatabase.setTrades(losingTrades);
      
      const newRiskManager = new RiskManager(config, mockDatabase as any);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const state = newRiskManager.getState();
      expect(state.consecutiveLosses).toBe(3); // First 3 trades are losses
    });

    it('should handle database initialization errors gracefully', async () => {
      const failingDatabase = {
        getDailyStats: jest.fn().mockRejectedValue(new Error('DB Error')),
        getRecentTrades: jest.fn().mockRejectedValue(new Error('DB Error')),
        recordRiskEvent: jest.fn()
      };
      
      // Should not throw during construction
      expect(() => {
        new RiskManager(config, failingDatabase as any);
      }).not.toThrow();
    });
  });

  describe('Daily Loss Limit Enforcement', () => {
    it('should block trades that would exceed daily loss limit', async () => {
      mockDatabase.setDailyStats({ dailyPnl: -90 }); // Already at -90 USD
      
      const canTrade = await riskManager.canTrade(100, -15); // Would result in -105 total
      expect(canTrade).toBe(false);
    });

    it('should allow trades within daily loss limit', async () => {
      mockDatabase.setDailyStats({ dailyPnl: -50 });
      
      const canTrade = await riskManager.canTrade(100, -30); // Would result in -80 total
      expect(canTrade).toBe(true);
    });

    it('should allow profitable trades even when near daily limit', async () => {
      mockDatabase.setDailyStats({ dailyPnl: -99 });
      
      const canTrade = await riskManager.canTrade(100, 5); // Profitable trade
      expect(canTrade).toBe(true);
    });

    it('should trigger kill switch when daily limit exceeded during trade recording', async () => {
      const trade = createMockTrade({ actualProfitUsd: -100 });
      
      await riskManager.recordTrade(trade);
      
      const state = riskManager.getState();
      expect(state.isKilled).toBe(true);
      expect(state.killReason).toBe('Daily loss limit exceeded');
    });
  });

  describe('PnL Updates After Trade Recording', () => {
    it('should update daily PnL after profitable trade', async () => {
      const trade = createMockTrade({ actualProfitUsd: 5 });
      
      await riskManager.recordTrade(trade);
      
      const state = riskManager.getState();
      expect(state.dailyPnl).toBe(5);
    });

    it('should update daily PnL after losing trade', async () => {
      const trade = createMockTrade({ actualProfitUsd: -3 });
      
      await riskManager.recordTrade(trade);
      
      const state = riskManager.getState();
      expect(state.dailyPnl).toBe(-3);
    });

    it('should accumulate multiple trades correctly', async () => {
      const trades = [
        createMockTrade({ actualProfitUsd: 5 }),
        createMockTrade({ actualProfitUsd: -2 }),
        createMockTrade({ actualProfitUsd: 3 }),
        createMockTrade({ actualProfitUsd: -1 }),
      ];
      
      for (const trade of trades) {
        await riskManager.recordTrade(trade);
      }
      
      const state = riskManager.getState();
      expect(state.dailyPnl).toBe(5); // 5 - 2 + 3 - 1 = 5
    });
  });
});

describe('RiskManager - Kill-Switch Functionality', () => {
  let mockDatabase: MockDatabase;
  let riskManager: RiskManager;
  let config: Config;

  beforeEach(() => {
    mockDatabase = new MockDatabase();
    config = createMockConfig();
    riskManager = new RiskManager(config, mockDatabase as any);
  });

  describe('Manual Kill Switch', () => {
    it('should activate kill switch with custom reason', async () => {
      const reason = 'Manual emergency stop';
      
      await riskManager.killSwitch(reason);
      
      const state = riskManager.getState();
      expect(state.isKilled).toBe(true);
      expect(state.killReason).toBe(reason);
    });

    it('should record kill switch event in database', async () => {
      const reason = 'Market anomaly detected';
      
      await riskManager.killSwitch(reason);
      
      const events = mockDatabase.getRiskEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('kill_switch');
      expect(events[0].description).toBe(reason);
    });

    it('should include state data in kill switch event', async () => {
      // Set some state first
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -5 }));
      
      await riskManager.killSwitch('Test reason');
      
      const events = mockDatabase.getRiskEvents();
      expect(events[0].data).toEqual(
        expect.objectContaining({
          dailyPnl: -5,
          consecutiveLosses: 1
        })
      );
    });
  });

  describe('Automatic Kill Switch Triggers', () => {
    it('should trigger kill switch on daily loss limit breach', async () => {
      const trade = createMockTrade({ actualProfitUsd: -100 });
      
      await riskManager.recordTrade(trade);
      
      const state = riskManager.getState();
      expect(state.isKilled).toBe(true);
      expect(state.killReason).toBe('Daily loss limit exceeded');
      
      const events = mockDatabase.getRiskEvents();
      expect(events.some(e => e.eventType === 'kill_switch')).toBe(true);
    });

    it('should not trigger kill switch for profitable trades', async () => {
      const trade = createMockTrade({ actualProfitUsd: 10 });
      
      await riskManager.recordTrade(trade);
      
      const state = riskManager.getState();
      expect(state.isKilled).toBe(false);
    });
  });

  describe('Trading Blockage When Kill Switch Active', () => {
    beforeEach(async () => {
      await riskManager.killSwitch('Test kill');
    });

    it('should block all trades when kill switch is active', async () => {
      const canTrade = await riskManager.canTrade(50, 2);
      expect(canTrade).toBe(false);
    });

    it('should block trades regardless of profitability', async () => {
      const canTradeProfit = await riskManager.canTrade(100, 10);
      const canTradeLoss = await riskManager.canTrade(100, -5);
      
      expect(canTradeProfit).toBe(false);
      expect(canTradeLoss).toBe(false);
    });

    it('should block trades regardless of position size', async () => {
      const canTradeSmall = await riskManager.canTrade(1, 0.1);
      const canTradeLarge = await riskManager.canTrade(1000, 5);
      
      expect(canTradeSmall).toBe(false);
      expect(canTradeLarge).toBe(false);
    });
  });

  describe('Kill Switch Reset', () => {
    beforeEach(async () => {
      await riskManager.killSwitch('Test kill');
    });

    it('should reset kill switch state', async () => {
      await riskManager.resetKillSwitch();
      
      const state = riskManager.getState();
      expect(state.isKilled).toBe(false);
      expect(state.killReason).toBe(null);
    });

    it('should record kill switch reset event', async () => {
      mockDatabase.clearRiskEvents();
      
      await riskManager.resetKillSwitch();
      
      const events = mockDatabase.getRiskEvents();
      expect(events).toHaveLength(1);
      expect(events[0].eventType).toBe('kill_switch_reset');
      expect(events[0].description).toBe('Kill switch manually reset');
    });

    it('should allow trading after reset', async () => {
      await riskManager.resetKillSwitch();
      
      const canTrade = await riskManager.canTrade(100, 2);
      expect(canTrade).toBe(true);
    });
  });

  describe('Emergency Stop', () => {
    it('should activate emergency stop', async () => {
      await riskManager.emergencyStop();
      
      const state = riskManager.getState();
      expect(state.isKilled).toBe(true);
      expect(state.killReason).toBe('Emergency stop activated');
    });

    it('should record emergency stop event', async () => {
      await riskManager.emergencyStop();
      
      const events = mockDatabase.getRiskEvents();
      expect(events.some(e => e.eventType === 'kill_switch')).toBe(true);
      expect(events.find(e => e.eventType === 'kill_switch')?.description)
        .toBe('Emergency stop activated');
    });
  });
});

describe('RiskManager - Position Sizing Controls', () => {
  let mockDatabase: MockDatabase;
  let riskManager: RiskManager;
  let config: Config;

  beforeEach(() => {
    mockDatabase = new MockDatabase();
    config = createMockConfig({ MAX_NOTIONAL_USD: 1000 });
    riskManager = new RiskManager(config, mockDatabase as any);
  });

  describe('Maximum Notional Amount Limits', () => {
    it('should allow trades within notional limit', async () => {
      const canTrade = await riskManager.canTrade(500, 10); // Within 1000 limit
      expect(canTrade).toBe(true);
    });

    it('should block trades exceeding notional limit', async () => {
      const canTrade = await riskManager.canTrade(1500, 10); // Exceeds 1000 limit
      expect(canTrade).toBe(false);
    });

    it('should allow trades exactly at notional limit', async () => {
      const canTrade = await riskManager.canTrade(1000, 10); // Exactly at limit
      expect(canTrade).toBe(true);
    });

    it('should consider notional limit regardless of expected profit', async () => {
      const canTradeHighProfit = await riskManager.canTrade(1500, 100); // High profit but exceeds limit
      const canTradeLoss = await riskManager.canTrade(1500, -50); // Loss and exceeds limit
      
      expect(canTradeHighProfit).toBe(false);
      expect(canTradeLoss).toBe(false);
    });
  });

  describe('Risk Preset Integration', () => {
    it('should use conservative limits when configured', () => {
      const conservativeConfig = createMockConfig({ MAX_NOTIONAL_USD: 100 });
      const conservativeRiskManager = new RiskManager(conservativeConfig, mockDatabase as any);
      
      const limits = conservativeRiskManager.getLimits();
      expect(limits.maxNotionalUsd).toBe(100);
    });

    it('should use aggressive limits when configured', () => {
      const aggressiveConfig = createMockConfig({ MAX_NOTIONAL_USD: 5000 });
      const aggressiveRiskManager = new RiskManager(aggressiveConfig, mockDatabase as any);
      
      const limits = aggressiveRiskManager.getLimits();
      expect(limits.maxNotionalUsd).toBe(5000);
    });

    it('should dynamically update limits', () => {
      const newLimits = { maxNotionalUsd: 2000 };
      
      riskManager.updateLimits(newLimits);
      
      const limits = riskManager.getLimits();
      expect(limits.maxNotionalUsd).toBe(2000);
    });
  });

  describe('Position Size Validation', () => {
    it('should handle zero position size', async () => {
      const canTrade = await riskManager.canTrade(0, 0);
      expect(canTrade).toBe(true);
    });

    it('should handle negative position size gracefully', async () => {
      const canTrade = await riskManager.canTrade(-100, 5);
      expect(canTrade).toBe(true); // Should not crash, may allow or block
    });

    it('should handle very large position sizes', async () => {
      const canTrade = await riskManager.canTrade(1000000, 100);
      expect(canTrade).toBe(false);
    });

    it('should handle fractional position sizes', async () => {
      const canTrade = await riskManager.canTrade(99.99, 1.5);
      expect(canTrade).toBe(true);
    });
  });
});

describe('RiskManager - Consecutive Loss Tracking', () => {
  let mockDatabase: MockDatabase;
  let riskManager: RiskManager;
  let config: Config;

  beforeEach(() => {
    mockDatabase = new MockDatabase();
    config = createMockConfig();
    riskManager = new RiskManager(config, mockDatabase as any);
  });

  describe('Consecutive Loss Counting', () => {
    it('should track consecutive losses correctly', async () => {
      const trades = [
        createMockTrade({ actualProfitUsd: -1 }),
        createMockTrade({ actualProfitUsd: -2 }),
        createMockTrade({ actualProfitUsd: -1.5 }),
      ];
      
      for (const trade of trades) {
        await riskManager.recordTrade(trade);
      }
      
      const state = riskManager.getState();
      expect(state.consecutiveLosses).toBe(3);
    });

    it('should reset consecutive losses after profitable trade', async () => {
      const trades = [
        createMockTrade({ actualProfitUsd: -1 }),
        createMockTrade({ actualProfitUsd: -2 }),
        createMockTrade({ actualProfitUsd: 3 }), // Profitable trade
        createMockTrade({ actualProfitUsd: -1 }),
      ];
      
      for (const trade of trades) {
        await riskManager.recordTrade(trade);
      }
      
      const state = riskManager.getState();
      expect(state.consecutiveLosses).toBe(1); // Only the last losing trade
    });

    it('should handle break-even trades (zero profit)', async () => {
      const trades = [
        createMockTrade({ actualProfitUsd: -1 }),
        createMockTrade({ actualProfitUsd: 0 }), // Break-even
        createMockTrade({ actualProfitUsd: -1 }),
      ];
      
      for (const trade of trades) {
        await riskManager.recordTrade(trade);
      }
      
      const state = riskManager.getState();
      expect(state.consecutiveLosses).toBe(3); // Zero profit counts as loss
    });

    it('should track alternating win/loss sequences', async () => {
      const trades = [
        createMockTrade({ actualProfitUsd: 2 }),  // Win
        createMockTrade({ actualProfitUsd: -1 }), // Loss
        createMockTrade({ actualProfitUsd: 3 }),  // Win
        createMockTrade({ actualProfitUsd: -2 }), // Loss
      ];
      
      for (const trade of trades) {
        await riskManager.recordTrade(trade);
      }
      
      const state = riskManager.getState();
      expect(state.consecutiveLosses).toBe(1); // Only the last loss
    });
  });

  describe('Consecutive Loss Limits', () => {
    beforeEach(() => {
      riskManager.updateLimits({ maxConsecutiveLosses: 3 });
    });

    it('should block trades after reaching consecutive loss limit', async () => {
      // Record 3 consecutive losses
      for (let i = 0; i < 3; i++) {
        await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -1 }));
      }
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(false);
    });

    it('should allow trades just below consecutive loss limit', async () => {
      // Record 2 consecutive losses (below limit of 3)
      for (let i = 0; i < 2; i++) {
        await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -1 }));
      }
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(true);
    });

    it('should allow trades after consecutive losses broken by profit', async () => {
      // Record 3 consecutive losses
      for (let i = 0; i < 3; i++) {
        await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -1 }));
      }
      
      // Record profitable trade
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: 2 }));
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(true);
    });

    it('should handle different consecutive loss limits', async () => {
      riskManager.updateLimits({ maxConsecutiveLosses: 1 });
      
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -1 }));
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(false);
    });
  });

  describe('Risk Event Logging for Consecutive Losses', () => {
    it('should log risk event for 3+ consecutive losses', async () => {
      mockDatabase.clearRiskEvents();
      
      // Record 3 consecutive losses
      for (let i = 0; i < 3; i++) {
        await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -1 }));
      }
      
      const events = mockDatabase.getRiskEvents();
      expect(events.some(e => e.eventType === 'consecutive_losses')).toBe(true);
    });

    it('should not log risk event for less than 3 consecutive losses', async () => {
      mockDatabase.clearRiskEvents();
      
      // Record 2 consecutive losses
      for (let i = 0; i < 2; i++) {
        await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -1 }));
      }
      
      const events = mockDatabase.getRiskEvents();
      expect(events.some(e => e.eventType === 'consecutive_losses')).toBe(false);
    });

    it('should include trade details in consecutive loss event', async () => {
      mockDatabase.clearRiskEvents();
      
      const lastTrade = createMockTrade({ actualProfitUsd: -2, route: 'TEST_ROUTE' });
      
      // Record 3 consecutive losses
      for (let i = 0; i < 2; i++) {
        await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -1 }));
      }
      await riskManager.recordTrade(lastTrade);
      
      const events = mockDatabase.getRiskEvents();
      const consecutiveLossEvent = events.find(e => e.eventType === 'consecutive_losses');
      
      expect(consecutiveLossEvent?.data).toEqual(
        expect.objectContaining({
          consecutiveLosses: 3,
          lastTrade: expect.objectContaining({
            route: 'TEST_ROUTE',
            actualProfitUsd: -2
          })
        })
      );
    });
  });
});

describe('RiskManager - Time-based Controls', () => {
  let mockDatabase: MockDatabase;
  let riskManager: RiskManager;
  let config: Config;

  beforeEach(() => {
    mockDatabase = new MockDatabase();
    config = createMockConfig();
    riskManager = new RiskManager(config, mockDatabase as any);
  });

  describe('Cooldown After Loss', () => {
    beforeEach(() => {
      riskManager.updateLimits({ cooldownAfterLossMs: 60000 }); // 1 minute cooldown
    });

    it('should block trades during cooldown period after loss', async () => {
      // Record a losing trade
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -2 }));
      
      // Try to trade immediately after loss
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(false);
    });

    it('should allow trades after cooldown period expires', async () => {
      // Test with shorter cooldown for faster testing
      riskManager.updateLimits({ cooldownAfterLossMs: 100 }); // 100ms
      
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -2 }));
      
      // Wait for cooldown to pass
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(true);
    });

    it('should not impose cooldown after profitable trades', async () => {
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: 3 }));
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(true);
    });

    it('should reset cooldown after profitable trade', async () => {
      // Record loss
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -2 }));
      
      // Record profit (should reset cooldown)
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: 3 }));
      
      // Should be able to trade immediately
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(true);
    });

    it('should handle different cooldown periods', async () => {
      riskManager.updateLimits({ cooldownAfterLossMs: 5000 }); // 5 seconds
      
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -1 }));
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(false);
    });
  });

  describe('Minimum Time Between Trades', () => {
    beforeEach(() => {
      riskManager.updateLimits({ minTimeBetweenTradesMs: 30000 }); // 30 seconds
    });

    it('should block rapid successive trades', async () => {
      // Record any trade
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: 2 }));
      
      // Try to trade immediately
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(false);
    });

    it('should allow trades after minimum time elapsed', async () => {
      // Test with reduced minimum time for faster testing
      riskManager.updateLimits({ minTimeBetweenTradesMs: 100 }); // 100ms
      
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: 2 }));
      
      // Wait for minimum time to pass
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(true);
    });

    it('should apply minimum time regardless of trade outcome', async () => {
      riskManager.updateLimits({ 
        minTimeBetweenTradesMs: 10000, // 10 seconds
        cooldownAfterLossMs: 5000      // 5 seconds (shorter than min time)
      });
      
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -1 }));
      
      // Should be blocked by minTimeBetweenTrades, not cooldown
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(false);
    });

    it('should handle zero minimum time', async () => {
      riskManager.updateLimits({ minTimeBetweenTradesMs: 0 });
      
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: 2 }));
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(true);
    });
  });

  describe('Maximum Trades Per Hour', () => {
    beforeEach(() => {
      riskManager.updateLimits({ maxTradesPerHour: 5 });
    });

    it('should allow trades under hourly limit', async () => {
      // Mock 3 trades in the last hour
      const tradesInLastHour = Array.from({ length: 3 }, (_, i) => 
        createMockTrade({ 
          actualProfitUsd: 1,
          timestamp: new Date(Date.now() - (i * 10 * 60 * 1000)) // 10 min apart
        })
      );
      mockDatabase.setTrades(tradesInLastHour);
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(true);
    });

    it('should block trades when hourly limit reached', async () => {
      // Mock 5 trades in the last hour (at limit)
      const tradesInLastHour = Array.from({ length: 5 }, (_, i) => 
        createMockTrade({ 
          actualProfitUsd: 1,
          timestamp: new Date(Date.now() - (i * 10 * 60 * 1000))
        })
      );
      mockDatabase.setTrades(tradesInLastHour);
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(false);
    });

    it('should not count trades older than 1 hour', async () => {
      // Mock trades: 3 recent, 3 old
      const recentTrades = Array.from({ length: 3 }, (_, i) => 
        createMockTrade({ 
          actualProfitUsd: 1,
          timestamp: new Date(Date.now() - (i * 10 * 60 * 1000)) // Within hour
        })
      );
      const oldTrades = Array.from({ length: 3 }, (_, i) => 
        createMockTrade({ 
          actualProfitUsd: 1,
          timestamp: new Date(Date.now() - (70 * 60 * 1000) - (i * 10 * 60 * 1000)) // Over hour old
        })
      );
      mockDatabase.setTrades([...recentTrades, ...oldTrades]);
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(true); // Only 3 recent trades count
    });

    it('should handle different hourly limits', async () => {
      riskManager.updateLimits({ maxTradesPerHour: 1 });
      
      const oneTrade = [createMockTrade({ 
        actualProfitUsd: 1,
        timestamp: new Date(Date.now() - (10 * 60 * 1000))
      })];
      mockDatabase.setTrades(oneTrade);
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(false);
    });

    it('should handle zero trades per hour limit', async () => {
      riskManager.updateLimits({ maxTradesPerHour: 0 });
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(false);
    });
  });

  describe('Combined Time Controls', () => {
    beforeEach(() => {
      riskManager.updateLimits({
        cooldownAfterLossMs: 60000,      // 1 minute
        minTimeBetweenTradesMs: 30000,   // 30 seconds
        maxTradesPerHour: 10
      });
    });

    it('should enforce most restrictive time control', async () => {
      // Record a losing trade (triggers both cooldown and min time)
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -2 }));
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(false); // Blocked by cooldown (more restrictive)
    });

    it('should allow trades when all time controls pass', async () => {
      // Set very short time limits for testing
      riskManager.updateLimits({
        cooldownAfterLossMs: 50,      // 50ms
        minTimeBetweenTradesMs: 50,   // 50ms
        maxTradesPerHour: 10
      });
      
      // Record profitable trade (no cooldown triggered)
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: 2 }));
      
      // Wait for all time controls to pass
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(true);
    });

    it('should handle time control conflicts appropriately', async () => {
      // Set min time > cooldown
      riskManager.updateLimits({
        cooldownAfterLossMs: 30000,      // 30 seconds
        minTimeBetweenTradesMs: 60000,   // 1 minute (more restrictive)
      });
      
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -1 }));
      
      // Should be blocked by min time between trades
      const canTrade = await riskManager.canTrade(100, 5);
      expect(canTrade).toBe(false);
    });
  });
});

describe('RiskManager - Risk Event Logging & Database Integration', () => {
  let mockDatabase: MockDatabase;
  let riskManager: RiskManager;
  let config: Config;

  beforeEach(() => {
    mockDatabase = new MockDatabase();
    config = createMockConfig();
    riskManager = new RiskManager(config, mockDatabase as any);
  });

  describe('Database Error Handling', () => {
    it('should handle database errors gracefully during PnL updates', async () => {
      const failingDatabase = {
        getDailyStats: jest.fn().mockRejectedValue(new Error('DB Connection Lost')),
        getRecentTrades: jest.fn().mockResolvedValue([]),
        recordRiskEvent: jest.fn()
      };
      
      const failingRiskManager = new RiskManager(config, failingDatabase as any);
      
      // Should not throw, should default to allowing trade
      await expect(failingRiskManager.canTrade(100, 5)).resolves.toBe(true);
    });

    it('should handle database errors during trade count updates', async () => {
      const failingDatabase = {
        getDailyStats: jest.fn().mockResolvedValue({ dailyPnl: 0 }),
        getRecentTrades: jest.fn().mockRejectedValue(new Error('DB Error')),
        recordRiskEvent: jest.fn()
      };
      
      const failingRiskManager = new RiskManager(config, failingDatabase as any);
      
      // Should handle gracefully
      await expect(failingRiskManager.canTrade(100, 5)).resolves.toBe(true);
    });

    it('should continue operating when risk event logging fails', async () => {
      mockDatabase.recordRiskEvent = jest.fn().mockRejectedValue(new Error('Log Error'));
      
      // Should not throw when recording risk events
      await expect(riskManager.killSwitch('Test')).resolves.toBeUndefined();
    });
  });

  describe('State Management Edge Cases', () => {
    it('should handle daily counter resets', async () => {
      // Set some state
      await riskManager.recordTrade(createMockTrade({ actualProfitUsd: -50 }));
      
      // Reset daily counters
      await riskManager.resetDailyCounters();
      
      const state = riskManager.getState();
      expect(state.dailyPnl).toBe(0);
      expect(state.consecutiveLosses).toBe(0);
      expect(state.lastLossTime).toBe(null);
    });

    it('should handle limit updates at runtime', async () => {
      const originalLimits = riskManager.getLimits();
      
      const newLimits = {
        maxDailyLossUsd: 200,
        maxNotionalUsd: 1000,
        maxConsecutiveLosses: 10
      };
      
      riskManager.updateLimits(newLimits);
      
      const updatedLimits = riskManager.getLimits();
      expect(updatedLimits.maxDailyLossUsd).toBe(200);
      expect(updatedLimits.maxNotionalUsd).toBe(1000);
      expect(updatedLimits.maxConsecutiveLosses).toBe(10);
      
      // Should preserve unchanged limits
      expect(updatedLimits.cooldownAfterLossMs).toBe(originalLimits.cooldownAfterLossMs);
    });

    it('should provide immutable state copies', async () => {
      const state1 = riskManager.getState();
      const state2 = riskManager.getState();
      
      // Should be different objects
      expect(state1).not.toBe(state2);
      
      // But with same content
      expect(state1).toEqual(state2);
      
      // Modifying returned state should not affect internal state
      state1.dailyPnl = 999;
      const state3 = riskManager.getState();
      expect(state3.dailyPnl).not.toBe(999);
    });

    it('should provide immutable limit copies', async () => {
      const limits1 = riskManager.getLimits();
      const limits2 = riskManager.getLimits();
      
      expect(limits1).not.toBe(limits2);
      expect(limits1).toEqual(limits2);
      
      // Modifying returned limits should not affect internal limits
      limits1.maxDailyLossUsd = 999;
      const limits3 = riskManager.getLimits();
      expect(limits3.maxDailyLossUsd).not.toBe(999);
    });
  });

  describe('Integration with Trade Recording', () => {
    it('should handle rapid trade recording', async () => {
      const trades = Array.from({ length: 10 }, (_, i) => 
        createMockTrade({ actualProfitUsd: i % 2 === 0 ? 1 : -1 })
      );
      
      // Record all trades rapidly
      await Promise.all(trades.map(trade => riskManager.recordTrade(trade)));
      
      const state = riskManager.getState();
      expect(state.dailyPnl).toBe(0); // Should be 5 wins + 5 losses = 0
      expect(state.consecutiveLosses).toBe(1); // Last trade was a loss
    });

    it('should maintain consistency during concurrent operations', async () => {
      const trade1 = createMockTrade({ actualProfitUsd: 5 });
      const trade2 = createMockTrade({ actualProfitUsd: -3 });
      
      // Simulate concurrent recording and checking
      const [, , canTrade] = await Promise.all([
        riskManager.recordTrade(trade1),
        riskManager.recordTrade(trade2),
        riskManager.canTrade(100, 2)
      ]);
      
      expect(typeof canTrade).toBe('boolean');
    });

    it('should handle edge case trade values', async () => {
      const edgeCases = [
        createMockTrade({ actualProfitUsd: 0 }),         // Break-even
        createMockTrade({ actualProfitUsd: -0.001 }),    // Tiny loss
        createMockTrade({ actualProfitUsd: 0.001 }),     // Tiny profit
        createMockTrade({ actualProfitUsd: -1000 }),     // Large loss
        createMockTrade({ actualProfitUsd: 1000 }),      // Large profit
      ];
      
      for (const trade of edgeCases) {
        await expect(riskManager.recordTrade(trade)).resolves.toBeUndefined();
      }
      
      const state = riskManager.getState();
      expect(typeof state.dailyPnl).toBe('number');
      expect(typeof state.consecutiveLosses).toBe('number');
    });
  });
});