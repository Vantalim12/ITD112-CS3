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

/**
 * Export a model to JSON file (includes metadata and model weights)
 */
export async function exportModelToFile(modelId: string): Promise<void> {
  try {
    // Get model metadata
    const allModels = getAllModels();
    const metadata = allModels.find(m => m.id === modelId);
    
    if (!metadata) {
      throw new Error('Model metadata not found');
    }
    
    // Load model from IndexedDB
    const model = await tf.loadLayersModel(`indexeddb://${metadata.modelStorageKey}`);
    
    // Save model to memory (as JSON)
    const modelArtifacts = await model.save(tf.io.withSaveHandler(async (artifacts) => artifacts));
    
    // Create export package
    const exportPackage = {
      metadata: metadata,
      modelArtifacts: {
        modelTopology: modelArtifacts.modelTopology,
        weightSpecs: modelArtifacts.weightSpecs,
        weightData: Array.from(new Uint8Array(modelArtifacts.weightData as ArrayBuffer)),
        format: modelArtifacts.format,
        generatedBy: modelArtifacts.generatedBy,
        convertedBy: modelArtifacts.convertedBy,
      },
      exportedAt: new Date().toISOString(),
      version: '1.0',
    };
    
    // Convert to JSON and download
    const jsonStr = JSON.stringify(exportPackage);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${metadata.name}_${modelId}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ Model exported successfully');
  } catch (error) {
    console.error('❌ Error exporting model:', error);
    throw error;
  }
}

/**
 * Import a model from JSON file
 */
export async function importModelFromFile(file: File): Promise<string> {
  try {
    // Read file
    const text = await file.text();
    const importPackage = JSON.parse(text);
    
    // Validate import package
    if (!importPackage.metadata || !importPackage.modelArtifacts) {
      throw new Error('Invalid model file format');
    }
    
    // Generate new model ID to avoid conflicts
    const newModelId = `model_imported_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const indexedDBKey = `tfjs_model_${newModelId}`;
    
    // Reconstruct weight data
    const weightData = new Uint8Array(importPackage.modelArtifacts.weightData).buffer;
    
    // Reconstruct model artifacts
    const modelArtifacts: tf.io.ModelArtifacts = {
      modelTopology: importPackage.modelArtifacts.modelTopology,
      weightSpecs: importPackage.modelArtifacts.weightSpecs,
      weightData: weightData,
      format: importPackage.modelArtifacts.format,
      generatedBy: importPackage.modelArtifacts.generatedBy,
      convertedBy: importPackage.modelArtifacts.convertedBy,
    };
    
    // Load model from artifacts
    const model = await tf.loadLayersModel(tf.io.fromMemory(modelArtifacts));
    
    // Save model to IndexedDB
    await model.save(`indexeddb://${indexedDBKey}`);
    
    console.log('✅ Model loaded and saved to IndexedDB');
    
    // Create new metadata with updated ID
    const newMetadata: SavedModel = {
      ...importPackage.metadata,
      id: newModelId,
      modelStorageKey: indexedDBKey,
      createdAt: new Date().toISOString(),
      displayName: `${importPackage.metadata.displayName} (Imported)`,
      lastUsed: undefined,
    };
    
    // Save metadata to localStorage
    const allModels = getAllModels();
    allModels.push(newMetadata);
    localStorage.setItem(MODELS_METADATA_KEY, JSON.stringify(allModels));
    
    console.log('✅ Model imported successfully with ID:', newModelId);
    return newModelId;
  } catch (error) {
    console.error('❌ Error importing model:', error);
    throw error;
  }
}
