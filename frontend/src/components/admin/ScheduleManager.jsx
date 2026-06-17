import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import SessionViewer from './SessionViewer';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const EMPTY_FORM = {
  teacher_id : '',
  student_id : '',
  start_time : '10:00',
  end_time   : '11:00',
  date_from  : '',
  date_until : '',
  days       : [],
};

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  purple: '#a855f7', purpleLight: '#c084fc', purpleBg: 'rgba(168, 85, 247, 0.08)',
  pink: '#f472b6', pinkLight: '#fbcfe8', pinkBg: 'rgba(244, 114, 182, 0.08)',
  blue: '#8b5cf6', blueLight: '#a78bfa', blueBg: 'rgba(139, 92, 246, 0.08)',
  green: '#10b981', greenLight: '#34d399', greenBg: 'rgba(16, 185, 129, 0.08)',
  red: '#ef4444', redLight: '#f87171', redBg: 'rgba(239, 68, 68, 0.08)',
  amber: '#f59e0b', amberLight: '#fbbf24', amberBg: 'rgba(245, 158, 11, 0.08)',
  gray: '#8b8b9a', grayLight: '#e5e7eb', grayBg: 'rgba(255, 255, 255, 0.4)',
  text: '#2d2d3a', sub: '#8b8b9a', light: 'rgba(255, 255, 255, 0.55)',
  border: 'rgba(233, 213, 255, 0.5)',
};

const CSS = `
  @keyframes sm-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sm-slide  { from{transform:translateX(105%)} to{transform:translateX(0)} }
  .sm-row:hover  { background:rgba(192, 132, 252, 0.06) !important; cursor:pointer; }
  .sm-card:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(168, 85, 247, 0.12)!important; }
  .sm-btn:hover  { filter:brightness(.92); }
  .sm-inp:focus  { outline:none; border-color:${C.purpleLight}; box-shadow:0 0 0 3px ${C.purpleBg}; }
`;

const Btn = ({ color = C.purple, outline, small, disabled, onClick, children, style = {} }) => (
  <button className="sm-btn" onClick={onClick} disabled={disabled} style={{
    padding: small ? '6px 14px' : '8px 18px',
    fontSize: small ? '.75rem' : '.85rem',
    fontWeight: 600, borderRadius: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: `1.5px solid ${color}`,
    background: outline ? 'rgba(255, 255, 255, 0.5)' : `linear-gradient(135deg, ${C.purpleLight}, ${color})`,
    color: outline ? color : '#fff',
    opacity: disabled ? .55 : 1,
    transition: 'all .2s',
    boxShadow: outline ? 'none' : `0 4px 15px ${color}40`,
    ...style,
  }}>{children}</button>
);

const Tag = ({ color, bg, children }) => (
  <span style={{
    display:'inline-flex', alignItems:'center', padding:'3px 12px',
    borderRadius: 9999, fontSize:'.72rem', fontWeight: 600,
    color, background: bg, border:`1px solid ${color}28`,
  }}>{children}</span>
);

// ── Glass Card ────────────────────────────────────────────────────────────────
const GlassCard = ({ children, style = {} }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: 24,
    padding: '28px',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    boxShadow: '0 8px 32px rgba(155, 89, 182, 0.06)',
    ...style,
  }}>{children}</div>
);

