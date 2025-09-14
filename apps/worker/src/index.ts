import dotenv from 'dotenv';
import { logger } from '@pkg/shared';
import { ArbitrageBot } from './bot.js';
import { loadConfig } from '@pkg/shared';

dotenv.config();

async function main() {
  try {
    const config = loadConfig();
    logger.info('Starting DeFi Arbitrage Bot', { 
      mode: config.MODE,
      chain: config.CHAIN,
      minProfitUsd: config.MIN_PROFIT_USD
    });

    const bot = new ArbitrageBot(config);
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await bot.stop();
      process.exit(0);
    });

    await bot.start();
  } catch (error) {
    logger.error('Failed to start bot', { error: error.message });
    process.exit(1);
  }
}

main();
