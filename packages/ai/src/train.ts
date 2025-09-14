#!/usr/bin/env node
import { Database } from '@pkg/data';
import { AIModel } from './model.js';
import { extractTrainingFeatures } from './features.js';
import { logger } from '@pkg/shared';

async function main() {
  try {
    logger.info('Starting AI model training');

    const database = new Database();
    await database.initialize();

    const aiModel = new AIModel();
    
    // Get historical trade data for training
    const trades = await database.getRecentTrades(1000);
    logger.info(`Found ${trades.length} trades for training`);

    if (trades.length < 10) {
      logger.warn('Insufficient training data, using default weights');
      return;
    }

    // Convert trades to training data
    const trainingData = [];
    
    for (const trade of trades) {
      try {
        // Mock snapshot data - in practice this would come from saved snapshots
        const mockSnapshot = {
          timestamp: trade.timestamp,
          pairAddress: '0x0000000000000000000000000000000000000000',
          reserve0: '1000000000000000000',
          reserve1: '2000000000',
          token0: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
          token1: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
          dex: 'quickswap'
        };

        const mockRoute = {
          id: trade.route,
          path: ['0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'],
          symbols: ['USDC', 'WETH', 'USDC'],
          dexA: 'quickswap',
          dexB: 'sushiswap'
        };

        const trainingFeatures = extractTrainingFeatures(
          mockSnapshot,
          mockRoute,
          trade.amountInUsd,
          trade.actualProfitUsd
        );

        trainingData.push(trainingFeatures);
      } catch (error) {
        logger.error('Error processing trade for training', { error: error.message, tradeId: trade.id });
      }
    }

    if (trainingData.length === 0) {
      logger.error('No valid training data extracted');
      return;
    }

    logger.info(`Prepared ${trainingData.length} training samples`);

    // Train the model
    await aiModel.train(trainingData);

    // Display training results
    const stats = aiModel.getStats();
    logger.info('Training completed', {
      accuracy: (stats.accuracy * 100).toFixed(1) + '%',
      sampleCount: stats.sampleCount,
      lastTrained: stats.lastTrained
    });

    // Show feature importance
    const featureImportance = aiModel.getFeatureImportance();
    logger.info('Feature importance rankings:');
    featureImportance.forEach((feature, index) => {
      logger.info(`${index + 1}. ${feature.feature}: ${feature.importance.toFixed(3)} (weight: ${feature.weight.toFixed(3)})`);
    });

    await database.close();
    logger.info('Training completed successfully');

  } catch (error) {
    logger.error('Training failed', { error: error.message });
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
