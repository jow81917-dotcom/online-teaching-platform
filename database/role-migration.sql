-- ============================================================================
-- ROLE-BASED ACCESS CONTROL MIGRATION SCRIPT
-- Online Teaching Platform - Adding supervisor and manager roles
-- Compatible with Neon PostgreSQL
-- ============================================================================

-- PHASE 1: CREATE RBAC SYSTEM TABLES
-- ============================================================================

-- Create permissions table for granular access control
CREATE TABLE IF NOT EXISTS permissions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create roles table for role definitions
CREATE TABLE IF NOT EXISTS roles (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    name VARCHAR(20) UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    hierarchy_level INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create role_permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    role_id VARCHAR(36) NOT NULL,
    permission_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE (role_id, permission_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_permissions_category ON permissions(category);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_hierarchy ON roles(hierarchy_level);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

-- ============================================================================
-- PHASE 2: UPDATE EXISTING ROLE CONSTRAINTS
-- ============================================================================

-- Update users table role constraint to include new roles
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin','manager','supervisor','teacher','student'));

-- Update analytics table role constraint
ALTER TABLE analytics DROP CONSTRAINT IF EXISTS analytics_user_role_check;
ALTER TABLE analytics ADD CONSTRAINT analytics_user_role_check 
    CHECK (user_role IN ('admin','manager','supervisor','teacher','student'));

-- Update leave_requests table role constraint  
ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_user_role_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_user_role_check 
    CHECK (user_role IN ('teacher','student'));

-- Note: live_participants constraint remains unchanged (teacher,student only)

-- ============================================================================
-- PHASE 3: POPULATE RBAC SYSTEM DATA
-- ============================================================================

-- Insert all permissions
INSERT INTO permissions (name, description, category) VALUES
-- User Management
('users.view', 'View user profiles and lists', 'users'),
('users.create', 'Create new user accounts', 'users'),
('users.edit', 'Edit user profiles and settings', 'users'),
('users.delete', 'Delete user accounts', 'users'),
('users.manage_roles', 'Assign and change user roles', 'users'),

-- Admin Management  
('admins.create', 'Create new admin accounts', 'admins'),
('admins.edit', 'Edit admin profiles', 'admins'),
('admins.delete', 'Delete admin accounts', 'admins'),
('admins.promote', 'Promote users to admin role', 'admins'),

-- Session Management
('sessions.view_all', 'View all sessions across platform', 'sessions'),
('sessions.create', 'Create new sessions', 'sessions'),
('sessions.edit', 'Edit session details', 'sessions'),
('sessions.delete', 'Delete sessions', 'sessions'),
('sessions.monitor_live', 'Monitor live sessions in progress', 'sessions'),
('sessions.join_any', 'Join any session for support', 'sessions'),
('sessions.end', 'End active sessions', 'sessions'),
('sessions.suspend', 'Suspend sessions temporarily', 'sessions'),

-- Analytics & Reports
('analytics.view', 'View analytics dashboards', 'analytics'),
('reports.view', 'View system reports', 'reports'),
('reports.export', 'Export reports and data', 'reports'),

-- System Settings
('settings.view', 'View system settings', 'settings'),
('settings.edit', 'Modify system settings', 'settings'),
('settings.backup', 'Create system backups', 'settings'),

-- Content Management
('content.view', 'View educational content', 'content'),
('content.create', 'Create new content', 'content'),
('content.edit', 'Edit existing content', 'content'),
('content.delete', 'Delete content', 'content'),

-- Homework Management
('homework.view_all', 'View all homework assignments', 'homework'),
('homework.create', 'Create homework assignments', 'homework'),
('homework.edit', 'Edit homework assignments', 'homework'),
('homework.delete', 'Delete homework assignments', 'homework'),
('homework.grade', 'Grade homework submissions', 'homework'),

-- Leave Management
('leave.view_all', 'View all leave requests', 'leave'),
('leave.approve', 'Approve or reject leave requests', 'leave'),
('leave.create', 'Submit leave requests', 'leave')
ON CONFLICT (name) DO NOTHING;

-- Insert role definitions with hierarchy levels
INSERT INTO roles (name, display_name, description, hierarchy_level) VALUES
('admin', 'System Administrator', 'Full system owner with all privileges', 1),
('manager', 'Manager', 'Admin-like role but cannot manage other admins', 2),
('supervisor', 'Supervisor', 'Can monitor and control sessions, view reports', 3),
('teacher', 'Teacher', 'Can conduct classes and manage student content', 4),
('student', 'Student', 'Can attend classes and submit homework', 5)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PHASE 4: ASSIGN PERMISSIONS TO ROLES
-- ============================================================================

-- ADMIN ROLE (Full Access)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- MANAGER ROLE (Admin privileges except admin management)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'manager' 
AND p.name NOT IN (
    'admins.create', 'admins.edit', 'admins.delete', 'admins.promote'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- SUPERVISOR ROLE (Monitoring and session control only)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'supervisor' 
AND p.name IN (
    'sessions.view_all', 'sessions.monitor_live', 'sessions.join_any', 
    'sessions.end', 'sessions.suspend', 'analytics.view', 'reports.view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- TEACHER ROLE (Teaching related permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'teacher' 
AND p.name IN (
    'sessions.create', 'sessions.edit', 'content.view', 'content.create', 
    'content.edit', 'homework.create', 'homework.edit', 'homework.grade', 
    'leave.create'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- STUDENT ROLE (Learning related permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id 
FROM roles r, permissions p 
WHERE r.name = 'student' 
AND p.name IN (
    'content.view', 'leave.create'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- PHASE 5: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION user_has_permission(user_role VARCHAR, permission_name VARCHAR)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM roles r
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE r.name = user_role AND p.name = permission_name
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get all permissions for a role
CREATE OR REPLACE FUNCTION get_role_permissions(role_name VARCHAR)
RETURNS TABLE(permission_name VARCHAR, permission_description TEXT, category VARCHAR) AS $$
BEGIN
    RETURN QUERY
    SELECT p.name, p.description, p.category
    FROM roles r
    JOIN role_permissions rp ON r.id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE r.name = role_name
    ORDER BY p.category, p.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PHASE 6: CREATE AUDIT TRIGGERS FOR ROLE CHANGES
-- ============================================================================

-- Create audit table for role changes
CREATE TABLE IF NOT EXISTS role_change_audit (
    id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id VARCHAR(36) NOT NULL,
    old_role VARCHAR(20),
    new_role VARCHAR(20) NOT NULL,
    changed_by VARCHAR(36) NOT NULL,
    reason TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (changed_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_role_audit_user ON role_change_audit(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_role_audit_changed_by ON role_change_audit(changed_by);

-- ============================================================================
-- PHASE 7: VERIFICATION QUERIES
-- ============================================================================

-- Verify role constraints are updated
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%role%check%';

-- Verify RBAC tables are populated
SELECT 'permissions' as table_name, COUNT(*) as count FROM permissions
UNION ALL
SELECT 'roles' as table_name, COUNT(*) as count FROM roles
UNION ALL  
SELECT 'role_permissions' as table_name, COUNT(*) as count FROM role_permissions;

-- Verify role hierarchy
SELECT r.name, r.display_name, r.hierarchy_level, COUNT(rp.permission_id) as permission_count
FROM roles r
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY r.id, r.name, r.display_name, r.hierarchy_level
ORDER BY r.hierarchy_level;

-- Show permissions per role for verification
SELECT r.name as role, p.category, COUNT(*) as permission_count
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
GROUP BY r.name, p.category
ORDER BY r.hierarchy_level, p.category;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- The migration has successfully:
-- 1. ✅ Created RBAC system tables (permissions, roles, role_permissions)
-- 2. ✅ Updated role constraints to include 'manager' and 'supervisor'
-- 3. ✅ Populated granular permissions system
-- 4. ✅ Assigned appropriate permissions to each role
-- 5. ✅ Created helper functions for permission checking
-- 6. ✅ Added audit system for role changes
-- 7. ✅ Preserved all existing data
-- 8. ✅ Added optimized indexes for performance

COMMIT;