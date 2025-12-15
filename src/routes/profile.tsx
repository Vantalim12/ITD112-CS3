import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "../context/authContext";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { useState } from "react";

export const Route = createFileRoute("/profile")({
  component: () => (
    <ProtectedRoute>
      <ProfilePage />
    </ProtectedRoute>
  ),
});

function ProfilePage() {
  const { userProfile, signOut, refreshUserProfile } = useAuth();
  const navigate = useNavigate();
  const [refreshing, setRefreshing] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Redirect to landing page after successful logout
      navigate({ to: "/" });
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  if (!userProfile) {
    return (
      <div className="p-6 bg-primary min-h-screen flex items-center justify-center">
        <div className="text-gray-300">Loading profile...</div>
      </div>
    );
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-600 border-red-500';
      case 'dataAnalyst':
        return 'bg-blue-600 border-blue-500';
      case 'viewer':
        return 'bg-green-600 border-green-500';
      case 'guest':
        return 'bg-gray-600 border-gray-500';
      default:
        return 'bg-gray-600 border-gray-500';
    }
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Administrator';
      case 'dataAnalyst':
        return 'Data Analyst';
      case 'viewer':
        return 'Viewer';
      case 'guest':
        return 'Guest';
      default:
        return role;
    }
  };

  const getRolePermissions = (role: string) => {
    switch (role) {
      case 'admin':
        return [
          'Full access to all features',
          'Manage users and roles',
          'CRUD operations on data',
          'Train and manage ML models',
          'View all visualizations',
          'Upload/populate data',
        ];
      case 'dataAnalyst':
        return [
          'Read access to all data',
          'View all visualizations',
          'Train and use ML models',
          'Export visualizations',
          'Manage own ML models',
        ];
      case 'viewer':
        return [
          'Read-only access to data',
          'View all visualizations',
          'Generate forecasts using existing models',
        ];
      case 'guest':
        return [
          'Limited read access',
          'View public dashboards only',
        ];
      default:
        return [];
    }
  };

  return (
    <div className="p-6 bg-primary min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">User Profile</h1>
          <p className="text-gray-300 text-lg">
            Manage your account settings and view your permissions
          </p>
        </div>

        {/* Profile Card */}
        <div className="bg-secondary rounded-lg p-8 border border-gray-700 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <span className="text-3xl font-bold text-white">
                  {userProfile.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {userProfile.displayName}
                </h2>
                <p className="text-gray-400">{userProfile.email}</p>
              </div>
            </div>
            <div className={`px-4 py-2 rounded-lg border-2 ${getRoleBadgeColor(userProfile.role)}`}>
              <span className="text-white font-semibold">
                {getRoleDisplayName(userProfile.role)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-6 border-t border-gray-600">
            <div>
              <p className="text-gray-400 text-sm mb-1">User ID</p>
              <p className="text-white font-mono text-xs break-all">{userProfile.uid}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Member Since</p>
              <p className="text-white">{userProfile.createdAt.toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Last Login</p>
              <p className="text-white">{userProfile.lastLogin.toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm mb-1">Account Status</p>
              <p className="text-green-400 font-semibold">✓ Active</p>
            </div>
          </div>
        </div>

        {/* Permissions Card */}
        <div className="bg-secondary rounded-lg p-8 border border-gray-700 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Role Permissions
          </h2>
          <p className="text-gray-300 mb-4">
            As a <strong>{getRoleDisplayName(userProfile.role)}</strong>, you have the following permissions:
          </p>
          <ul className="space-y-2">
            {getRolePermissions(userProfile.role).map((permission, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-green-400 mt-1">✓</span>
                <span className="text-gray-300">{permission}</span>
              </li>
            ))}
          </ul>

          {userProfile.role === 'viewer' || userProfile.role === 'guest' ? (
            <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-300">
                ℹ️ Need more permissions? Contact an administrator to upgrade your role.
              </p>
            </div>
          ) : null}
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <button
            onClick={async () => {
              setRefreshing(true);
              await refreshUserProfile();
              setRefreshing(false);
              alert('Profile refreshed! Check the role above.');
            }}
            disabled={refreshing}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-600 transition-colors font-semibold"
          >
            {refreshing ? 'Refreshing...' : '🔄 Refresh Profile'}
          </button>
          <button
            onClick={handleSignOut}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold"
          >
            Sign Out
          </button>
        </div>
        
        {/* Debug Info */}
        <div className="mt-6 p-4 bg-gray-900/50 border border-gray-600 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-300 mb-2">🔍 Debug Information</h3>
          <div className="text-xs text-gray-400 space-y-1 font-mono">
            <p>Current Role: <span className="text-white">{userProfile?.role || 'null'}</span></p>
            <p>UID: <span className="text-white">{userProfile?.uid || 'null'}</span></p>
            <p>Email: <span className="text-white">{userProfile?.email || 'null'}</span></p>
            <p className="mt-2 text-yellow-400">💡 Tip: If role is incorrect, click "Refresh Profile" above or sign out and sign back in.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
