import { TimeSeriesMLP } from '../ml/forecastModel';
import type { TrainingConfig, ModelMetrics } from '../ml/forecastModel';
import type { TimeSeriesPoint } from '../utils/trendMetrics';
import {
  saveModelToStorage,
  loadModelFromStorage,
  getAllModels,
  getModelsForItem,
  getBestModelForItem,
  deleteModelFromStorage,
  type SavedModel,
} from './modelService';

export type { SavedModel as SavedModelInfo };

/**
 * Service for managing trained models (100% Local Browser Storage - FREE)
 */
export class ModelManagementService {
  /**
   * Get all saved model info
   */
  static getAllModels(): SavedModel[] {
    return getAllModels();
  }

  /**
   * Get model info by ID
   */
  static getModelInfo(modelId: string): SavedModel | null {
    const models = getAllModels();
    return models.find(m => m.id === modelId) || null;
  }

  /**
   * Get models filtered by data type and item
   */
  static getModelsForItem(
    dataType: 'destination' | 'age',
    selectedItem: string
  ): SavedModel[] {
    return getModelsForItem(dataType, selectedItem);
  }

  /**
   * Get the best model for a specific item (highest accuracy)
   */
  static getBestModelForItem(
    dataType: 'destination' | 'age',
    selectedItem: string
  ): SavedModel | null {
    return getBestModelForItem(dataType, selectedItem);
  }

  /**
   * Delete model from storage
   */
  static async deleteModel(modelId: string): Promise<void> {
    await deleteModelFromStorage(modelId);
  }

  /**
   * Train a new model with hyperparameter tuning and save to local storage (FREE)
   */
  static async trainModelWithTuning(
    data: TimeSeriesPoint[],
    dataType: 'destination' | 'age',
    selectedItem: string,
    onProgress?: (current: number, total: number, config: Partial<TrainingConfig>, metrics: ModelMetrics) => void
  ): Promise<{ modelId: string; metrics: ModelMetrics; config: TrainingConfig }> {
    
    // Define hyperparameter grid
    const paramGrid: Partial<TrainingConfig>[] = [
      // Configuration 1: Small network, short window
      { windowSize: 3, hiddenLayers: [32, 16], activation: 'relu', learningRate: 0.001 },
      // Configuration 2: Medium network, short window
      { windowSize: 3, hiddenLayers: [64, 32, 16], activation: 'relu', learningRate: 0.001 },
      // Configuration 3: Medium network, medium window
      { windowSize: 5, hiddenLayers: [64, 32, 16], activation: 'relu', learningRate: 0.001 },
      // Configuration 4: Medium network, medium window, ELU
      { windowSize: 5, hiddenLayers: [64, 32, 16], activation: 'elu', learningRate: 0.001 },
      // Configuration 5: Large network, medium window
      { windowSize: 5, hiddenLayers: [128, 64, 32], activation: 'relu', learningRate: 0.001 },
      // Configuration 6: Medium network, large window
      { windowSize: 7, hiddenLayers: [64, 32, 16], activation: 'relu', learningRate: 0.001 },
      // Configuration 7: Large network, large window
      { windowSize: 7, hiddenLayers: [128, 64, 32], activation: 'relu', learningRate: 0.0005 },
      // Configuration 8: Extra large network, medium window
      { windowSize: 5, hiddenLayers: [256, 128, 64], activation: 'relu', learningRate: 0.0005 },
    ];

    // Create model instance for tuning
    const tempModel = new TimeSeriesMLP();

    // Perform hyperparameter tuning
    const { bestConfig, bestMetrics } = await tempModel.hyperparameterTuning(
      data,
      paramGrid,
      onProgress
    );

    // Dispose temporary model
    tempModel.dispose();

    // Train final model with best configuration
    const finalModel = new TimeSeriesMLP(bestConfig);
    const finalMetrics = await finalModel.train(data);

    // Get model state (needed for saving)
    const config = finalModel.getConfig();
    const tfModel = finalModel.getModel();
    const normalizationParams = finalModel.getNormalizationParams();
    const lastKnownValues = finalModel.getLastKnownValues();

    if (!tfModel || !normalizationParams || !lastKnownValues) {
      throw new Error('Model state not available for saving');
    }

    // Generate model name
    const modelName = `model_${dataType}_${selectedItem}_${Date.now()}`;
    const displayName = `${selectedItem} (${new Date().toLocaleDateString()})`;

    // Save the model to local storage (FREE)
    const modelId = await saveModelToStorage(
      tfModel,
      {
        name: modelName,
        displayName,
        dataType,
        selectedItem,
        config,
        metrics: finalMetrics,
        normalizationParams,
        lastKnownValues,
      }
    );

    // Dispose final model
    finalModel.dispose();

    return { modelId, metrics: finalMetrics, config };
  }

  /**
   * Load a trained model from local storage
   */
  static async loadModel(modelId: string): Promise<{
    model: TimeSeriesMLP;
    metadata: SavedModel;
  }> {
    try {
      // Load model and metadata
      const { model: tfModel, metadata } = await loadModelFromStorage(modelId);
      
      // Create TimeSeriesMLP wrapper
      const model = new TimeSeriesMLP(metadata.config);
      
      // Set the model state
      model.setModelState(
        tfModel as any,
        metadata.normalizationParams,
        metadata.lastKnownValues
      );
      
      return { model, metadata };
    } catch (error) {
      console.error('Error loading model:', error);
      throw error;
    }
  }
}
