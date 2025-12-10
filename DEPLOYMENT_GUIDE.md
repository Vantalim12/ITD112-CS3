# 🚀 Deployment Guide

This guide covers how to deploy your React + Vite + Firebase application.

**Architecture:**
- **Frontend:** Vercel (Hosting & CDN)
- **Database:** Firebase Firestore (Managed Database)
- **Backend:** None required (App connects directly to Firebase)

---

## 1. Prerequisites

Before deploying, ensure you have:
1. A [GitHub Account](https://github.com/) with your project repository
2. A [Vercel Account](https://vercel.com/)
3. Your **Firebase Configuration** values (from your `.env` file)

---

## 2. Prepare Your Project for Deployment

### A. Environment Variables
You've already set up your `.env` file locally. For production, these values need to be added to Vercel.

**Do NOT commit your `.env` file to GitHub.** (It's already ignored in your `.gitignore`, which is correct).

### B. Build Check
Run the build command locally to ensure there are no errors:

```bash
npm run build
```
If this passes, your project is ready.

---

## 3. Deploy Frontend to Vercel

### Step 1: Connect GitHub
1. Push your latest code to your GitHub repository.
2. Go to [Vercel Dashboard](https://vercel.com/dashboard).
3. Click **"Add New..."** -> **"Project"**.
4. Select your GitHub repository (`CS2-SirPaul` or whatever you named it).

### Step 2: Configure Project
Vercel will automatically detect that you are using **Vite**.

- **Framework Preset:** Vite
- **Root Directory:** `./` (default)
- **Build Command:** `vite build` (default)
- **Output Directory:** `dist` (default)

### Step 3: Add Environment Variables (CRITICAL)
Expand the **"Environment Variables"** section and add the keys from your local `.env` file.

| Key | Value (Copy from your local .env) |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `AIzaSyBT...` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `filipinoemigrantsdb...` |
| `VITE_FIREBASE_PROJECT_ID` | `filipinoemigrantsdb-21c54` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `filipinoemigrantsdb...` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `96472317522` |
| `VITE_FIREBASE_APP_ID` | `1:96472317522:web:...` |

**Important:** You must copy the exact values from your local `.env` file.

### Step 4: Deploy
Click **"Deploy"**. Vercel will build your project and give you a live URL (e.g., `https://your-project.vercel.app`).

---

## 4. Firebase Security (Production Readiness)

Since your app connects directly to Firestore, ensure your security rules are set up correctly in the Firebase Console.

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Navigate to **Firestore Database** -> **Rules**
3. Ensure rules are restrictive enough for production.

**Example Production Rules (Read-only for public, Write for admins):**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow public read access
    match /{document=**} {
      allow read: if true;
      allow write: if false; // Only allow writes via Firebase Console or Admin SDK
    }
  }
}
```

---

## 5. Troubleshooting Common Issues

### "404 Not Found" on Refresh
If you refresh a page (like `/trends`) and get a 404 error, you need to configure a rewrite rule for the Single Page App (SPA).

**Fix:** Create a `vercel.json` file in your root directory:

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### "Missing Firebase Configuration" Error
This means your environment variables weren't added correctly in Vercel.
- Go to **Project Settings** -> **Environment Variables**
- Check for typos
- Ensure the prefix `VITE_` is included

### "Module Not Found" Errors
If build fails due to missing modules:
- Ensure all dependencies are in `dependencies` (not `devDependencies` if they are needed at runtime, though Vite handles devDeps fine for build).
- Check that filename casing matches exactly (e.g., `ForecastModel.ts` vs `forecastModel.ts`).

---

## Summary

1. **Push** code to GitHub
2. **Import** project in Vercel
3. **Add** Environment Variables in Vercel
4. **Deploy**
5. **Verify** live site works

