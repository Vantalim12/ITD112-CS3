import * as tf from '@tensorflow/tfjs';
import {
  normalizeData,
  denormalizeData,
  createWindowedDataset,
} from '../utils/trendMetrics';
import type { TimeSeriesPoint } from '../utils/trendMetrics';

export type ActivationFunction = 'relu' | 'tanh' | 'sigmoid' | 'elu' | 'softmax' | 'linear';

export interface TrainingConfig {
  windowSize: number;
  epochs: number;
  batchSize: number;
  learningRate: number;
  hiddenLayers: number[];
  activation: ActivationFunction;
  validationSplit: number;
}

export interface ForecastResult {
  year: number;
  value: number;
  type: 'forecast';
}

export interface ModelMetrics {
  loss: number;
  valLoss: number;
  mae: number;
  mse: number;
  rmse: number;
  mape: number;
  r2: number;
  accuracy: number;
  trainTime: number;
}

/**
 * MLP (Multi-Layer Perceptron) Model for Time Series Forecasting
 */
export class TimeSeriesMLP {
  private model: tf.Sequential | null = null;
  private config: TrainingConfig;
  private normalizationParams: { min: number; max: number } | null = null;
  private lastKnownValues: number[] = [];
  private isTrained: boolean = false;

  constructor(config?: Partial<TrainingConfig>) {
    // Default hyperparameters (tuned for emigrant data)
    this.config = {
      windowSize: config?.windowSize ?? 5,
      epochs: config?.epochs ?? 100,
      batchSize: config?.batchSize ?? 8,
      learningRate: config?.learningRate ?? 0.001,
      hiddenLayers: config?.hiddenLayers ?? [64, 32, 16],
      activation: config?.activation ?? 'relu',
      validationSplit: config?.validationSplit ?? 0.2,
    };
  }

  /**
   * Build the MLP model architecture
   */
  private buildModel(): tf.Sequential {
    const model = tf.sequential();

    // Input layer
    model.add(
      tf.layers.dense({
        units: this.config.hiddenLayers[0],
        activation: this.config.activation,
        inputShape: [this.config.windowSize],
        kernelInitializer: 'heNormal',
      })
    );

    // Add dropout for regularization
    model.add(tf.layers.dropout({ rate: 0.2 }));

    // Hidden layers
    for (let i = 1; i < this.config.hiddenLayers.length; i++) {
      model.add(
        tf.layers.dense({
          units: this.config.hiddenLayers[i],
          activation: this.config.activation,
          kernelInitializer: 'heNormal',
        })
      );
      model.add(tf.layers.dropout({ rate: 0.2 }));
    }

    // Output layer (single value prediction)
    model.add(
      tf.layers.dense({
        units: 1,
        activation: 'linear',
      })
    );

    // Compile model
    model.compile({
      optimizer: tf.train.adam(this.config.learningRate),
      loss: 'meanSquaredError',
      metrics: ['mae', 'mse'],
    });

    return model;
  }

