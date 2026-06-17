-- ============================================================================
-- EXAMPLE PERMISSION QUERIES AND SECURITY RECOMMENDATIONS
-- Online Teaching Platform - RBAC System Usage Examples
-- ============================================================================

-- ============================================================================
-- 1. PERMISSION CHECKING EXAMPLES
-- ============================================================================

-- Check if a specific user role has permission
SELECT user_has_permission('manager', 'users.create') as can_create_users;
SELECT user_has_permission('supervisor', 'sessions.end') as can_end_sessions;
SELECT user_has_permission('teacher', 'admins.delete') as can_delete_admins; -- Should be false

-- Get all permissions for a specific role
SELECT * FROM get_role_permissions('supervisor');
SELECT * FROM get_role_permissions('manager');

-- Check multiple permissions at once
SELECT 
    'manager' as role,
    user_has_permission('manager', 'users.create') as can_create_users,
    user_has_permission('manager', 'admins.delete') as can_delete_admins,
    user_has_permission('manager', 'sessions.monitor_live') as can_monitor_sessions;

-- ============================================================================
-- 2. USER MANAGEMENT QUERIES
-- ============================================================================

-- Find users by role with their permission count
SELECT 
    u.id, 
    u.full_name, 
    u.email, 
    u.role,
    COUNT(rp.permission_id) as permission_count
FROM users u
LEFT JOIN roles r ON u.role = r.name
LEFT JOIN role_permissions rp ON r.id = rp.role_id
GROUP BY u.id, u.full_name, u.email, u.role
ORDER BY u.role, u.full_name;

-- Create a new manager user (example)
-- INSERT INTO users (id, email, password_hash, full_name, role, is_active)
-- VALUES (gen_random_uuid()::text, 'manager@school.com', '$2b$10$hashedpassword', 'Platform Manager', 'manager', 1);

-- Create a new supervisor user (example)  
-- INSERT INTO users (id, email, password_hash, full_name, role, is_active)
-- VALUES (gen_random_uuid()::text, 'supervisor@school.com', '$2b$10$hashedpassword', 'Session Supervisor', 'supervisor', 1);

-- ============================================================================
-- 3. SESSION MONITORING QUERIES (FOR SUPERVISORS)
-- ============================================================================

-- View all active sessions (supervisor permission)
SELECT 
    s.id,
    s.title,
    s.status,
    s.scheduled_start,
    s.scheduled_end,
    t.full_name as teacher_name,
    st.full_name as student_name,
    ls.status as live_status
FROM sessions s
JOIN users t ON s.teacher_id = t.id
JOIN users st ON s.student_id = st.id  
LEFT JOIN live_sessions ls ON s.id = ls.session_id
WHERE s.status IN ('scheduled', 'active')
ORDER BY s.scheduled_start;

-- Monitor live session participants
SELECT 
    ls.room_name,
    ls.status,
    ls.actual_start_time,
    COUNT(lp.id) as participant_count,
    STRING_AGG(u.full_name, ', ') as participants
FROM live_sessions ls
JOIN live_participants lp ON ls.id = lp.live_session_id
JOIN users u ON lp.user_id = u.id
WHERE ls.status = 'active'
GROUP BY ls.id, ls.room_name, ls.status, ls.actual_start_time;

-- ============================================================================
-- 4. AUDIT AND SECURITY QUERIES
-- ============================================================================

-- View recent role changes
SELECT 
    u1.full_name as user_changed,
    rca.old_role,
    rca.new_role,
    u2.full_name as changed_by,
    rca.reason,
    rca.created_at
FROM role_change_audit rca
JOIN users u1 ON rca.user_id = u1.id
JOIN users u2 ON rca.changed_by = u2.id
ORDER BY rca.created_at DESC
LIMIT 20;

-- Find users with elevated permissions
SELECT 
    u.full_name,
    u.email,
    u.role,
    r.hierarchy_level,
    u.last_login,
    u.is_active
FROM users u
JOIN roles r ON u.role = r.name
WHERE r.hierarchy_level <= 3  -- admin, manager, supervisor
ORDER BY r.hierarchy_level, u.full_name;

