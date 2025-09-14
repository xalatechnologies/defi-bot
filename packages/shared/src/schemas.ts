import { z } from 'zod';

export const tradeSchema = z.object({
  id: z.string(),
  timestamp: z.date(),
  route: z.string(),
  amountInUsd: z.number().positive(),
  expectedProfitUsd: z.number(),
  actualProfitUsd: z.number(),
  gasUsedUsd: z.number().nonnegative(),
  aiScore: z.number().min(0).max(1),
  status: z.enum(['pending', 'success', 'failed']),
  mode: z.enum(['paper', 'live']),
  txHash: z.string().nullable(),
  errorMessage: z.string().nullable()
});

export const routeSchema = z.object({
  id: z.string(),
  path: z.array(z.string()),
  symbols: z.array(z.string()),
  dexA: z.string(),
  dexB: z.string()
});

export const snapshotSchema = z.object({
  timestamp: z.date(),
  pairAddress: z.string(),
  reserve0: z.string(),
  reserve1: z.string(),
  token0: z.string(),
  token1: z.string(),
  dex: z.string()
});

export const paramsUpdateSchema = z.object({
  minProfitUsd: z.number().positive().optional(),
  maxDailyLossUsd: z.number().positive().optional(),
  maxNotionalUsd: z.number().positive().optional(),
  slippageBps: z.number().min(1).max(1000).optional(),
  gasPriceMultiplier: z.number().min(1).max(3).optional(),
  aiThreshold: z.number().min(0).max(1).optional()
});
