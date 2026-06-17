// backend/src/controllers/userController.js
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

const SUB_ADMIN_ROLES = ['manager', 'supervisor'];
const ELEVATED_ROLES = ['admin', ...SUB_ADMIN_ROLES];

const getUserColumns = async () => {
  const [columns] = await sequelize.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
  );
  return new Set(columns.map((column) => column.column_name));
};

const userSelectList = (alias, columns) => {
  const prefix = alias ? `${alias}.` : '';
  return [
    `${prefix}id`,
    `${prefix}username`,
    columns.has('email') ? `${prefix}email` : 'NULL AS email',
    columns.has('full_name') ? `${prefix}full_name` : 'NULL AS full_name',
    `${prefix}role`,
    `${prefix}is_active`,
    `${prefix}created_at`,
    `${prefix}last_login`
  ];
};

const userGroupList = (alias, columns) => {
  const prefix = alias ? `${alias}.` : '';
  return [
    `${prefix}id`,
    `${prefix}username`,
    ...(columns.has('email') ? [`${prefix}email`] : []),
    ...(columns.has('full_name') ? [`${prefix}full_name`] : []),
    `${prefix}role`,
    `${prefix}is_active`,
    `${prefix}created_at`,
    `${prefix}last_login`
  ];
};

const sanitizeSubAdminPayload = (body) => {
  const username = String(body.username || '').trim();
  const role = String(body.role || '').trim().toLowerCase();

  return { username, role };
};

const generatePassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = 'Otp@';
  for (let i = 0; i < 10; i += 1) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
};

