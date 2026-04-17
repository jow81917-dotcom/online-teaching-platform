// backend/src/services/automationEngine.js
const sequelize = require('../config/database');

const checkSessionStatuses = async () => {
  try {
    await sequelize.query(
      `UPDATE sessions SET status='active' WHERE status='scheduled' AND scheduled_start <= NOW() AND scheduled_end > NOW()`
    );
  } catch (e) { console.error('checkSessionStatuses:', e.message); }
};

const autoEndExpiredSessions = async () => {
  try {
    await sequelize.query(
      `UPDATE sessions SET status='completed', auto_ended=1 WHERE status='active' AND scheduled_end < NOW()`
    );
  } catch (e) { console.error('autoEndExpiredSessions:', e.message); }
};

const checkHomeworkCleanup = async () => {
  try {
    await sequelize.query(
      `UPDATE homework SET status='closed' WHERE status='active' AND due_date < NOW()`
    );
  } catch (e) { console.error('checkHomeworkCleanup:', e.message); }
};

const sendPendingNotifications = async () => {};

module.exports = { checkSessionStatuses, autoEndExpiredSessions, checkHomeworkCleanup, sendPendingNotifications };
