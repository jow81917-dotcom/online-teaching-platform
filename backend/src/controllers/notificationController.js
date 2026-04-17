// backend/src/controllers/notificationController.js
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

exports.getAll = async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      'SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50',
      { replacements: [req.user.id] }
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.markRead = async (req, res) => {
  try {
    await sequelize.query(
      'UPDATE notifications SET is_read=1, read_at=NOW() WHERE id=? AND user_id=?',
      { replacements: [req.params.id, req.user.id] }
    );
    res.json({ message: 'Marked as read' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.markAllRead = async (req, res) => {
  try {
    await sequelize.query(
      'UPDATE notifications SET is_read=1, read_at=NOW() WHERE user_id=? AND is_read=0',
      { replacements: [req.user.id] }
    );
    res.json({ message: 'All marked as read' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
