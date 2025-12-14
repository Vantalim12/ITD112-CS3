import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useTrendData } from "../hooks/useTrendData";
import { ModelManagementService } from "../api/modelManagementService";
import type { SavedModelInfo } from "../api/modelManagementService";
import { TimeSeriesMLP } from "../ml/forecastModel";
import type { ForecastResult } from "../ml/forecastModel";

export const Route = createFileRoute("/forecast")({
  component: ForecastPage,
});

type DataType = "destination" | "age";
type ForecastHorizon = 5 | 10;

function ForecastPage() {
  const [dataType, setDataType] = useState<DataType>("destination");
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizon>(10);
  const [availableModels, setAvailableModels] = useState<SavedModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<SavedModelInfo | null>(null);
  const [loadedModel, setLoadedModel] = useState<TimeSeriesMLP | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isForecasting, setIsForecasting] = useState(false);
  const [forecasts, setForecasts] = useState<ForecastResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const { countryTrends, ageGroupTrends, loading, error: dataError, countries, ageGroups } =
    useTrendData();

  // Get available items based on data type
  const availableItems = dataType === "destination" ? countries : ageGroups;

  // Load available models when selection changes
  useEffect(() => {
    if (selectedItem) {
      try {
        const models = ModelManagementService.getModelsForItem(dataType, selectedItem);
        setAvailableModels(models);
        
        // Auto-select best model
        const bestModel = ModelManagementService.getBestModelForItem(dataType, selectedItem);
        setSelectedModel(bestModel);
        
        // Reset loaded model and forecasts
        if (loadedModel) {
          loadedModel.dispose();
          setLoadedModel(null);
        }
        setForecasts([]);
        setError(null);
      } catch (error) {
        console.error('Error loading models:', error);
        setError('Failed to load models from storage');
      }
    }
  }, [dataType, selectedItem]);

  // Set default item when data loads or type changes
  useEffect(() => {
    if (!selectedItem && availableItems.length > 0) {
      setSelectedItem(availableItems[0]);
    }
  }, [availableItems]);

  // Get selected trend data
  const selectedTrendData = useMemo(() => {
    const trends = dataType === "destination" ? countryTrends : ageGroupTrends;
    const trend = trends.find((t) => t.id === selectedItem);
    if (!trend) return [];

    return trend.data.map((d) => ({
      year: parseInt(d.x),
      value: d.y,
    }));
  }, [dataType, selectedItem, countryTrends, ageGroupTrends]);

  // Prepare chart data (combine historical + forecast)
  const chartData = useMemo(() => {
    const historical = selectedTrendData.map((d) => ({
      year: d.year.toString(),
      actual: d.value,
      forecast: null,
    }));

    const forecastPoints = forecasts.map((f) => ({
      year: f.year.toString(),
      actual: null,
      forecast: f.value,
    }));

    return [...historical, ...forecastPoints];
  }, [selectedTrendData, forecasts]);

  // Load model handler
  const handleLoadModel = async () => {
    if (!selectedModel) {
      setError("Please select a model first");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Loading model:", selectedModel.id);
      
      // Dispose previous model if exists
      if (loadedModel) {
        loadedModel.dispose();
      }

      const { model, metadata } = await ModelManagementService.loadModel(selectedModel.id);
      setLoadedModel(model);
      
      console.log("Model loaded successfully from local storage");
    } catch (err) {
      console.error("Load error:", err);
      setError(err instanceof Error ? err.message : "Failed to load model from IndexedDB");
    } finally {
      setIsLoading(false);
    }
  };

  // Generate forecast handler
  const handleForecast = async () => {
    if (!loadedModel) {
      setError("Please load a model first");
      return;
    }

    if (selectedTrendData.length === 0) {
      setError("No historical data available");
      return;
    }

    setIsForecasting(true);
    setError(null);

    try {
      const lastYear = selectedTrendData[selectedTrendData.length - 1].year;
      console.log(`Generating ${forecastHorizon}-year forecast starting from ${lastYear + 1}...`);
      
      const predictions = await loadedModel.forecast(forecastHorizon, lastYear + 1);
      setForecasts(predictions);
      
      console.log("Forecast generated:", predictions);
    } catch (err) {
      console.error("Forecast error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate forecast");
    } finally {
      setIsForecasting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-primary min-h-screen flex items-center justify-center">
        <div className="text-gray-300">Loading data...</div>
      </div>
    );
  }

  if (dataError) {
    return (
      <div className="p-6 bg-primary min-h-screen flex items-center justify-center">
        <div className="text-red-400">Error loading data: {dataError}</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-primary min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Forecasting
          </h1>
          <p className="text-gray-300 text-lg">
            Generate forecasts using pre-trained ML models (up to 10 years)
          </p>
        </div>

        {/* Controls */}
        <div className="bg-secondary rounded-lg p-6 border border-gray-700 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Select Data & Model</h2>
          
          {/* Data Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Data Type */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Data Type
              </label>
              <select
                value={dataType}
                onChange={(e) => {
                  setDataType(e.target.value as DataType);
                  setSelectedItem("");
                }}
                disabled={isLoading || isForecasting}
                className="w-full p-3 border border-gray-600 rounded-lg bg-primary text-white focus:ring-highlights focus:border-highlights disabled:opacity-50"
              >
                <option value="destination">Destination Country</option>
                <option value="age">Age Group</option>
              </select>
            </div>

            {/* Selected Item */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                {dataType === "destination" ? "Country" : "Age Group"}
              </label>
              <select
                value={selectedItem}
                onChange={(e) => setSelectedItem(e.target.value)}
                disabled={isLoading || isForecasting}
                className="w-full p-3 border border-gray-600 rounded-lg bg-primary text-white focus:ring-highlights focus:border-highlights disabled:opacity-50"
              >
                {availableItems.map((item) => (
                  <option key={item} value={item} className="bg-primary text-white">
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {/* Forecast Horizon */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Forecast Horizon (Years)
              </label>
              <select
                value={forecastHorizon}
                onChange={(e) => setForecastHorizon(parseInt(e.target.value) as ForecastHorizon)}
                className="w-full p-3 border border-gray-600 rounded-lg bg-primary text-white focus:ring-highlights focus:border-highlights"
              >
                <option value={5}>5 Years</option>
                <option value={10}>10 Years</option>
              </select>
            </div>
          </div>

          {/* Model Selection */}
          {availableModels.length === 0 ? (
            <div className="border-t border-gray-600 pt-4 mb-4">
              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <h3 className="text-yellow-300 font-semibold mb-2">⚠️ No Models Available</h3>
                <p className="text-gray-300 text-sm mb-2">
                  No trained models found for <strong>{selectedItem}</strong>.
                </p>
                <p className="text-gray-300 text-sm">
                  Please visit the <a href="/train" className="text-blue-400 hover:text-blue-300 underline">Training page</a> to train a model first.
                </p>
              </div>
            </div>
          ) : (
            <div className="border-t border-gray-600 pt-4 mb-4">
              <h3 className="text-lg font-semibold text-white mb-3">Available Models</h3>
              <div className="space-y-3 mb-4">
                {availableModels.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => setSelectedModel(model)}
                    className={`cursor-pointer rounded-lg p-4 border-2 transition-colors ${
                      selectedModel?.id === model.id
                        ? "border-blue-500 bg-blue-900/20"
                        : "border-gray-600 bg-primary/50 hover:border-gray-500"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="text-white font-semibold">{model.displayName}</h4>
                        <p className="text-xs text-gray-400 mt-1">
                          Created: {new Date(model.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {selectedModel?.id === model.id && (
                        <span className="text-blue-400 text-sm font-semibold">✓ Selected</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
                      <div>
                        <p className="text-gray-400">Accuracy</p>
                        <p className="text-green-400 font-semibold">{model.metrics.accuracy.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-400">R²</p>
                        <p className="text-white font-semibold">{model.metrics.r2.toFixed(4)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">MAE</p>
                        <p className="text-white font-semibold">{model.metrics.mae.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Window</p>
                        <p className="text-white font-semibold">{model.config.windowSize}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Layers</p>
                        <p className="text-white font-semibold text-xs">[{model.config.hiddenLayers.join(',')}]</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Activation</p>
                        <p className="text-white font-semibold">{model.config.activation.toUpperCase()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleLoadModel}
              disabled={!selectedModel || isLoading || loadedModel !== null}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isLoading ? "Loading Model..." : loadedModel ? "Model Loaded ✓" : "Load Model"}
            </button>
            <button
              onClick={handleForecast}
              disabled={!loadedModel || isForecasting}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {isForecasting ? "Generating..." : "Generate Forecast"}
            </button>
            <button
              onClick={() => {
                if (loadedModel) {
                  loadedModel.dispose();
                  setLoadedModel(null);
                }
                setForecasts([]);
                setError(null);
              }}
              disabled={isLoading || isForecasting}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-300">
              {error}
            </div>
          )}

          {/* Success Message */}
          {forecasts.length > 0 && (
            <div className="mt-4 p-4 bg-green-900/30 border border-green-500 rounded-lg text-green-300">
              ✓ Forecast generated successfully for {forecastHorizon} years
            </div>
          )}
        </div>

        {/* Loaded Model Info */}
        {loadedModel && selectedModel && (
          <div className="bg-secondary rounded-lg p-6 border border-green-500 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">✓ Loaded Model</h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
              <div className="bg-primary/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Accuracy</p>
                <p className="text-2xl font-bold text-green-400">
                  {selectedModel.metrics.accuracy.toFixed(2)}%
                </p>
              </div>
              <div className="bg-primary/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs">R²</p>
                <p className="text-xl font-bold text-white">
                  {selectedModel.metrics.r2.toFixed(4)}
                </p>
              </div>
              <div className="bg-primary/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs">MAE</p>
                <p className="text-xl font-bold text-white">
                  {selectedModel.metrics.mae.toFixed(2)}
                </p>
              </div>
              <div className="bg-primary/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs">RMSE</p>
                <p className="text-xl font-bold text-white">
                  {selectedModel.metrics.rmse.toFixed(2)}
                </p>
              </div>
              <div className="bg-primary/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs">MAPE</p>
                <p className="text-xl font-bold text-white">
                  {selectedModel.metrics.mape.toFixed(2)}%
                </p>
              </div>
              <div className="bg-primary/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Window Size</p>
                <p className="text-xl font-bold text-white">
                  {selectedModel.config.windowSize}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Chart */}
        <div className="bg-secondary rounded-lg p-6 border border-gray-700 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Time Series Forecast - {selectedItem}
          </h2>
          <div style={{ width: "100%", height: 500 }}>
            <ResponsiveContainer width="100%" height={500}>
              <LineChart
                data={chartData}
                margin={{ top: 20, right: 50, left: 80, bottom: 70 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  dataKey="year"
                  stroke="#9ca3af"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                />
                <YAxis
                  stroke="#9ca3af"
                  width={80}
                  label={{
                    value: "Emigrants",
                    angle: -90,
                    position: "insideLeft",
                    fill: "#fff",
                  }}
                  tick={{ fill: "#9ca3af", fontSize: 12 }}
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1f2937",
                    border: "1px solid #374151",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="actual"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  name="Historical"
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="#10b981"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ r: 4 }}
                  name="Forecast"
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
