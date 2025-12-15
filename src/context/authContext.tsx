import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import type { User } from 'firebase/auth';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export type UserRole = 'admin' | 'dataAnalyst' | 'viewer' | 'guest';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName: string;
  createdAt: Date;
  lastLogin: Date;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: UserRole | UserRole[]) => boolean;
  refreshUserProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, role?: UserRole) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        try {
          // Fetch user profile from Firestore
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            
            // Debug logging
            console.log('🔍 Loading user profile from Firestore:');
            console.log('  - User UID:', user.uid);
            console.log('  - Firestore data:', data);
            console.log('  - Role from Firestore:', data.role);
            console.log('  - Role type:', typeof data.role);
            
            const role = data.role || 'viewer';
            console.log('  - Final role assigned:', role);
            
            const profile = {
              uid: user.uid,
              email: user.email || '',
              role: role as UserRole,
              displayName: data.displayName || user.displayName || '',
              createdAt: data.createdAt?.toDate() || new Date(),
              lastLogin: new Date(),
            };
            
            console.log('  - Profile object:', profile);
            setUserProfile(profile);
            
            // Update last login
            await setDoc(doc(db, 'users', user.uid), {
              ...data,
              lastLogin: new Date(),
            }, { merge: true });
          } else {
            // Create default profile if doesn't exist
            const newProfile = {
              uid: user.uid,
              email: user.email || '',
              role: 'viewer' as UserRole,
              displayName: user.displayName || user.email?.split('@')[0] || 'User',
              createdAt: new Date(),
              lastLogin: new Date(),
            };
            await setDoc(doc(db, 'users', user.uid), newProfile);
            setUserProfile(newProfile);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          // Set a default profile if Firestore fails
          setUserProfile({
            uid: user.uid,
            email: user.email || '',
            role: 'viewer',
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
            createdAt: new Date(),
            lastLogin: new Date(),
          });
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const hasPermission = (permission: string): boolean => {
    if (!userProfile) {
      console.warn('⚠️ hasPermission called but userProfile is null. Permission:', permission);
      return false;
    }
    
    // Define permission matrix based on RBAC recommendations
    const permissions: Record<string, UserRole[]> = {
      // Data permissions
      'data.read': ['admin', 'dataAnalyst', 'viewer', 'guest'],
      'data.create': ['admin'],
      'data.update': ['admin'],
      'data.delete': ['admin'],
      'data.upload': ['admin'],
      
      // ML permissions
      'ml.train': ['admin', 'dataAnalyst'],
      'ml.forecast': ['admin', 'dataAnalyst', 'viewer'],
      'ml.manageModels': ['admin', 'dataAnalyst'],
      'ml.deleteModels': ['admin', 'dataAnalyst'],
      
      // Visualization permissions
      'visualizations.viewAll': ['admin', 'dataAnalyst', 'viewer'],
      'visualizations.export': ['admin', 'dataAnalyst'],
      
      // User management permissions
      'users.create': ['admin'],
      'users.read': ['admin'],
      'users.update': ['admin'],
      'users.delete': ['admin'],
      'users.manageRoles': ['admin'],
    };
    
    const hasAccess = permissions[permission]?.includes(userProfile.role) ?? false;
    
    console.log('🔐 Checking permission:', {
      permission,
      userRole: userProfile.role,
      allowedRoles: permissions[permission],
      hasAccess
    });
    
    return hasAccess;
  };

  const hasRole = (role: UserRole | UserRole[]): boolean => {
    if (!userProfile) {
      console.warn('⚠️ hasRole called but userProfile is null');
      return false;
    }
    
    const userRole = userProfile.role;
    console.log('🔐 Checking role access:', {
      required: role,
      userRole: userRole,
      hasAccess: Array.isArray(role) ? role.includes(userRole) : userRole === role
    });
    
    if (Array.isArray(role)) {
      return role.includes(userRole);
    }
    
    return userRole === role;
  };

  const refreshUserProfile = async (): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.warn('⚠️ Cannot refresh profile: no user logged in');
      return;
    }

    try {
      console.log('🔄 Refreshing user profile...');
      const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        console.log('✅ Profile refreshed. Role:', data.role);
        
        setUserProfile({
          uid: currentUser.uid,
          email: currentUser.email || '',
          role: (data.role || 'viewer') as UserRole,
          displayName: data.displayName || currentUser.displayName || '',
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLogin: new Date(),
        });
      }
    } catch (error) {
      console.error('❌ Error refreshing profile:', error);
    }
  };

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(error.message || 'Failed to sign in');
    }
  };

  const signUp = async (
    email: string, 
    password: string, 
    displayName: string,
    role: UserRole = 'viewer'
  ): Promise<void> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Create user profile in Firestore
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: email,
        role: role,
        displayName: displayName,
        createdAt: new Date(),
        lastLogin: new Date(),
      });
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error.message || 'Failed to sign up');
    }
  };

  const signInWithGoogle = async (): Promise<void> => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      
      // Check if user profile exists
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      if (!userDoc.exists()) {
        // Create profile for new Google users
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userCredential.user.email || '',
          role: 'viewer',
          displayName: userCredential.user.displayName || 'User',
          createdAt: new Date(),
          lastLogin: new Date(),
        });
      }
    } catch (error: any) {
      console.error('Google sign in error:', error);
      throw new Error(error.message || 'Failed to sign in with Google');
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error(error.message || 'Failed to sign out');
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      userProfile, 
      loading, 
      hasPermission, 
      hasRole,
      refreshUserProfile,
      signIn,
      signUp,
      signInWithGoogle,
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

