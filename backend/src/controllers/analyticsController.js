// backend/src/controllers/analyticsController.js
const sequelize = require('../config/database');

exports.adminStats = async (req, res) => {
  try {
    const [[students]] = await sequelize.query('SELECT COUNT(*) as count FROM students');
    const [[teachers]] = await sequelize.query('SELECT COUNT(*) as count FROM teachers');
    const [[active]]   = await sequelize.query("SELECT COUNT(*) as count FROM sessions WHERE status='active'");
    const [[pending]]  = await sequelize.query("SELECT COUNT(*) as count FROM leave_requests WHERE status='pending'");
    res.json({
      totalStudents: students.count,
      totalTeachers: teachers.count,
      activeSessions: active.count,
      pendingLeave: pending.count,
      completionRate: 0,
      engagementScore: 0
    });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

exports.recentActivities = async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      "SELECT CONCAT(full_name, ' logged in') as description, last_login as time FROM users WHERE last_login IS NOT NULL ORDER BY last_login DESC LIMIT 10"
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
};