  /**
   * Train the model on historical data
   * @param data - Time series data points
   * @returns Training metrics
   */
  async train(data: TimeSeriesPoint[]): Promise<ModelMetrics> {
    const startTime = Date.now();

    // Sort data by year
    const sortedData = [...data].sort((a, b) => a.year - b.year);
    const values = sortedData.map((d) => d.value);

    // Normalize data
    const { normalized, min, max } = normalizeData(values);
    this.normalizationParams = { min, max };

    // Create windowed dataset
    const { inputs, targets } = createWindowedDataset(
      normalized,
      this.config.windowSize
    );

    if (inputs.length === 0) {
      throw new Error(
        `Not enough data to train. Need at least ${this.config.windowSize + 1} data points.`
      );
    }

    // Store last known values for forecasting
    this.lastKnownValues = normalized.slice(-this.config.windowSize);

    // Convert to tensors
    const xs = tf.tensor2d(inputs);
    const ys = tf.tensor2d(targets, [targets.length, 1]);

    // Build model if not exists
    if (!this.model) {
      this.model = this.buildModel();
    }

    // Train model
    const history = await this.model.fit(xs, ys, {
      epochs: this.config.epochs,
      batchSize: this.config.batchSize,
      validationSplit: this.config.validationSplit,
      shuffle: true,
      verbose: 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(
              `Epoch ${epoch}: loss = ${logs?.loss?.toFixed(4)}, val_loss = ${logs?.val_loss?.toFixed(4)}`
            );
          }
        },
      },
    });

    // Clean up tensors
    xs.dispose();
    ys.dispose();

    this.isTrained = true;

    const trainTime = Date.now() - startTime;
    const finalEpoch = history.history.loss.length - 1;

    // Calculate additional metrics
    const mae = (history.history.mae?.[finalEpoch] as number) || 0;
    const mse = (history.history.mse?.[finalEpoch] as number) || 0;
    const rmse = Math.sqrt(mse);
    
    // Calculate MAPE, R², and Accuracy
    let mape = 0;
    let r2 = 0;
    
    try {
      // Make predictions on a sample to calculate MAPE and R²
      const sampleSize = Math.min(inputs.length, 50); // Use sample for performance
      const predictions: number[] = [];
      const actuals: number[] = [];
      
      for (let i = 0; i < sampleSize; i++) {
        const idx = sampleSize === 1 
          ? 0 
          : Math.floor((i / (sampleSize - 1)) * (inputs.length - 1));
        const input = tf.tensor2d([inputs[idx]]);
        const pred = this.model!.predict(input) as tf.Tensor;
        const predValue = (await pred.data())[0];
        predictions.push(predValue);
        actuals.push(targets[idx]);
        input.dispose();
        pred.dispose();
      }
      
      // Calculate MAPE
      const absolutePercentageErrors = predictions.map((pred, i) => {
        const actual = actuals[i];
        return actual !== 0 ? Math.abs((actual - pred) / actual) * 100 : 0;
      });
      mape = absolutePercentageErrors.reduce((sum, err) => sum + err, 0) / predictions.length;
      
      // Calculate R²
      const mean = actuals.reduce((sum, val) => sum + val, 0) / actuals.length;
      const ssTotal = actuals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
      const ssResidual = predictions.reduce((sum, pred, i) => sum + Math.pow(actuals[i] - pred, 2), 0);
      r2 = ssTotal !== 0 ? Math.max(0, 1 - (ssResidual / ssTotal)) : 0;
      
    } catch (error) {
      console.warn('Could not calculate MAPE/R²:', error);
    }
    
    // Calculate accuracy (100 - MAPE), capped at 100%
    const accuracy = Math.min(100, Math.max(0, 100 - mape));

    return {
      loss: history.history.loss[finalEpoch] as number,
      valLoss: (history.history.val_loss?.[finalEpoch] as number) || 0,
      mae,
      mse,
      rmse,
      mape,
      r2,
      accuracy,
      trainTime,
    };
  }

  /**
   * Generate forecasts for future time periods
   * @param horizon - Number of periods to forecast (e.g., 10 years)
   * @param startYear - Starting year for forecasts
   * @returns Array of forecast results
   */
  async forecast(horizon: number, startYear: number): Promise<ForecastResult[]> {
    if (!this.model || !this.isTrained) {
      throw new Error('Model must be trained before generating forecasts');
    }

    if (!this.normalizationParams) {
      throw new Error('Normalization parameters not available');
    }

    const forecasts: ForecastResult[] = [];
    let currentWindow = [...this.lastKnownValues];

    for (let i = 0; i < horizon; i++) {
      // Predict next value
      const input = tf.tensor2d([currentWindow]);
      const prediction = this.model.predict(input) as tf.Tensor;
      const predictedValue = (await prediction.data())[0];

      // Clean up tensors
      input.dispose();
      prediction.dispose();

      // Denormalize prediction
      const denormalizedValue = denormalizeData(
        [predictedValue],
        this.normalizationParams.min,
        this.normalizationParams.max
      )[0];

      // Ensure non-negative values (emigrant counts can't be negative)
      const finalValue = Math.max(0, Math.round(denormalizedValue));

      forecasts.push({
        year: startYear + i,
        value: finalValue,
        type: 'forecast',
      });

      // Update window for next prediction
      currentWindow = [...currentWindow.slice(1), predictedValue];
    }

    return forecasts;
  }

  /**
   * Hyperparameter tuning using grid search
   * @param data - Training data
   * @param paramGrid - Grid of parameters to test
   * @param onProgress - Optional callback for progress updates
   * @returns Best configuration and its metrics
   */
  async hyperparameterTuning(
    data: TimeSeriesPoint[],
    paramGrid: Partial<TrainingConfig>[],
    onProgress?: (current: number, total: number, config: Partial<TrainingConfig>, metrics: ModelMetrics) => void
  ): Promise<{ bestConfig: TrainingConfig; bestMetrics: ModelMetrics }> {
    let bestMetrics: ModelMetrics | null = null;
    let bestConfig: TrainingConfig | null = null;

    console.log('Starting hyperparameter tuning...');

    for (let i = 0; i < paramGrid.length; i++) {
      const config = { ...this.config, ...paramGrid[i] };
      console.log(`Testing configuration ${i + 1}/${paramGrid.length}:`, config);

      // Create new model instance with this config
      const tempModel = new TimeSeriesMLP(config);

      try {
        const metrics = await tempModel.train(data);
        console.log(`  Loss: ${metrics.loss.toFixed(4)}, Val Loss: ${metrics.valLoss.toFixed(4)}`);

        // Report progress
        if (onProgress) {
          onProgress(i + 1, paramGrid.length, paramGrid[i], metrics);
        }

        // Select best based on validation loss (lower is better)
        if (!bestMetrics || metrics.valLoss < bestMetrics.valLoss) {
          bestMetrics = metrics;
          bestConfig = config;
          console.log('  ✓ New best configuration!');
        }
      } catch (error) {
        console.error(`  ✗ Failed with error:`, error);
      }

      // Dispose model to free memory
      tempModel.dispose();
    }

    if (!bestConfig || !bestMetrics) {
      throw new Error('Hyperparameter tuning failed - no valid configurations found');
    }

    console.log('Best configuration found:', bestConfig);
    return { bestConfig, bestMetrics };
  }

  /**
   * Save model to browser local storage
   */
  async saveModel(name: string): Promise<void> {
    if (!this.model) {
      throw new Error('No model to save');
    }
    await this.model.save(`localstorage://${name}`);
  }

  /**
   * Load model from browser local storage
   */
  async loadModel(name: string): Promise<void> {
    this.model = (await tf.loadLayersModel(
      `localstorage://${name}`
    )) as tf.Sequential;
    this.isTrained = true;
  }

  /**
   * Check if model is trained and ready for forecasting
   */
  isReady(): boolean {
    return this.isTrained && this.model !== null;
  }

  /**
   * Get model configuration
   */
  getConfig(): TrainingConfig {
    return { ...this.config };
  }

  /**
   * Get the TensorFlow.js model
   */
  getModel(): tf.Sequential | null {
    return this.model;
  }

  /**
   * Get normalization parameters
   */
  getNormalizationParams(): { min: number; max: number } | null {
    return this.normalizationParams;
  }

  /**
   * Get last known values (window)
   */
  getLastKnownValues(): number[] | null {
    return this.lastKnownValues;
  }

  /**
   * Set model state (for loading saved models)
   */
  setModelState(
    model: tf.Sequential,
    normalizationParams: { min: number; max: number },
    lastKnownValues: number[]
  ): void {
    this.model = model;
    this.normalizationParams = normalizationParams;
    this.lastKnownValues = lastKnownValues;
    this.isTrained = true;
  }

  /**
   * Dispose of model and free memory
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isTrained = false;
  }
}

