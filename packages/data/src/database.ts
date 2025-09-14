import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import type { Trade, Snapshot, DailyStats } from '@pkg/shared';

export class Database {
  private db: sqlite3.Database | null = null;

  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database('./arbitrage.db', (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        this.createTables()
          .then(() => resolve())
          .catch(reject);
      });
    });
  }

  private async createTables(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));

    // Trades table
    await run(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        route TEXT NOT NULL,
        amount_in_usd REAL NOT NULL,
        expected_profit_usd REAL NOT NULL,
        actual_profit_usd REAL NOT NULL,
        gas_used_usd REAL NOT NULL,
        ai_score REAL NOT NULL,
        status TEXT NOT NULL,
        mode TEXT NOT NULL,
        tx_hash TEXT,
        error_message TEXT
      )
    `);

    // Snapshots table
    await run(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        pair_address TEXT NOT NULL,
        reserve0 TEXT NOT NULL,
        reserve1 TEXT NOT NULL,
        token0 TEXT NOT NULL,
        token1 TEXT NOT NULL,
        dex TEXT NOT NULL
      )
    `);

    // Parameters table
    await run(`
      CREATE TABLE IF NOT EXISTS parameters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        min_profit_usd REAL NOT NULL,
        max_daily_loss_usd REAL NOT NULL,
        max_notional_usd REAL NOT NULL,
        slippage_bps INTEGER NOT NULL,
        gas_price_multiplier REAL NOT NULL,
        ai_threshold REAL NOT NULL
      )
    `);

    // Risk events table
    await run(`
      CREATE TABLE IF NOT EXISTS risk_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        event_type TEXT NOT NULL,
        description TEXT NOT NULL,
        data TEXT
      )
    `);

    // Create indices
    await run('CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(timestamp)');
    await run('CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)');
    await run('CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON snapshots(timestamp)');
    await run('CREATE INDEX IF NOT EXISTS idx_snapshots_pair ON snapshots(pair_address)');
  }

  async saveTrade(trade: Omit<Trade, 'id' | 'timestamp'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));
    const id = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await run(`
      INSERT INTO trades (
        id, route, amount_in_usd, expected_profit_usd, actual_profit_usd,
        gas_used_usd, ai_score, status, mode, tx_hash, error_message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id,
      trade.route,
      trade.amountInUsd,
      trade.expectedProfitUsd,
      trade.actualProfitUsd,
      trade.gasUsedUsd,
      trade.aiScore,
      trade.status,
      trade.mode,
      trade.txHash,
      trade.errorMessage
    ]);
  }

  async saveSnapshot(snapshot: Snapshot): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));

    await run(`
      INSERT INTO snapshots (
        pair_address, reserve0, reserve1, token0, token1, dex
      ) VALUES (?, ?, ?, ?, ?, ?)
    `, [
      snapshot.pairAddress,
      snapshot.reserve0,
      snapshot.reserve1,
      snapshot.token0,
      snapshot.token1,
      snapshot.dex
    ]);
  }

  async getRecentTrades(limit: number = 50): Promise<Trade[]> {
    if (!this.db) throw new Error('Database not initialized');

    const all = promisify(this.db.all.bind(this.db));

    const rows = await all(`
      SELECT * FROM trades 
      ORDER BY timestamp DESC 
      LIMIT ?
    `, [limit]);

    return rows.map(this.mapRowToTrade);
  }

  async getDailyStats(date?: Date): Promise<DailyStats> {
    if (!this.db) throw new Error('Database not initialized');

    const all = promisify(this.db.all.bind(this.db));
    const targetDate = date || new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    const rows = await all(`
      SELECT 
        COUNT(*) as trade_count,
        SUM(actual_profit_usd) as total_profit,
        SUM(gas_used_usd) as total_gas,
        AVG(actual_profit_usd) as avg_profit,
        SUM(CASE WHEN actual_profit_usd > 0 THEN 1 ELSE 0 END) as winning_trades
      FROM trades 
      WHERE DATE(timestamp) = ?
    `, [dateStr]);

    const row = rows[0];
    const tradeCount = row.trade_count || 0;
    const winningTrades = row.winning_trades || 0;

    return {
      date: dateStr,
      dailyPnl: row.total_profit || 0,
      tradeCount,
      winRate: tradeCount > 0 ? (winningTrades / tradeCount) * 100 : 0,
      avgProfit: row.avg_profit || 0,
      gasSpent: row.total_gas || 0
    };
  }

  async getSnapshotsInRange(fromDate: Date, toDate: Date): Promise<Snapshot[]> {
    if (!this.db) throw new Error('Database not initialized');

    const all = promisify(this.db.all.bind(this.db));

    const rows = await all(`
      SELECT * FROM snapshots 
      WHERE timestamp BETWEEN ? AND ?
      ORDER BY timestamp ASC
    `, [fromDate.toISOString(), toDate.toISOString()]);

    return rows.map(this.mapRowToSnapshot);
  }

  async recordRiskEvent(eventType: string, description: string, data?: any): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const run = promisify(this.db.run.bind(this.db));

    await run(`
      INSERT INTO risk_events (event_type, description, data)
      VALUES (?, ?, ?)
    `, [eventType, description, data ? JSON.stringify(data) : null]);
  }

  async close(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      this.db!.close((err) => {
        if (err) console.error('Error closing database:', err);
        this.db = null;
        resolve();
      });
    });
  }

  private mapRowToTrade(row: any): Trade {
    return {
      id: row.id,
      timestamp: new Date(row.timestamp),
      route: row.route,
      amountInUsd: row.amount_in_usd,
      expectedProfitUsd: row.expected_profit_usd,
      actualProfitUsd: row.actual_profit_usd,
      gasUsedUsd: row.gas_used_usd,
      aiScore: row.ai_score,
      status: row.status,
      mode: row.mode,
      txHash: row.tx_hash,
      errorMessage: row.error_message
    };
  }

  private mapRowToSnapshot(row: any): Snapshot {
    return {
      timestamp: new Date(row.timestamp),
      pairAddress: row.pair_address,
      reserve0: row.reserve0,
      reserve1: row.reserve1,
      token0: row.token0,
      token1: row.token1,
      dex: row.dex
    };
  }
}
