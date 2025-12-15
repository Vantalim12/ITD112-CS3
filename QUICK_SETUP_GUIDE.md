# Quick Setup Guide - New Features

## 🚀 Getting Started in 5 Minutes

### Step 1: Deploy Firestore Rules (Required)

1. Copy the contents of `firestore.rules`
2. Go to [Firebase Console](https://console.firebase.google.com/)
3. Select your project → **Firestore Database** → **Rules**
4. Paste and **Publish**

### Step 2: Enable Authentication Methods (Required)

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable:
   - ✅ **Email/Password**
   - ✅ **Google** (optional but recommended)

### Step 3: Start the Application

```bash
npm install  # Install any new dependencies
npm run dev  # Start development server
```

### Step 4: Create Your First User

1. Visit `http://localhost:3000`
2. You'll be redirected to `/login`
3. Click **"Don't have an account? Sign up"**
4. Enter:
   - Display Name: Your Name
   - Email: your@email.com
   - Password: (min 6 characters)
5. Click **Sign Up**
6. You're now logged in with **Viewer** role

---

## 🔑 Creating Admin Users

### Method 1: Firebase Console (Recommended)

1. Sign up a new user in the app
2. Go to Firebase Console → **Firestore Database**
3. Navigate to `users` collection
4. Find your user document (by email)
5. Edit the `role` field to `admin`
6. Save changes
7. Sign out and sign back in to app

### Method 2: Via Code (For Development)

In `src/context/authContext.tsx`, temporarily modify the `signUp` function:

```typescript
// Find this line:
role: 'viewer',

// Change to:
role: 'admin',
```

**⚠️ Remember to change it back after creating your admin account!**

---

## 📊 Testing New Features

### 1. Test RBAC

**As Viewer:**
- ✅ Can view dashboards
- ✅ Can view forecasts
- ❌ Cannot train models
- ❌ Cannot upload data
- ❌ Cannot manage data (CRUD)

**As Admin:**
- ✅ Can do everything
- ✅ Train models
- ✅ Upload data
- ✅ Manage users

### 2. Test Forecast Comparison

1. Login as any user
2. Navigate to **ML Forecast** page
3. Select a country (e.g., "United States")
4. Select a trained model
5. Click **Load Model**
6. Click **Generate Forecast**
7. Scroll down to see **"Predicted Emigrants vs Historical Data"** table

### 3. Test Model Import/Export

**Export:**
1. Login as Admin or Data Analyst
2. Go to **ML Training** page
3. Train a model (or use existing)
4. Click **📤 Export** button
5. Model downloads as `.json` file

**Import:**
1. Click **📥 Import Model** button
2. Select the exported `.json` file
3. Model appears in list with "(Imported)" label

### 4. Test Firebase Sync

1. Train a new model
2. Open browser DevTools → Console
3. Look for: `✅ Model metadata synced to Firebase`
4. Go to Firebase Console → Firestore → `mlModels` collection
5. Your model metadata should be there

---

## 👥 User Roles Explained

### 🔴 Admin
**Full access** - Can do everything
- Manage users
- Upload/delete data
- Train models
- Export visualizations

### 🔵 Data Analyst
**Analysis focus** - Can work with data and models
- Train ML models
- Generate forecasts
- Export visualizations
- ❌ Cannot modify core data

### 🟢 Viewer
**Read-only** - Can view and use existing models
- View all dashboards
- Generate forecasts (using existing models)
- ❌ Cannot train new models

### ⚪ Guest
**Limited access** - Public dashboards only
- View public dashboards
- ❌ No ML access

---

## 🎯 Common Tasks

### Change User Role

**Option 1: Firestore Console**
```
1. Firebase Console → Firestore → users collection
2. Click on user document
3. Edit "role" field
4. Options: admin, dataAnalyst, viewer, guest
5. Save
```

**Option 2: Future Enhancement**
(Need to build admin panel UI)

### Reset Password

Users can use the "Forgot Password" link on login page (if implemented).

For now:
1. Firebase Console → Authentication → Users
2. Find user → Three dots menu → Reset password
3. User receives email with reset link

### Delete a User

1. Firebase Console → Authentication → Users
2. Find user → Three dots menu → Delete user
3. Also delete from Firestore: `users/{userId}`

### Make a Model Public

Currently all models are private. To make public:

```typescript
// In browser console or via code:
import { toggleModelPublicStatus } from './src/api/firebaseModelService';
await toggleModelPublicStatus('model_id_here', true);
```

---

## 🐛 Troubleshooting

### "Not authenticated" errors

**Solution:** 
- Check if `.env` file has all Firebase config variables
- Verify Firebase Authentication is enabled
- Clear browser cache and localStorage
- Sign out and sign back in

### "Permission denied" on Firestore

**Solution:**
- Deploy `firestore.rules` file to Firebase Console
- Check user role in Firestore `users` collection
- Verify user is authenticated

### Models not syncing to Firebase

**Solution:**
- Check browser console for errors
- Verify Firestore rules include `mlModels` collection
- Ensure user is authenticated
- Check internet connection

### Can't access train/crud/upload pages

**Solution:**
- Check your user role in Firebase Console
- Viewers cannot access these pages
- Change role to `admin` or `dataAnalyst`

### Import model fails

**Solution:**
- Ensure file is valid JSON
- File must be exported from this app
- Check browser console for detailed error
- File size should be reasonable (< 50MB)

---

## 📱 Browser Support

Tested and working on:
- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ Internet Explorer (Not supported)

---

## 🔒 Security Tips

### Do's ✅
- Use strong passwords (12+ characters)
- Sign out when done
- Only give admin role to trusted users
- Regularly review user list
- Keep Firebase API keys in `.env` file
- Use Google Sign-In for convenience

### Don'ts ❌
- Don't share admin credentials
- Don't commit `.env` file to git
- Don't make all models public
- Don't give admin role to new users by default
- Don't disable Firestore security rules

---

## 📞 Need Help?

1. **Check Console Logs**: Open DevTools → Console for detailed errors
2. **Review Files**:
   - `IMPLEMENTATION_SUMMARY.md` - Full technical details
   - `RBAC_RECOMMENDATIONS.md` - Original RBAC design
   - `firestore.rules` - Security rules reference
3. **Firebase Documentation**: [firebase.google.com/docs](https://firebase.google.com/docs)

---

## 🎉 You're Ready!

All features are now active:
- ✅ User authentication
- ✅ Role-based access control
- ✅ Protected routes
- ✅ Enhanced forecast visualization
- ✅ Model import/export
- ✅ Firebase model metadata sync

**Start exploring by logging in and training your first model!**

