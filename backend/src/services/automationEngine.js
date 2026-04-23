// backend/src/services/automationEngine.js
const sequelize = require('../config/database');

// scheduled → active: when NOW() is within [scheduled_start, scheduled_end]
const checkSessionStatuses = async () => {
  try {
    await sequelize.query(
      `UPDATE sessions
       SET status = 'active', actual_start_time = COALESCE(actual_start_time, NOW())
       WHERE status = 'scheduled'
         AND scheduled_start <= NOW()
         AND scheduled_end > NOW()`
    );
  } catch (e) { console.error('checkSessionStatuses:', e.message); }
};

// active → completed: when NOW() is past scheduled_end + grace_period_minutes
const autoEndExpiredSessions = async () => {
  try {
    await sequelize.query(
      `UPDATE sessions
       SET status = 'completed',
           auto_ended = true,
           actual_end_time = COALESCE(actual_end_time, NOW())
       WHERE status = 'active'
         AND (scheduled_end + (grace_period_minutes || ' minutes')::INTERVAL) < NOW()`
    );
  } catch (e) { console.error('autoEndExpiredSessions:', e.message); }
};

// scheduled → cancelled: sessions that never started and are now past end time
const cancelMissedSessions = async () => {
  try {
    await sequelize.query(
      `UPDATE sessions
       SET status = 'cancelled'
       WHERE status = 'scheduled'
         AND scheduled_end < NOW()`
    );
  } catch (e) { console.error('cancelMissedSessions:', e.message); }
};

const checkHomeworkCleanup = async () => {
  try {
    await sequelize.query(
      `UPDATE homework SET status = 'closed' WHERE status = 'active' AND due_date < NOW()`
    );
  } catch (e) { console.error('checkHomeworkCleanup:', e.message); }
};

const sendPendingNotifications = async () => {};

module.exports = {
  checkSessionStatuses,
  autoEndExpiredSessions,
  cancelMissedSessions,
  checkHomeworkCleanup,
  sendPendingNotifications
};
