import type { Snapshot, Pair } from '@pkg/shared';

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

export class MemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs: number = 60000) {
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, cleanupIntervalMs);
  }

  set<T>(key: string, data: T, ttlMs: number = 30000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.clear();
  }

  // Specialized cache methods for common use cases
  
  cacheReserves(pairAddress: string, dex: string, reserves: any, ttlMs: number = 10000): void {
    const key = `reserves:${pairAddress}:${dex}`;
    this.set(key, reserves, ttlMs);
  }

  getReserves(pairAddress: string, dex: string): any | null {
    const key = `reserves:${pairAddress}:${dex}`;
    return this.get(key);
  }

  cachePairAddress(tokenA: string, tokenB: string, dex: string, pairAddress: string): void {
    const key = `pair:${tokenA}:${tokenB}:${dex}`;
    this.set(key, pairAddress, 300000); // 5 minutes TTL for pair addresses
  }

  getPairAddress(tokenA: string, tokenB: string, dex: string): string | null {
    const key = `pair:${tokenA}:${tokenB}:${dex}`;
    return this.get(key);
  }

  cacheGasPrice(gasPrice: bigint, ttlMs: number = 30000): void {
    this.set('gasPrice', gasPrice.toString(), ttlMs);
  }

  getGasPrice(): bigint | null {
    const cached = this.get<string>('gasPrice');
    return cached ? BigInt(cached) : null;
  }

  // Snapshot aggregation for performance metrics
  addSnapshot(snapshot: Snapshot): void {
    const key = `snapshot:${snapshot.pairAddress}:${snapshot.dex}`;
    const existing = this.get<Snapshot[]>(key) || [];
    
    existing.push(snapshot);
    
    // Keep only last 100 snapshots per pair
    if (existing.length > 100) {
      existing.shift();
    }
    
    this.set(key, existing, 300000); // 5 minutes
  }

  getSnapshotHistory(pairAddress: string, dex: string): Snapshot[] {
    const key = `snapshot:${pairAddress}:${dex}`;
    return this.get<Snapshot[]>(key) || [];
  }

  // Price volatility calculation
  calculateVolatility(pairAddress: string, dex: string, windowMs: number = 300000): number {
    const snapshots = this.getSnapshotHistory(pairAddress, dex);
    
    if (snapshots.length < 2) return 0;
    
    const cutoff = Date.now() - windowMs;
    const recentSnapshots = snapshots.filter(s => s.timestamp.getTime() > cutoff);
    
    if (recentSnapshots.length < 2) return 0;
    
    const prices = recentSnapshots.map(s => {
      const reserve0 = parseFloat(s.reserve0);
      const reserve1 = parseFloat(s.reserve1);
      return reserve1 / reserve0;
    });
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push(Math.log(prices[i] / prices[i - 1]));
    }
    
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(365.25 * 24 * 60); // Annualized volatility
  }

  // Get cache statistics
  getStats(): {
    totalEntries: number;
    memoryUsage: string;
    hitRate: number;
  } {
    return {
      totalEntries: this.cache.size,
      memoryUsage: `${Math.round(JSON.stringify(Array.from(this.cache.values())).length / 1024)} KB`,
      hitRate: 0 // Would need to track hits/misses to calculate this
    };
  }
}

// Global cache instance
export const globalCache = new MemoryCache();
