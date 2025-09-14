import { WebSocket } from 'ws';
import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import type { Snapshot } from '@pkg/shared';
import { UNISWAP_V2_PAIR_ABI } from '@pkg/connectors/constants';

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

export class WebSocketSubscriber extends EventEmitter {
  private config: WebSocketConfig;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private isConnected = false;
  private subscriptions: Set<string> = new Set();
  private provider: ethers.WebSocketProvider;

  constructor(wsUrl: string) {
    super();
    
    this.config = {
      url: wsUrl,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10
    };

    this.provider = new ethers.WebSocketProvider(wsUrl);
    this.setupProviderListeners();
  }

  async connect(): Promise<void> {
    try {
      await this.provider.ready;
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      console.log('WebSocket provider connected');
      this.emit('connected');
    } catch (error) {
      console.error('Failed to connect WebSocket provider:', error);
      this.handleReconnect();
    }
  }

  async disconnect(): Promise<void> {
    this.isConnected = false;
    this.subscriptions.clear();
    
    if (this.provider) {
      await this.provider.destroy();
    }
  }

  async subscribeToPair(pairAddress: string, dexName: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }

    const subscriptionKey = `${pairAddress}-${dexName}`;
    if (this.subscriptions.has(subscriptionKey)) {
      return; // Already subscribed
    }

    try {
      const pairContract = new ethers.Contract(pairAddress, UNISWAP_V2_PAIR_ABI, this.provider);
      
      // Subscribe to Sync events (reserve updates)
      pairContract.on('Sync', async (reserve0: bigint, reserve1: bigint, event: any) => {
        try {
          const [token0, token1] = await Promise.all([
            pairContract.token0(),
            pairContract.token1()
          ]);

          const snapshot: Snapshot = {
            timestamp: new Date(),
            pairAddress,
            reserve0: reserve0.toString(),
            reserve1: reserve1.toString(),
            token0,
            token1,
            dex: dexName
          };

          this.emit('reserveUpdate', snapshot);
        } catch (error) {
          console.error('Error processing Sync event:', error);
        }
      });

      this.subscriptions.add(subscriptionKey);
      console.log(`Subscribed to pair ${pairAddress} on ${dexName}`);
    } catch (error) {
      console.error(`Failed to subscribe to pair ${pairAddress}:`, error);
    }
  }

  async subscribeToMultiplePairs(pairs: Array<{ address: string; dex: string }>): Promise<void> {
    for (const pair of pairs) {
      await this.subscribeToPair(pair.address, pair.dex);
      // Small delay to avoid overwhelming the RPC
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private setupProviderListeners(): void {
    this.provider.on('error', (error) => {
      console.error('WebSocket provider error:', error);
      this.handleReconnect();
    });

    this.provider.on('close', () => {
      console.log('WebSocket provider closed');
      this.isConnected = false;
      this.handleReconnect();
    });
  }

  private async handleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);

    await new Promise(resolve => setTimeout(resolve, this.config.reconnectInterval));

    try {
      // Create new provider
      this.provider = new ethers.WebSocketProvider(this.config.url);
      this.setupProviderListeners();
      await this.connect();
      
      // Re-subscribe to all pairs
      await this.resubscribeAll();
    } catch (error) {
      console.error('Reconnection failed:', error);
      this.handleReconnect();
    }
  }

  private async resubscribeAll(): Promise<void> {
    const subscriptions = Array.from(this.subscriptions);
    this.subscriptions.clear();

    for (const subscription of subscriptions) {
      const [pairAddress, dexName] = subscription.split('-');
      await this.subscribeToPair(pairAddress, dexName);
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }

  // Utility method to get latest block
  async getLatestBlock(): Promise<number> {
    if (!this.isConnected) {
      throw new Error('WebSocket not connected');
    }
    return await this.provider.getBlockNumber();
  }

  // Subscribe to new blocks for timing-based strategies
  subscribeToBlocks(): void {
    if (!this.isConnected) return;

    this.provider.on('block', (blockNumber) => {
      this.emit('newBlock', blockNumber);
    });
  }
}
