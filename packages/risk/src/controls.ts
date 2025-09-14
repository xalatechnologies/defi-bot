import type { Config, Trade } from '@pkg/shared';
import type { Database } from '@pkg/data';
import { logger } from '@pkg/shared';

export interface RiskLimits {
  maxDailyLossUsd: number;
  maxNotionalUsd: number;
  maxTradesPerHour: number;
  maxConsecutiveLosses: number;
  cooldownAfterLossMs: number;
  minTimeBetweenTradesMs: number;
}

export interface RiskState {
  isKilled: boolean;
  dailyPnl: number;
  tradesInLastHour: number;
  consecutiveLosses: number;
  lastTradeTime: Date | null;
  lastLossTime: Date | null;
  killReason: string | null;
}

export class RiskManager {
  private config: Config;
  private database: Database;
  private state: RiskState;
  private limits: RiskLimits;

  constructor(config: Config, database: Database) {
    this.config = config;
    this.database = database;
    
    this.limits = {
      maxDailyLossUsd: config.MAX_DAILY_LOSS_USD,
      maxNotionalUsd: config.MAX_NOTIONAL_USD,
      maxTradesPerHour: 100,
      maxConsecutiveLosses: 5,
      cooldownAfterLossMs: 60000, // 1 minute
      minTimeBetweenTradesMs: 5000 // 5 seconds
    };

    this.state = {
      isKilled: false,
      dailyPnl: 0,
      tradesInLastHour: 0,
      consecutiveLosses: 0,
      lastTradeTime: null,
      lastLossTime: null,
      killReason: null
    };

    this.initializeState();
  }

  private async initializeState(): Promise<void> {
    try {
      const today = new Date();
      const stats = await this.database.getDailyStats(today);
      
      this.state.dailyPnl = stats.dailyPnl;
      
      // Get recent trades for consecutive loss calculation
      const recentTrades = await this.database.getRecentTrades(10);
      this.calculateConsecutiveLosses(recentTrades);
      
      logger.info('Risk manager initialized', {
        dailyPnl: this.state.dailyPnl,
        consecutiveLosses: this.state.consecutiveLosses
      });
    } catch (error) {
      logger.error('Failed to initialize risk state', { error: error.message });
    }
  }

  private calculateConsecutiveLosses(trades: Trade[]): void {
    let losses = 0;
    
    for (const trade of trades) {
      if (trade.actualProfitUsd <= 0) {
        losses++;
      } else {
        break; // Stop at first profitable trade
      }
    }
    
    this.state.consecutiveLosses = losses;
  }

  /**
   * Check if trading should be stopped
   */
  async shouldStop(): Promise<boolean> {
    await this.updateDailyPnl();
    return this.state.isKilled;
  }

  /**
   * Check if a specific trade can be executed
   */
  async canTrade(amountUsd: number, expectedProfitUsd: number): Promise<boolean> {
    // Check if killed
    if (this.state.isKilled) {
      logger.warn('Trade blocked: bot is killed', { reason: this.state.killReason });
      return false;
    }

    // Check position size limits
    if (amountUsd > this.limits.maxNotionalUsd) {
      logger.warn('Trade blocked: exceeds max notional', { 
        amountUsd, 
        maxNotional: this.limits.maxNotionalUsd 
      });
      return false;
    }

    // Check daily loss limits
    await this.updateDailyPnl();
    const potentialDailyLoss = Math.abs(Math.min(0, this.state.dailyPnl + expectedProfitUsd));
    if (potentialDailyLoss > this.limits.maxDailyLossUsd) {
      await this.killSwitch('Daily loss limit would be exceeded');
      return false;
    }

    // Check consecutive losses
    if (this.state.consecutiveLosses >= this.limits.maxConsecutiveLosses) {
      logger.warn('Trade blocked: too many consecutive losses', { 
        consecutiveLosses: this.state.consecutiveLosses 
      });
      return false;
    }

    // Check cooldown period after loss
    if (this.state.lastLossTime) {
      const timeSinceLoss = Date.now() - this.state.lastLossTime.getTime();
      if (timeSinceLoss < this.limits.cooldownAfterLossMs) {
        logger.debug('Trade blocked: in cooldown period after loss');
        return false;
      }
    }

    // Check minimum time between trades
    if (this.state.lastTradeTime) {
      const timeSinceTrade = Date.now() - this.state.lastTradeTime.getTime();
      if (timeSinceTrade < this.limits.minTimeBetweenTradesMs) {
        logger.debug('Trade blocked: minimum time between trades not met');
        return false;
      }
    }

    // Check trades per hour limit
    await this.updateTradeCount();
    if (this.state.tradesInLastHour >= this.limits.maxTradesPerHour) {
      logger.warn('Trade blocked: hourly trade limit reached', { 
        tradesInLastHour: this.state.tradesInLastHour 
      });
      return false;
    }

    return true;
  }

