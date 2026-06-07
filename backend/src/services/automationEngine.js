// backend/src/services/automationEngine.js
const sequelize              = require('../config/database');
const { sendWebhook }        = require('./webhookService');

// ── scheduled → active: fire session-start webhook ───────────────────────────
const checkSessionStatuses = async () => {
  try {
    // Find sessions that should now be active and haven't had webhook fired yet
    const [toActivate] = await sequelize.query(`
      UPDATE sessions
      SET status = 'active',
          actual_start_time = COALESCE(actual_start_time, NOW()),
          webhook_sent_start = true,
          updated_at = NOW()
      WHERE status = 'scheduled'
        AND scheduled_start <= NOW()
        AND scheduled_end   >  NOW()
        AND webhook_sent_start = false
      RETURNING id, room_name, teacher_id, student_id, scheduled_end
    `);

    for (const s of toActivate) {
      sendWebhook('/session-start', {
        sessionId  : s.id,
        roomId     : s.room_name || s.id,
        teacherId  : s.teacher_id,
        studentId  : s.student_id,
        endTime    : s.scheduled_end
      });
      console.log(`[automation] session-start sent for room ${s.room_name}`);
    }

    // Also flip sessions that somehow became active without webhook (edge case)
    await sequelize.query(`
      UPDATE sessions
      SET status = 'active', actual_start_time = COALESCE(actual_start_time, NOW())
      WHERE status = 'scheduled'
        AND scheduled_start <= NOW()
        AND scheduled_end   >  NOW()
        AND webhook_sent_start = true
    `);

  } catch (e) { console.error('[checkSessionStatuses]', e.message); }
};

// ── active → completed: fire session-end webhook ─────────────────────────────
const autoEndExpiredSessions = async () => {
  try {
    const [toEnd] = await sequelize.query(`
      UPDATE sessions
      SET status = 'completed',
          auto_ended = true,
          actual_end_time = COALESCE(actual_end_time, NOW()),
          webhook_sent_end = true,
          updated_at = NOW()
      WHERE status = 'active'
        AND (scheduled_end + (grace_period_minutes || ' minutes')::INTERVAL) < NOW()
        AND webhook_sent_end = false
      RETURNING id, room_name, scheduled_end
    `);

    for (const s of toEnd) {
      sendWebhook('/session-end', {
        sessionId: s.id,
        roomId   : s.room_name || s.id
      });
      console.log(`[automation] session-end sent for room ${s.room_name}`);
    }
  } catch (e) { console.error('[autoEndExpiredSessions]', e.message); }
};

// ── scheduled → cancelled: never started, past end time ─────────────────────
const cancelMissedSessions = async () => {
  try {
    await sequelize.query(`
      UPDATE sessions
      SET status = 'cancelled', updated_at = NOW()
      WHERE status = 'scheduled'
        AND scheduled_end < NOW()
    `);
  } catch (e) { console.error('[cancelMissedSessions]', e.message); }
};

const checkHomeworkCleanup = async () => {
  try {
    await sequelize.query(`
      UPDATE homework SET status = 'closed' WHERE status = 'active' AND due_date < NOW()
    `);
  } catch (e) { console.error('[checkHomeworkCleanup]', e.message); }
};

const sendPendingNotifications = async () => {};

module.exports = {
  checkSessionStatuses,
  autoEndExpiredSessions,
  cancelMissedSessions,
  checkHomeworkCleanup,
  sendPendingNotifications
};
