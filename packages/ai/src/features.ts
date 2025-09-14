import type { Snapshot, Route, FeatureVector } from '@pkg/shared';

/**
 * Extract feature vector from market snapshot for AI model
 */
export function extractFeatures(
  snapshot: Snapshot,
  route: Route,
  tradeSizeUsd: number
): FeatureVector {
  // Calculate basic price metrics
  const reserve0 = parseFloat(snapshot.reserve0);
  const reserve1 = parseFloat(snapshot.reserve1);
  const price = reserve1 / reserve0;
  
  // Calculate spread (simplified - in practice would compare multiple DEXes)
  const spreadBps = Math.random() * 100; // Placeholder - would calculate actual spread
  
  // Liquidity depth estimation
  const depthUsd = Math.min(reserve0, reserve1) * 2; // Simplified depth calculation
  
  // Volatility (simplified - would use historical data)
  const volatility = Math.random() * 50; // Placeholder
  
  // Trade size tier (categorize trade sizes)
  let sizeTier = 0;
  if (tradeSizeUsd <= 100) sizeTier = 1;
  else if (tradeSizeUsd <= 500) sizeTier = 2;
  else if (tradeSizeUsd <= 1000) sizeTier = 3;
  else sizeTier = 4;
  
  // Gas price (simplified)
  const gasPrice = 30; // Placeholder - would get actual gas price
  
  // Time features
  const now = new Date();
  const timeOfDay = now.getHours() + now.getMinutes() / 60; // 0-24
  const dayOfWeek = now.getDay(); // 0-6
  
  return {
    spreadBps,
    depthUsd,
    volatility,
    sizeTier,
    gasPrice,
    timeOfDay,
    dayOfWeek
  };
}

/**
 * Normalize features for ML model
 */
export function normalizeFeatures(features: FeatureVector): number[] {
  return [
    features.spreadBps / 1000, // Normalize to 0-1 range
    Math.log(features.depthUsd) / 20, // Log scale for depth
    features.volatility / 100,
    features.sizeTier / 4,
    features.gasPrice / 100,
    features.timeOfDay / 24,
    features.dayOfWeek / 7
  ];
}

/**
 * Feature importance weights (can be learned)
 */
export const FEATURE_WEIGHTS = {
  spreadBps: 0.3,
  depthUsd: 0.2,
  volatility: 0.15,
  sizeTier: 0.1,
  gasPrice: 0.1,
  timeOfDay: 0.08,
  dayOfWeek: 0.07
};

/**
 * Calculate feature importance score
 */
export function calculateFeatureImportance(features: FeatureVector): number {
  const normalized = normalizeFeatures(features);
  
  let score = 0;
  score += normalized[0] * FEATURE_WEIGHTS.spreadBps;
  score += normalized[1] * FEATURE_WEIGHTS.depthUsd;
  score += (1 - normalized[2]) * FEATURE_WEIGHTS.volatility; // Lower volatility is better
  score += normalized[3] * FEATURE_WEIGHTS.sizeTier;
  score += (1 - normalized[4]) * FEATURE_WEIGHTS.gasPrice; // Lower gas is better
  score += normalized[5] * FEATURE_WEIGHTS.timeOfDay;
  score += normalized[6] * FEATURE_WEIGHTS.dayOfWeek;
  
  return Math.max(0, Math.min(1, score));
}

/**
 * Extract features from historical trade data for training
 */
export function extractTrainingFeatures(
  snapshot: Snapshot,
  route: Route,
  tradeSizeUsd: number,
  actualProfitUsd: number
): {
  features: number[];
  label: number; // 1 for profitable, 0 for unprofitable
} {
  const featureVector = extractFeatures(snapshot, route, tradeSizeUsd);
  const normalizedFeatures = normalizeFeatures(featureVector);
  
  // Binary label: 1 if profitable, 0 if not
  const label = actualProfitUsd > 0 ? 1 : 0;
  
  return {
    features: normalizedFeatures,
    label
  };
}

/**
 * Feature selection - identify most predictive features
 */
export function selectTopFeatures(
  trainingData: Array<{ features: number[]; label: number }>,
  topK: number = 5
): number[] {
  const featureCount = trainingData[0]?.features.length || 7;
  const correlations: number[] = [];
  
  for (let i = 0; i < featureCount; i++) {
    const featureValues = trainingData.map(d => d.features[i]);
    const labels = trainingData.map(d => d.label);
    
    const correlation = calculateCorrelation(featureValues, labels);
    correlations.push(Math.abs(correlation));
  }
  
  // Get indices of top K features by correlation
  const indices = correlations
    .map((corr, idx) => ({ corr, idx }))
    .sort((a, b) => b.corr - a.corr)
    .slice(0, topK)
    .map(item => item.idx);
  
  return indices;
}

/**
 * Calculate Pearson correlation coefficient
 */
function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n !== y.length || n === 0) return 0;
  
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
  const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
  const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
  
  const numerator = n * sumXY - sumX * sumY;
  const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
}
