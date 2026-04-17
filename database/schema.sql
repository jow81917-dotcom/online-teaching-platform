-- database/schema.sql
SET SQL_MODE = '';

CREATE DATABASE IF NOT EXISTS school_management_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE school_management_system;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role ENUM('admin', 'teacher', 'student') NOT NULL,
    avatar_url TEXT,
    is_active TINYINT(1) DEFAULT 1,
    last_login TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_role (role),
    INDEX idx_email (email)
);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) UNIQUE NOT NULL,
    grade_level INT,
    parent_email VARCHAR(255),
    phone_number VARCHAR(20),
    address TEXT,
    payment_status ENUM('paid', 'pending', 'expired') DEFAULT 'pending',
    payment_expiry DATE,
    enrollment_date DATE DEFAULT NULL,
    attendance_score DECIMAL(5,2) DEFAULT 0,
    homework_completion_rate DECIMAL(5,2) DEFAULT 0,
    engagement_score DECIMAL(5,2) DEFAULT 0,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_payment_status (payment_status),
    INDEX idx_enrollment_date (enrollment_date)
);

-- Teachers table
CREATE TABLE IF NOT EXISTS teachers (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) UNIQUE NOT NULL,
    subject_specialization VARCHAR(255),
    qualification TEXT,
    experience_years INT DEFAULT 0,
    phone_number VARCHAR(20),
    address TEXT,
    reliability_score DECIMAL(5,2) DEFAULT 100,
    session_count INT DEFAULT 0,
    performance_rating DECIMAL(3,2) DEFAULT 0,
    is_available TINYINT(1) DEFAULT 1,
    hire_date DATE DEFAULT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_subject (subject_specialization),
    INDEX idx_reliability (reliability_score)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    subject VARCHAR(100),
    teacher_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    scheduled_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scheduled_end TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    min_duration_minutes INT DEFAULT 30,
    max_duration_minutes INT DEFAULT 60,
    grace_period_minutes INT DEFAULT 5,
    status ENUM('scheduled', 'active', 'completed', 'cancelled', 'replaced') DEFAULT 'scheduled',
    actual_start_time TIMESTAMP NULL DEFAULT NULL,
    actual_end_time TIMESTAMP NULL DEFAULT NULL,
    auto_ended TINYINT(1) DEFAULT 0,
    meeting_link TEXT,
    room_name VARCHAR(255) UNIQUE,
    is_replacement TINYINT(1) DEFAULT 0,
    original_teacher_id VARCHAR(36) NULL,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(user_id),
    FOREIGN KEY (student_id) REFERENCES students(user_id),
    FOREIGN KEY (original_teacher_id) REFERENCES teachers(user_id),
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_teacher (teacher_id, scheduled_start),
    INDEX idx_student (student_id, scheduled_start),
    INDEX idx_status_time (status, scheduled_start),
    INDEX idx_room_name (room_name)
);

-- Live sessions tracking
CREATE TABLE IF NOT EXISTS live_sessions (
    id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) UNIQUE NOT NULL,
    room_name VARCHAR(255) UNIQUE NOT NULL,
    signaling_server_url VARCHAR(255),
    status ENUM('waiting', 'active', 'ended', 'expired') DEFAULT 'waiting',
    scheduled_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scheduled_end TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    min_duration_minutes INT DEFAULT 30,
    max_duration_minutes INT DEFAULT 60,
    grace_period_minutes INT DEFAULT 5,
    actual_start_time TIMESTAMP NULL DEFAULT NULL,
    actual_end_time TIMESTAMP NULL DEFAULT NULL,
    auto_ended TINYINT(1) DEFAULT 0,
    extensions_granted INT DEFAULT 0,
    total_extended_minutes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_room (room_name),
    INDEX idx_time (scheduled_start, scheduled_end)
);

