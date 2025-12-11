import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
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
import { useForecast } from "../hooks/useForecast";
import type { ActivationFunction } from "../ml/forecastModel";
import { saveModelToFirebase } from "../api/modelService";

export const Route = createFileRoute("/forecast")({
  component: ForecastPage,
});

type DataType = "destination" | "age";
type ForecastHorizon = 5 | 10;

function ForecastPage() {
  const [dataType, setDataType] = useState<DataType>("destination");
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [forecastHorizon, setForecastHorizon] = useState<ForecastHorizon>(10);
  const [lookback, setLookback] = useState<number>(3);
  const [mlpNeurons, setMlpNeurons] = useState<string>("64, 32");
  const [activation, setActivation] = useState<ActivationFunction>("relu");
  const [activation2, setActivation2] = useState<ActivationFunction>("relu");

  const { countryTrends, ageGroupTrends, loading, error, countries, ageGroups } =
    useTrendData();
  const forecast = useForecast();

  // Get available items based on data type
  const availableItems =
    dataType === "destination" ? countries : ageGroups;

  // Set default item when data loads or type changes
  if (!selectedItem && availableItems.length > 0) {
    setSelectedItem(availableItems[0]);
  }

  // Get selected trend data
  const selectedTrendData = useMemo(() => {
    const trends =
      dataType === "destination" ? countryTrends : ageGroupTrends;
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

    const forecastPoints = forecast.state.forecasts.map((f) => ({
      year: f.year.toString(),
      actual: null,
      forecast: f.value,
    }));

    return [...historical, ...forecastPoints];
  }, [selectedTrendData, forecast.state.forecasts]);

  // Prepare moving averages for chart
  const movingAverageData = useMemo(() => {
    const result: any[] = [];

    selectedTrendData.forEach((d) => {
      const entry: any = { year: d.year.toString() };

      if (forecast.state.movingAverages.MA3) {
        const ma3 = forecast.state.movingAverages.MA3.find(
          (m) => m.year === d.year
        );
        if (ma3) entry.ma3 = ma3.value;
      }

      if (forecast.state.movingAverages.MA5) {
        const ma5 = forecast.state.movingAverages.MA5.find(
          (m) => m.year === d.year
        );
        if (ma5) entry.ma5 = ma5.value;
      }

      if (forecast.state.movingAverages.MA10) {
        const ma10 = forecast.state.movingAverages.MA10.find(
          (m) => m.year === d.year
        );
        if (ma10) entry.ma10 = ma10.value;
      }

      result.push(entry);
    });

    return result;
  }, [selectedTrendData, forecast.state.movingAverages]);

  const handleTrain = async () => {
    if (selectedTrendData.length < 6) {
      alert("Need at least 6 data points to train the model");
      return;
    }

    // Parse MLP neurons
    const hiddenLayers = mlpNeurons
      .split(",")
      .map((n) => parseInt(n.trim()))
      .filter((n) => !isNaN(n) && n > 0);

    if (hiddenLayers.length === 0) {
      alert("Invalid MLP neurons format. Use comma-separated numbers (e.g., 64, 32)");
      return;
    }

    await forecast.trainModel(selectedTrendData, {
      windowSize: lookback,
      hiddenLayers,
      activation,
      activation2,
    });
  };

  const handleForecast = async () => {
    if (!forecast.state.isTrained) {
      alert("Please train the model first");
      return;
    }

    const lastYear = selectedTrendData[selectedTrendData.length - 1].year;
    await forecast.generateForecast(forecastHorizon, lastYear + 1);
  };

  if (loading) {
    return (
      <div className="p-6 bg-primary min-h-screen flex items-center justify-center">
        <div className="text-gray-300">Loading data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-primary min-h-screen flex items-center justify-center">
        <div className="text-red-400">Error loading data: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-primary min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            ML Forecasting
          </h1>
          <p className="text-gray-300 text-lg">
            Time Series Forecasting using Multi-Layer Perceptron (MLP)
          </p>
        </div>

        {/* Controls */}
        <div className="bg-secondary rounded-lg p-6 border border-gray-700 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Configuration</h2>
          
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
                  forecast.reset();
                }}
                className="w-full p-3 border border-gray-600 rounded-lg bg-primary text-white focus:ring-highlights focus:border-highlights"
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
                onChange={(e) => {
                  setSelectedItem(e.target.value);
                  forecast.reset();
                }}
                className="w-full p-3 border border-gray-600 rounded-lg bg-primary text-white focus:ring-highlights focus:border-highlights"
              >
                {availableItems.map((item) => (
                  <option
                    key={item}
                    value={item}
                    className="bg-primary text-white"
                  >
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
                onChange={(e) =>
                  setForecastHorizon(parseInt(e.target.value) as ForecastHorizon)
                }
                className="w-full p-3 border border-gray-600 rounded-lg bg-primary text-white focus:ring-highlights focus:border-highlights"
              >
                <option value={5}>5 Years</option>
                <option value={10}>10 Years</option>
              </select>
            </div>
          </div>

          {/* Model Hyperparameters */}
          <div className="border-t border-gray-600 pt-4 mb-4">
            <h3 className="text-lg font-semibold text-white mb-3">Model Hyperparameters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Lookback */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Lookback (Window Size)
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={lookback}
                  onChange={(e) => setLookback(parseInt(e.target.value) || 3)}
                  className="w-full p-3 border border-gray-600 rounded-lg bg-primary text-white focus:ring-highlights focus:border-highlights"
                />
              </div>

              {/* MLP Neurons */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  MLP Neurons (Units)
                </label>
                <input
                  type="text"
                  value={mlpNeurons}
                  onChange={(e) => setMlpNeurons(e.target.value)}
                  placeholder="64, 32"
                  className="w-full p-3 border border-gray-600 rounded-lg bg-primary text-white focus:ring-highlights focus:border-highlights"
                />
              </div>

              {/* Activation Function Layer 1 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Activation (Layer 1)
                </label>
                <select
                  value={activation}
                  onChange={(e) => setActivation(e.target.value as ActivationFunction)}
                  className="w-full p-3 border border-gray-600 rounded-lg bg-primary text-white focus:ring-highlights focus:border-highlights"
                >
                  <option value="relu">ReLU</option>
                  <option value="elu">ELU</option>
                  <option value="tanh">Tanh</option>
                  <option value="sigmoid">Sigmoid</option>
                </select>
              </div>

              {/* Activation Function Layer 2 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Activation (Layer 2)
                </label>
                <select
                  value={activation2}
                  onChange={(e) => setActivation2(e.target.value as ActivationFunction)}
                  className="w-full p-3 border border-gray-600 rounded-lg bg-primary text-white focus:ring-highlights focus:border-highlights"
                >
                  <option value="relu">ReLU</option>
                  <option value="elu">ELU</option>
                  <option value="tanh">Tanh</option>
                  <option value="sigmoid">Sigmoid</option>
                </select>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-4">
            <button
              onClick={handleTrain}
              disabled={forecast.state.isTraining || selectedTrendData.length < 6}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {forecast.state.isTraining ? "Training..." : "Train Model"}
            </button>
            <button
              onClick={handleForecast}
              disabled={
                !forecast.state.isTrained ||
                forecast.state.isForecasting ||
                forecast.state.isTraining
              }
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              {forecast.state.isForecasting
                ? "Forecasting..."
                : "Generate Forecast"}
            </button>
            <button
              onClick={async () => {
                if (!forecast.state.metrics) {
                  alert("No trained model to save");
                  return;
                }
                
                try {
                  const modelName = `${dataType}_${selectedItem}_${new Date().toISOString()}`;
                  
                  // Parse MLP neurons for config
                  const hiddenLayers = mlpNeurons
                    .split(",")
                    .map((n) => parseInt(n.trim()))
                    .filter((n) => !isNaN(n) && n > 0);
                  
                  // Save to Firebase
                  const modelId = await saveModelToFirebase({
                    name: modelName,
                    dataType,
                    selectedItem,
                    config: {
                      windowSize: lookback,
                      epochs: 100, // default value
                      batchSize: 8, // default value
                      learningRate: 0.001, // default value
                      hiddenLayers,
                      activation,
                      activation2,
                      validationSplit: 0.2, // default value
                    },
                    metrics: forecast.state.metrics,
                    modelWeights: "", // Placeholder - TensorFlow.js models are complex to serialize
                    createdAt: new Date(),
                  });
                  
                  alert(`Model saved to Firebase!\nID: ${modelId}\nName: ${modelName}`);
                } catch (error) {
                  console.error("Error saving model:", error);
                  alert(`Failed to save model: ${error instanceof Error ? error.message : "Unknown error"}`);
                }
              }}
              disabled={!forecast.state.isTrained}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              Save Model to Firebase
            </button>
            <button
              onClick={forecast.reset}
              disabled={forecast.state.isTraining || forecast.state.isForecasting}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              Reset
            </button>
          </div>

          {/* Error Message */}
          {forecast.state.error && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-300">
              {forecast.state.error}
            </div>
          )}
        </div>

        {/* Metrics Cards */}
        {forecast.state.isTrained && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-4">
              {/* Training Loss */}
              {forecast.state.metrics && (
                <>
                  <div className="bg-secondary rounded-lg p-4 border border-gray-700">
                    <p className="text-gray-400 text-xs">MAE</p>
                    <p className="text-xl font-bold text-white">
                      {forecast.state.metrics.mae.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-secondary rounded-lg p-4 border border-gray-700">
                    <p className="text-gray-400 text-xs">RMSE</p>
                    <p className="text-xl font-bold text-white">
                      {forecast.state.metrics.rmse.toFixed(2)}
                    </p>
                  </div>
                  <div className="bg-secondary rounded-lg p-4 border border-gray-700">
                    <p className="text-gray-400 text-xs">MAPE</p>
                    <p className="text-xl font-bold text-white">
                      {forecast.state.metrics.mape.toFixed(2)}%
                    </p>
                  </div>
                  <div className="bg-secondary rounded-lg p-4 border border-gray-700">
                    <p className="text-gray-400 text-xs">R²</p>
                    <p className="text-xl font-bold text-white">
                      {forecast.state.metrics.r2.toFixed(4)}
                    </p>
                  </div>
                  <div className="bg-secondary rounded-lg p-4 border border-gray-700">
                    <p className="text-gray-400 text-xs">Accuracy</p>
                    <p className="text-xl font-bold text-green-400">
                      {forecast.state.metrics.accuracy.toFixed(2)}%
                    </p>
                  </div>
                </>
              )}

              {/* CAGR */}
              <div className="bg-secondary rounded-lg p-4 border border-gray-700">
                <p className="text-gray-400 text-xs">CAGR</p>
                <p className="text-xl font-bold text-white">
                  {forecast.state.cagr.toFixed(2)}%
                </p>
              </div>
            </div>

            {/* Model Configuration */}
            <div className="bg-secondary rounded-lg p-6 border border-gray-700 mb-6">
              <h3 className="text-lg font-semibold text-white mb-3">Trained Model Configuration</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Lookback</p>
                  <p className="text-white font-semibold">{lookback}</p>
                </div>
                <div>
                  <p className="text-gray-400">MLP Neurons</p>
                  <p className="text-white font-semibold">{mlpNeurons}</p>
                </div>
                <div>
                  <p className="text-gray-400">Activation L1</p>
                  <p className="text-white font-semibold">{activation.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-gray-400">Activation L2</p>
                  <p className="text-white font-semibold">{activation2.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-gray-400">Data Points</p>
                  <p className="text-white font-semibold">{selectedTrendData.length}</p>
                </div>
              </div>
            </div>
          </>
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

        {/* Moving Averages Chart */}
        {forecast.state.isTrained &&
          Object.keys(forecast.state.movingAverages).length > 0 && (
            <div className="bg-secondary rounded-lg p-6 border border-gray-700">
              <h2 className="text-xl font-semibold text-white mb-4">
                Moving Averages
              </h2>
              <div style={{ width: "100%", height: 400 }}>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart
                    data={movingAverageData}
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
                      dataKey="ma3"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      name="3-Year MA"
                    />
                    <Line
                      type="monotone"
                      dataKey="ma5"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      name="5-Year MA"
                    />
                    <Line
                      type="monotone"
                      dataKey="ma10"
                      stroke="#ec4899"
                      strokeWidth={2}
                      name="10-Year MA"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
      </div>
    </div>
  );
}

