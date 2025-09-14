import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from "./storage";
import { z } from "zod";
import { updateBotParamsSchema, insertTradeSchema, type DashboardStats, type Trade, type SystemStatus } from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // WebSocket server for real-time updates
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Store connected clients
  const clients = new Set<WebSocket>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket connection');
    clients.add(ws);

    ws.on('close', () => {
      clients.delete(ws);
      console.log('WebSocket connection closed');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });

    // Send initial data
    ws.send(JSON.stringify({
      type: 'welcome',
      message: 'Connected to DeFi Arbitrage Bot'
    }));
  });

  // Broadcast function for real-time updates
  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // API Routes
  
  // Get dashboard statistics
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      // Mock data - in production this would come from the database
      const stats: DashboardStats = {
        dailyPnl: 12.47,
        weeklyPnl: 87.23,
        winRate: 73.2,
        avgGasCost: 0.83,
        tradesCount: 42,
        consecutiveLosses: 0,
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
  });

  // Get recent trades
  app.get('/api/trades', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const filter = req.query.filter as string;
      
      // Mock trades data - in production this would come from the database
      const mockTrades: Trade[] = [
        {
          id: '1',
          timestamp: new Date('2025-01-20T14:32:15Z'),
          route: 'USDC→WETH→USDC',
          amountInUsd: 156.40,
          expectedProfitUsd: 2.31,
          actualProfitUsd: 2.31,
          gasUsedUsd: 0.74,
          aiScore: 0.87,
          status: 'success',
          mode: 'paper',
          txHash: null,
          errorMessage: null,
        },
        {
          id: '2',
          timestamp: new Date('2025-01-20T14:28:43Z'),
          route: 'WETH→USDT→WETH',
          amountInUsd: 89.25,
          expectedProfitUsd: 1.67,
          actualProfitUsd: 1.67,
          gasUsedUsd: 0.68,
          aiScore: 0.79,
          status: 'success',
          mode: 'paper',
          txHash: null,
          errorMessage: null,
        },
        {
          id: '3',
          timestamp: new Date('2025-01-20T14:25:12Z'),
          route: 'USDC→WMATIC→USDC',
          amountInUsd: 234.50,
          expectedProfitUsd: -0.43,
          actualProfitUsd: -0.43,
          gasUsedUsd: 0.91,
          aiScore: 0.65,
          status: 'failed',
          mode: 'paper',
          txHash: null,
          errorMessage: 'Insufficient liquidity',
        },
      ];

      let filteredTrades = mockTrades;
      if (filter === 'profitable') {
        filteredTrades = mockTrades.filter(t => t.actualProfitUsd > 0);
      } else if (filter === 'losses') {
        filteredTrades = mockTrades.filter(t => t.actualProfitUsd <= 0);
      }

      res.json(filteredTrades.slice(0, limit));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch trades' });
    }
  });

  // Get system status
  app.get('/api/system/status', async (req, res) => {
    try {
      const status: SystemStatus = {
        id: 1,
        timestamp: new Date(),
        isRunning: true,
        mode: 'paper',
        chain: 'polygon',
        wsConnected: true,
        rpcHealthy: true,
        dbConnected: true,
        riskControlsActive: true,
      };

      res.json(status);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch system status' });
    }
  });

  // Update bot parameters
  app.post('/api/bot/params', async (req, res) => {
    try {
      const params = updateBotParamsSchema.parse(req.body);
      
      // In production, this would update the bot configuration
      console.log('Updating bot parameters:', params);
      
      // Broadcast parameter update to connected clients
      broadcast({
        type: 'params_updated',
        data: params
      });

      res.json({ success: true, params });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid parameters', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to update parameters' });
      }
    }
  });

  // Toggle trading mode
  app.post('/api/bot/mode', async (req, res) => {
    try {
      const { mode } = req.body;
      
      if (mode !== 'paper' && mode !== 'live') {
        return res.status(400).json({ error: 'Invalid mode. Must be "paper" or "live"' });
      }

      console.log('Switching bot mode to:', mode);
      
      // Broadcast mode change to connected clients
      broadcast({
        type: 'mode_changed',
        data: { mode }
      });

      res.json({ success: true, mode });
    } catch (error) {
      res.status(500).json({ error: 'Failed to change mode' });
    }
  });

  // Kill switch
  app.post('/api/bot/kill', async (req, res) => {
    try {
      const { reason } = req.body;
      
      console.log('Kill switch activated:', reason || 'Manual trigger');
      
      // Broadcast kill switch activation to connected clients
      broadcast({
        type: 'kill_switch_activated',
        data: { reason: reason || 'Manual trigger', timestamp: new Date() }
      });

      res.json({ success: true, message: 'Kill switch activated' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to activate kill switch' });
    }
  });

  // Reset kill switch
  app.post('/api/bot/reset', async (req, res) => {
    try {
      console.log('Kill switch reset');
      
      // Broadcast kill switch reset to connected clients
      broadcast({
        type: 'kill_switch_reset',
        data: { timestamp: new Date() }
      });

      res.json({ success: true, message: 'Kill switch reset' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to reset kill switch' });
    }
  });

  // Toggle DEX route
  app.post('/api/dex/toggle', async (req, res) => {
    try {
      const { dex, enabled } = req.body;
      
      console.log(`${enabled ? 'Enabling' : 'Disabling'} ${dex} route`);
      
      // Broadcast route toggle to connected clients
      broadcast({
        type: 'dex_toggled',
        data: { dex, enabled }
      });

      res.json({ success: true, dex, enabled });
    } catch (error) {
      res.status(500).json({ error: 'Failed to toggle DEX route' });
    }
  });

  // Retrain AI model
  app.post('/api/ai/retrain', async (req, res) => {
    try {
      console.log('AI model retraining requested');
      
      // In production, this would trigger the actual retraining process
      // For now, just broadcast the event
      broadcast({
        type: 'ai_retrain_started',
        data: { timestamp: new Date() }
      });

      res.json({ success: true, message: 'AI model retraining started' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to start AI retraining' });
    }
  });

  // Get AI model status
  app.get('/api/ai/status', async (req, res) => {
    try {
      const aiStatus = {
        accuracy: 84.3,
        lastTrained: new Date('2025-01-20T12:00:00Z'),
        sampleCount: 1847,
        isTraining: false,
      };

      res.json(aiStatus);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch AI status' });
    }
  });

  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    res.json({ 
      status: 'healthy', 
      timestamp: new Date(),
      version: '1.0.0'
    });
  });

  // Simulate real-time data updates (for demo purposes)
  setInterval(() => {
    const mockUpdate = {
      type: 'trade_update',
      data: {
        route: 'USDC→WETH→USDC',
        profit: Math.random() * 5,
        timestamp: new Date()
      }
    };
    broadcast(mockUpdate);
  }, 30000); // Every 30 seconds

  return httpServer;
}