exports.getStats = async (req, res) => {
  try {
    const [rows] = await sequelize.query(`
      SELECT
        COUNT(*) FILTER (WHERE role = 'admin')      AS admins,
        COUNT(*) FILTER (WHERE role = 'manager')    AS managers,
        COUNT(*) FILTER (WHERE role = 'supervisor') AS supervisors,
        COUNT(*) FILTER (WHERE role = 'teacher')    AS teachers,
        COUNT(*) FILTER (WHERE role = 'student')    AS students,
        COUNT(*) FILTER (WHERE is_active = 1) AS active_total,
        COUNT(*)                                 AS total
      FROM users
    `);
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getAll = async (req, res) => {
  try {
    const { role } = req.query;
    const columns = await getUserColumns();
    const selectColumns = userSelectList('u', columns).join(', ');
    const groupColumns = userGroupList('u', columns).join(', ');
    const bind = [];
    const clauses = [];

    if (role) {
      clauses.push(`u.role = $${bind.length + 1}`);
      bind.push(role);
    }

    if (req.user.role === 'manager') {
      clauses.push("u.role <> 'admin'");
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const [rows] = await sequelize.query(`
      SELECT
        ${selectColumns},
        COUNT(s.id) FILTER (WHERE s.status = 'scheduled' AND s.scheduled_start > NOW()) AS upcoming_sessions,
        COUNT(s.id) FILTER (WHERE s.status = 'completed')                               AS completed_sessions,
        COUNT(s.id) FILTER (WHERE s.status = 'active')                                  AS active_sessions
      FROM users u
      LEFT JOIN sessions s ON (
        (u.role = 'teacher' AND s.teacher_id = u.id) OR
        (u.role = 'student' AND s.student_id = u.id)
      )
      ${where}
      GROUP BY ${groupColumns}
      ORDER BY u.created_at DESC
    `, { bind });
    res.json(rows);
  } catch (e) {
    console.error('[users.getAll]', e.message);
    res.status(500).json({ message: e.message });
  }
};

exports.getOne = async (req, res) => {
  try {
    const columns = await getUserColumns();
    const [rows] = await sequelize.query(
      `SELECT ${userSelectList('', columns).join(', ')} FROM users WHERE id = $1`,
      { bind: [req.params.id] }
    );
    if (!rows.length) return res.status(404).json({ message: 'Not found' });
    const user = rows[0];
    // today's sessions
    const [today] = await sequelize.query(`
      SELECT s.id, s.status, s.scheduled_start, s.scheduled_end, s.room_name,
        CASE WHEN u.role='teacher' THEN us.username ELSE ut.username END AS other_name
      FROM users u
      JOIN sessions s ON (
        (u.role='teacher' AND s.teacher_id=u.id) OR
        (u.role='student' AND s.student_id=u.id)
      )
      LEFT JOIN users ut ON ut.id = s.teacher_id
      LEFT JOIN users us ON us.id = s.student_id
      WHERE u.id = $1 AND DATE(s.scheduled_start) = CURRENT_DATE
      ORDER BY s.scheduled_start ASC
    `, { bind: [req.params.id] });
    user.today_sessions = today;
    res.json(user);
  } catch (e) {
    console.error('[users.getOne]', e.message);
    res.status(500).json({ message: e.message });
  }
};

exports.getSubAdmins = async (req, res) => {
  try {
    const columns = await getUserColumns();
    const [rows] = await sequelize.query(`
      SELECT ${userSelectList('', columns).join(', ')}
      FROM users
      WHERE role IN ('manager', 'supervisor')
      ORDER BY created_at DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error('[users.getSubAdmins]', e.message);
    res.status(500).json({ message: e.message });
  }
};

exports.createSubAdmin = async (req, res) => {
  const { username, role } = sanitizeSubAdminPayload(req.body);
  const { password } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Username, password, and role are required' });
  }

  if (!SUB_ADMIN_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Only manager and supervisor accounts can be created here' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  try {
    const [existing] = await sequelize.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1)',
      { bind: [username] }
    );
    if (existing.length) return res.status(409).json({ message: 'Username already exists' });

    const id = uuidv4();
    const hash = await bcrypt.hash(password, 10);
    await sequelize.query(
      `INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 1, NOW(), NOW())`,
      { bind: [id, username, hash, role] }
    );

    const [rows] = await sequelize.query(
      `SELECT ${userSelectList('', await getUserColumns()).join(', ')} FROM users WHERE id = $1`,
      { bind: [id] }
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error('[users.createSubAdmin]', e.message);
    res.status(500).json({ message: e.message });
  }
};

exports.getRolePermissions = async (req, res) => {
  const role = String(req.params.role || '').toLowerCase();
  if (!['admin', 'manager', 'supervisor', 'teacher', 'student'].includes(role)) {
    return res.status(400).json({ message: 'Unknown role' });
  }

  try {
    const [rows] = await sequelize.query(
      'SELECT permission_name, permission_description, category FROM get_role_permissions($1)',
      { bind: [role] }
    );
    res.json(rows);
  } catch (e) {
    const fallback = {
      manager: [
        { permission_name: 'users.view', permission_description: 'View users', category: 'users' },
        { permission_name: 'sessions.view_all', permission_description: 'View all sessions', category: 'sessions' },
        { permission_name: 'reports.view', permission_description: 'View reports', category: 'reports' },
        { permission_name: 'reports.export', permission_description: 'Export reports', category: 'reports' }
      ],
      supervisor: [
        { permission_name: 'sessions.view_all', permission_description: 'View all sessions', category: 'sessions' },
        { permission_name: 'sessions.monitor_live', permission_description: 'Monitor live sessions', category: 'sessions' },
        { permission_name: 'sessions.join_any', permission_description: 'Join sessions for support', category: 'sessions' },
        { permission_name: 'reports.view', permission_description: 'View reports', category: 'reports' }
      ]
    };
    res.json(fallback[role] || []);
  }
};

exports.update = async (req, res) => {
  const { username, email, fullName, role } = sanitizeSubAdminPayload(req.body);
  const { avatar_url, is_active } = req.body;
  try {
    const columns = await getUserColumns();
    const [existingRows] = await sequelize.query('SELECT id, role FROM users WHERE id=$1', { bind: [req.params.id] });
    if (!existingRows.length) return res.status(404).json({ message: 'User not found' });

    const existingUser = existingRows[0];
    if (existingUser.role === 'admin' && role && role !== 'admin') {
      return res.status(403).json({ message: 'Admin accounts cannot be modified from sub-admin management' });
    }
    if (role && ELEVATED_ROLES.includes(role) && role !== 'admin' && !SUB_ADMIN_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid elevated role' });
    }
    if (role === 'admin' && existingUser.role !== 'admin') {
      return res.status(403).json({ message: 'Use a dedicated admin promotion workflow for admin roles' });
    }

    const updates = [];
    const bind = [];
    const addUpdate = (column, value) => {
      if (value === undefined || value === null || value === '') return;
      if (!columns.has(column)) return;
      bind.push(value);
      updates.push(`${column}=$${bind.length}`);
    };

    addUpdate('username', username);
    addUpdate('email', email);
    addUpdate('full_name', fullName);
    addUpdate('role', role);
    addUpdate('avatar_url', avatar_url);
    addUpdate('is_active', is_active);

    if (updates.length) {
      bind.push(req.params.id);
      await sequelize.query(
        `UPDATE users SET ${updates.join(', ')}, updated_at=NOW() WHERE id=$${bind.length}`,
        { bind }
      );
    }
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.resetPassword = async (req, res) => {
  try {
    const [rows] = await sequelize.query('SELECT role FROM users WHERE id=$1', { bind: [req.params.id] });
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    if (!SUB_ADMIN_ROLES.includes(rows[0].role)) {
      return res.status(403).json({ message: 'Password resets here are limited to manager and supervisor accounts' });
    }

    const newPassword = generatePassword();
    const hash = await bcrypt.hash(newPassword, 10);
    await sequelize.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', {
      bind: [hash, req.params.id]
    });
    res.json({ newPassword });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const [rows] = await sequelize.query('SELECT role FROM users WHERE id=$1', { bind: [req.params.id] });
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    if (rows[0].role === 'admin') return res.status(403).json({ message: 'Admin accounts cannot be deleted here' });

    await sequelize.query('UPDATE users SET is_active=0, updated_at=NOW() WHERE id=$1', { bind: [req.params.id] });
    res.json({ message: 'Deactivated' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
