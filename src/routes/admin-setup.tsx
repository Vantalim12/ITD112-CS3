import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db, auth } from "../firebase";
import { useAuth } from "../context/authContext";

export const Route = createFileRoute("/admin-setup")({
  component: AdminSetupPage,
});

function AdminSetupPage() {
  const { user, userProfile, refreshUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkFirestoreRole = async () => {
    if (!user) {
      setError("Please sign in first");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        setMessage(
          `Current role in Firestore: "${data.role || 'undefined'}"\n` +
          `Type: ${typeof data.role}\n` +
          `Full document: ${JSON.stringify(data, null, 2)}`
        );
      } else {
        setMessage("User document does not exist in Firestore!");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setAdminRole = async () => {
    if (!user) {
      setError("Please sign in first");
      return;
    }

    if (!confirm("This will set your role to 'admin' in Firestore. Continue?")) {
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        // Update existing document
        await updateDoc(doc(db, 'users', user.uid), {
          role: 'admin'
        });
        setMessage("✅ Successfully updated role to 'admin'! Now click 'Refresh Profile' below.");
      } else {
        // Create new document
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email || '',
          role: 'admin',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
          createdAt: new Date(),
          lastLogin: new Date(),
        });
        setMessage("✅ Successfully created profile with 'admin' role! Now click 'Refresh Profile' below.");
      }
    } catch (err: any) {
      setError(`Failed to update: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setMessage(null);
    setError(null);
    
    try {
      await refreshUserProfile();
      setMessage("✅ Profile refreshed! Check your role above. If it still shows 'viewer', sign out and sign back in.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-primary min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-white mb-2">🔧 Admin Setup Helper</h1>
        <p className="text-gray-300 mb-6">
          Use this page to diagnose and fix your admin role
        </p>

        {/* Current Status */}
        <div className="bg-secondary rounded-lg p-6 border border-gray-700 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Current Status</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Logged in as:</span>
              <span className="text-white font-mono">{user?.email || 'Not logged in'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">User UID:</span>
              <span className="text-white font-mono text-xs break-all">{user?.uid || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Role in App:</span>
              <span className={`font-bold ${userProfile?.role === 'admin' ? 'text-green-400' : 'text-yellow-400'}`}>
                {userProfile?.role || 'Unknown'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-secondary rounded-lg p-6 border border-gray-700 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">Actions</h2>
          
          <div className="space-y-4">
            <div>
              <button
                onClick={checkFirestoreRole}
                disabled={loading || !user}
                className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors font-semibold"
              >
                1️⃣ Check Firestore Role
              </button>
              <p className="text-xs text-gray-400 mt-1">
                Check what role is stored in Firestore database
              </p>
            </div>

            <div>
              <button
                onClick={setAdminRole}
                disabled={loading || !user}
                className="w-full md:w-auto px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-600 transition-colors font-semibold"
              >
                2️⃣ Set Role to Admin (In Firestore)
              </button>
              <p className="text-xs text-gray-400 mt-1">
                This will update your role to 'admin' in Firestore
              </p>
            </div>

            <div>
              <button
                onClick={handleRefresh}
                disabled={loading || !user}
                className="w-full md:w-auto px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-600 transition-colors font-semibold"
              >
                3️⃣ Refresh Profile (Reload from Firestore)
              </button>
              <p className="text-xs text-gray-400 mt-1">
                Reload your profile from Firestore without signing out
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-4 mb-6">
            <h3 className="text-blue-300 font-semibold mb-2">ℹ️ Result:</h3>
            <pre className="text-sm text-white whitespace-pre-wrap font-mono bg-black/30 p-3 rounded">
              {message}
            </pre>
          </div>
        )}

        {error && (
          <div className="bg-red-900/30 border border-red-500 rounded-lg p-4 mb-6">
            <h3 className="text-red-300 font-semibold mb-2">❌ Error:</h3>
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-yellow-300 mb-4">📋 Step-by-Step Instructions</h2>
          <ol className="space-y-3 text-gray-300 text-sm list-decimal list-inside">
            <li>Click <strong>"1️⃣ Check Firestore Role"</strong> to see what's currently in Firestore</li>
            <li>Click <strong>"2️⃣ Set Role to Admin"</strong> to update your role to admin in Firestore</li>
            <li>Click <strong>"3️⃣ Refresh Profile"</strong> to reload your profile</li>
            <li>Check the "Role in App" above - it should now show "admin"</li>
            <li>If it still shows "viewer", <strong>sign out completely and sign back in</strong></li>
            <li>After signing back in, go to <code className="bg-black/30 px-1 rounded">/profile</code> to verify</li>
          </ol>
        </div>

        {/* Console Instructions */}
        <div className="mt-6 bg-gray-900/50 border border-gray-600 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">🔍 Debug Console</h3>
          <p className="text-xs text-gray-400">
            Open your browser's Developer Console (F12) to see detailed logs about role loading and permission checks.
          </p>
        </div>
      </div>
    </div>
  );
}
