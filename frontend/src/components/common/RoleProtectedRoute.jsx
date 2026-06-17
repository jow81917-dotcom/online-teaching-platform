import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission } from '../../utils/permissions';

const RoleProtectedRoute = ({ 
  children, 
  allowedRoles = [], 
  requiredRole = null, 
  adminOnly = false,
  managerAccess = false,
  supervisorAccess = false,
  requiredPermission = null
}) => {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '50vh',
        color: 'var(--gray-600)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          Loading...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Admin only access
  if (adminOnly && user?.role !== 'admin') {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem',
        color: 'var(--gray-600)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ color: 'var(--red-600)', marginBottom: '0.5rem' }}>Access Denied</h2>
        <p>This area requires administrator privileges.</p>
      </div>
    );
  }

  // Manager access includes admin
  if (managerAccess && !['admin', 'manager'].includes(user?.role)) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem',
        color: 'var(--gray-600)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ color: 'var(--red-600)', marginBottom: '0.5rem' }}>Access Denied</h2>
        <p>This area requires manager level access or above.</p>
      </div>
    );
  }

  // Supervisor access includes admin, manager, and supervisor
  if (supervisorAccess && !['admin', 'manager', 'supervisor'].includes(user?.role)) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem',
        color: 'var(--gray-600)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ color: 'var(--red-600)', marginBottom: '0.5rem' }}>Access Denied</h2>
        <p>This area requires supervisor level access or above.</p>
      </div>
    );
  }

  // Specific role requirement
  if (requiredRole && user?.role !== requiredRole) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem',
        color: 'var(--gray-600)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ color: 'var(--red-600)', marginBottom: '0.5rem' }}>Access Denied</h2>
        <p>This area requires {requiredRole} role access.</p>
      </div>
    );
  }

  // Array of allowed roles
  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem',
        color: 'var(--gray-600)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
        <h2 style={{ color: 'var(--red-600)', marginBottom: '0.5rem' }}>Access Denied</h2>
        <p>You don't have permission to access this area.</p>
      </div>
    );
  }

  if (requiredPermission && !hasPermission(user?.role, requiredPermission)) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '3rem',
        color: 'var(--gray-600)'
      }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>ðŸ”’</div>
        <h2 style={{ color: 'var(--red-600)', marginBottom: '0.5rem' }}>Access Denied</h2>
        <p>You don't have permission to access this area.</p>
      </div>
    );
  }

  return children;
};

// Hook for checking permissions within components
export const usePermissions = () => {
  const { user } = useAuth();
  
  const hasRole = (role) => user?.role === role;
  
  const hasAnyRole = (roles) => roles.includes(user?.role);
  
  const hasMinimumRole = (minimumRole) => {
    const ROLE_HIERARCHY = {
      admin: 5,
      manager: 4,
      supervisor: 3,
      teacher: 2,
      student: 1
    };
    
    const userLevel = ROLE_HIERARCHY[user?.role] || 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole] || 0;
    
    return userLevel >= requiredLevel;
  };

  const isAdmin = () => user?.role === 'admin';
  const isManager = () => user?.role === 'manager';
  const isSupervisor = () => user?.role === 'supervisor';
  const isTeacher = () => user?.role === 'teacher';
  const isStudent = () => user?.role === 'student';

  // Permission checks for specific actions
  const canManageUsers = () => ['admin', 'manager'].includes(user?.role);
  const canViewAllSessions = () => ['admin', 'manager', 'supervisor'].includes(user?.role);
  const canSuperviseClasses = () => ['admin', 'supervisor'].includes(user?.role);
  const canCreateSessions = () => ['admin', 'manager'].includes(user?.role);
  const canEditUsers = () => user?.role === 'admin';
  const canDeleteUsers = () => user?.role === 'admin';
  const canResetPasswords = () => user?.role === 'admin';
  const canViewReports = () => ['admin', 'manager', 'supervisor'].includes(user?.role);
  const canExportData = () => ['admin', 'manager'].includes(user?.role);
  const canManageSubAdmins = () => user?.role === 'admin';
  const canMonitorSessions = () => ['admin', 'manager', 'supervisor'].includes(user?.role);
  const can = (permission) => hasPermission(user?.role, permission);
  
  return {
    user,
    hasRole,
    hasAnyRole,
    hasMinimumRole,
    isAdmin,
    isManager, 
    isSupervisor,
    isTeacher,
    isStudent,
    canManageUsers,
    canViewAllSessions,
    canSuperviseClasses,
    canCreateSessions,
    canEditUsers,
    canDeleteUsers,
    canResetPasswords,
    canViewReports,
    canExportData,
    canManageSubAdmins,
    canMonitorSessions,
    can
  };
};

export const PermissionGuard = ({ permission, children, fallback = null }) => {
  const { user } = useAuth();
  return hasPermission(user?.role, permission) ? children : fallback;
};

export default RoleProtectedRoute;
