import { Navigate } from '@tanstack/react-router';
import { useAuth } from '../context/authContext';
import type { UserRole } from '../context/authContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole | UserRole[];
  requiredPermission?: string;
}

export function ProtectedRoute({ 
  children, 
  requiredRole, 
  requiredPermission 
}: ProtectedRouteProps) {
  const { user, userProfile, loading, hasPermission, hasRole } = useAuth();

  // Debug logging
  console.log('🛡️ ProtectedRoute check:', {
    loading,
    hasUser: !!user,
    userProfile: userProfile ? {
      role: userProfile.role,
      email: userProfile.email
    } : null,
    requiredRole,
    requiredPermission
  });

  if (loading) {
    return (
      <div className="p-6 bg-primary min-h-screen flex items-center justify-center">
        <div className="text-gray-300">Loading...</div>
      </div>
    );
  }

  if (!user) {
    console.log('❌ ProtectedRoute: No user, redirecting to login');
    return <Navigate to="/" />;
  }

  if (requiredRole && !hasRole(requiredRole)) {
    console.log('❌ ProtectedRoute: Role check failed', {
      required: requiredRole,
      current: userProfile?.role
    });
    return (
      <div className="p-6 bg-primary min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto bg-secondary rounded-lg p-8 border border-red-500">
          <h1 className="text-2xl font-bold text-red-400 mb-4">⛔ Access Denied</h1>
          <p className="text-gray-300 mb-4">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-gray-400 mb-4">
            Required role: {Array.isArray(requiredRole) ? requiredRole.join(' or ') : requiredRole}
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Your role: {userProfile?.role}
          </p>
          <a 
            href="/dashboard" 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    console.log('❌ ProtectedRoute: Permission check failed', {
      required: requiredPermission,
      current: userProfile?.role
    });
    return (
      <div className="p-6 bg-primary min-h-screen flex items-center justify-center">
        <div className="max-w-md mx-auto bg-secondary rounded-lg p-8 border border-red-500">
          <h1 className="text-2xl font-bold text-red-400 mb-4">⛔ Access Denied</h1>
          <p className="text-gray-300 mb-4">
            You don't have the required permission to access this feature.
          </p>
          <p className="text-sm text-gray-400 mb-2">
            Required permission: {requiredPermission}
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Your role: {userProfile?.role || 'Unknown'}
          </p>
          <a 
            href="/dashboard" 
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-block"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  console.log('✅ ProtectedRoute: Access granted');
  return <>{children}</>;
}

