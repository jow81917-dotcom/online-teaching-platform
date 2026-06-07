// backend/src/services/sessionGenerator.js
// Pure function: takes a schedule + its days, returns array of session objects ready to insert.
// Conflict checking is done in the controller so we keep this pure.

/**
 * Generate session date candidates from a schedule rule.
 *
 * @param {object} schedule - { id, teacher_id, student_id, title, subject, start_time, end_time, date_from, date_until }
 * @param {number[]} days   - array of day_of_week values [0..6] (0=Sun, 1=Mon, ...)
 * @returns {Array} array of candidate objects { session_date, start_time, end_time, ... }
 */
const generateCandidates = (schedule, days) => {
  const candidates = [];
  const daySet     = new Set(days);

  const current = new Date(schedule.date_from);
  current.setHours(0, 0, 0, 0);

  const until = new Date(schedule.date_until);
  until.setHours(23, 59, 59, 999);

  while (current <= until) {
    const dow = current.getDay(); // 0=Sun … 6=Sat
    if (daySet.has(dow)) {
      // Build ISO date string YYYY-MM-DD
      const y  = current.getFullYear();
      const m  = String(current.getMonth() + 1).padStart(2, '0');
      const d  = String(current.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      candidates.push({
        schedule_id : schedule.id,
        teacher_id  : schedule.teacher_id,
        student_id  : schedule.student_id,
        title       : schedule.title,
        subject     : schedule.subject || null,
        session_date: dateStr,
        start_time  : schedule.start_time,   // "HH:MM:SS"
        end_time    : schedule.end_time,
        // Combined timestamps for DB insertion
        scheduled_start: `${dateStr}T${schedule.start_time}`,
        scheduled_end  : `${dateStr}T${schedule.end_time}`,
      });
    }
    current.setDate(current.getDate() + 1);
  }

  return candidates;
};

module.exports = { generateCandidates };