-- Live participants tracking
CREATE TABLE IF NOT EXISTS live_participants (
    id VARCHAR(36) NOT NULL,
    live_session_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    peer_id VARCHAR(255),
    role ENUM('teacher', 'student') NOT NULL,
    join_time TIMESTAMP NULL DEFAULT NULL,
    leave_time TIMESTAMP NULL DEFAULT NULL,
    duration_minutes INT DEFAULT 0,
    met_min_duration TINYINT(1) DEFAULT 0,
    video_enabled TINYINT(1) DEFAULT 0,
    audio_enabled TINYINT(1) DEFAULT 0,
    connection_quality INT DEFAULT 0,
    packet_loss DECIMAL(5,2) DEFAULT 0,
    hand_raised_count INT DEFAULT 0,
    last_hand_raised TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (live_session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_session (live_session_id),
    INDEX idx_user (user_id),
    UNIQUE KEY unique_participant (live_session_id, user_id)
);

-- Session extensions requests
CREATE TABLE IF NOT EXISTS session_extensions (
    id VARCHAR(36) NOT NULL,
    live_session_id VARCHAR(36) NOT NULL,
    requested_by VARCHAR(36) NOT NULL,
    requested_minutes INT NOT NULL,
    reason TEXT,
    status ENUM('pending', 'approved', 'denied') DEFAULT 'pending',
    approved_by VARCHAR(36) NULL,
    approved_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (live_session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    INDEX idx_status (status)
);

-- Homework table
CREATE TABLE IF NOT EXISTS homework (
    id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type ENUM('image', 'audio', 'mixed') NOT NULL,
    content_url TEXT NOT NULL,
    due_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    max_score INT DEFAULT 100,
    status ENUM('active', 'closed', 'archived') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(user_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    INDEX idx_teacher (teacher_id),
    INDEX idx_session (session_id),
    INDEX idx_due_date (due_date),
    INDEX idx_status (status)
);

-- Homework submissions
CREATE TABLE IF NOT EXISTS homework_submissions (
    id VARCHAR(36) NOT NULL,
    homework_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    content_type ENUM('image', 'audio', 'mixed') NOT NULL,
    content_url TEXT NOT NULL,
    score INT NULL,
    feedback TEXT,
    interaction_count INT DEFAULT 0,
    status ENUM('submitted', 'reviewed', 'resubmitted') DEFAULT 'submitted',
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(user_id),
    INDEX idx_homework (homework_id),
    INDEX idx_student (student_id),
    INDEX idx_interaction_count (interaction_count),
    UNIQUE KEY unique_submission (homework_id, student_id)
);

-- Homework interactions
CREATE TABLE IF NOT EXISTS homework_interactions (
    id VARCHAR(36) NOT NULL,
    submission_id VARCHAR(36) NOT NULL,
    interaction_type ENUM('initial', 'resubmission', 'teacher_feedback', 'admin_cleanup') NOT NULL,
    content_url TEXT,
    notes TEXT,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (submission_id) REFERENCES homework_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_submission (submission_id),
    INDEX idx_created_at (created_at)
);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    user_role ENUM('teacher', 'student') NOT NULL,
    session_id VARCHAR(36) NULL,
    leave_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approved_by VARCHAR(36) NULL,
    approved_at TIMESTAMP NULL DEFAULT NULL,
    replacement_teacher_id VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (replacement_teacher_id) REFERENCES teachers(user_id),
    INDEX idx_user (user_id, leave_date),
    INDEX idx_status (status),
    INDEX idx_date (leave_date)
);

-- Session replacements
CREATE TABLE IF NOT EXISTS session_replacements (
    id VARCHAR(36) NOT NULL,
    original_session_id VARCHAR(36) NOT NULL,
    original_teacher_id VARCHAR(36) NOT NULL,
    replacement_teacher_id VARCHAR(36) NOT NULL,
    leave_request_id VARCHAR(36) NOT NULL,
    status ENUM('pending', 'confirmed', 'completed') DEFAULT 'pending',
    notified_at TIMESTAMP NULL DEFAULT NULL,
    confirmed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (original_session_id) REFERENCES sessions(id),
    FOREIGN KEY (original_teacher_id) REFERENCES teachers(user_id),
    FOREIGN KEY (replacement_teacher_id) REFERENCES teachers(user_id),
    FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id),
    INDEX idx_original_session (original_session_id),
    INDEX idx_replacement (replacement_teacher_id),
    INDEX idx_status (status)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data LONGTEXT,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id, is_read),
    INDEX idx_created_at (created_at),
    INDEX idx_type (type)
);

