# RBAC (Role-Based Access Control) Recommendations

## Overview
This document provides recommendations for implementing Role-Based Access Control (RBAC) in your CS2-SirPaul Data Visualization & ML application.

## Recommended Roles

### 1. **Admin**
- Full access to all features
- Can manage users and roles
- Can access CRUD operations
- Can train and manage ML models
- Can view all visualizations
- Can upload/populate data

**Permissions:**
```typescript
const adminPermissions = {
  data: {
    read: true,
    create: true,
    update: true,
    delete: true,
    upload: true,
  },
  ml: {
    train: true,
    forecast: true,
    manageModels: true,
    deleteModels: true,
  },
  visualizations: {
    viewAll: true,
    export: true,
  },
  users: {
    create: true,
    read: true,
    update: true,
    delete: true,
    manageRoles: true,
  },
};
```

### 2. **Data Analyst**
- Read access to all data
- Can view all visualizations
- Can train and use ML models
- **Cannot** modify core data
- **Cannot** manage users

**Permissions:**
```typescript
const dataAnalystPermissions = {
  data: {
    read: true,
    create: false,
    update: false,
    delete: false,
    upload: false,
  },
  ml: {
    train: true,
    forecast: true,
    manageModels: true, // Only their own models
    deleteModels: true, // Only their own models
  },
  visualizations: {
    viewAll: true,
    export: true,
  },
  users: {
    create: false,
    read: false,
    update: false,
    delete: false,
    manageRoles: false,
  },
};
```

### 3. **Viewer**
- Read-only access
- Can view visualizations
- Can generate forecasts using existing models
- **Cannot** train models
- **Cannot** modify data

**Permissions:**
```typescript
const viewerPermissions = {
  data: {
    read: true,
    create: false,
    update: false,
    delete: false,
    upload: false,
  },
  ml: {
    train: false,
    forecast: true, // Only using pre-trained models
    manageModels: false,
    deleteModels: false,
  },
  visualizations: {
    viewAll: true,
    export: false,
  },
  users: {
    create: false,
    read: false,
    update: false,
    delete: false,
    manageRoles: false,
  },
};
```

### 4. **Guest** (Optional)
- Limited read access
- Can view only public dashboards
- No ML access
- No data modification

**Permissions:**
```typescript
const guestPermissions = {
  data: {
    read: true, // Limited to public datasets
    create: false,
    update: false,
    delete: false,
    upload: false,
  },
  ml: {
    train: false,
    forecast: false,
    manageModels: false,
    deleteModels: false,
  },
  visualizations: {
    viewAll: false, // Only specific pages
    export: false,
  },
  users: {
    create: false,
    read: false,
    update: false,
    delete: false,
    manageRoles: false,
  },
};
```

## Implementation Strategy

### Phase 1: Firebase Authentication Setup

1. **Enable Firebase Authentication**
```typescript
// src/firebase.ts
import { getAuth } from 'firebase/auth';

export const auth = getAuth(app);
```

2. **Add Authentication Providers**
- Email/Password
- Google Sign-In
- Microsoft (for enterprise)

### Phase 2: User Management in Firestore

**User Document Structure:**
```typescript
// Collection: users/{userId}
interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: 'admin' | 'dataAnalyst' | 'viewer' | 'guest';
  createdAt: Date;
  lastLogin: Date;
  permissions?: CustomPermissions; // Optional fine-grained permissions
}
```

**Firestore Rules:**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function to check if user is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }
    
    // Helper function to get user role
    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }
    
    // Helper function to check if user is admin
    function isAdmin() {
      return isAuthenticated() && getUserRole() == 'admin';
    }
    
    // Helper function to check if user is admin or analyst
    function isAdminOrAnalyst() {
      return isAuthenticated() && getUserRole() in ['admin', 'dataAnalyst'];
    }
    
    // Users collection - only admins can manage
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAdmin();
      allow update: if isAdmin() || request.auth.uid == userId; // Users can update their own profile
      allow delete: if isAdmin();
    }
    
    // Destinations collection - data CRUD
    match /destinations/{destinationId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // Age groups collection - data CRUD
    match /ageGroups/{ageGroupId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    // ML Models - stored in localStorage, but metadata could be in Firestore
    match /mlModels/{modelId} {
      allow read: if isAuthenticated();
      allow create: if isAdminOrAnalyst();
      allow update: if isAdminOrAnalyst() && resource.data.createdBy == request.auth.uid;
      allow delete: if isAdmin() || (isAdminOrAnalyst() && resource.data.createdBy == request.auth.uid);
    }
  }
}
```

### Phase 3: Frontend Route Protection

**Create Auth Context:**
```typescript
// src/context/authContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'dataAnalyst' | 'viewer' | 'guest';
  displayName: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
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
        // Fetch user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserProfile(userDoc.data() as UserProfile);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const hasPermission = (permission: string): boolean => {
    if (!userProfile) return false;
    
    // Define permission matrix
    const permissions: Record<string, string[]> = {
      'data.write': ['admin'],
      'ml.train': ['admin', 'dataAnalyst'],
      'ml.forecast': ['admin', 'dataAnalyst', 'viewer'],
      'users.manage': ['admin'],
      'models.delete': ['admin', 'dataAnalyst'],
    };
    
    return permissions[permission]?.includes(userProfile.role) ?? false;
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, hasPermission }}>
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
```

**Protected Route Component:**
```typescript
// src/components/ProtectedRoute.tsx
import { Navigate } from '@tanstack/react-router';
import { useAuth } from '../context/authContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'dataAnalyst' | 'viewer' | 'guest';
  requiredPermission?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  requiredPermission 
}: ProtectedRouteProps) {
  const { user, userProfile, loading, hasPermission } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (requiredRole && userProfile?.role !== requiredRole) {
    return <Navigate to="/unauthorized" />;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <Navigate to="/unauthorized" />;
  }

  return <>{children}</>;
}
```

**Update Routes:**
```typescript
// src/routes/train.tsx
import { ProtectedRoute } from '../components/ProtectedRoute';

