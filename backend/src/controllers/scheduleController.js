// backend/src/controllers/scheduleController.js
const { v4: uuidv4 }         = require('uuid');
const sequelize               = require('../config/database');
const { generateCandidates }  = require('../services/sessionGenerator');

// ── Helper: notify all admin users about a conflict ──────────────────────────
const notifyAdmins = async (conflict, schedule) => {
  try {
    const [admins] = await sequelize.query(
      `SELECT id FROM users WHERE role = 'admin'`,
      { bind: [] }
    );
    for (const admin of admins) {
      const nid = uuidv4();
      await sequelize.query(
        `INSERT INTO notifications (id, user_id, type, title, message, created_at)
         VALUES ($1, $2, 'conflict', $3, $4, NOW())`,
        {
          bind: [
            nid,
            admin.id,
            'Scheduling Conflict Detected',
            `Schedule "${schedule.title}" has a conflict on ${conflict.conflict_date}: ` +
            conflict.reason
          ]
        }
      );
    }
  } catch (e) {
    console.warn('[scheduleController] notifyAdmins error:', e.message);
  }
};

// ── Helper: check teacher/student overlap ────────────────────────────────────
const findConflict = async (teacherId, studentId, scheduledStart, scheduledEnd, excludeScheduleId = null) => {
  let q = `
    SELECT id, title, teacher_id, student_id, scheduled_start, scheduled_end
    FROM sessions
    WHERE status NOT IN ('cancelled', 'completed', 'conflict_blocked')
      AND scheduled_start < $3
      AND scheduled_end   > $2
      AND (teacher_id = $1 OR student_id = $4)
  `;
  const bind = [teacherId, scheduledStart, scheduledEnd, studentId];

  if (excludeScheduleId) {
    q    += ' AND (schedule_id IS NULL OR schedule_id != $5)';
    bind.push(excludeScheduleId);
  }

  const [rows] = await sequelize.query(q, { bind });
  return rows[0] || null;
};

