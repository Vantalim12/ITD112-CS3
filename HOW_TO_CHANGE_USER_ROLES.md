# How to Change User Roles

## Method 1: Firebase Console (Recommended)

### Steps:

1. **Go to Firebase Console**
   - Visit [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - Select your project

2. **Navigate to Firestore Database**
   - Click on **Firestore Database** in the left sidebar
   - Click on **Data** tab

3. **Find the User**
   - Click on the `users` collection
   - Find the user by their email or UID
   - Click on the user document

4. **Edit the Role Field**
   - Find the `role` field
   - Click the pencil icon to edit
   - Change the value to one of:
     - `admin` - Full access
     - `dataAnalyst` - Can train models and analyze data
     - `viewer` - Read-only access
     - `guest` - Limited access
   - Click **Update**

5. **User Must Sign Out and Sign In Again**
   - The user must sign out and sign back in for the role change to take effect
   - The role is loaded when the user authenticates

---

## Method 2: Using Firebase Admin SDK (For Developers)

If you want to automate role changes or do it programmatically:

### Create a Cloud Function or Admin Script:

```javascript
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

async function changeUserRole(userEmail, newRole) {
  try {
    // Find user by email
    const userRecord = await admin.auth().getUserByEmail(userEmail);
    
    // Update role in Firestore
    await db.collection('users').doc(userRecord.uid).update({
      role: newRole,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ Successfully changed ${userEmail} to ${newRole}`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Usage:
changeUserRole('user@example.com', 'dataAnalyst');
```

---

## Method 3: Create an Admin Panel (Future Enhancement)

You can build an admin panel in your app with these features:

```typescript
// src/routes/admin-users.tsx (for admins only)
import { collection, query, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { ProtectedRoute } from '../components/ProtectedRoute';

export function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  
  const changeRole = async (userId: string, newRole: string) => {
    await updateDoc(doc(db, 'users', userId), { role: newRole });
    // Refresh user list
  };
  
  return (
    <ProtectedRoute requiredRole="admin">
      <div>
        <h1>User Management</h1>
        {users.map(user => (
          <div key={user.id}>
            <span>{user.email}</span>
            <select 
              value={user.role} 
              onChange={(e) => changeRole(user.id, e.target.value)}
            >
              <option value="admin">Admin</option>
              <option value="dataAnalyst">Data Analyst</option>
              <option value="viewer">Viewer</option>
              <option value="guest">Guest</option>
            </select>
          </div>
        ))}
      </div>
    </ProtectedRoute>
  );
}
```

---

## Quick Reference: User Roles

### 👑 Admin
- **Access:** Everything
- **Permissions:**
  - Manage users and roles
  - Upload and modify data
  - Train ML models
  - View all visualizations
  - Export data

### 📊 Data Analyst (`dataAnalyst`)
- **Access:** Data analysis and ML
- **Permissions:**
  - Train ML models
  - Generate forecasts
  - View all visualizations
  - Export visualizations
  - ❌ Cannot modify core data
  - ❌ Cannot manage users

### 👁️ Viewer
- **Access:** Read-only
- **Permissions:**
  - View all dashboards
  - Generate forecasts using existing models
  - ❌ Cannot train new models
  - ❌ Cannot modify data

### 👤 Guest
- **Access:** Limited
- **Permissions:**
  - View public dashboards only
  - ❌ No ML access
  - ❌ No data modification

---

## Setting Your First Admin

When you first deploy, all users are created as `viewer` by default. To set your first admin:

1. **Sign up** in the app with your email
2. **Go to Firebase Console** → Firestore → `users` collection
3. **Find your user document** (search by email)
4. **Change `role`** from `viewer` to `admin`
5. **Sign out and sign in** to the app

Now you'll have admin access!

---

## Troubleshooting

### Role Change Not Taking Effect

**Problem:** Changed role in Firestore but still seeing old permissions

**Solution:**
1. User must **sign out completely**
2. **Close all browser tabs** with your app
3. **Sign in again**
4. Role is loaded fresh on authentication

### Can't Access Firestore

**Problem:** "Permission denied" when trying to view users

**Solution:**
1. Make sure you're logged in as an admin
2. Check that Firestore rules are deployed
3. Verify your role in Firestore is actually `admin`

### Want to Bulk Change Roles

**Problem:** Need to change roles for many users

**Solution:**
Use Firebase Admin SDK with a script (see Method 2 above) to loop through users:

```javascript
const usersToPromote = ['user1@example.com', 'user2@example.com'];

for (const email of usersToPromote) {
  await changeUserRole(email, 'dataAnalyst');
}
```

---

## Security Notes

⚠️ **Important:**
- Only trusted individuals should have `admin` role
- Admins can see and modify ALL data
- Admins can change other users' roles
- Regular users cannot see or change roles (enforced by Firestore rules)
- Role changes require authentication

---

## Questions?

- Check `RBAC_RECOMMENDATIONS.md` for detailed permission matrix
- Check `firestore.rules` to see how roles are enforced
- Check `src/context/authContext.tsx` to see how roles are used in the app

