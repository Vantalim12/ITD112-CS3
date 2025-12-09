/**
 * Utility functions for calculating time series metrics
 */

export interface TimeSeriesPoint {
  year: number;
  value: number;
}

/**
 * Calculate Year-over-Year Growth Rate
 * Formula: ((Current - Previous) / Previous) * 100
 */
export function calculateYoYGrowthRate(data: TimeSeriesPoint[]): TimeSeriesPoint[] {
  if (data.length < 2) return [];

  const sortedData = [...data].sort((a, b) => a.year - b.year);
  const growthRates: TimeSeriesPoint[] = [];

  for (let i = 1; i < sortedData.length; i++) {
    const current = sortedData[i].value;
    const previous = sortedData[i - 1].value;

    if (previous !== 0) {
      const growthRate = ((current - previous) / previous) * 100;
      growthRates.push({
        year: sortedData[i].year,
        value: growthRate,
      });
    }
  }

  return growthRates;
}

/**
 * Calculate Compound Annual Growth Rate (CAGR)
 * Formula: ((End Value / Start Value)^(1/Years)) - 1
 */
export function calculateCAGR(
  startValue: number,
  endValue: number,
  years: number
): number {
  if (startValue <= 0 || years <= 0) return 0;
  return (Math.pow(endValue / startValue, 1 / years) - 1) * 100;
}

/**
 * Calculate CAGR for entire dataset
 */
export function calculateDatasetCAGR(data: TimeSeriesPoint[]): number {
  if (data.length < 2) return 0;

  const sortedData = [...data].sort((a, b) => a.year - b.year);
  const startValue = sortedData[0].value;
  const endValue = sortedData[sortedData.length - 1].value;
  const years = sortedData[sortedData.length - 1].year - sortedData[0].year;

  return calculateCAGR(startValue, endValue, years);
}

/**
 * Calculate Moving Average
 * @param data - Time series data
 * @param window - Window size (e.g., 3, 5, 10)
 */
export function calculateMovingAverage(
  data: TimeSeriesPoint[],
  window: number
): TimeSeriesPoint[] {
  if (data.length < window) return [];

  const sortedData = [...data].sort((a, b) => a.year - b.year);
  const movingAverages: TimeSeriesPoint[] = [];

  for (let i = window - 1; i < sortedData.length; i++) {
    const windowData = sortedData.slice(i - window + 1, i + 1);
    const average =
      windowData.reduce((sum, point) => sum + point.value, 0) / window;

    movingAverages.push({
      year: sortedData[i].year,
      value: average,
    });
  }

  return movingAverages;
}

/**
 * Calculate multiple moving averages at once
 */
export function calculateMultipleMovingAverages(
  data: TimeSeriesPoint[],
  windows: number[]
): Record<string, TimeSeriesPoint[]> {
  const result: Record<string, TimeSeriesPoint[]> = {};

  windows.forEach((window) => {
    result[`MA${window}`] = calculateMovingAverage(data, window);
  });

  return result;
}

/**
 * Normalize data to 0-1 range (for ML model input)
 */
export function normalizeData(data: number[]): {
  normalized: number[];
  min: number;
  max: number;
} {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min;

  if (range === 0) {
    return {
      normalized: data.map(() => 0.5),
      min,
      max,
    };
  }

  const normalized = data.map((value) => (value - min) / range);

  return { normalized, min, max };
}

/**
 * Denormalize data back to original scale
 */
export function denormalizeData(
  normalized: number[],
  min: number,
  max: number
): number[] {
  const range = max - min;
  return normalized.map((value) => value * range + min);
}

/**
 * Create windowed dataset for time series prediction
 * @param data - Input time series data
 * @param windowSize - Number of past observations to use
 * @returns Array of [input_window, target_value] pairs
 */
export function createWindowedDataset(
  data: number[],
  windowSize: number
): { inputs: number[][]; targets: number[] } {
  const inputs: number[][] = [];
  const targets: number[] = [];

  for (let i = windowSize; i < data.length; i++) {
    inputs.push(data.slice(i - windowSize, i));
    targets.push(data[i]);
  }

  return { inputs, targets };
}

/**
 * Calculate basic statistics for a dataset
 */
export function calculateStatistics(data: TimeSeriesPoint[]): {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  total: number;
} {
  if (data.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0, total: 0 };
  }

  const values = data.map((d) => d.value);
  const sortedValues = [...values].sort((a, b) => a - b);

  const total = values.reduce((sum, val) => sum + val, 0);
  const mean = total / values.length;

  const median =
    values.length % 2 === 0
      ? (sortedValues[values.length / 2 - 1] + sortedValues[values.length / 2]) / 2
      : sortedValues[Math.floor(values.length / 2)];

  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    median,
    stdDev,
    min: Math.min(...values),
    max: Math.max(...values),
    total,
  };
}