// ── GET /api/schedules ────────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const [schedules] = await sequelize.query(`
      SELECT s.*,
        ut.username AS teacher_name,
        us.username AS student_name,
        (SELECT COUNT(*) FROM sessions se WHERE se.schedule_id = s.id AND se.status != 'conflict_blocked') AS sessions_count,
        (SELECT COUNT(*) FROM conflicts c WHERE c.schedule_id = s.id) AS conflicts_count
      FROM schedules s
      JOIN users ut ON ut.id = s.teacher_id
      JOIN users us ON us.id = s.student_id
      ORDER BY s.created_at DESC
    `);

    // Fetch days for each schedule
    for (const sched of schedules) {
      const [days] = await sequelize.query(
        'SELECT day_of_week FROM schedule_days WHERE schedule_id = $1 ORDER BY day_of_week',
        { bind: [sched.id] }
      );
      sched.days = days.map(d => d.day_of_week);
    }

    res.json(schedules);
  } catch (e) {
    console.error('[getAll schedules]', e.message);
    res.status(500).json({ message: e.message });
  }
};

// ── GET /api/schedules/:id ────────────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      'SELECT * FROM schedules WHERE id = $1',
      { bind: [req.params.id] }
    );
    if (!rows.length) return res.status(404).json({ message: 'Schedule not found' });

    const schedule = rows[0];
    const [days] = await sequelize.query(
      'SELECT day_of_week FROM schedule_days WHERE schedule_id = $1 ORDER BY day_of_week',
      { bind: [schedule.id] }
    );
    schedule.days = days.map(d => d.day_of_week);

    const [sessions] = await sequelize.query(
      'SELECT * FROM sessions WHERE schedule_id = $1 ORDER BY scheduled_start ASC',
      { bind: [schedule.id] }
    );
    schedule.sessions = sessions;

    const [conflicts] = await sequelize.query(
      'SELECT * FROM conflicts WHERE schedule_id = $1 ORDER BY conflict_date ASC',
      { bind: [schedule.id] }
    );
    schedule.conflicts = conflicts;

    res.json(schedule);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── POST /api/schedules ───────────────────────────────────────────────────────
exports.create = async (req, res) => {
  const { teacher_id, student_id, start_time, end_time, date_from, date_until, days } = req.body;

  if (!teacher_id || !student_id || !start_time || !end_time || !date_from || !date_until || !days?.length) {
    return res.status(400).json({ message: 'teacher_id, student_id, start_time, end_time, date_from, date_until, days[] are all required' });
  }
  if (new Date(date_from) > new Date(date_until)) {
    return res.status(400).json({ message: 'date_from must be before date_until' });
  }
  if (start_time >= end_time) {
    return res.status(400).json({ message: 'start_time must be before end_time' });
  }

  try {
    // Resolve teacher/student names to auto-generate title
    const [[teacher], [student]] = await Promise.all([
      sequelize.query('SELECT username FROM users WHERE id = $1', { bind: [teacher_id] }),
      sequelize.query('SELECT username FROM users WHERE id = $1', { bind: [student_id] }),
    ]);
    const title = `${teacher[0]?.username} & ${student[0]?.username}`;

    // 1. Insert schedule
    const scheduleId = uuidv4();
    await sequelize.query(
      `INSERT INTO schedules (id, teacher_id, student_id, title, start_time, end_time, date_from, date_until, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())`,
      { bind: [scheduleId, teacher_id, student_id, title, start_time, end_time, date_from, date_until, req.user.id] }
    );

    // 2. Insert schedule_days
    for (const dow of days) {
      await sequelize.query(
        'INSERT INTO schedule_days (id, schedule_id, day_of_week) VALUES ($1,$2,$3)',
        { bind: [uuidv4(), scheduleId, Number(dow)] }
      );
    }

    // 3. Generate candidates
    const schedule   = { id: scheduleId, teacher_id, student_id, title, start_time, end_time, date_from, date_until };
    const candidates = generateCandidates(schedule, days.map(Number));

    let sessionsCreated = 0;
    let conflictsFound  = 0;
    const conflictList  = [];

    // 4. For each candidate: conflict check then insert
    for (const c of candidates) {
      const conflict = await findConflict(teacher_id, student_id, c.scheduled_start, c.scheduled_end);

      if (conflict) {
        // Log conflict
        const conflictId = uuidv4();
        const reason = conflict.teacher_id === teacher_id
          ? `Teacher already has session "${conflict.title}"`
          : `Student already has session "${conflict.title}"`;

        await sequelize.query(
          `INSERT INTO conflicts (id, schedule_id, conflicting_session_id, blocked_teacher_id, blocked_student_id,
            conflict_date, conflict_start, conflict_end, reason, notified_admin, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,NOW())`,
          { bind: [conflictId, scheduleId, conflict.id, teacher_id, student_id, c.session_date, start_time, end_time, reason] }
        );

        conflictsFound++;
        conflictList.push({ date: c.session_date, reason });

        // Notify admins
        await notifyAdmins({ conflict_date: c.session_date, reason }, schedule);

      } else {
        // Insert session
        const sessionId = uuidv4();
        const roomName  = 'room-' + sessionId.replace(/-/g, '').slice(0, 10);

        await sequelize.query(
          `INSERT INTO sessions
             (id, schedule_id, title, teacher_id, student_id,
              scheduled_start, scheduled_end, status, room_name, created_by, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled',$8,$9,NOW(),NOW())`,
          { bind: [sessionId, scheduleId, title, teacher_id, student_id,
                   c.scheduled_start, c.scheduled_end, roomName, req.user.id] }
        );
        sessionsCreated++;
      }
    }

    res.status(201).json({
      message: `Schedule created. ${sessionsCreated} sessions generated, ${conflictsFound} conflicts skipped.`,
      schedule_id    : scheduleId,
      sessions_created: sessionsCreated,
      conflicts_found : conflictsFound,
      conflicts       : conflictList
    });
  } catch (e) {
    console.error('[create schedule]', e.message);
    res.status(500).json({ message: e.message });
  }
};

// ── DELETE /api/schedules/:id ─────────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    // Cancel all future sessions linked to this schedule
    await sequelize.query(
      `UPDATE sessions SET status = 'cancelled', updated_at = NOW()
       WHERE schedule_id = $1 AND status = 'scheduled' AND scheduled_start > NOW()`,
      { bind: [req.params.id] }
    );
    // Deactivate schedule
    await sequelize.query(
      'UPDATE schedules SET is_active = false, updated_at = NOW() WHERE id = $1',
      { bind: [req.params.id] }
    );
    res.json({ message: 'Schedule deactivated and future sessions cancelled' });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// ── GET /api/schedules/:id/conflicts ─────────────────────────────────────────
exports.getConflicts = async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      'SELECT * FROM conflicts WHERE schedule_id = $1 ORDER BY conflict_date ASC',
      { bind: [req.params.id] }
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};
