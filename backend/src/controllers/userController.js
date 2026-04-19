// backend/src/controllers/userController.js
const sequelize = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const { role } = req.query;
    const where = role ? 'WHERE role = $1' : '';
    const bind = role ? [role] : [];
    const [rows] = await sequelize.query(`SELECT id, email, full_name, role, is_active, created_at FROM users ${where}`, { bind });
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.getOne = async (req, res) => {
  try {
    const [rows] = await sequelize.query('SELECT id, email, full_name, role, is_active, created_at FROM users WHERE id = $1', { bind: [req.params.id] });
    if (!rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.update = async (req, res) => {
  const { full_name, avatar_url, is_active } = req.body;
  try {
    await sequelize.query(
      'UPDATE users SET full_name=COALESCE($1,full_name), avatar_url=COALESCE($2,avatar_url), is_active=COALESCE($3,is_active) WHERE id=$4',
      { bind: [full_name||null, avatar_url||null, is_active??null, req.params.id] }
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
