import { useState, useCallback, useRef } from 'react';
// Import the Class (Value)
import { TimeSeriesMLP } from '../ml/forecastModel';
// Import the Types (Interfaces)
import type { ForecastResult, ModelMetrics, TrainingConfig } from '../ml/forecastModel';
import { calculateYoYGrowthRate, calculateDatasetCAGR, calculateMultipleMovingAverages } from '../utils/trendMetrics';
import type { TimeSeriesPoint } from '../utils/trendMetrics';

export interface ForecastState {
  isTraining: boolean;
  isTrained: boolean;
  isForecasting: boolean;
  error: string | null;
  metrics: ModelMetrics | null;
  forecasts: ForecastResult[];
  movingAverages: Record<string, TimeSeriesPoint[]>;
  growthRates: TimeSeriesPoint[];
  cagr: number;
}

export interface UseForecastReturn {
  state: ForecastState;
  trainModel: (data: TimeSeriesPoint[], config?: Partial<TrainingConfig>) => Promise<void>;
  generateForecast: (horizon: number, startYear: number) => Promise<void>;
  reset: () => void;
  saveModel: (name: string) => Promise<void>;
  loadModel: (name: string) => Promise<void>;
}

/**
 * Custom hook for managing ML forecasting with time series data
 */
export function useForecast(): UseForecastReturn {
  const modelRef = useRef<TimeSeriesMLP | null>(null);
  
  const [state, setState] = useState<ForecastState>({
    isTraining: false,
    isTrained: false,
    isForecasting: false,
    error: null,
    metrics: null,
    forecasts: [],
    movingAverages: {},
    growthRates: [],
    cagr: 0,
  });

  /**
   * Train the MLP model on historical data
   */
  const trainModel = useCallback(async (
    data: TimeSeriesPoint[],
    config?: Partial<TrainingConfig>
  ) => {
    if (data.length < 6) {
      setState(prev => ({
        ...prev,
        error: 'Need at least 6 data points to train the model',
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isTraining: true,
      error: null,
      forecasts: [],
    }));

    try {
      // Create or reset model
      if (!modelRef.current) {
        modelRef.current = new TimeSeriesMLP(config);
      }

      // Calculate metrics
      const growthRates = calculateYoYGrowthRate(data);
      const cagr = calculateDatasetCAGR(data);
      const movingAverages = calculateMultipleMovingAverages(data, [3, 5, 10]);

      // Train model
      console.log('Training MLP model with', data.length, 'data points...');
      const metrics = await modelRef.current.train(data);
      console.log('Training completed:', metrics);

      setState(prev => ({
        ...prev,
        isTraining: false,
        isTrained: true,
        metrics,
        growthRates,
        cagr,
        movingAverages,
      }));
    } catch (error) {
      console.error('Training error:', error);
      setState(prev => ({
        ...prev,
        isTraining: false,
        isTrained: false,
        error: error instanceof Error ? error.message : 'Training failed',
      }));
    }
  }, []);

  /**
   * Generate forecasts using the trained model
   */
  const generateForecast = useCallback(async (
    horizon: number,
    startYear: number
  ) => {
    if (!modelRef.current || !state.isTrained) {
      setState(prev => ({
        ...prev,
        error: 'Model must be trained before generating forecasts',
      }));
      return;
    }

    if (horizon < 1 || horizon > 20) {
      setState(prev => ({
        ...prev,
        error: 'Forecast horizon must be between 1 and 20 years',
      }));
      return;
    }

    setState(prev => ({
      ...prev,
      isForecasting: true,
      error: null,
    }));

    try {
      console.log(`Generating ${horizon}-year forecast starting from ${startYear}...`);
      const forecasts = await modelRef.current.forecast(horizon, startYear);
      console.log('Forecast generated:', forecasts);

      setState(prev => ({
        ...prev,
        isForecasting: false,
        forecasts,
      }));
    } catch (error) {
      console.error('Forecast error:', error);
      setState(prev => ({
        ...prev,
        isForecasting: false,
        error: error instanceof Error ? error.message : 'Forecast generation failed',
      }));
    }
  }, [state.isTrained]);

  /**
   * Save trained model to local storage
   */
  const saveModel = useCallback(async (name: string) => {
    if (!modelRef.current) {
      setState(prev => ({
        ...prev,
        error: 'No model to save',
      }));
      return;
    }

    try {
      await modelRef.current.saveModel(name);
      console.log(`Model saved as: ${name}`);
    } catch (error) {
      console.error('Save error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to save model',
      }));
    }
  }, []);

  /**
   * Load trained model from local storage
   */
  const loadModel = useCallback(async (name: string) => {
    try {
      if (!modelRef.current) {
        modelRef.current = new TimeSeriesMLP();
      }
      
      await modelRef.current.loadModel(name);
      console.log(`Model loaded: ${name}`);
      
      setState(prev => ({
        ...prev,
        isTrained: true,
        error: null,
      }));
    } catch (error) {
      console.error('Load error:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to load model',
      }));
    }
  }, []);

  /**
   * Reset the forecast state and dispose of model
   */
  const reset = useCallback(() => {
    if (modelRef.current) {
      modelRef.current.dispose();
      modelRef.current = null;
    }

    setState({
      isTraining: false,
      isTrained: false,
      isForecasting: false,
      error: null,
      metrics: null,
      forecasts: [],
      movingAverages: {},
      growthRates: [],
      cagr: 0,
    });
  }, []);

  return {
    state,
    trainModel,
    generateForecast,
    reset,
    saveModel,
    loadModel,
  };
}

