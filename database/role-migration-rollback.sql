-- ============================================================================
-- ROLLBACK SCRIPT FOR ROLE-BASED ACCESS CONTROL MIGRATION
-- Online Teaching Platform - Rollback supervisor and manager roles
-- Compatible with Neon PostgreSQL
-- ============================================================================

-- WARNING: This will remove the new RBAC system and revert to original state
-- Only run this if you need to completely rollback the migration

BEGIN;

-- ============================================================================
-- PHASE 1: BACKUP EXISTING DATA (OPTIONAL - FOR SAFETY)
-- ============================================================================

-- Create temporary backup tables (uncomment if you want backups)
-- CREATE TABLE users_backup_before_rollback AS SELECT * FROM users;
-- CREATE TABLE analytics_backup_before_rollback AS SELECT * FROM analytics;

-- ============================================================================
-- PHASE 2: REMOVE NEW ROLES FROM EXISTING USERS
-- ============================================================================

-- Check if any users have the new roles
SELECT role, COUNT(*) 
FROM users 
WHERE role IN ('manager', 'supervisor') 
GROUP BY role;

-- WARNING: This will change manager/supervisor users to admin
-- Modify this section based on your preference:

-- Option A: Convert managers back to admin
UPDATE users 
SET role = 'admin' 
WHERE role = 'manager';

-- Option B: Convert supervisors back to admin (or teacher if preferred)
UPDATE users 
SET role = 'admin' 
WHERE role = 'supervisor';

-- Alternative: Convert supervisors to teacher instead
-- UPDATE users SET role = 'teacher' WHERE role = 'supervisor';

-- ============================================================================
-- PHASE 3: REVERT ROLE CONSTRAINTS TO ORIGINAL STATE
-- ============================================================================

-- Revert users table constraint to original
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
    CHECK (role IN ('admin','teacher','student'));

-- Revert analytics table constraint to original
ALTER TABLE analytics DROP CONSTRAINT IF EXISTS analytics_user_role_check;
ALTER TABLE analytics ADD CONSTRAINT analytics_user_role_check 
    CHECK (user_role IN ('admin','teacher','student'));

-- Leave requests constraint remains the same (was not changed for new roles)

-- ============================================================================
-- PHASE 4: DROP RBAC SYSTEM TABLES
-- ============================================================================

-- Drop audit table
DROP TABLE IF EXISTS role_change_audit CASCADE;

-- Drop RBAC tables in correct order (foreign key dependencies)
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;  
DROP TABLE IF EXISTS roles CASCADE;

-- ============================================================================
-- PHASE 5: DROP HELPER FUNCTIONS
-- ============================================================================

DROP FUNCTION IF EXISTS user_has_permission(VARCHAR, VARCHAR);
DROP FUNCTION IF EXISTS get_role_permissions(VARCHAR);

-- ============================================================================
-- PHASE 6: VERIFICATION
-- ============================================================================

-- Verify constraints are back to original
SELECT constraint_name, check_clause 
FROM information_schema.check_constraints 
WHERE constraint_name LIKE '%role%check%';

-- Verify no users have new roles
SELECT role, COUNT(*) as user_count 
FROM users 
GROUP BY role 
ORDER BY role;

-- Verify RBAC tables are gone
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('permissions', 'roles', 'role_permissions', 'role_change_audit')
AND table_schema = 'public';

-- ============================================================================
-- ROLLBACK COMPLETE
-- ============================================================================

-- The rollback has successfully:
-- 1. ✅ Converted manager/supervisor users back to admin
-- 2. ✅ Reverted role constraints to original state (admin, teacher, student)
-- 3. ✅ Dropped all RBAC system tables
-- 4. ✅ Removed helper functions
-- 5. ✅ Preserved all existing core data
-- 6. ✅ Restored original database schema

-- Your system is now back to the original role structure.

COMMIT;

-- ============================================================================
-- POST-ROLLBACK NOTES
-- ============================================================================

-- After running this rollback:
-- 1. Update your backend User model to remove 'manager' and 'supervisor' from ENUM
-- 2. Update any frontend code that references these roles  
-- 3. Remove any middleware that checks for these roles
-- 4. Test all role-based functionality to ensure it works as before

-- Example backend model update needed:
-- role: { type: DataTypes.ENUM('admin', 'teacher', 'student'), allowNull: false }