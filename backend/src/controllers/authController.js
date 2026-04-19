// backend/src/controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

const signToken = (user) =>
  jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });

exports.login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password required' });
  try {
    const [rows] = await sequelize.query('SELECT * FROM users WHERE email = $1 AND is_active = 1', { bind: [email] });
    const user = rows[0];
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials' });
    await sequelize.query('UPDATE users SET last_login = NOW() WHERE id = $1', { bind: [user.id] });
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, avatar_url: user.avatar_url } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.register = async (req, res) => {
  const { email, password, full_name, role } = req.body;
  if (!email || !password || !full_name || !role) return res.status(400).json({ message: 'All fields required' });
  try {
    const [existing] = await sequelize.query('SELECT id FROM users WHERE email = $1', { bind: [email] });
    if (existing.length) return res.status(409).json({ message: 'Email already registered' });
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await sequelize.query(
      'INSERT INTO users (id, email, password_hash, full_name, role) VALUES ($1,$2,$3,$4,$5)',
      { bind: [id, email, hash, full_name, role] }
    );
    if (role === 'student') {
      await sequelize.query('INSERT INTO students (id, user_id, enrollment_date) VALUES ($1,$2,CURRENT_DATE)', { bind: [uuidv4(), id] });
    } else if (role === 'teacher') {
      await sequelize.query('INSERT INTO teachers (id, user_id, hire_date) VALUES ($1,$2,CURRENT_DATE)', { bind: [uuidv4(), id] });
    }
    const [rows] = await sequelize.query('SELECT * FROM users WHERE id = $1', { bind: [id] });
    const token = signToken(rows[0]);
    res.status(201).json({ token, user: { id, email, full_name, role } });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.me = async (req, res) => {
  try {
    const [rows] = await sequelize.query('SELECT id, email, full_name, role, avatar_url FROM users WHERE id = $1', { bind: [req.user.id] });
    if (!rows.length) return res.status(404).json({ message: 'User not found' });
    res.json({ user: rows[0] });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
