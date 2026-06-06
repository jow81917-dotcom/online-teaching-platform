// backend/src/services/automationEngine.js
const sequelize = require('../config/database');
const https = require('https');
const http = require('http');

const CLASSROOM_URL = process.env.CLASSROOM_URL || 'http://localhost:3000';

const notifyClassroomSessionEnded = (roomId, scheduledEnd) => {
  if (!roomId || !scheduledEnd) return;

  try {
    const classroomBase = CLASSROOM_URL.replace(/\/$/, '');
    const postData = JSON.stringify({ roomId, scheduledEnd });
    const parsedUrl = new URL(`${classroomBase}/api/room-schedule`);
    const lib = parsedUrl.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    });

    req.on('error', e => console.warn('[automation] failed to end classroom room:', e.message));
    req.write(postData);
    req.end();
  } catch (e) {
    console.warn('[automation] failed to build classroom end request:', e.message);
  }
};

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
    const [endedSessions] = await sequelize.query(
      `UPDATE sessions
       SET status = 'completed',
           auto_ended = true,
           actual_end_time = COALESCE(actual_end_time, NOW())
       WHERE status = 'active'
         AND (scheduled_end + (grace_period_minutes || ' minutes')::INTERVAL) < NOW()
       RETURNING id, room_name, scheduled_end`
    );

    endedSessions.forEach(session => {
      notifyClassroomSessionEnded(session.room_name || session.id, session.scheduled_end);
    });
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
