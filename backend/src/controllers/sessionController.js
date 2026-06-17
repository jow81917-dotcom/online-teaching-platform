// backend/src/controllers/sessionController.js
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');
const https = require('https');
const http  = require('http');

const CLASSROOM_URL       = process.env.CLASSROOM_URL || 'http://localhost:3000';
const JOIN_WINDOW_MINUTES = 15;

// ── GET /api/sessions/admin/stats ────────────────────────────────────────
exports.getAdminStats = async (req, res) => {
  try {
    const [rows] = await sequelize.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'scheduled')                          AS scheduled,
        COUNT(*) FILTER (WHERE status = 'active')                             AS active,
        COUNT(*) FILTER (WHERE status = 'completed')                          AS completed,
        COUNT(*) FILTER (WHERE status = 'cancelled')                          AS cancelled,
        COUNT(*) FILTER (WHERE DATE(scheduled_start) = CURRENT_DATE)          AS today_total,
        COUNT(*) FILTER (WHERE status = 'active'
                           AND DATE(scheduled_start) = CURRENT_DATE)          AS today_active,
        COUNT(*) FILTER (WHERE scheduled_start >= NOW()
                           AND scheduled_start <= NOW() + INTERVAL '7 days'
                           AND status = 'scheduled')                          AS upcoming_7d,
        COUNT(DISTINCT teacher_id) FILTER (WHERE status = 'active')           AS teachers_teaching,
        COUNT(DISTINCT student_id) FILTER (WHERE status = 'active')           AS students_in_class,
        COUNT(*) FILTER (WHERE DATE(scheduled_start) = CURRENT_DATE - 1)      AS yesterday_total
      FROM sessions
    `);
    res.json(rows[0]);
  } catch (e) {
    console.error('[getAdminStats]', e.message);
    res.status(500).json({ message: e.message }); }
};

// ── GET /api/sessions/admin/calendar ─────────────────────────────────────
exports.getAdminCalendar = async (req, res) => {
  const { year, month } = req.query; // month = 1-12
  const y = parseInt(year)  || new Date().getFullYear();
  const m = parseInt(month) || new Date().getMonth() + 1;
  const from  = `${y}-${String(m).padStart(2,'0')}-01`;
  const until = `${m === 12 ? y+1 : y}-${String(m === 12 ? 1 : m+1).padStart(2,'0')}-01`;
  try {
    const [rows] = await sequelize.query(`
      SELECT
        DATE(scheduled_start)                                         AS day,
        COUNT(*)                                                      AS total,
        COUNT(*) FILTER (WHERE status = 'active')                    AS active,
        COUNT(*) FILTER (WHERE status = 'cancelled')                 AS cancelled,
        COUNT(*) FILTER (WHERE status = 'scheduled')                 AS scheduled,
        COUNT(*) FILTER (WHERE status = 'completed')                 AS completed,
        COUNT(*) FILTER (WHERE status IN ('scheduled','active')
                           AND scheduled_start
                             < $2::date AND scheduled_end > $1::date) AS conflicts
      FROM sessions
      WHERE scheduled_start >= $1::timestamp
        AND scheduled_start <  $2::timestamp
      GROUP BY DATE(scheduled_start)
      ORDER BY day
    `, { bind: [from, until] });
    res.json(rows);
  } catch (e) {
    console.error('[getAdminCalendar]', e.message);
    res.status(500).json({ message: e.message }); }
};

// ── GET /api/sessions/admin/day/:date ─────────────────────────────────────
exports.getAdminDaySessions = async (req, res) => {
  const { date } = req.params;
  try {
    const [rows] = await sequelize.query(`
      SELECT
        s.*,
        ut.username AS teacher_name,
        us.username AS student_name
      FROM sessions s
      JOIN users ut ON ut.id = s.teacher_id
      JOIN users us ON us.id = s.student_id
      WHERE DATE(s.scheduled_start AT TIME ZONE 'UTC') = $1::date
      ORDER BY s.scheduled_start ASC
    `, { bind: [date] });
    res.json(rows);
  } catch (e) {
    console.error('[getAdminDaySessions]', e.message);
    res.status(500).json({ message: e.message });
  }
};


exports.getLiveSession = async (req, res) => {
  const { role, id } = req.user;
  try {
    const col = role === 'teacher' ? 'teacher_id' : 'student_id';

    // A session is joinable when:
    //   - it belongs to this user
    //   - status is active OR scheduled (cron may not have flipped yet)
    //   - scheduled_start is within the join window (start - 15min <= now)
    //   - scheduled_end has not passed yet
    // Use literal interval to avoid PostgreSQL parameterized INTERVAL cast issues
    const [rows] = await sequelize.query(
      `SELECT * FROM sessions
       WHERE ${col} = $1
         AND status IN ('active', 'scheduled')
         AND scheduled_start <= NOW() + INTERVAL '${JOIN_WINDOW_MINUTES} minutes'
         AND scheduled_end > NOW()
       ORDER BY scheduled_start ASC
       LIMIT 1`,
      { bind: [id] }
    );

    if (rows.length) {
      return res.json({ session: rows[0], next: null });
    }

    // No joinable session — next truly future session (start AND end both in future)
    const [next] = await sequelize.query(
      `SELECT * FROM sessions
       WHERE ${col} = $1
         AND status = 'scheduled'
         AND scheduled_start > NOW() + INTERVAL '${JOIN_WINDOW_MINUTES} minutes'
         AND scheduled_end > NOW()
       ORDER BY scheduled_start ASC
       LIMIT 1`,
      { bind: [id] }
    );
    return res.json({ session: null, next: next[0] || null });
  } catch (e) {
    console.error('[getLiveSession] error:', e.message);
    res.status(500).json({ message: e.message });
  }
};

// ── /api/sessions/classroom/join/:sessionId ───────────────────────────────
exports.getClassroomJoin = async (req, res) => {
  const { role, id } = req.user;
  try {
    const [rows] = await sequelize.query(
      'SELECT * FROM sessions WHERE id = $1',
      { bind: [req.params.sessionId] }
    );
    if (!rows.length) return res.status(404).json({ message: 'Session not found' });
    const session = rows[0];

    const isTeacher = role === 'teacher' && session.teacher_id === id;
    const isStudent = role === 'student' && session.student_id === id;
    const isObserver = ['admin', 'manager', 'supervisor'].includes(role);

    console.log(`[join] user id=${id} role=${role} teacher_id=${session.teacher_id} student_id=${session.student_id} isTeacher=${isTeacher} isStudent=${isStudent}`);

    if (!isTeacher && !isStudent && !isObserver) {
      return res.status(403).json({ message: 'You are not assigned to this session' });
    }

    if (!isObserver) {
      const [timeCheck] = await sequelize.query(
        `SELECT
           scheduled_end > NOW() AS not_ended,
           status
         FROM sessions WHERE id = $1`,
        { bind: [req.params.sessionId] }
      );
      const tc = timeCheck[0];
      const notEnded = tc.not_ended === true || tc.not_ended === 't';

      if (tc.status === 'cancelled') {
        return res.status(403).json({ message: 'This session has been cancelled' });
      }
      if (!notEnded) {
        return res.status(403).json({ message: 'This session has already ended' });
      }
    }

    const room = session.room_name || session.id;
    const page = role === 'teacher'
      ? 'teacher.html'
      : isObserver
        ? 'moderator.html'
        : 'student.html';

    // Fetch username from DB since JWT doesn't include it
    const [userRows] = await sequelize.query(
      'SELECT username FROM users WHERE id = $1',
      { bind: [id] }
    );
    const username = userRows[0]?.username || role;
    const name = encodeURIComponent(username);
    const url  = `${CLASSROOM_URL}/${page}?room=${encodeURIComponent(room)}&name=${name}&role=${encodeURIComponent(role)}`;

    // Register end time with audio-relay server for auto-termination
    try {
      const classroomBase = CLASSROOM_URL.replace(/\/$/, '');
      const postData  = JSON.stringify({ roomId: room, scheduledEnd: session.scheduled_end });
      const parsedUrl = new URL(`${classroomBase}/api/room-schedule`);
      const lib       = parsedUrl.protocol === 'https:' ? https : http;
      const schedReq  = lib.request({
        hostname: parsedUrl.hostname,
        port:     parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path:     parsedUrl.pathname,
        method:   'POST',
        headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
      });
      schedReq.on('error', () => {});
      schedReq.write(postData);
      schedReq.end();
    } catch (_) {}

    res.json({ url, room, session });
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── /api/sessions ─────────────────────────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { role, id } = req.user;
    let query = 'SELECT * FROM sessions';
    let bind  = [];
    if (role === 'teacher')      { query += ' WHERE teacher_id = $1 ORDER BY scheduled_start DESC'; bind = [id]; }
    else if (role === 'student') { query += ' WHERE student_id = $1 ORDER BY scheduled_start DESC'; bind = [id]; }
    else                         { query += ' ORDER BY scheduled_start DESC'; }
    const [rows] = await sequelize.query(query, { bind });
    res.json(rows);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── /api/sessions/:id ─────────────────────────────────────────────────────
exports.getOne = async (req, res) => {
  try {
    const [rows] = await sequelize.query(
      'SELECT * FROM sessions WHERE id = $1',
      { bind: [req.params.id] }
    );
    if (!rows.length) return res.status(404).json({ message: 'Not found' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── POST /api/sessions ────────────────────────────────────────────────────
exports.create = async (req, res) => {
  const { title, description, subject, teacher_id, student_id, scheduled_start, scheduled_end } = req.body;

  if (!title || !teacher_id || !student_id || !scheduled_start || !scheduled_end) {
    return res.status(400).json({ message: 'title, teacher_id, student_id, scheduled_start and scheduled_end are required' });
  }

  const start = new Date(scheduled_start);
  const end   = new Date(scheduled_end);

  if (isNaN(start) || isNaN(end))      return res.status(400).json({ message: 'Invalid date format' });
  if (start >= end)                     return res.status(400).json({ message: 'scheduled_end must be after scheduled_start' });
  if (start < new Date(Date.now() - 60000)) return res.status(400).json({ message: 'Cannot schedule a session in the past' });
  if ((end - start) < 15 * 60 * 1000)  return res.status(400).json({ message: 'Session must be at least 15 minutes long' });

  try {
    const [teacherConflicts] = await sequelize.query(
      `SELECT id, title, scheduled_start, scheduled_end FROM sessions
       WHERE teacher_id = $1 AND status NOT IN ('cancelled','completed')
         AND scheduled_start < $3 AND scheduled_end > $2`,
      { bind: [teacher_id, scheduled_start, scheduled_end] }
    );
    if (teacherConflicts.length) {
      const c = teacherConflicts[0];
      return res.status(409).json({ message: `Teacher has a conflicting session: "${c.title}" (${new Date(c.scheduled_start).toLocaleString()} – ${new Date(c.scheduled_end).toLocaleString()})` });
    }

    const [studentConflicts] = await sequelize.query(
      `SELECT id, title, scheduled_start, scheduled_end FROM sessions
       WHERE student_id = $1 AND status NOT IN ('cancelled','completed')
         AND scheduled_start < $3 AND scheduled_end > $2`,
      { bind: [student_id, scheduled_start, scheduled_end] }
    );
    if (studentConflicts.length) {
      const c = studentConflicts[0];
      return res.status(409).json({ message: `Student has a conflicting session: "${c.title}" (${new Date(c.scheduled_start).toLocaleString()} – ${new Date(c.scheduled_end).toLocaleString()})` });
    }

    const id        = uuidv4();
    const room_name = 'room-' + id.replace(/-/g, '').slice(0, 10);

    await sequelize.query(
      `INSERT INTO sessions (id,title,description,subject,teacher_id,student_id,scheduled_start,scheduled_end,created_by,room_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      { bind: [id, title, description||null, subject||null, teacher_id, student_id, scheduled_start, scheduled_end, req.user.id, room_name] }
    );

    const [rows] = await sequelize.query('SELECT * FROM sessions WHERE id = $1', { bind: [id] });
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ message: e.message }); }
};

