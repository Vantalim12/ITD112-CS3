import { db } from '../firebase';
import { collection, addDoc, getDocs, doc, getDoc, deleteDoc, query, orderBy, limit } from 'firebase/firestore';
import type { TrainingConfig } from '../ml/forecastModel';
import type { ModelMetrics } from '../ml/forecastModel';

export interface SavedModel {
  id?: string;
  name: string;
  dataType: 'destination' | 'age';
  selectedItem: string;
  config: TrainingConfig;
  metrics: ModelMetrics;
  modelWeights: string; // Base64 encoded model weights
  createdAt: Date;
}

const MODELS_COLLECTION = 'trainedModels';

/**
 * Save a trained model to Firebase
 */
export async function saveModelToFirebase(modelData: Omit<SavedModel, 'id'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, MODELS_COLLECTION), {
      ...modelData,
      createdAt: new Date(),
    });
    console.log('Model saved to Firebase with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving model to Firebase:', error);
    throw error;
  }
}

/**
 * Load a model from Firebase by ID
 */
export async function loadModelFromFirebase(modelId: string): Promise<SavedModel> {
  try {
    const docRef = doc(db, MODELS_COLLECTION, modelId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Model not found');
    }
    
    return {
      id: docSnap.id,
      ...docSnap.data(),
    } as SavedModel;
  } catch (error) {
    console.error('Error loading model from Firebase:', error);
    throw error;
  }
}

/**
 * Get all saved models
 */
export async function getAllModels(): Promise<SavedModel[]> {
  try {
    const q = query(
      collection(db, MODELS_COLLECTION),
      orderBy('createdAt', 'desc')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as SavedModel[];
  } catch (error) {
    console.error('Error getting models from Firebase:', error);
    throw error;
  }
}

/**
 * Get models for a specific data type and item
 */
export async function getModelsForItem(
  dataType: 'destination' | 'age',
  selectedItem: string
): Promise<SavedModel[]> {
  try {
    const allModels = await getAllModels();
    return allModels.filter(
      model => model.dataType === dataType && model.selectedItem === selectedItem
    );
  } catch (error) {
    console.error('Error filtering models:', error);
    throw error;
  }
}

/**
 * Delete a model from Firebase
 */
export async function deleteModelFromFirebase(modelId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, MODELS_COLLECTION, modelId));
    console.log('Model deleted from Firebase');
  } catch (error) {
    console.error('Error deleting model from Firebase:', error);
    throw error;
  }
}

/**
 * Export model weights to base64 string
 */
export async function exportModelWeights(model: any): Promise<string> {
  try {
    // Save to IndexedDB temporarily
    await model.save('indexeddb://temp-model');
    
    // Load from IndexedDB and convert to base64
    const modelArtifacts = await model.save(tf.io.withSaveHandler(async (artifacts: any) => {
      const json = JSON.stringify(artifacts);
      return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } };
    }));
    
    // For now, return a placeholder - full implementation would serialize the model
    return btoa(JSON.stringify({ placeholder: 'model-weights' }));
  } catch (error) {
    console.error('Error exporting model weights:', error);
    throw error;
  }
}


