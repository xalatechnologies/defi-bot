import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, real, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const trades = pgTable("trades", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  route: text("route").notNull(),
  amountInUsd: real("amount_in_usd").notNull(),
  expectedProfitUsd: real("expected_profit_usd").notNull(),
  actualProfitUsd: real("actual_profit_usd").notNull(),
  gasUsedUsd: real("gas_used_usd").notNull(),
  aiScore: real("ai_score").notNull(),
  status: text("status").notNull(), // 'pending' | 'success' | 'failed'
  mode: text("mode").notNull(), // 'paper' | 'live'
  txHash: text("tx_hash"),
  errorMessage: text("error_message"),
});

export const snapshots = pgTable("snapshots", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  pairAddress: text("pair_address").notNull(),
  reserve0: text("reserve0").notNull(),
  reserve1: text("reserve1").notNull(),
  token0: text("token0").notNull(),
  token1: text("token1").notNull(),
  dex: text("dex").notNull(),
});

export const riskEvents = pgTable("risk_events", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  eventType: text("event_type").notNull(),
  description: text("description").notNull(),
  data: text("data"), // JSON string
});

export const systemStatus = pgTable("system_status", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  isRunning: boolean("is_running").notNull(),
  mode: text("mode").notNull(),
  chain: text("chain").notNull(),
  wsConnected: boolean("ws_connected").notNull(),
  rpcHealthy: boolean("rpc_healthy").notNull(),
  dbConnected: boolean("db_connected").notNull(),
  riskControlsActive: boolean("risk_controls_active").notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  timestamp: true,
});

export const insertSnapshotSchema = createInsertSchema(snapshots).omit({
  id: true,
  timestamp: true,
});

export const insertRiskEventSchema = createInsertSchema(riskEvents).omit({
  id: true,
  timestamp: true,
});

export const insertSystemStatusSchema = createInsertSchema(systemStatus).omit({
  id: true,
  timestamp: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

export type InsertSnapshot = z.infer<typeof insertSnapshotSchema>;
export type Snapshot = typeof snapshots.$inferSelect;

export type InsertRiskEvent = z.infer<typeof insertRiskEventSchema>;
export type RiskEvent = typeof riskEvents.$inferSelect;

export type InsertSystemStatus = z.infer<typeof insertSystemStatusSchema>;
export type SystemStatus = typeof systemStatus.$inferSelect;

// API schemas
export const updateBotParamsSchema = z.object({
  minProfitUsd: z.number().positive().optional(),
  maxDailyLossUsd: z.number().positive().optional(),
  maxNotionalUsd: z.number().positive().optional(),
  slippageBps: z.number().min(1).max(1000).optional(),
  gasPriceMultiplier: z.number().min(1).max(3).optional(),
  aiThreshold: z.number().min(0).max(1).optional(),
});

export const dashboardStatsSchema = z.object({
  dailyPnl: z.number(),
  weeklyPnl: z.number(),
  winRate: z.number(),
  avgGasCost: z.number(),
  tradesCount: z.number(),
  consecutiveLosses: z.number(),
});

export type UpdateBotParams = z.infer<typeof updateBotParamsSchema>;
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
