export const ROLES = {
  admin: 'admin',
  manager: 'manager',
  supervisor: 'supervisor',
  teacher: 'teacher',
  student: 'student'
};

export const ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  supervisor: 'Supervisor',
  teacher: 'Teacher',
  student: 'Student'
};

export const ROLE_PERMISSIONS = {
  admin: [
    'dashboard.view',
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'sub_admins.view',
    'sub_admins.create',
    'sub_admins.edit',
    'sub_admins.delete',
    'sub_admins.reset_password',
    'sessions.view_all',
    'sessions.create',
    'sessions.edit',
    'sessions.monitor_live',
    'schedule.manage',
    'analytics.view',
    'reports.view',
    'reports.export',
    'leave.manage'
  ],
  manager: [
    'dashboard.view',
    'users.view',
    'users.create',
    'users.edit',
    'sessions.view_all',
    'sessions.create',
    'sessions.edit',
    'sessions.monitor_live',
    'schedule.manage',
    'analytics.view',
    'reports.view',
    'reports.export',
    'leave.manage'
  ],
  supervisor: [
    'dashboard.view',
    'sessions.monitor_live'
  ],
  teacher: [
    'dashboard.view',
    'sessions.view_own',
    'homework.manage',
    'leave.create'
  ],
  student: [
    'dashboard.view',
    'sessions.view_own',
    'homework.view',
    'videos.view',
    'leave.create'
  ]
};

export const hasPermission = (role, permission) =>
  Boolean(ROLE_PERMISSIONS[role]?.includes(permission));

export const hasAnyPermission = (role, permissions = []) =>
  permissions.some(permission => hasPermission(role, permission));

export const canAccessTab = (role, tabId) => {
  const tabPermissions = {
    overview: ['dashboard.view'],
    users: ['users.view'],
    roles: ['sub_admins.view'],
    sessions: ['sessions.view_all'],
    moderation: ['sessions.monitor_live'],
    schedule: ['schedule.manage'],
    analytics: ['analytics.view'],
    reports: ['reports.view'],
    leave: ['leave.manage']
  };

  return hasAnyPermission(role, tabPermissions[tabId] || []);
};