// ── PUT /api/sessions/:id ─────────────────────────────────────────────────
exports.update = async (req, res) => {
  const { status, actual_start_time, actual_end_time, scheduled_start, scheduled_end, title, subject } = req.body;
  try {
    if (scheduled_start && scheduled_end) {
      const s = new Date(scheduled_start), e = new Date(scheduled_end);
      if (s >= e) return res.status(400).json({ message: 'scheduled_end must be after scheduled_start' });
    }
    await sequelize.query(
      `UPDATE sessions SET
         status            = COALESCE($1, status),
         actual_start_time = COALESCE($2, actual_start_time),
         actual_end_time   = COALESCE($3, actual_end_time),
         scheduled_start   = COALESCE($4, scheduled_start),
         scheduled_end     = COALESCE($5, scheduled_end),
         title             = COALESCE($6, title),
         subject           = COALESCE($7, subject),
         updated_at        = NOW()
       WHERE id = $8`,
      { bind: [status||null, actual_start_time||null, actual_end_time||null, scheduled_start||null, scheduled_end||null, title||null, subject||null, req.params.id] }
    );
    const [rows] = await sequelize.query('SELECT * FROM sessions WHERE id = $1', { bind: [req.params.id] });
    res.json(rows[0] || { message: 'Updated' });
  } catch (e) { res.status(500).json({ message: e.message }); }
};