-- Check for inactive users with admin privileges
SELECT 
    u.full_name,
    u.email,
    u.role,
    u.last_login,
    u.created_at
FROM users u
WHERE u.role IN ('admin', 'manager', 'supervisor')
AND (u.last_login IS NULL OR u.last_login < NOW() - INTERVAL '30 days')
AND u.is_active = true;

-- ============================================================================
-- 5. PERFORMANCE OPTIMIZATION QUERIES
-- ============================================================================

-- Check index usage on role-related tables
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('users', 'roles', 'permissions', 'role_permissions')
ORDER BY times_used DESC;

-- Analyze permission lookup performance
EXPLAIN ANALYZE
SELECT COUNT(*) 
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'manager' AND p.name = 'users.create';

-- ============================================================================
-- 6. SECURITY RECOMMENDATIONS
-- ============================================================================

/*
SECURITY BEST PRACTICES:

1. PASSWORD POLICIES:
   - Enforce strong passwords for admin/manager/supervisor roles
   - Require password changes every 90 days for elevated roles
   - Enable 2FA for admin and manager accounts

2. ACCESS CONTROL:
   - Regularly audit user permissions (monthly)
   - Remove inactive elevated accounts immediately  
   - Log all administrative actions
   - Implement IP whitelisting for admin access

3. SESSION SECURITY:
   - Set shorter JWT expiration for elevated roles (1-2 hours)
   - Implement session invalidation on role changes
   - Log all permission checks and access attempts

4. DATABASE SECURITY:
   - Use row-level security (RLS) where appropriate
   - Encrypt sensitive data at rest
   - Regular backup and recovery testing
   - Monitor for SQL injection attempts

5. MONITORING:
   - Alert on multiple failed login attempts
   - Monitor for privilege escalation attempts
   - Track unusual permission usage patterns
   - Regular security audits and penetration testing

6. PRINCIPLE OF LEAST PRIVILEGE:
   - Regularly review and minimize permissions
   - Use time-limited elevated access when possible
   - Separate duties between different admin roles
   - Document all permission grants and changes

7. COMPLIANCE:
   - Maintain audit logs for compliance requirements
   - Regular access reviews and certifications
   - Document security procedures and policies
   - Train staff on security best practices
*/

-- ============================================================================
-- 7. RECOMMENDED STORED PROCEDURES FOR COMMON OPERATIONS
-- ============================================================================

-- Procedure to safely change user role with audit logging
CREATE OR REPLACE FUNCTION change_user_role(
    target_user_id VARCHAR(36),
    new_role VARCHAR(20),
    changed_by_user_id VARCHAR(36),
    reason TEXT DEFAULT NULL,
    client_ip VARCHAR(45) DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    old_role VARCHAR(20);
    role_exists BOOLEAN;
BEGIN
    -- Check if new role exists
    SELECT EXISTS(SELECT 1 FROM roles WHERE name = new_role) INTO role_exists;
    IF NOT role_exists THEN
        RAISE EXCEPTION 'Role % does not exist', new_role;
    END IF;
    
    -- Get current role
    SELECT role INTO old_role FROM users WHERE id = target_user_id;
    
    -- Update user role
    UPDATE users SET role = new_role, updated_at = NOW() 
    WHERE id = target_user_id;
    
    -- Log the change
    INSERT INTO role_change_audit (user_id, old_role, new_role, changed_by, reason, ip_address)
    VALUES (target_user_id, old_role, new_role, changed_by_user_id, reason, client_ip);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
-- SELECT change_user_role('user-123', 'manager', 'admin-001', 'Promoted to manager role', '192.168.1.100');

-- ============================================================================
-- 8. MAINTENANCE QUERIES
-- ============================================================================

-- Clean up old audit records (run monthly)
-- DELETE FROM role_change_audit WHERE created_at < NOW() - INTERVAL '1 year';

-- Vacuum and analyze role-related tables
-- VACUUM ANALYZE users, roles, permissions, role_permissions, role_change_audit;

-- Update table statistics
-- ANALYZE users, roles, permissions, role_permissions, role_change_audit;