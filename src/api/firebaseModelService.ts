import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  where,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import type { SavedModel } from './modelService';

/**
 * Firebase Model Service - Sync model metadata to Firestore
 * This allows sharing model info across devices and users (respecting RBAC)
 */

export interface FirebaseModelMetadata {
  id: string;
  name: string;
  displayName: string;
  dataType: 'destination' | 'age';
  selectedItem: string;
  config: any;
  metrics: any;
  normalizationParams: {
    min: number;
    max: number;
  };
  createdBy: string;
  createdByEmail: string;
  createdAt: Timestamp;
  lastUsed?: Timestamp;
  isPublic: boolean;
}

/**
 * Save model metadata to Firestore
 */
export async function saveModelMetadataToFirebase(
  modelData: SavedModel
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to save model metadata to Firebase');
    }

    const modelRef = doc(db, 'mlModels', modelData.id);
    
    const firebaseData: FirebaseModelMetadata = {
      id: modelData.id,
      name: modelData.name,
      displayName: modelData.displayName,
      dataType: modelData.dataType,
      selectedItem: modelData.selectedItem,
      config: modelData.config,
      metrics: modelData.metrics,
      normalizationParams: modelData.normalizationParams,
      createdBy: user.uid,
      createdByEmail: user.email || '',
      createdAt: Timestamp.now(),
      isPublic: false, // Default to private
    };

    await setDoc(modelRef, firebaseData);
    console.log('✅ Model metadata saved to Firebase:', modelData.id);
  } catch (error) {
    console.error('❌ Error saving model metadata to Firebase:', error);
    throw error;
  }
}

/**
 * Get model metadata from Firestore by ID
 */
export async function getModelMetadataFromFirebase(
  modelId: string
): Promise<FirebaseModelMetadata | null> {
  try {
    const modelRef = doc(db, 'mlModels', modelId);
    const modelSnap = await getDoc(modelRef);
    
    if (modelSnap.exists()) {
      return modelSnap.data() as FirebaseModelMetadata;
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting model metadata from Firebase:', error);
    throw error;
  }
}

/**
 * Get all model metadata from Firestore (for current user or public)
 */
export async function getAllModelMetadataFromFirebase(): Promise<FirebaseModelMetadata[]> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const modelsCollection = collection(db, 'mlModels');
    
    // Get models created by current user or public models
    const userQuery = query(modelsCollection, where('createdBy', '==', user.uid));
    const publicQuery = query(modelsCollection, where('isPublic', '==', true));
    
    const [userSnapshot, publicSnapshot] = await Promise.all([
      getDocs(userQuery),
      getDocs(publicQuery),
    ]);
    
    const models: FirebaseModelMetadata[] = [];
    const seenIds = new Set<string>();
    
    // Add user models
    userSnapshot.forEach((doc) => {
      const data = doc.data() as FirebaseModelMetadata;
      models.push(data);
      seenIds.add(data.id);
    });
    
    // Add public models (avoid duplicates)
    publicSnapshot.forEach((doc) => {
      const data = doc.data() as FirebaseModelMetadata;
      if (!seenIds.has(data.id)) {
        models.push(data);
      }
    });
    
    return models;
  } catch (error) {
    console.error('❌ Error getting model metadata from Firebase:', error);
    throw error;
  }
}

/**
 * Get models for specific data type and item from Firestore
 */
export async function getModelMetadataForItem(
  dataType: 'destination' | 'age',
  selectedItem: string
): Promise<FirebaseModelMetadata[]> {
  try {
    const allModels = await getAllModelMetadataFromFirebase();
    return allModels.filter(
      model => model.dataType === dataType && model.selectedItem === selectedItem
    );
  } catch (error) {
    console.error('❌ Error getting model metadata for item from Firebase:', error);
    return [];
  }
}

/**
 * Delete model metadata from Firestore
 */
export async function deleteModelMetadataFromFirebase(modelId: string): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated');
    }

    // Check if user owns the model
    const modelRef = doc(db, 'mlModels', modelId);
    const modelSnap = await getDoc(modelRef);
    
    if (!modelSnap.exists()) {
      throw new Error('Model not found in Firebase');
    }
    
    const modelData = modelSnap.data() as FirebaseModelMetadata;
    if (modelData.createdBy !== user.uid) {
      // Check if user is admin (would need to check user role)
      // For now, throw error
      throw new Error('You do not have permission to delete this model');
    }

    await deleteDoc(modelRef);
    console.log('✅ Model metadata deleted from Firebase:', modelId);
  } catch (error) {
    console.error('❌ Error deleting model metadata from Firebase:', error);
    throw error;
  }
}

/**
 * Update model last used timestamp in Firestore
 */
export async function updateModelLastUsedInFirebase(modelId: string): Promise<void> {
  try {
    const modelRef = doc(db, 'mlModels', modelId);
    await setDoc(modelRef, {
      lastUsed: Timestamp.now(),
    }, { merge: true });
  } catch (error) {
    console.warn('⚠️ Error updating model last used in Firebase:', error);
  }
}

/**
 * Toggle model public/private status
 */
export async function toggleModelPublicStatus(
  modelId: string,
  isPublic: boolean
): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const modelRef = doc(db, 'mlModels', modelId);
    const modelSnap = await getDoc(modelRef);
    
    if (!modelSnap.exists()) {
      throw new Error('Model not found in Firebase');
    }
    
    const modelData = modelSnap.data() as FirebaseModelMetadata;
    if (modelData.createdBy !== user.uid) {
      throw new Error('You do not have permission to modify this model');
    }

    await setDoc(modelRef, {
      isPublic: isPublic,
    }, { merge: true });
    
    console.log(`✅ Model ${modelId} is now ${isPublic ? 'public' : 'private'}`);
  } catch (error) {
    console.error('❌ Error toggling model public status:', error);
    throw error;
  }
}

