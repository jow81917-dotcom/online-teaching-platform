// backend/src/controllers/videoController.js
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

exports.getMyVideos = async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      'SELECT * FROM video_access WHERE student_id=? AND access_granted=1',
      { replacements: [req.user.id] }
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.assign = async (req, res) => {
  const { student_id, session_id, video_url, title, duration, is_paid_only, expires_at } = req.body;
  try {
    const id = uuidv4();
    await sequelize.query(
      'INSERT INTO video_access (id,student_id,session_id,video_url,title,duration,assigned_by,is_paid_only,expires_at) VALUES (?,?,?,?,?,?,?,?,?)',
      { replacements: [id, student_id, session_id, video_url, title||null, duration||null, req.user.id, is_paid_only??1, expires_at||null] }
    );
    res.status(201).json({ message: 'Video assigned', id });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.grantAccess = async (req, res) => {
  try {
    await sequelize.query('UPDATE video_access SET access_granted=1 WHERE id=?', { replacements: [req.params.id] });
    res.json({ message: 'Access granted' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
