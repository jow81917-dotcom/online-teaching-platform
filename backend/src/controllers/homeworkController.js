// backend/src/controllers/homeworkController.js
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { role, id } = req.user;
    let query = 'SELECT * FROM homework';
    let bind = [];
    if (role === 'teacher') { query += ' WHERE teacher_id=$1'; bind = [id]; }
    const [rows] = await sequelize.query(query, { bind });
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await sequelize.query('SELECT * FROM homework WHERE id=$1', { bind: [req.params.id] });
    if (!rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.create = async (req, res) => {
  const { session_id, title, description, content_type, content_url, due_date, max_score } = req.body;
  try {
    const [teacher] = await sequelize.query('SELECT user_id FROM teachers WHERE user_id=$1', { bind: [req.user.id] });
    if (!teacher.length) return res.status(403).json({ message: 'Not a teacher' });
    const id = uuidv4();
    await sequelize.query(
      'INSERT INTO homework (id,teacher_id,session_id,title,description,content_type,content_url,due_date,max_score) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
      { bind: [id, req.user.id, session_id, title, description||null, content_type, content_url, due_date, max_score||100] }
    );
    const [rows] = await sequelize.query('SELECT * FROM homework WHERE id=$1', { bind: [id] });
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getSubmissions = async (req, res) => {
  try {
    const [rows] = await sequelize.query('SELECT * FROM homework_submissions WHERE homework_id=$1', { bind: [req.params.id] });
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.submit = async (req, res) => {
  const { content_type, content_url } = req.body;
  try {
    const id = uuidv4();
    await sequelize.query(
      `INSERT INTO homework_submissions (id,homework_id,student_id,content_type,content_url)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (homework_id, student_id)
       DO UPDATE SET content_type=EXCLUDED.content_type, content_url=EXCLUDED.content_url, status='resubmitted'`,
      { bind: [id, req.params.id, req.user.id, content_type, content_url] }
    );
    res.status(201).json({ message: 'Submitted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.grade = async (req, res) => {
  const { score, feedback } = req.body;
  try {
    await sequelize.query(
      `UPDATE homework_submissions SET score=$1, feedback=$2, status='reviewed', reviewed_at=NOW() WHERE id=$3`,
      { bind: [score, feedback||null, req.params.submissionId] }
    );
    res.json({ message: 'Graded' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
