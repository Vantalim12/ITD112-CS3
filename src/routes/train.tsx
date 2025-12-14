import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useTrendData } from "../hooks/useTrendData";
import { ModelManagementService } from "../api/modelManagementService";
import type { SavedModelInfo } from "../api/modelManagementService";
import type { TrainingConfig, ModelMetrics } from "../ml/forecastModel";

export const Route = createFileRoute("/train")({
  component: TrainPage,
});

type DataType = "destination" | "age";

interface TrainingProgress {
  current: number;
  total: number;
  config: Partial<TrainingConfig>;
  metrics: ModelMetrics;
}

function TrainPage() {
  const [dataType, setDataType] = useState<DataType>("destination");
  const [selectedItem, setSelectedItem] = useState<string>("");
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState<TrainingProgress | null>(null);
  const [trainedModel, setTrainedModel] = useState<{
    modelId: string;
    metrics: ModelMetrics;
    config: TrainingConfig;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedModels, setSavedModels] = useState<SavedModelInfo[]>([]);

  const { countryTrends, ageGroupTrends, loading, error: dataError, countries, ageGroups } =
    useTrendData();

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

  // Load saved models for current selection
  const loadSavedModels = async () => {
    try {
      const models = await ModelManagementService.getModelsForItem(dataType, selectedItem);
      setSavedModels(models);
    } catch (error) {
      console.error('Error loading models:', error);
      setSavedModels([]);
    }
  };

  // Load models when selection changes
  useEffect(() => {
    if (selectedItem) {
      loadSavedModels();
    }
  }, [dataType, selectedItem]);

  const handleTrain = async () => {
    if (selectedTrendData.length < 6) {
      setError("Need at least 6 data points to train the model");
      return;
    }

    setIsTraining(true);
    setError(null);
    setTrainedModel(null);
    setTrainingProgress(null);

    try {
      console.log("Starting hyperparameter tuning and training...");
      
      const result = await ModelManagementService.trainModelWithTuning(
        selectedTrendData,
        dataType,
        selectedItem,
        (current, total, config, metrics) => {
          setTrainingProgress({ current, total, config, metrics });
        }
      );

      setTrainedModel({
        modelId: result.modelId,
        metrics: result.metrics,
        config: result.config,
      });
      await loadSavedModels();
      
      console.log("Training completed successfully!");
      console.log("Model ID:", result.modelId);
      console.log("Best Accuracy:", result.metrics.accuracy.toFixed(2) + "%");
      
    } catch (err) {
      console.error("Training error:", err);
      setError(err instanceof Error ? err.message : "Training failed");
    } finally {
      setIsTraining(false);
      setTrainingProgress(null);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm(`Are you sure you want to delete this model?`)) {
      return;
    }

    try {
      await ModelManagementService.deleteModel(modelId);
      await loadSavedModels();
      
      if (trainedModel && trainedModel.modelId === modelId) {
        setTrainedModel(null);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert(`Failed to delete model: ${err instanceof Error ? err.message : "Unknown error"}`);
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
            Model Training
          </h1>
          <p className="text-gray-300 text-lg">
            Train ML models with automatic hyperparameter tuning
          </p>
        </div>

        {/* Configuration */}
        <div className="bg-secondary rounded-lg p-6 border border-gray-700 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Data Selection</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                  setTrainedModel(null);
                }}
                disabled={isTraining}
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
                onChange={(e) => {
                  setSelectedItem(e.target.value);
                  setTrainedModel(null);
                }}
                disabled={isTraining}
                className="w-full p-3 border border-gray-600 rounded-lg bg-primary text-white focus:ring-highlights focus:border-highlights disabled:opacity-50"
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
          </div>

          {/* Data Info */}
          <div className="bg-primary/50 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-2">Dataset Info</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-400">Data Points</p>
                <p className="text-white font-semibold">{selectedTrendData.length}</p>
              </div>
              <div>
                <p className="text-gray-400">Year Range</p>
                <p className="text-white font-semibold">
                  {selectedTrendData.length > 0
                    ? `${selectedTrendData[0].year} - ${selectedTrendData[selectedTrendData.length - 1].year}`
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Min Value</p>
                <p className="text-white font-semibold">
                  {selectedTrendData.length > 0
                    ? Math.min(...selectedTrendData.map(d => d.value)).toLocaleString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-gray-400">Max Value</p>
                <p className="text-white font-semibold">
                  {selectedTrendData.length > 0
                    ? Math.max(...selectedTrendData.map(d => d.value)).toLocaleString()
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Training Info */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 mb-4">
            <h3 className="text-sm font-semibold text-blue-300 mb-2">ℹ️ Automatic Hyperparameter Tuning</h3>
            <p className="text-sm text-gray-300">
              The system will automatically test 8 different configurations with varying:
            </p>
            <ul className="text-sm text-gray-300 list-disc list-inside mt-2 space-y-1">
              <li>Window sizes (3, 5, 7 years lookback)</li>
              <li>Network architectures (32-16, 64-32-16, 128-64-32, 256-128-64 neurons)</li>
              <li>Activation functions (ReLU, ELU)</li>
              <li>Learning rates (0.001, 0.0005)</li>
            </ul>
            <p className="text-sm text-gray-300 mt-2">
              The model with the <strong>highest accuracy</strong> will be automatically selected and saved.
            </p>
          </div>

          {/* Train Button */}
          <button
            onClick={handleTrain}
            disabled={isTraining || selectedTrendData.length < 6}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors font-semibold"
          >
            {isTraining ? "Training in Progress..." : "Start Training"}
          </button>

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Training Progress */}
        {isTraining && trainingProgress && (
          <div className="bg-secondary rounded-lg p-6 border border-gray-700 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">Training Progress</h2>
            
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-300 mb-2">
                <span>Configuration {trainingProgress.current} of {trainingProgress.total}</span>
                <span>{Math.round((trainingProgress.current / trainingProgress.total) * 100)}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(trainingProgress.current / trainingProgress.total) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Current Config */}
            <div className="bg-primary/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Current Configuration</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-gray-400">Window Size</p>
                  <p className="text-white font-semibold">{trainingProgress.config.windowSize}</p>
                </div>
                <div>
                  <p className="text-gray-400">Hidden Layers</p>
                  <p className="text-white font-semibold">[{trainingProgress.config.hiddenLayers?.join(', ')}]</p>
                </div>
                <div>
                  <p className="text-gray-400">Activation</p>
                  <p className="text-white font-semibold">{trainingProgress.config.activation?.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-gray-400">Learning Rate</p>
                  <p className="text-white font-semibold">{trainingProgress.config.learningRate}</p>
                </div>
              </div>
              
              {/* Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm mt-3 pt-3 border-t border-gray-600">
                <div>
                  <p className="text-gray-400">Accuracy</p>
                  <p className="text-green-400 font-semibold">{trainingProgress.metrics.accuracy.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-gray-400">R²</p>
                  <p className="text-white font-semibold">{trainingProgress.metrics.r2.toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-gray-400">MAE</p>
                  <p className="text-white font-semibold">{trainingProgress.metrics.mae.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-400">RMSE</p>
                  <p className="text-white font-semibold">{trainingProgress.metrics.rmse.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-400">MAPE</p>
                  <p className="text-white font-semibold">{trainingProgress.metrics.mape.toFixed(2)}%</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Training Results */}
        {trainedModel && (
          <div className="bg-secondary rounded-lg p-6 border border-green-500 mb-6">
            <h2 className="text-xl font-semibold text-white mb-4">✅ Training Complete!</h2>
            
            {/* Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
              <div className="bg-primary/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Accuracy</p>
                <p className="text-2xl font-bold text-green-400">
                  {trainedModel.metrics.accuracy.toFixed(2)}%
                </p>
              </div>
              <div className="bg-primary/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs">R²</p>
                <p className="text-xl font-bold text-white">
                  {trainedModel.metrics.r2.toFixed(4)}
                </p>
              </div>
              <div className="bg-primary/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs">MAE</p>
                <p className="text-xl font-bold text-white">
                  {trainedModel.metrics.mae.toFixed(2)}
                </p>
              </div>
              <div className="bg-primary/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs">RMSE</p>
                <p className="text-xl font-bold text-white">
                  {trainedModel.metrics.rmse.toFixed(2)}
                </p>
              </div>
              <div className="bg-primary/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs">MAPE</p>
                <p className="text-xl font-bold text-white">
                  {trainedModel.metrics.mape.toFixed(2)}%
                </p>
              </div>
              <div className="bg-primary/50 rounded-lg p-4">
                <p className="text-gray-400 text-xs">Train Time</p>
                <p className="text-xl font-bold text-white">
                  {(trainedModel.metrics.trainTime / 1000).toFixed(1)}s
                </p>
              </div>
            </div>

            {/* Best Configuration */}
            <div className="bg-primary/50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Best Configuration</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <div>
                  <p className="text-gray-400">Window Size</p>
                  <p className="text-white font-semibold">{trainedModel.config.windowSize}</p>
                </div>
                <div>
                  <p className="text-gray-400">Hidden Layers</p>
                  <p className="text-white font-semibold">[{trainedModel.config.hiddenLayers.join(', ')}]</p>
                </div>
                <div>
                  <p className="text-gray-400">Activation</p>
                  <p className="text-white font-semibold">{trainedModel.config.activation.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-gray-400">Learning Rate</p>
                  <p className="text-white font-semibold">{trainedModel.config.learningRate}</p>
                </div>
                <div>
                  <p className="text-gray-400">Model ID</p>
                  <p className="text-white font-semibold text-xs break-all">{trainedModel.modelId}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-green-900/20 border border-green-500/30 rounded-lg text-green-300 text-sm">
              ✅ Model has been saved and is ready for forecasting. Go to the Forecast page to use it.
            </div>
          </div>
        )}

        {/* Saved Models */}
        <div className="bg-secondary rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-4">
            Saved Models for {selectedItem}
          </h2>
          
          {savedModels.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              No models trained yet for this selection. Train a model above to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {savedModels.map((model) => (
                <div
                  key={model.id}
                  className="bg-primary/50 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-white font-semibold">{model.displayName}</h3>
                      <p className="text-xs text-gray-400 mt-1">
                        Created: {new Date(model.createdAt).toLocaleString()}
                      </p>
                      {model.lastUsed && (
                        <p className="text-xs text-gray-400">
                          Last Used: {new Date(model.lastUsed).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteModel(model.id)}
                      className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
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
          )}
        </div>
      </div>
    </div>
  );
}