  /**
   * Record a completed trade and update risk state
   */
  async recordTrade(trade: Omit<Trade, 'id' | 'timestamp'>): Promise<void> {
    this.state.lastTradeTime = new Date();
    
    // Update PnL
    this.state.dailyPnl += trade.actualProfitUsd;
    
    // Update consecutive losses
    if (trade.actualProfitUsd <= 0) {
      this.state.consecutiveLosses++;
      this.state.lastLossTime = new Date();
    } else {
      this.state.consecutiveLosses = 0;
    }

    // Check if daily loss limit hit
    if (-this.state.dailyPnl >= this.limits.maxDailyLossUsd) {
      await this.killSwitch('Daily loss limit exceeded');
    }

    // Log risk event if needed
    if (this.state.consecutiveLosses >= 3) {
      await this.database.recordRiskEvent(
        'consecutive_losses',
        `${this.state.consecutiveLosses} consecutive losses recorded`,
        { consecutiveLosses: this.state.consecutiveLosses, lastTrade: trade }
      );
    }

    logger.debug('Trade recorded in risk manager', {
      dailyPnl: this.state.dailyPnl,
      consecutiveLosses: this.state.consecutiveLosses,
      profit: trade.actualProfitUsd
    });
  }

  /**
   * Manually trigger kill switch
   */
  async killSwitch(reason: string): Promise<void> {
    this.state.isKilled = true;
    this.state.killReason = reason;
    
    await this.database.recordRiskEvent('kill_switch', reason, {
      dailyPnl: this.state.dailyPnl,
      consecutiveLosses: this.state.consecutiveLosses,
      timestamp: new Date().toISOString()
    });

    logger.error('KILL SWITCH ACTIVATED', { reason });
  }

  /**
   * Reset kill switch (manual intervention required)
   */
  async resetKillSwitch(): Promise<void> {
    this.state.isKilled = false;
    this.state.killReason = null;
    
    await this.database.recordRiskEvent('kill_switch_reset', 'Kill switch manually reset');
    logger.info('Kill switch reset');
  }

  /**
   * Update risk parameters
   */
  updateLimits(newLimits: Partial<RiskLimits>): void {
    this.limits = { ...this.limits, ...newLimits };
    logger.info('Risk limits updated', newLimits);
  }

  /**
   * Get current risk state
   */
  getState(): RiskState {
    return { ...this.state };
  }

  /**
   * Get current risk limits
   */
  getLimits(): RiskLimits {
    return { ...this.limits };
  }

  /**
   * Check daily limits
   */
  async checkLimits(): Promise<void> {
    await this.updateDailyPnl();
    
    if (-this.state.dailyPnl >= this.limits.maxDailyLossUsd && !this.state.isKilled) {
      await this.killSwitch('Daily loss limit check failed');
    }
  }

  private async updateDailyPnl(): Promise<void> {
    try {
      const stats = await this.database.getDailyStats();
      this.state.dailyPnl = stats.dailyPnl;
    } catch (error) {
      logger.error('Failed to update daily PnL', { error: error.message });
    }
  }

  private async updateTradeCount(): Promise<void> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentTrades = await this.database.getRecentTrades(1000); // Get more trades to filter
      
      const tradesInLastHour = recentTrades.filter(
        trade => trade.timestamp > oneHourAgo
      ).length;
      
      this.state.tradesInLastHour = tradesInLastHour;
    } catch (error) {
      logger.error('Failed to update trade count', { error: error.message });
    }
  }

  /**
   * Reset daily counters (called at start of new trading day)
   */
  async resetDailyCounters(): Promise<void> {
    this.state.dailyPnl = 0;
    this.state.consecutiveLosses = 0;
    this.state.lastLossTime = null;
    
    logger.info('Daily risk counters reset');
  }

  /**
   * Emergency stop all trading activity
   */
  async emergencyStop(): Promise<void> {
    await this.killSwitch('Emergency stop activated');
    
    // Additional emergency actions could go here
    // e.g., cancel pending orders, close positions, etc.
  }
}
