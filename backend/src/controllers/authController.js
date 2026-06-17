// backend/src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

const signToken = (user) =>
  jwt.sign({ id: user.id, username: user.username, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });

exports.login = async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Username and password required' });
  try {
    const [rows] = await sequelize.query('SELECT * FROM users WHERE LOWER(username) = LOWER($1) AND is_active = 1', { bind: [username] });
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
    await sequelize.query('UPDATE users SET last_login = NOW() WHERE id = $1', { bind: [user.id] });
    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        avatar_url: user.avatar_url
      }
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.register = async (req, res) => {
  const { username, password, role } = req.body;
  const email = String(req.body.email || `${username}@local.invalid`).trim().toLowerCase();
  const fullName = String(req.body.full_name || req.body.fullName || username || '').trim();
  if (!username || !password || !role) return res.status(400).json({ message: 'All fields required' });
  if (['admin', 'manager', 'supervisor'].includes(role)) {
    return res.status(403).json({ message: 'Elevated accounts must be created by an administrator' });
  }
  try {
    const [existing] = await sequelize.query(
      'SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)',
      { bind: [username, email] }
    );
    if (existing.length) return res.status(409).json({ message: 'Username already registered' });
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await sequelize.query(
      'INSERT INTO users (id, username, email, full_name, password_hash, role) VALUES ($1,$2,$3,$4,$5,$6)',
      { bind: [id, username, email, fullName, hash, role] }
    );
    if (role === 'student') {
      await sequelize.query('INSERT INTO students (id, user_id, enrollment_date) VALUES ($1,$2,CURRENT_DATE)', { bind: [uuidv4(), id] });
    } else if (role === 'teacher') {
      await sequelize.query('INSERT INTO teachers (id, user_id, hire_date) VALUES ($1,$2,CURRENT_DATE)', { bind: [uuidv4(), id] });
    }
    const [rows] = await sequelize.query('SELECT * FROM users WHERE id = $1', { bind: [id] });
    const token = signToken(rows[0]);
    res.status(201).json({ token, user: { id, username, email, full_name: fullName, role } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.me = async (req, res) => {
  try {
    const [columns] = await sequelize.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'users'"
    );
    const existingColumns = new Set(columns.map((column) => column.column_name));
    const optionalColumns = ['email', 'full_name', 'avatar_url']
      .filter((column) => existingColumns.has(column));
    const selectColumns = ['id', 'username', ...optionalColumns, 'role'];

    const [rows] = await sequelize.query(
      `SELECT ${selectColumns.join(', ')} FROM users WHERE id = $1`,
      { bind: [req.user.id] }
    );
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    res.json({
      user: {
        email: null,
        full_name: null,
        avatar_url: null,
        ...rows[0]
      }
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
