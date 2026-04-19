-- database/schema.sql (PostgreSQL)

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(10) NOT NULL CHECK (role IN ('admin','teacher','student')),
    avatar_url TEXT,
    is_active SMALLINT DEFAULT 1,
    last_login TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_users_role  ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Students table
CREATE TABLE IF NOT EXISTS students (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) UNIQUE NOT NULL,
    grade_level INT,
    parent_email VARCHAR(255),
    phone_number VARCHAR(20),
    address TEXT,
    payment_status VARCHAR(10) DEFAULT 'pending' CHECK (payment_status IN ('paid','pending','expired')),
    payment_expiry DATE,
    enrollment_date DATE DEFAULT NULL,
    attendance_score DECIMAL(5,2) DEFAULT 0,
    homework_completion_rate DECIMAL(5,2) DEFAULT 0,
    engagement_score DECIMAL(5,2) DEFAULT 0,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_students_payment    ON students(payment_status);
CREATE INDEX IF NOT EXISTS idx_students_enrollment ON students(enrollment_date);

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
    is_available SMALLINT DEFAULT 1,
    hire_date DATE DEFAULT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_teachers_subject     ON teachers(subject_specialization);
CREATE INDEX IF NOT EXISTS idx_teachers_reliability ON teachers(reliability_score);

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
    status VARCHAR(10) DEFAULT 'scheduled' CHECK (status IN ('scheduled','active','completed','cancelled','replaced')),
    actual_start_time TIMESTAMP NULL DEFAULT NULL,
    actual_end_time TIMESTAMP NULL DEFAULT NULL,
    auto_ended SMALLINT DEFAULT 0,
    meeting_link TEXT,
    room_name VARCHAR(255) UNIQUE,
    is_replacement SMALLINT DEFAULT 0,
    original_teacher_id VARCHAR(36) NULL,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(user_id),
    FOREIGN KEY (student_id) REFERENCES students(user_id),
    FOREIGN KEY (original_teacher_id) REFERENCES teachers(user_id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_teacher     ON sessions(teacher_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_sessions_student     ON sessions(student_id, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_sessions_status_time ON sessions(status, scheduled_start);
CREATE INDEX IF NOT EXISTS idx_sessions_room        ON sessions(room_name);

-- Live sessions tracking
CREATE TABLE IF NOT EXISTS live_sessions (
    id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) UNIQUE NOT NULL,
    room_name VARCHAR(255) UNIQUE NOT NULL,
    signaling_server_url VARCHAR(255),
    status VARCHAR(10) DEFAULT 'waiting' CHECK (status IN ('waiting','active','ended','expired')),
    scheduled_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    scheduled_end TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    min_duration_minutes INT DEFAULT 30,
    max_duration_minutes INT DEFAULT 60,
    grace_period_minutes INT DEFAULT 5,
    actual_start_time TIMESTAMP NULL DEFAULT NULL,
    actual_end_time TIMESTAMP NULL DEFAULT NULL,
    auto_ended SMALLINT DEFAULT 0,
    extensions_granted INT DEFAULT 0,
    total_extended_minutes INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON live_sessions(status);
CREATE INDEX IF NOT EXISTS idx_live_sessions_room   ON live_sessions(room_name);
CREATE INDEX IF NOT EXISTS idx_live_sessions_time   ON live_sessions(scheduled_start, scheduled_end);

-- Live participants tracking
CREATE TABLE IF NOT EXISTS live_participants (
    id VARCHAR(36) NOT NULL,
    live_session_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    peer_id VARCHAR(255),
    role VARCHAR(10) NOT NULL CHECK (role IN ('teacher','student')),
    join_time TIMESTAMP NULL DEFAULT NULL,
    leave_time TIMESTAMP NULL DEFAULT NULL,
    duration_minutes INT DEFAULT 0,
    met_min_duration SMALLINT DEFAULT 0,
    video_enabled SMALLINT DEFAULT 0,
    audio_enabled SMALLINT DEFAULT 0,
    connection_quality INT DEFAULT 0,
    packet_loss DECIMAL(5,2) DEFAULT 0,
    hand_raised_count INT DEFAULT 0,
    last_hand_raised TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (live_session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE (live_session_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_live_participants_session ON live_participants(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_participants_user    ON live_participants(user_id);

-- Session extensions
CREATE TABLE IF NOT EXISTS session_extensions (
    id VARCHAR(36) NOT NULL,
    live_session_id VARCHAR(36) NOT NULL,
    requested_by VARCHAR(36) NOT NULL,
    requested_minutes INT NOT NULL,
    reason TEXT,
    status VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
    approved_by VARCHAR(36) NULL,
    approved_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (live_session_id) REFERENCES live_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (requested_by) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_session_extensions_status ON session_extensions(status);

-- Homework table
CREATE TABLE IF NOT EXISTS homework (
    id VARCHAR(36) NOT NULL,
    teacher_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(10) NOT NULL CHECK (content_type IN ('image','audio','mixed')),
    content_url TEXT NOT NULL,
    due_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    max_score INT DEFAULT 100,
    status VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active','closed','archived')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (teacher_id) REFERENCES teachers(user_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_homework_teacher   ON homework(teacher_id);
CREATE INDEX IF NOT EXISTS idx_homework_session   ON homework(session_id);
CREATE INDEX IF NOT EXISTS idx_homework_due_date  ON homework(due_date);
CREATE INDEX IF NOT EXISTS idx_homework_status    ON homework(status);

-- Homework submissions
CREATE TABLE IF NOT EXISTS homework_submissions (
    id VARCHAR(36) NOT NULL,
    homework_id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    content_type VARCHAR(10) NOT NULL CHECK (content_type IN ('image','audio','mixed')),
    content_url TEXT NOT NULL,
    score INT NULL,
    feedback TEXT,
    interaction_count INT DEFAULT 0,
    status VARCHAR(15) DEFAULT 'submitted' CHECK (status IN ('submitted','reviewed','resubmitted')),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (homework_id) REFERENCES homework(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(user_id),
    UNIQUE (homework_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_hw_submissions_homework ON homework_submissions(homework_id);
CREATE INDEX IF NOT EXISTS idx_hw_submissions_student  ON homework_submissions(student_id);

-- Homework interactions
CREATE TABLE IF NOT EXISTS homework_interactions (
    id VARCHAR(36) NOT NULL,
    submission_id VARCHAR(36) NOT NULL,
    interaction_type VARCHAR(20) NOT NULL CHECK (interaction_type IN ('initial','resubmission','teacher_feedback','admin_cleanup')),
    content_url TEXT,
    notes TEXT,
    created_by VARCHAR(36) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (submission_id) REFERENCES homework_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_hw_interactions_submission ON homework_interactions(submission_id);
CREATE INDEX IF NOT EXISTS idx_hw_interactions_created_at ON homework_interactions(created_at);

-- Leave requests
CREATE TABLE IF NOT EXISTS leave_requests (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    user_role VARCHAR(10) NOT NULL CHECK (user_role IN ('teacher','student')),
    session_id VARCHAR(36) NULL,
    leave_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    reason TEXT,
    status VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
    approved_by VARCHAR(36) NULL,
    approved_at TIMESTAMP NULL DEFAULT NULL,
    replacement_teacher_id VARCHAR(36) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    FOREIGN KEY (replacement_teacher_id) REFERENCES teachers(user_id)
);
CREATE INDEX IF NOT EXISTS idx_leave_requests_user   ON leave_requests(user_id, leave_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_date   ON leave_requests(leave_date);

-- Session replacements
CREATE TABLE IF NOT EXISTS session_replacements (
    id VARCHAR(36) NOT NULL,
    original_session_id VARCHAR(36) NOT NULL,
    original_teacher_id VARCHAR(36) NOT NULL,
    replacement_teacher_id VARCHAR(36) NOT NULL,
    leave_request_id VARCHAR(36) NOT NULL,
    status VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending','confirmed','completed')),
    notified_at TIMESTAMP NULL DEFAULT NULL,
    confirmed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (original_session_id) REFERENCES sessions(id),
    FOREIGN KEY (original_teacher_id) REFERENCES teachers(user_id),
    FOREIGN KEY (replacement_teacher_id) REFERENCES teachers(user_id),
    FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id)
);
CREATE INDEX IF NOT EXISTS idx_session_replacements_original    ON session_replacements(original_session_id);
CREATE INDEX IF NOT EXISTS idx_session_replacements_replacement ON session_replacements(replacement_teacher_id);
CREATE INDEX IF NOT EXISTS idx_session_replacements_status      ON session_replacements(status);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data TEXT,
    is_read SMALLINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_notifications_user       ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_type       ON notifications(type);

-- Video access
CREATE TABLE IF NOT EXISTS video_access (
    id VARCHAR(36) NOT NULL,
    student_id VARCHAR(36) NOT NULL,
    session_id VARCHAR(36) NOT NULL,
    video_url TEXT NOT NULL,
    title VARCHAR(255),
    duration INT,
    assigned_by VARCHAR(36) NOT NULL,
    is_paid_only SMALLINT DEFAULT 1,
    access_granted SMALLINT DEFAULT 0,
    viewed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL DEFAULT NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (student_id) REFERENCES students(user_id),
    FOREIGN KEY (session_id) REFERENCES sessions(id),
    FOREIGN KEY (assigned_by) REFERENCES users(id),
    UNIQUE (student_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_video_access_student    ON video_access(student_id);
CREATE INDEX IF NOT EXISTS idx_video_access_paid       ON video_access(is_paid_only, access_granted);
CREATE INDEX IF NOT EXISTS idx_video_access_expiry     ON video_access(expires_at);

-- Analytics
CREATE TABLE IF NOT EXISTS analytics (
    id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    user_role VARCHAR(10) NOT NULL CHECK (user_role IN ('admin','teacher','student')),
    metric_type VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,2),
    metric_data TEXT,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_analytics_user   ON analytics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_analytics_metric ON analytics(metric_type, date);
CREATE INDEX IF NOT EXISTS idx_analytics_role   ON analytics(user_role);

-- Admin actions log
CREATE TABLE IF NOT EXISTS admin_actions (
    id VARCHAR(36) NOT NULL,
    admin_id VARCHAR(36) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    target_user_id VARCHAR(36),
    target_type VARCHAR(50),
    details TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (admin_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin  ON admin_actions(admin_id, created_at);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON admin_actions(target_user_id);

-- Default admin user (password: Admin@123)
INSERT INTO users (id, email, password_hash, full_name, role, is_active)
VALUES ('admin-001', 'admin@school.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'System Administrator', 'admin', 1)
ON CONFLICT (id) DO NOTHING;