// ── Month Calendar for Schedule ───────────────────────────────────────────────
const ScheduleCalendar = ({ dateFrom, dateUntil, days, color = C.purple }) => {
  if (!dateFrom || !dateUntil) return null;
  const from = new Date(dateFrom);
  const until = new Date(dateUntil);
  const months = [];
  let cur = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cur <= until) {
    months.push(new Date(cur));
    cur.setMonth(cur.getMonth() + 1);
  }

  const isInRange = (d) => d >= from && d <= until;
  const isSelectedDay = (d) => days.includes(d.getDay());

  return (
    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '12px' }}>
      {months.map((m, mi) => {
        const year = m.getFullYear();
        const month = m.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startOffset = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        const cells = [];
        for (let i = 0; i < startOffset; i++) cells.push(null);
        for (let d = 1; d <= daysInMonth; d++) cells.push(d);

        return (
          <div key={mi} style={{
            background: 'rgba(255, 255, 255, 0.4)',
            borderRadius: 16,
            padding: '14px 18px',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            minWidth: 200,
            flex: '1 1 200px',
          }}>
            <div style={{ fontWeight: 700, fontSize: '.85rem', color: C.text, textAlign: 'center', marginBottom: 10 }}>
              {MONTH_NAMES[month]} {year}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
              {DAY_LABELS.map(d => (
                <div key={d} style={{ fontSize: '.65rem', fontWeight: 600, color: C.sub, padding: '4px 0' }}>{d}</div>
              ))}
              {cells.map((day, i) => {
                if (!day) return <div key={i} style={{ padding: '6px 0' }} />;
                const dateObj = new Date(year, month, day);
                const inRange = isInRange(dateObj);
                const selected = inRange && isSelectedDay(dateObj);
                return (
                  <div key={i} style={{
                    padding: '6px 0',
                    borderRadius: 8,
                    fontSize: '.75rem',
                    fontWeight: selected ? 700 : 500,
                    color: selected ? '#fff' : inRange ? C.text : C.sub,
                    background: selected ? `linear-gradient(135deg, ${C.purpleLight}, ${color})` : 'transparent',
                    boxShadow: selected ? `0 2px 8px ${color}40` : 'none',
                    transition: 'all .15s',
                  }}>{day}</div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const ScheduleManager = () => {
  const [view,       setView]       = useState('schedules');
  const [schedules,  setSchedules]  = useState([]);
  const [teachers,   setTeachers]   = useState([]);
  const [students,   setStudents]   = useState([]);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [showForm,   setShowForm]   = useState(false);
  const [formErr,    setFormErr]    = useState('');
  const [saving,     setSaving]     = useState(false);
  const [result,     setResult]     = useState(null);
  const [expandedId, setExpandedId] = useState(null);

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
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: C.text,
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 50%, #fbcfe8 100%)',
      padding: '32px',
    }}>
      <style>{CSS}</style>

      {/* ── Tab bar ── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {['schedules', 'sessions'].map(tab => (
          <button key={tab} onClick={() => setView(tab)}
            style={{
              padding: '8px 22px', borderRadius: 14, cursor: 'pointer',
              border: '1px solid rgba(139, 92, 246, 0.2)', fontWeight: 600, fontSize: '0.85rem',
              background: view === tab ? 'linear-gradient(135deg, #c084fc, #a855f7)' : 'rgba(255, 255, 255, 0.5)',
              color: view === tab ? '#fff' : '#6b7280',
              textTransform: 'capitalize',
              boxShadow: view === tab ? '0 4px 15px rgba(168, 85, 247, 0.3)' : 'none',
              transition: 'all 0.2s',
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: C.text, letterSpacing: '-0.3px' }}>Recurring Schedules</h2>
            <Btn onClick={() => { setShowForm(true); setFormErr(''); setResult(null); }}>
              + New Schedule
            </Btn>
          </div>

          {/* Result banner after create */}
          {result && (
            <GlassCard style={{ marginBottom: '1.5rem', padding: '1.25rem', animation: 'sm-fadein .3s ease' }}>
              <p style={{ fontWeight: 700, marginBottom: '0.5rem', color: result.conflicts_found > 0 ? C.amber : C.green, fontSize: '0.95rem' }}>
                ✅ {result.message}
              </p>
              {result.conflicts?.length > 0 && (
                <details>
                  <summary style={{ cursor: 'pointer', color: C.amber, fontSize: '0.85rem', fontWeight: 600 }}>
                    ⚠️ {result.conflicts_found} conflict(s) — click to see dates
                  </summary>
                  <ul style={{ marginTop: '0.5rem', paddingLeft: '1.2rem', fontSize: '0.82rem', color: C.sub }}>
                    {result.conflicts.map((c, i) => (
                      <li key={i}><strong style={{ color: C.text }}>{c.date}</strong> — {c.reason}</li>
                    ))}
                  </ul>
                </details>
              )}
            </GlassCard>
          )}

          {/* ── Create Form ── */}
          {showForm && (
            <GlassCard style={{ marginBottom: '1.5rem', animation: 'sm-fadein .3s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ fontWeight: 700, fontSize: '1.1rem', color: C.text }}>Create New Schedule</h3>
                <button onClick={() => setShowForm(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer', color: C.sub }}>✕</button>
              </div>

              {formErr && (
                <div style={{
                  background: C.redBg, border: `1px solid ${C.redLight}60`, borderRadius: 12,
                  padding: '0.85rem 1.25rem', marginBottom: '1.25rem', color: C.red, fontSize: '0.85rem', fontWeight: 600,
                }}>
                  ⚠️ {formErr}
                </div>
              )}

              <form onSubmit={handleCreate}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>

                  {/* Teacher */}
                  <div>
                    <label style={{ display:'block', fontSize:'.8rem', fontWeight:600, color: C.sub, marginBottom:6 }}>Teacher *</label>
                    <select className="sm-inp" style={{
                      width:'100%', padding:'10px 14px', border:`1.5px solid ${C.border}`,
                      borderRadius:12, fontSize:'.9rem', boxSizing:'border-box', background: 'rgba(255, 255, 255, 0.4)',
                    }} required value={form.teacher_id}
                      onChange={e => setForm({ ...form, teacher_id: e.target.value })}>
                      <option value="">Select teacher</option>
                      {teachers.map(t => <option key={t.id} value={t.id}>{t.username}</option>)}
                    </select>
                  </div>
                  {/* Student */}
                  <div>
                    <label style={{ display:'block', fontSize:'.8rem', fontWeight:600, color: C.sub, marginBottom:6 }}>Student *</label>
                    <select className="sm-inp" style={{
                      width:'100%', padding:'10px 14px', border:`1.5px solid ${C.border}`,
                      borderRadius:12, fontSize:'.9rem', boxSizing:'border-box', background: 'rgba(255, 255, 255, 0.4)',
                    }} required value={form.student_id}
                      onChange={e => setForm({ ...form, student_id: e.target.value })}>
                      <option value="">Select student</option>
                      {students.map(s => <option key={s.id} value={s.id}>{s.username}</option>)}
                    </select>
                  </div>

                  {/* Times */}
                  <div>
                    <label style={{ display:'block', fontSize:'.8rem', fontWeight:600, color: C.sub, marginBottom:6 }}>Class Start Time *</label>
                    <input className="sm-inp" style={{
                      width:'100%', padding:'10px 14px', border:`1.5px solid ${C.border}`,
                      borderRadius:12, fontSize:'.9rem', boxSizing:'border-box', background: 'rgba(255, 255, 255, 0.4)',
                    }} type="time" required value={form.start_time}
                      onChange={e => setForm({ ...form, start_time: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'.8rem', fontWeight:600, color: C.sub, marginBottom:6 }}>Class End Time *</label>
                    <input className="sm-inp" style={{
                      width:'100%', padding:'10px 14px', border:`1.5px solid ${C.border}`,
                      borderRadius:12, fontSize:'.9rem', boxSizing:'border-box', background: 'rgba(255, 255, 255, 0.4)',
                    }} type="time" required value={form.end_time}
                      onChange={e => setForm({ ...form, end_time: e.target.value })} />
                  </div>

                  {/* Date range */}
                  <div>
                    <label style={{ display:'block', fontSize:'.8rem', fontWeight:600, color: C.sub, marginBottom:6 }}>Date From *</label>
                    <input className="sm-inp" style={{
                      width:'100%', padding:'10px 14px', border:`1.5px solid ${C.border}`,
                      borderRadius:12, fontSize:'.9rem', boxSizing:'border-box', background: 'rgba(255, 255, 255, 0.4)',
                    }} type="date" required value={form.date_from}
                      onChange={e => setForm({ ...form, date_from: e.target.value })} />
                  </div>
                  <div>
                    <label style={{ display:'block', fontSize:'.8rem', fontWeight:600, color: C.sub, marginBottom:6 }}>Date Until *</label>
                    <input className="sm-inp" style={{
                      width:'100%', padding:'10px 14px', border:`1.5px solid ${C.border}`,
                      borderRadius:12, fontSize:'.9rem', boxSizing:'border-box', background: 'rgba(255, 255, 255, 0.4)',
                    }} type="date" required value={form.date_until}
                      onChange={e => setForm({ ...form, date_until: e.target.value })} />
                  </div>

                  {/* Days of week */}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ display:'block', fontSize:'.8rem', fontWeight:600, color: C.sub, marginBottom:10 }}>Repeat on Days *</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {DAY_LABELS.map((label, i) => (
                        <button key={i} type="button" onClick={() => toggleDay(i)}
                          style={{
                            padding: '8px 18px', borderRadius: 12, cursor: 'pointer',
                            border: '1px solid rgba(139, 92, 246, 0.2)', fontSize: '0.82rem', fontWeight: 600,
                            background: form.days.includes(i) ? 'linear-gradient(135deg, #c084fc, #a855f7)' : 'rgba(255, 255, 255, 0.5)',
                            color: form.days.includes(i) ? '#fff' : '#6b7280',
                            boxShadow: form.days.includes(i) ? '0 4px 12px rgba(168, 85, 247, 0.3)' : 'none',
                            transition: 'all 0.15s',
                          }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {form.days.length > 0 && (
                      <p style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: C.sub }}>
                        Selected: {form.days.sort().map(d => DAY_LABELS[d]).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                  <Btn disabled={saving}>
                    {saving ? 'Generating sessions…' : '✓ Create Schedule & Generate Sessions'}
                  </Btn>
                  <Btn outline color={C.gray} onClick={() => setShowForm(false)}>Cancel</Btn>
                </div>
              </form>
            </GlassCard>
          )}

          {/* ── Schedules Table ── */}
          {schedules.length === 0 ? (
            <GlassCard style={{ textAlign: 'center', color: C.sub, padding: '3rem' }}>
              <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📅</p>
              <p style={{ fontSize: '0.95rem' }}>No schedules yet. Click "+ New Schedule" to create one.</p>
            </GlassCard>
          ) : (
            <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255, 255, 255, 0.3)' }}>
                      {['Title', 'Teacher', 'Student', 'Time', 'Date Range', 'Days', 'Status', 'Sessions', 'Actions'].map(h => (
                        <th key={h} style={{
                          padding: '16px 18px', textAlign: 'left', fontSize: '.75rem',
                          fontWeight: 600, color: C.sub, letterSpacing: '.05em',
                          borderBottom: `2px solid ${C.border}`, whiteSpace: 'nowrap',
                        }}>{h.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {schedules.map(sched => (
                      <React.Fragment key={sched.id}>
                        <tr className="sm-row" onClick={() => setExpandedId(expandedId === sched.id ? null : sched.id)}
                          style={{
                            background: expandedId === sched.id ? 'rgba(192, 132, 252, 0.06)' : 'transparent',
                            transition: 'background .12s',
                            cursor: 'pointer',
                          }}>
                          {/* Title */}
                          <td style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ fontWeight: 600, fontSize: '.9rem', color: C.text }}>
                              {sched.title}
                              {sched.subject && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: C.sub, fontWeight: 400 }}>({sched.subject})</span>}
                            </div>
                            {!sched.is_active && (
                              <Tag color={C.red} bg={C.redBg}>Inactive</Tag>
                            )}
                          </td>
                          {/* Teacher */}
                          <td style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, fontSize: '.88rem', color: C.text }}>
                            {sched.teacher_name}
                          </td>
                          {/* Student */}
                          <td style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, fontSize: '.88rem', color: C.text }}>
                            {sched.student_name}
                          </td>
                          {/* Time */}
                          <td style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap', fontSize: '.88rem', color: C.sub }}>
                            🕐 {sched.start_time?.slice(0,5)} – {sched.end_time?.slice(0,5)}
                          </td>
                          {/* Date Range */}
                          <td style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap', fontSize: '.88rem', color: C.sub }}>
                            {sched.date_from} → {sched.date_until}
                          </td>
                          {/* Days */}
                          <td style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}` }}>
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                              {(sched.days || []).sort().map(d => (
                                <span key={d} style={{
                                  fontSize: '.68rem', background: C.purpleBg, color: C.purple,
                                  padding: '3px 10px', borderRadius: 9999, fontWeight: 600,
                                  border: `1px solid ${C.purple}20`,
                                }}>
                                  {DAY_LABELS[d]}
                                </span>
                              ))}
                            </div>
                          </td>
                          {/* Status */}
                          <td style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}` }}>
                            <Tag color={sched.is_active ? C.green : C.red} bg={sched.is_active ? C.greenBg : C.redBg}>
                              {sched.is_active ? '● Active' : '○ Inactive'}
                            </Tag>
                          </td>
                          {/* Sessions */}
                          <td style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>
                            <span style={{ color: C.green, fontWeight: 600, fontSize: '.88rem' }}>✅ {sched.sessions_count}</span>
                            {Number(sched.conflicts_count) > 0 && (
                              <span style={{ color: C.amber, fontWeight: 600, fontSize: '.82rem', marginLeft: 8 }}>⚠️ {sched.conflicts_count}</span>
                            )}
                          </td>
                          {/* Actions */}
                          <td style={{ padding: '16px 18px', borderBottom: `1px solid ${C.border}` }}
                            onClick={e => e.stopPropagation()}>
                            {sched.is_active && (
                              <Btn small outline color={C.red} onClick={() => deleteSchedule(sched.id)}>
                                🗑 Deactivate
                              </Btn>
                            )}
                          </td>
                        </tr>
                        {/* Expanded Calendar Row */}
                        {expandedId === sched.id && (
                          <tr>
                            <td colSpan={9} style={{
                              padding: '20px 24px',
                              background: 'rgba(255, 255, 255, 0.3)',
                              borderBottom: `1px solid ${C.border}`,
                            }}>
                              <div style={{ fontWeight: 700, fontSize: '.9rem', color: C.text, marginBottom: '12px' }}>
                                📆 Calendar View — {sched.title}
                              </div>
                              <ScheduleCalendar
                                dateFrom={sched.date_from}
                                dateUntil={sched.date_until}
                                days={sched.days || []}
                                color={C.purple}
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {view === 'sessions' && <SessionViewer />}
    </div>
  );
};

export default ScheduleManager;