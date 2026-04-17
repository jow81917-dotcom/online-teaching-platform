// backend/src/controllers/reportController.js
const sequelize = require('../config/database');

exports.summary = async (req, res) => {
  try {
    const [sessions] = await sequelize.query('SELECT status, COUNT(*) as count FROM sessions GROUP BY status');
    const [homework] = await sequelize.query('SELECT status, COUNT(*) as count FROM homework GROUP BY status');
    res.json({ sessions, homework });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
