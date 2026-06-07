// backend/src/controllers/userController.js
const sequelize = require('../config/database');

exports.getStats = async (req, res) => {
  try {
    const [rows] = await sequelize.query(`
      SELECT
        COUNT(*) FILTER (WHERE role = 'admin')   AS admins,
        COUNT(*) FILTER (WHERE role = 'teacher') AS teachers,
        COUNT(*) FILTER (WHERE role = 'student') AS students,
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
    const where = role ? 'WHERE u.role = $1' : '';
    const bind  = role ? [role] : [];
    const [rows] = await sequelize.query(`
      SELECT
        u.id, u.username, u.role, u.is_active, u.created_at, u.last_login,
        COUNT(s.id) FILTER (WHERE s.status = 'scheduled' AND s.scheduled_start > NOW()) AS upcoming_sessions,
        COUNT(s.id) FILTER (WHERE s.status = 'completed')                               AS completed_sessions,
        COUNT(s.id) FILTER (WHERE s.status = 'active')                                  AS active_sessions
      FROM users u
      LEFT JOIN sessions s ON (
        (u.role = 'teacher' AND s.teacher_id = u.id) OR
        (u.role = 'student' AND s.student_id = u.id)
      )
      ${where}
      GROUP BY u.id, u.username, u.role, u.is_active, u.created_at, u.last_login
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
    const [rows] = await sequelize.query(
      'SELECT id, username, role, is_active, created_at, last_login FROM users WHERE id = $1',
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

exports.update = async (req, res) => {
  const { username, avatar_url, is_active } = req.body;
  try {
    await sequelize.query(
      'UPDATE users SET username=COALESCE($1,username), avatar_url=COALESCE($2,avatar_url), is_active=COALESCE($3,is_active) WHERE id=$4',
      { bind: [username||null, avatar_url||null, is_active??null, req.params.id] }
    );
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.remove = async (req, res) => {
  try {
    await sequelize.query('UPDATE users SET is_active=0 WHERE id=$1', { bind: [req.params.id] });
    res.json({ message: 'Deactivated' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