export const Route = createFileRoute("/train")({
  component: () => (
    <ProtectedRoute requiredPermission="ml.train">
      <TrainPage />
    </ProtectedRoute>
  ),
});
```

### Phase 4: UI Conditional Rendering

**Hide/Disable UI Elements Based on Permissions:**
```typescript
// Example in train.tsx
function TrainPage() {
  const { hasPermission } = useAuth();
  
  return (
    <div>
      {hasPermission('ml.train') && (
        <button onClick={handleTrain}>Train Model</button>
      )}
      
      {hasPermission('models.delete') && (
        <button onClick={handleDelete}>Delete Model</button>
      )}
    </div>
  );
}
```

## Security Best Practices

### 1. **Never Trust Client-Side Checks**
- All RBAC checks must be enforced in Firestore Security Rules
- Frontend checks are only for UX (hiding/showing elements)
- Backend (Firestore) is the source of truth

### 2. **Use Custom Claims for Performance**
- Firebase Auth Custom Claims for role storage
- Avoids additional Firestore read on every request
- Set via Admin SDK

```typescript
// Backend (Admin SDK)
admin.auth().setCustomUserClaims(uid, { role: 'admin' });
```

### 3. **Audit Logging**
- Log all sensitive operations (CRUD, model training, etc.)
- Store in Firestore collection: `auditLogs/{logId}`

```typescript
interface AuditLog {
  userId: string;
  action: string;
  resource: string;
  timestamp: Date;
  success: boolean;
  metadata?: any;
}
```

### 4. **Session Management**
- Set session timeout (e.g., 1 hour for sensitive operations)
- Force re-authentication for critical actions
- Use `setPersistence` for browser session control

## Cost Considerations (FREE TIER)

### Firestore Free Tier Limits:
- **Reads:** 50,000/day
- **Writes:** 20,000/day
- **Deletes:** 20,000/day
- **Storage:** 1 GB

### Firebase Authentication Free Tier:
- **Unlimited** users
- **10,000 phone auth verifications/month**

### Optimization Tips:
1. Cache user profiles in localStorage after first fetch
2. Use Firestore offline persistence
3. Implement pagination for large datasets
4. Use security rules to prevent unnecessary reads

## Recommended Implementation Order

1. ✅ **Week 1:** Set up Firebase Authentication
2. ✅ **Week 2:** Create user profile system in Firestore
3. ✅ **Week 3:** Implement Auth Context and hooks
4. ✅ **Week 4:** Add Firestore Security Rules
5. ✅ **Week 5:** Protect routes with ProtectedRoute component
6. ✅ **Week 6:** Add UI conditional rendering
7. ✅ **Week 7:** Testing and audit logging

## Testing Strategy

### Test Cases:
1. ✅ Admin can access all pages
2. ✅ Data Analyst can train models but not manage users
3. ✅ Viewer can only view forecasts, not train
4. ✅ Unauthenticated users redirected to login
5. ✅ Firestore rules block unauthorized writes
6. ✅ Custom claims work correctly
7. ✅ Session timeout enforced

## Additional Resources

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)
- [Custom Claims Best Practices](https://firebase.google.com/docs/auth/admin/custom-claims)
- [OWASP RBAC Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Access_Control_Cheat_Sheet.html)

## Summary

This RBAC implementation provides:
- ✅ **4 distinct roles** with clear permissions
- ✅ **Firebase-native** authentication and authorization
- ✅ **FREE** (within Firebase limits)
- ✅ **Secure** (server-side enforcement)
- ✅ **Scalable** (supports growth)
- ✅ **User-friendly** (clear error messages, seamless UX)

The recommended approach uses Firebase Authentication + Firestore + Security Rules, which is:
- Industry-standard
- Well-documented
- Cost-effective (free tier sufficient for most use cases)
- Secure by default

