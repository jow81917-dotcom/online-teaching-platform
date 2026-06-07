// frontend/src/components/admin/ScheduleManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import SessionViewer from './SessionViewer';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const EMPTY_FORM = {
  teacher_id : '',
  student_id : '',
  start_time : '10:00',
  end_time   : '11:00',
  date_from  : '',
  date_until : '',
  days       : [],   // array of numbers 0-6
};

// ── tiny reusable styled components ──────────────────────────────────────────
const inp = {
  width: '100%', padding: '0.5rem 0.75rem',
  border: '1px solid #d1d5db', borderRadius: '0.4rem',
  fontSize: '0.875rem', boxSizing: 'border-box',
};
const lbl = { display: 'block', marginBottom: '0.3rem', fontWeight: 600, fontSize: '0.8rem', color: '#374151' };


// ── Main Component ────────────────────────────────────────────────────────────
const ScheduleManager = () => {
  const [view,       setView]       = useState('schedules'); // 'schedules' | 'sessions'
  const [schedules,  setSchedules]  = useState([]);
  const [teachers,   setTeachers]   = useState([]);
  const [students,   setStudents]   = useState([]);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [showForm,   setShowForm]   = useState(false);
  const [formErr,    setFormErr]    = useState('');
  const [saving,     setSaving]     = useState(false);
  const [result,     setResult]     = useState(null); // last create result

  // ── loaders ─────────────────────────────────────────────────────────────────
  const loadSchedules = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/schedules');
      setSchedules(data);
    } catch { toast.error('Failed to load schedules'); }
  }, []);

  const loadUsers = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/users');
      setTeachers(data.filter(u => u.role === 'teacher'));
      setStudents(data.filter(u => u.role === 'student'));
    } catch {}
  }, []);

  useEffect(() => {
    loadSchedules();
    loadUsers();
  }, [loadSchedules, loadUsers]);

  useEffect(() => {
    const t = setInterval(() => { loadSchedules(); }, 30000);
    return () => clearInterval(t);
  }, [loadSchedules]);

  // ── form helpers ─────────────────────────────────────────────────────────────
  const toggleDay = (d) => {
    setForm(f => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d]
    }));
  };

  const validate = () => {
    if (!form.teacher_id)           return 'Select a teacher';
    if (!form.student_id)           return 'Select a student';
    if (!form.start_time)           return 'Start time is required';
    if (!form.end_time)             return 'End time is required';
    if (form.start_time >= form.end_time) return 'End time must be after start time';
    if (!form.date_from)            return 'From date is required';
    if (!form.date_until)           return 'Until date is required';
    if (form.date_from > form.date_until) return 'Date "until" must be after "from"';
    if (!form.days.length)          return 'Select at least one day of the week';
    return null;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setFormErr(err); return; }
    setFormErr('');
    setSaving(true);
    setResult(null);
    try {
      const { data } = await axios.post('/api/schedules', {
        teacher_id : form.teacher_id,
        student_id : form.student_id,
        start_time : form.start_time + ':00',
        end_time   : form.end_time   + ':00',
        date_from  : form.date_from,
        date_until : form.date_until,
        days       : form.days,
      });
      setResult(data);
      toast.success(data.message);
      setShowForm(false);
      setForm(EMPTY_FORM);
      loadSchedules();
    } catch (err) {
      setFormErr(err.response?.data?.message || 'Error creating schedule');
    } finally {
      setSaving(false);
    }
  };

  const deleteSchedule = async (id) => {
    if (!window.confirm('Deactivate this schedule and cancel its future sessions?')) return;
    try {
      await axios.delete(`/api/schedules/${id}`);
      toast.success('Schedule deactivated');
      loadSchedules();
    } catch { toast.error('Error'); }
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {['schedules', 'sessions'].map(tab => (
          <button key={tab} onClick={() => setView(tab)}
            style={{
              padding: '6px 20px', borderRadius: '9999px', cursor: 'pointer',
              border: '1px solid #d1d5db', fontWeight: 600, fontSize: '0.85rem',
              background: view === tab ? '#1d4ed8' : '#fff',
              color: view === tab ? '#fff' : '#374151',
              textTransform: 'capitalize'
            }}>
            {tab === 'schedules' ? `📅 Schedules (${schedules.length})` : `📋 Sessions`}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          SCHEDULES VIEW
      ════════════════════════════════════════════ */}
      {view === 'schedules' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Recurring Schedules</h2>
            <button onClick={() => { setShowForm(true); setFormErr(''); setResult(null); }}
              style={{ padding: '7px 18px', background: '#1d4ed8', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>
              + New Schedule
            </button>
          </div>

          {/* Result banner after create */}
          {result && (
            <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '8px',
              background: result.conflicts_found > 0 ? '#fffbeb' : '#f0fdf4',
              border: `1px solid ${result.conflicts_found > 0 ? '#fcd34d' : '#86efac'}` }}>
              <p style={{ fontWeight: 700, marginBottom: '0.4rem' }}>✅ {result.message}</p>
              {result.conflicts?.length > 0 && (
                <details>
                  <summary style={{ cursor: 'pointer', color: '#b45309', fontSize: '0.85rem' }}>
                    ⚠️ {result.conflicts_found} conflict(s) — click to see dates
                  </summary>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', fontSize: '0.82rem' }}>
                    {result.conflicts.map((c, i) => (
                      <li key={i}><strong>{c.date}</strong> — {c.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}

          {/* ── Create Form ── */}
          {showForm && (
            <div className="card p-6 mb-6">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Create New Schedule</h3>
                <button onClick={() => setShowForm(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: '#6b7280' }}>✕</button>
              </div>

              {formErr && (
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px',
                  padding: '0.65rem 1rem', marginBottom: '1rem', color: '#b91c1c', fontSize: '0.85rem' }}>
                  ⚠️ {formErr}
                </div>
              )}

              <form onSubmit={handleCreate}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>

                  {/* Teacher */}
                  <div>
                    <label style={lbl}>Teacher *</label>
                    <select style={inp} required value={form.teacher_id}
                      onChange={e => setForm({ ...form, teacher_id: e.target.value })}>
                      <option value="">Select teacher</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.username}</option>)}
                    </select>
                  </div>
                  {/* Student */}
                  <div>
                    <label style={lbl}>Student *</label>
                    <select style={inp} required value={form.student_id}
                      onChange={e => setForm({ ...form, student_id: e.target.value })}>
                      <option value="">Select student</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.username}</option>)}
                    </select>
                  </div>

                  {/* Times */}
                  <div>
                    <label style={lbl}>Class Start Time *</label>
                    <input style={inp} type="time" required value={form.start_time}
                      onChange={e => setForm({ ...form, start_time: e.target.value })} />
                  </div>
                  <div>
                    <label style={lbl}>Class End Time *</label>
                    <input style={inp} type="time" required value={form.end_time}
                      onChange={e => setForm({ ...form, end_time: e.target.value })} />
                  </div>

                  {/* Date range */}
                  <div>
                    <label style={lbl}>Date From *</label>
                    <input style={inp} type="date" required value={form.date_from}
                      onChange={e => setForm({ ...form, date_from: e.target.value })} />
                  </div>
                  <div>
                    <label style={lbl}>Date Until *</label>
                    <input style={inp} type="date" required value={form.date_until}
                      onChange={e => setForm({ ...form, date_until: e.target.value })} />
                  </div>

                  {/* Days of week */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={lbl}>Repeat on Days *</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {DAY_LABELS.map((label, i) => (
                        <button key={i} type="button" onClick={() => toggleDay(i)}
                          style={{
                            padding: '5px 14px', borderRadius: '9999px', cursor: 'pointer',
                            border: '1px solid #d1d5db', fontSize: '0.82rem', fontWeight: 600,
                            background: form.days.includes(i) ? '#1d4ed8' : '#fff',
                            color: form.days.includes(i) ? '#fff' : '#374151',
                            transition: 'all 0.15s'
                          }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {form.days.length > 0 && (
                      <p style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#6b7280' }}>
                        Selected: {form.days.sort().map(d => DAY_LABELS[d]).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem' }}>
                  <button type="submit" disabled={saving}
                    style={{ padding: '8px 22px', background: '#1d4ed8', color: '#fff', border: 'none',
                      borderRadius: '6px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: '0.9rem' }}>
                    {saving ? 'Generating sessions…' : '✓ Create Schedule & Generate Sessions'}
                  </button>
                  <button type="button" onClick={() => setShowForm(false)}
                    style={{ padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', background: '#fff' }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ── Schedules List ── */}
          {schedules.length === 0 ? (
            <div className="card p-6" style={{ textAlign: 'center', color: '#9ca3af' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</p>
              <p>No schedules yet. Click "+ New Schedule" to create one.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {schedules.map(sched => (
                <div key={sched.id} className="card p-5">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.25rem' }}>
                        {sched.title}
                        {sched.subject && <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: '#6b7280', fontWeight: 400 }}>({sched.subject})</span>}
                        {!sched.is_active && <span style={{ marginLeft: '0.5rem', fontSize: '0.72rem', color: '#dc2626', background: '#fef2f2', padding: '2px 8px', borderRadius: '9999px' }}>Inactive</span>}
                      </h3>
                      <p style={{ fontSize: '0.82rem', color: '#6b7280', marginBottom: '0.3rem' }}>
                        👤 Teacher: <strong>{sched.teacher_name}</strong> &nbsp;|&nbsp;
                        🎓 Student: <strong>{sched.student_name}</strong>
                      </p>
                      <p style={{ fontSize: '0.82rem', color: '#374151' }}>
                        🕐 {sched.start_time?.slice(0,5)} – {sched.end_time?.slice(0,5)} &nbsp;|&nbsp;
                        📆 {sched.date_from} → {sched.date_until}
                      </p>
                      <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                        {(sched.days || []).sort().map(d => (
                          <span key={d} style={{ fontSize: '0.72rem', background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '9999px', fontWeight: 600 }}>
                            {DAY_LABELS[d]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.82rem' }}>
                        <span style={{ color: '#16a34a', fontWeight: 600 }}>✅ {sched.sessions_count} sessions</span>
                        {Number(sched.conflicts_count) > 0 && (
                          <span style={{ color: '#d97706', fontWeight: 600 }}>⚠️ {sched.conflicts_count} conflicts</span>
                        )}
                      </div>
                      {sched.is_active && (
                        <button onClick={() => deleteSchedule(sched.id)}
                          style={{ padding: '4px 12px', border: '1px solid #fca5a5', color: '#dc2626',
                            borderRadius: '6px', cursor: 'pointer', background: '#fff', fontSize: '0.78rem' }}>
                          🗑 Deactivate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'sessions' && <SessionViewer />}
    </div>
  );
};

export default ScheduleManager;
