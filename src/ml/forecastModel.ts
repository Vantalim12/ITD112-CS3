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

    return {
      loss: history.history.loss[finalEpoch] as number,
      valLoss: (history.history.val_loss?.[finalEpoch] as number) || 0,
      mae: (history.history.mae?.[finalEpoch] as number) || 0,
      mse: (history.history.mse?.[finalEpoch] as number) || 0,
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
   * @returns Best configuration and its metrics
   */
  async hyperparameterTuning(
    data: TimeSeriesPoint[],
    paramGrid: Partial<TrainingConfig>[]
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

