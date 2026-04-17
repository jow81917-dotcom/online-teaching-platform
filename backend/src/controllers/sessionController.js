// backend/src/controllers/sessionController.js
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

exports.getLiveSession = async (req, res) => {
  const { role, id } = req.user;
  try {
    const col = role === 'teacher' ? 'teacher_id' : 'student_id';
    // Get active session first, then next scheduled within 15 minutes
    const [rows] = await sequelize.query(
      `SELECT * FROM sessions
       WHERE ${col} = ?
         AND status IN ('active','scheduled')
         AND scheduled_start <= DATE_ADD(NOW(), INTERVAL 15 MINUTE)
         AND scheduled_end >= NOW()
       ORDER BY scheduled_start ASC
       LIMIT 1`,
      { replacements: [id] }
    );
    if (!rows.length) {
      // Return next upcoming session so frontend can show when it is
      const [next] = await sequelize.query(
        `SELECT * FROM sessions WHERE ${col}=? AND status='scheduled' AND scheduled_start > NOW() ORDER BY scheduled_start ASC LIMIT 1`,
        { replacements: [id] }
      );
      return res.json({ session: null, next: next[0] || null });
    }
    res.json({ session: rows[0], next: null });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getAll = async (req, res) => {
  try {
    const { role, id } = req.user;
    let query = 'SELECT * FROM sessions';
    let replacements = [];
    if (role === 'teacher') { query += ' WHERE teacher_id=?'; replacements = [id]; }
    else if (role === 'student') { query += ' WHERE student_id=?'; replacements = [id]; }
    const [rows] = await sequelize.query(query, { replacements });
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await sequelize.query('SELECT * FROM sessions WHERE id=?', { replacements: [req.params.id] });
    if (!rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.create = async (req, res) => {
  const { title, description, subject, teacher_id, student_id, scheduled_start, scheduled_end } = req.body;
  try {
    const id = uuidv4();
    await sequelize.query(
      'INSERT INTO sessions (id,title,description,subject,teacher_id,student_id,scheduled_start,scheduled_end,created_by) VALUES (?,?,?,?,?,?,?,?,?)',
      { replacements: [id, title, description||null, subject||null, teacher_id, student_id, scheduled_start, scheduled_end, req.user.id] }
    );
    const [rows] = await sequelize.query('SELECT * FROM sessions WHERE id=?', { replacements: [id] });
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.update = async (req, res) => {
  const { status, actual_start_time, actual_end_time } = req.body;
  try {
    await sequelize.query(
      'UPDATE sessions SET status=COALESCE(?,status), actual_start_time=COALESCE(?,actual_start_time), actual_end_time=COALESCE(?,actual_end_time) WHERE id=?',
      { replacements: [status||null, actual_start_time||null, actual_end_time||null, req.params.id] }
    );
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
