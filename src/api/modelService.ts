import * as tf from '@tensorflow/tfjs';
import type { TrainingConfig, ModelMetrics } from '../ml/forecastModel';

export interface SavedModel {
  id: string;
  name: string;
  displayName: string;
  dataType: 'destination' | 'age';
  selectedItem: string;
  config: TrainingConfig;
  metrics: ModelMetrics;
  modelStorageKey: string; // IndexedDB key for the model
  normalizationParams: {
    min: number;
    max: number;
  };
  lastKnownValues: number[];
  createdAt: string;
  lastUsed?: string;
}

const MODELS_METADATA_KEY = 'ml_models_metadata';

/**
 * Save a TensorFlow.js model to IndexedDB and metadata to localStorage (100% FREE)
 */
export async function saveModelToStorage(
  model: tf.LayersModel,
  modelData: {
    name: string;
    displayName: string;
    dataType: 'destination' | 'age';
    selectedItem: string;
    config: TrainingConfig;
    metrics: ModelMetrics;
    normalizationParams: { min: number; max: number };
    lastKnownValues: number[];
  }
): Promise<string> {
  try {
    // Generate unique model ID
    const modelId = `model_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const indexedDBKey = `tfjs_model_${modelId}`;
    
    // Save model to IndexedDB (TensorFlow.js built-in)
    await model.save(`indexeddb://${indexedDBKey}`);
    
    console.log('✅ Model saved to IndexedDB:', indexedDBKey);
    
    // Create model metadata
    const savedModel: SavedModel = {
      id: modelId,
      name: modelData.name,
      displayName: modelData.displayName,
      dataType: modelData.dataType,
      selectedItem: modelData.selectedItem,
      config: modelData.config,
      metrics: modelData.metrics,
      modelStorageKey: indexedDBKey,
      normalizationParams: modelData.normalizationParams,
      lastKnownValues: modelData.lastKnownValues,
      createdAt: new Date().toISOString(),
    };
    
    // Save metadata to localStorage
    const allModels = getAllModels();
    allModels.push(savedModel);
    localStorage.setItem(MODELS_METADATA_KEY, JSON.stringify(allModels));
    
    console.log('✅ Model metadata saved to localStorage with ID:', modelId);
    return modelId;
  } catch (error) {
    console.error('❌ Error saving model:', error);
    throw error;
  }
}

/**
 * Load a model from IndexedDB by ID
 */
export async function loadModelFromStorage(modelId: string): Promise<{
  model: tf.LayersModel;
  metadata: SavedModel;
}> {
  try {
    // Get metadata from localStorage
    const allModels = getAllModels();
    const metadata = allModels.find(m => m.id === modelId);
    
    if (!metadata) {
      throw new Error('Model metadata not found in localStorage');
    }
    
    // Load model from IndexedDB
    console.log('Loading model from IndexedDB:', metadata.modelStorageKey);
    const model = await tf.loadLayersModel(`indexeddb://${metadata.modelStorageKey}`);
    
    // Update last used timestamp
    updateModelLastUsed(modelId);
    
    return {
      model: model as tf.LayersModel,
      metadata: metadata,
    };
  } catch (error) {
    console.error('❌ Error loading model:', error);
    throw error;
  }
}

/**
 * Get all saved models from localStorage
 */
export function getAllModels(): SavedModel[] {
  try {
    const data = localStorage.getItem(MODELS_METADATA_KEY);
    if (!data) return [];
    
    return JSON.parse(data) as SavedModel[];
  } catch (error) {
    console.error('Error getting models from localStorage:', error);
    return [];
  }
}

/**
 * Get models for a specific data type and item
 */
export function getModelsForItem(
  dataType: 'destination' | 'age',
  selectedItem: string
): SavedModel[] {
  const allModels = getAllModels();
  return allModels.filter(
    model => model.dataType === dataType && model.selectedItem === selectedItem
  );
}

/**
 * Get the best model for a specific item (highest accuracy)
 */
export function getBestModelForItem(
  dataType: 'destination' | 'age',
  selectedItem: string
): SavedModel | null {
  const models = getModelsForItem(dataType, selectedItem);
  if (models.length === 0) return null;
  
  return models.reduce((best, current) => {
    const currentAccuracy = current.metrics.accuracy ?? 0;
    const bestAccuracy = best.metrics.accuracy ?? 0;
    return currentAccuracy > bestAccuracy ? current : best;
  });
}

/**
 * Delete a model from both IndexedDB and localStorage
 */
export async function deleteModelFromStorage(modelId: string): Promise<void> {
  try {
    // Get model metadata
    const allModels = getAllModels();
    const model = allModels.find(m => m.id === modelId);
    
    if (!model) {
      throw new Error('Model not found');
    }
    
    // Delete model from IndexedDB
    try {
      // Note: Deleting specific models from IndexedDB is complex
      // The model is stored with TensorFlow.js internal structure
      // We remove metadata and the model will be garbage collected
      await tf.io.removeModel(`indexeddb://${model.modelStorageKey}`);
      console.log('✅ Model deleted from IndexedDB');
    } catch (storageError) {
      console.warn('⚠️ Could not delete model from IndexedDB:', storageError);
      // Continue anyway - at least metadata is deleted
    }
    
    // Delete metadata from localStorage
    const updatedModels = allModels.filter(m => m.id !== modelId);
    localStorage.setItem(MODELS_METADATA_KEY, JSON.stringify(updatedModels));
    
    console.log('✅ Model deleted');
  } catch (error) {
    console.error('❌ Error deleting model:', error);
    throw error;
  }
}

/**
 * Update last used timestamp for a model
 */
export function updateModelLastUsed(modelId: string): void {
  try {
    const allModels = getAllModels();
    const model = allModels.find(m => m.id === modelId);
    
    if (model) {
      model.lastUsed = new Date().toISOString();
      localStorage.setItem(MODELS_METADATA_KEY, JSON.stringify(allModels));
    }
  } catch (error) {
    console.warn('Error updating last used timestamp:', error);
  }
}
