export interface Config {
  NODE_ENV: string;
  CHAIN: string;
  RPC_HTTP: string;
  RPC_WS: string;
  WALLET_PRIVATE_KEY: string;
  ALCHEMY_HTTP?: string;
  ALCHEMY_WS?: string;
  INFURA_HTTP?: string;
  INFURA_WS?: string;
  MIN_PROFIT_USD: number;
  MAX_DAILY_LOSS_USD: number;
  MAX_NOTIONAL_USD: number;
  SLIPPAGE_BPS: number;
  GAS_PRICE_MULTIPLIER: number;
  MODE: 'paper' | 'live';
  PORT: number;
  USE_OPENAI: boolean;
  OPENAI_API_KEY?: string;
  DASHBOARD_TOKEN?: string;
}

export interface Trade {
  id: string;
  timestamp: Date;
  route: string;
  amountInUsd: number;
  expectedProfitUsd: number;
  actualProfitUsd: number;
  gasUsedUsd: number;
  aiScore: number;
  status: 'pending' | 'success' | 'failed';
  mode: 'paper' | 'live';
  txHash: string | null;
  errorMessage: string | null;
}

export interface Route {
  id: string;
  path: string[]; // Token addresses
  symbols: string[]; // Token symbols for display
  dexA: string;
  dexB: string;
}

export interface Snapshot {
  timestamp: Date;
  pairAddress: string;
  reserve0: string;
  reserve1: string;
  token0: string;
  token1: string;
  dex: string;
}

export interface Pair {
  address: string;
  token0: string;
  token1: string;
  symbol0: string;
  symbol1: string;
  dex: string;
}

export interface Params {
  minProfitUsd: number;
  maxDailyLossUsd: number;
  maxNotionalUsd: number;
  slippageBps: number;
  gasPriceMultiplier: number;
  aiThreshold: number;
}

export interface DailyStats {
  date: string;
  dailyPnl: number;
  tradeCount: number;
  winRate: number;
  avgProfit: number;
  gasSpent: number;
}

export interface SystemStatus {
  isRunning: boolean;
  mode: 'paper' | 'live';
  chain: string;
  wsConnected: boolean;
  rpcHealthy: boolean;
  dbConnected: boolean;
  riskControlsActive: boolean;
  lastUpdate: Date;
}

export interface FeatureVector {
  spreadBps: number;
  depthUsd: number;
  volatility: number;
  sizeTier: number;
  gasPrice: number;
  timeOfDay: number;
  dayOfWeek: number;
}

export interface AIModelState {
  weights: number[];
  bias: number;
  accuracy: number;
  lastTrained: Date;
  sampleCount: number;
}
