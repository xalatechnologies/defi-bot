import { z } from 'zod';
import type { Config } from './types.js';

const configSchema = z.object({
  NODE_ENV: z.string().default('development'),
  CHAIN: z.string().default('polygon'),
  RPC_HTTP: z.string().url(),
  RPC_WS: z.string().url(),
  WALLET_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  ALCHEMY_HTTP: z.string().url().optional(),
  ALCHEMY_WS: z.string().url().optional(),
  INFURA_HTTP: z.string().url().optional(),
  INFURA_WS: z.string().url().optional(),
  MIN_PROFIT_USD: z.string().transform(Number).pipe(z.number().positive()),
  MAX_DAILY_LOSS_USD: z.string().transform(Number).pipe(z.number().positive()),
  MAX_NOTIONAL_USD: z.string().transform(Number).pipe(z.number().positive()),
  SLIPPAGE_BPS: z.string().transform(Number).pipe(z.number().min(1).max(1000)),
  GAS_PRICE_MULTIPLIER: z.string().transform(Number).pipe(z.number().min(1).max(3)),
  MODE: z.enum(['paper', 'live']),
  PORT: z.string().transform(Number).pipe(z.number().int().min(1000).max(65535)),
  USE_OPENAI: z.string().transform(val => val === 'true'),
  OPENAI_API_KEY: z.string().optional(),
  DASHBOARD_TOKEN: z.string().optional()
});

export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('Configuration validation failed:');
    console.error(result.error.format());
    process.exit(1);
  }
  
  return result.data;
}