-- Video access
CREATE TABLE IF NOT EXISTS video_access (
    id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    video_url TEXT NOT NULL,
    title VARCHAR(255),
    duration INT,
    assigned_by VARCHAR(36) NOT NULL,
    is_paid_only TINYINT(1) DEFAULT 1,
    access_granted TINYINT(1) DEFAULT 0,
    viewed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (student_id) REFERENCES students(user_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id),
    INDEX idx_student (student_id),
    INDEX idx_paid_status (is_paid_only, access_granted),
    INDEX idx_expiry (expires_at),
    UNIQUE KEY unique_video_access (student_id, session_id)
);

-- Analytics table
CREATE TABLE IF NOT EXISTS analytics (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    user_role ENUM('admin', 'teacher', 'student') NOT NULL,
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2),
    metric_data LONGTEXT,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_user (user_id, date),
    INDEX idx_metric (metric_type, date),
    INDEX idx_role (user_role)
);

-- Admin actions log
CREATE TABLE IF NOT EXISTS admin_actions (
    id VARCHAR(36) NOT NULL,
    admin_id VARCHAR(36) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    target_user_id VARCHAR(36),
    target_type VARCHAR(50),
    details LONGTEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (admin_id) REFERENCES users(id),
    INDEX idx_admin (admin_id, created_at),
    INDEX idx_action (action_type),
    INDEX idx_target (target_user_id)
);

-- Triggers
DELIMITER $$

DROP TRIGGER IF EXISTS check_session_conflicts_before_insert$$
CREATE TRIGGER check_session_conflicts_before_insert
BEFORE INSERT ON sessions
FOR EACH ROW
BEGIN
    DECLARE conflict_count INT;

    SELECT COUNT(*) INTO conflict_count
    FROM sessions
    WHERE teacher_id = NEW.teacher_id
      AND status IN ('scheduled', 'active')
      AND scheduled_start < NEW.scheduled_end
      AND scheduled_end > NEW.scheduled_start;

    IF conflict_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Teacher has conflicting session';
    END IF;

    SELECT COUNT(*) INTO conflict_count
    FROM sessions
    WHERE student_id = NEW.student_id
      AND status IN ('scheduled', 'active')
      AND scheduled_start < NEW.scheduled_end
      AND scheduled_end > NEW.scheduled_start;

    IF conflict_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student has conflicting session';
    END IF;
END$$

DROP TRIGGER IF EXISTS auto_create_live_session$$
CREATE TRIGGER auto_create_live_session
AFTER INSERT ON sessions
FOR EACH ROW
BEGIN
    IF NEW.status = 'scheduled' THEN
        INSERT INTO live_sessions (
            id, session_id, room_name, scheduled_start, scheduled_end,
            min_duration_minutes, max_duration_minutes, grace_period_minutes
        ) VALUES (
            UUID(),
            NEW.id,
            CONCAT('room_', REPLACE(UUID(), '-', ''), '_', UNIX_TIMESTAMP()),
            NEW.scheduled_start, NEW.scheduled_end,
            NEW.min_duration_minutes, NEW.max_duration_minutes, NEW.grace_period_minutes
        );
    END IF;
END$$

DELIMITER ;

-- Default admin user (password: Admin@123)
INSERT IGNORE INTO users (id, email, password_hash, full_name, role, is_active) VALUES
('admin-001', 'admin@school.com', '$2b$10$YourHashHere', 'System Administrator', 'admin', 1);
