import fs from 'fs/promises';
import path from 'path';
import type { FeatureVector, AIModelState } from '@pkg/shared';
import { normalizeFeatures } from './features';

export class AIModel {
  private weights: number[] = [];
  private bias: number = 0;
  private accuracy: number = 0;
  private lastTrained: Date = new Date();
  private sampleCount: number = 0;
  private modelPath: string;

  constructor(modelPath: string = './packages/ai/model.json') {
    this.modelPath = modelPath;
  }

  /**
   * Load model from disk
   */
  async load(): Promise<void> {
    try {
      const modelData = await fs.readFile(this.modelPath, 'utf-8');
      const state: AIModelState = JSON.parse(modelData);
      
      this.weights = state.weights;
      this.bias = state.bias;
      this.accuracy = state.accuracy;
      this.lastTrained = new Date(state.lastTrained);
      this.sampleCount = state.sampleCount;
      
      console.log(`AI model loaded: ${this.weights.length} features, ${this.accuracy.toFixed(3)} accuracy`);
    } catch (error) {
      console.log('No existing model found, initializing with default weights');
      this.initializeDefaultWeights();
    }
  }

  /**
   * Save model to disk
   */
  async save(): Promise<void> {
    const state: AIModelState = {
      weights: this.weights,
      bias: this.bias,
      accuracy: this.accuracy,
      lastTrained: this.lastTrained,
      sampleCount: this.sampleCount
    };

    // Ensure directory exists
    const dir = path.dirname(this.modelPath);
    await fs.mkdir(dir, { recursive: true });
    
    await fs.writeFile(this.modelPath, JSON.stringify(state, null, 2));
    console.log(`Model saved to ${this.modelPath}`);
  }

  /**
   * Score a trade opportunity
   */
  async score(features: FeatureVector): Promise<number> {
    if (this.weights.length === 0) {
      await this.load();
    }

    const normalizedFeatures = normalizeFeatures(features);
    
    // Logistic regression prediction
    let z = this.bias;
    for (let i = 0; i < Math.min(normalizedFeatures.length, this.weights.length); i++) {
      z += normalizedFeatures[i] * this.weights[i];
    }
    
    // Sigmoid function
    const probability = 1 / (1 + Math.exp(-z));
    
    return probability;
  }

  /**
   * Train the model using stochastic gradient descent
   */
  async train(trainingData: Array<{ features: number[]; label: number }>): Promise<void> {
    if (trainingData.length === 0) {
      console.log('No training data provided');
      return;
    }

    const learningRate = 0.01;
    const epochs = 100;
    const featureCount = trainingData[0].features.length;

    // Initialize weights if needed
    if (this.weights.length !== featureCount) {
      this.weights = new Array(featureCount).fill(0).map(() => Math.random() * 0.1 - 0.05);
      this.bias = 0;
    }

    console.log(`Training on ${trainingData.length} samples for ${epochs} epochs`);

    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;
      
      // Shuffle training data
      const shuffled = [...trainingData].sort(() => Math.random() - 0.5);
      
      for (const sample of shuffled) {
        const { features, label } = sample;
        
        // Forward pass
        let z = this.bias;
        for (let i = 0; i < features.length; i++) {
          z += features[i] * this.weights[i];
        }
        
        const prediction = 1 / (1 + Math.exp(-z));
        const loss = -label * Math.log(prediction + 1e-8) - (1 - label) * Math.log(1 - prediction + 1e-8);
        totalLoss += loss;
        
        // Backward pass (gradient calculation)
        const error = prediction - label;
        
        // Update weights
        for (let i = 0; i < features.length; i++) {
          this.weights[i] -= learningRate * error * features[i];
        }
        this.bias -= learningRate * error;
      }
      
      if (epoch % 20 === 0) {
        console.log(`Epoch ${epoch}: Average loss = ${(totalLoss / trainingData.length).toFixed(4)}`);
      }
    }

    // Calculate accuracy on training data
    this.accuracy = await this.calculateAccuracy(trainingData);
    this.lastTrained = new Date();
    this.sampleCount = trainingData.length;
    
    console.log(`Training completed. Accuracy: ${(this.accuracy * 100).toFixed(1)}%`);
    
    await this.save();
  }

  /**
   * Calculate model accuracy
   */
  private async calculateAccuracy(data: Array<{ features: number[]; label: number }>): Promise<number> {
    let correct = 0;
    
    for (const sample of data) {
      const { features, label } = sample;
      
      let z = this.bias;
      for (let i = 0; i < features.length; i++) {
        z += features[i] * this.weights[i];
      }
      
      const probability = 1 / (1 + Math.exp(-z));
      const prediction = probability >= 0.5 ? 1 : 0;
      
      if (prediction === label) {
        correct++;
      }
    }
    
    return correct / data.length;
  }

  /**
   * Initialize default weights for cold start
   */
  private initializeDefaultWeights(): void {
    // Default weights based on feature importance
    this.weights = [
      0.5,  // spreadBps - most important
      0.3,  // depthUsd - second most important
      -0.2, // volatility - negative (high volatility bad)
      0.1,  // sizeTier - moderate importance
      -0.1, // gasPrice - negative (high gas bad)
      0.05, // timeOfDay - minor importance
      0.05  // dayOfWeek - minor importance
    ];
    this.bias = 0;
    this.accuracy = 0.5; // Random guess baseline
    this.lastTrained = new Date();
    this.sampleCount = 0;
  }

  /**
   * Get model statistics
   */
  getStats(): {
    accuracy: number;
    lastTrained: Date;
    sampleCount: number;
    weightMagnitude: number;
  } {
    const weightMagnitude = Math.sqrt(this.weights.reduce((sum, w) => sum + w * w, 0));
    
    return {
      accuracy: this.accuracy,
      lastTrained: this.lastTrained,
      sampleCount: this.sampleCount,
      weightMagnitude
    };
  }

  /**
   * Feature importance analysis
   */
  getFeatureImportance(): Array<{ feature: string; weight: number; importance: number }> {
    const featureNames = [
      'spreadBps',
      'depthUsd', 
      'volatility',
      'sizeTier',
      'gasPrice',
      'timeOfDay',
      'dayOfWeek'
    ];

    return this.weights.map((weight, index) => ({
      feature: featureNames[index] || `feature_${index}`,
      weight,
      importance: Math.abs(weight)
    })).sort((a, b) => b.importance - a.importance);
  }

  /**
   * Retrain model from database
   */
  async retrain(): Promise<void> {
    // This would fetch training data from database
    // For now, using mock data
    const mockTrainingData = this.generateMockTrainingData(1000);
    await this.train(mockTrainingData);
  }

  private generateMockTrainingData(count: number): Array<{ features: number[]; label: number }> {
    const data = [];
    
    for (let i = 0; i < count; i++) {
      const spread = Math.random() * 100;
      const depth = Math.random() * 100000;
      const volatility = Math.random() * 50;
      const sizeTier = Math.floor(Math.random() * 4) + 1;
      const gasPrice = Math.random() * 100;
      const timeOfDay = Math.random() * 24;
      const dayOfWeek = Math.floor(Math.random() * 7);
      
      const features = [
        spread / 100,
        Math.log(depth) / 20,
        volatility / 50,
        sizeTier / 4,
        gasPrice / 100,
        timeOfDay / 24,
        dayOfWeek / 7
      ];
      
      // Simple rule: profitable if spread > 20 and volatility < 25
      const label = spread > 20 && volatility < 25 ? 1 : 0;
      
      data.push({ features, label });
    }
    
    return data;
  }
}
