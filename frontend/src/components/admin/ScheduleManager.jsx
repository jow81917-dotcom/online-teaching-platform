import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const EMPTY = { title: '', subject: '', teacher_id: '', student_id: '', scheduled_start: '', scheduled_end: '', description: '' };

// Convert datetime-local string to UTC ISO — only if browser local time differs from UTC
// Since Neon stores TIMESTAMP (no timezone), we send the local time string directly
// so what the admin sees in the form is exactly what gets stored and compared with NOW() AT TIME ZONE 'UTC'
const toUTC = (localStr) => localStr || '';

// Format a UTC date string back to datetime-local input value (local time)
const toLocalInput = (d) => {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const statusColor = {
  scheduled: 'var(--primary)',
  active:    'var(--green-500)',
  completed: 'var(--gray-500)',
  cancelled: 'var(--red-500)',
  replaced:  'var(--yellow-500)'
};

const ScheduleManager = () => {
  const [sessions,  setSessions]  = useState([]);
  const [teachers,  setTeachers]  = useState([]);
  const [students,  setStudents]  = useState([]);
  const [form,      setForm]      = useState(EMPTY);
  const [editId,    setEditId]    = useState(null);   // null = create, string = edit
  const [showForm,  setShowForm]  = useState(false);
  const [filter,    setFilter]    = useState('all');
  const [formError, setFormError] = useState('');
  const [saving,    setSaving]    = useState(false);

  const load = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([axios.get('/api/sessions'), axios.get('/api/users')]);
      setSessions(s.data);
      setTeachers(u.data.filter(u => u.role === 'teacher'));
      setStudents(u.data.filter(u => u.role === 'student'));
    } catch { toast.error('Failed to load data'); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s so status changes from cron are reflected
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const openCreate = () => {
    setForm(EMPTY);
    setEditId(null);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (s) => {
    setForm({
      title:           s.title,
      subject:         s.subject || '',
      teacher_id:      s.teacher_id,
      student_id:      s.student_id,
      scheduled_start: toLocalInput(new Date(s.scheduled_start)),
      scheduled_end:   toLocalInput(new Date(s.scheduled_end)),
      description:     s.description || ''
    });
    setEditId(s.id);
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); setFormError(''); };

  // Client-side validation before hitting the server
  const validate = () => {
    if (!form.title.trim())       return 'Title is required';
    if (!form.teacher_id)         return 'Select a teacher';
    if (!form.student_id)         return 'Select a student';
    if (!form.scheduled_start)    return 'Start time is required';
    if (!form.scheduled_end)      return 'End time is required';
    const start = new Date(form.scheduled_start);
    const end   = new Date(form.scheduled_end);
    if (isNaN(start) || isNaN(end)) return 'Invalid date';
    if (!editId && start < new Date()) return 'Cannot schedule in the past';
    if (start >= end)             return 'End time must be after start time';
    if ((end - start) < 15 * 60 * 1000) return 'Session must be at least 15 minutes';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setFormError(err); return; }
    setFormError('');
    setSaving(true);
    try {
      if (editId) {
        await axios.put(`/api/sessions/${editId}`, {
          title:           form.title,
          subject:         form.subject,
          scheduled_start: toUTC(form.scheduled_start),
          scheduled_end:   toUTC(form.scheduled_end),
          description:     form.description
        });
        toast.success('Session updated');
      } else {
        await axios.post('/api/sessions', {
          ...form,
          scheduled_start: toUTC(form.scheduled_start),
          scheduled_end:   toUTC(form.scheduled_end)
        });
        toast.success('Session created');
      }
      closeForm();
      load();
    } catch (err) {
      const msg = err.response?.data?.message || 'Error saving session';
      setFormError(msg);
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this session?')) return;
    try {
      await axios.put(`/api/sessions/${id}`, { status: 'cancelled' });
      toast.success('Session cancelled');
      load();
    } catch { toast.error('Error'); }
  };

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.status === filter);

  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)', fontSize: '0.82rem', whiteSpace: 'nowrap' };
  const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.85rem', verticalAlign: 'middle' };

  const inputStyle = { width: '100%', padding: '0.5rem 0.75rem', border: '1px solid var(--gray-300)', borderRadius: '0.375rem', fontSize: '0.9rem' };
  const labelStyle = { display: 'block', marginBottom: '0.35rem', fontWeight: 600, fontSize: '0.85rem', color: 'var(--gray-700)' };

  return (
    <div>
      {/* Filter + New button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['all', 'scheduled', 'active', 'completed', 'cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '4px 12px', borderRadius: '9999px', border: '1px solid var(--gray-300)', cursor: 'pointer', fontSize: '0.82rem',
                background: filter === s ? 'var(--primary)' : '#fff', color: filter === s ? '#fff' : 'var(--gray-700)', textTransform: 'capitalize' }}>
              {s}
            </button>
          ))}
        </div>
        <button className="btn-primary" onClick={openCreate}>+ New Session</button>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <div className="card p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">{editId ? 'Edit Session' : 'Create Session'}</h3>

          {formError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.5rem', padding: '0.75rem 1rem', marginBottom: '1rem', color: '#b91c1c', fontSize: '0.88rem' }}>
              ⚠️ {formError}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Title *</label>
                <input style={inputStyle} required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div>
                <label style={labelStyle}>Subject</label>
                <input style={inputStyle} value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
              </div>

              <div>
                <label style={labelStyle}>Teacher *</label>
                <select style={inputStyle} required value={form.teacher_id}
                  onChange={e => setForm({ ...form, teacher_id: e.target.value })}
                  disabled={!!editId}>
                  <option value="">Select teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Student *</label>
                <select style={inputStyle} required value={form.student_id}
                  onChange={e => setForm({ ...form, student_id: e.target.value })}
                  disabled={!!editId}>
                  <option value="">Select student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle}>Start *</label>
                <input style={inputStyle} type="datetime-local" required value={form.scheduled_start}
                  min={editId ? undefined : toLocalInput(new Date())}
                  onChange={e => {
                    const newStart = e.target.value;
                    // Auto-set end to start + 1 hour if end is empty or before new start
                    let newEnd = form.scheduled_end;
                    if (!newEnd || new Date(newEnd) <= new Date(newStart)) {
                      const d = new Date(newStart);
                      d.setHours(d.getHours() + 1);
                      newEnd = toLocalInput(d);
                    }
                    setForm({ ...form, scheduled_start: newStart, scheduled_end: newEnd });
                  }} />
              </div>
              <div>
                <label style={labelStyle}>End *</label>
                <input style={inputStyle} type="datetime-local" required value={form.scheduled_end}
                  min={form.scheduled_start || toLocalInput(new Date())}
                  onChange={e => setForm({ ...form, scheduled_end: e.target.value })} />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={labelStyle}>Description</label>
                <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }}
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Saving...' : editId ? 'Update Session' : 'Create Session'}
              </button>
              <button type="button" onClick={closeForm}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem', cursor: 'pointer', background: '#fff' }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Sessions table */}
      <div className="card p-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="text-xl font-semibold">Sessions ({filtered.length})</h2>
          <button onClick={load} style={{ fontSize: '0.8rem', padding: '4px 10px', border: '1px solid var(--gray-300)', borderRadius: '6px', cursor: 'pointer', background: '#fff' }}>
            ↻ Refresh
          </button>
        </div>

        {filtered.length === 0 && <p className="text-gray-500 text-sm">No sessions found.</p>}

        {filtered.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Title</th>
                  <th style={th}>Subject</th>
                  <th style={th}>Start</th>
                  <th style={th}>End</th>
                  <th style={th}>Room Code</th>
                  <th style={th}>Status</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td style={td}>{s.title}</td>
                    <td style={td}>{s.subject || '—'}</td>
                    <td style={td} style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(s.scheduled_start).toLocaleString()}</td>
                    <td style={td} style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(s.scheduled_end).toLocaleString()}</td>
                    <td style={td}>
                      <code style={{ fontSize: '0.75rem', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px', userSelect: 'all' }}>
                        {s.room_name || '—'}
                      </code>
                    </td>
                    <td style={td}>
                      <span style={{ color: statusColor[s.status] || 'var(--gray-500)', fontWeight: 600, textTransform: 'capitalize' }}>
                        {s.status}
                      </span>
                    </td>
                    <td style={td}>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                        {s.status === 'scheduled' && (
                          <>
                            <button onClick={() => openEdit(s)}
                              style={{ padding: '2px 10px', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: '4px', cursor: 'pointer', background: '#fff', fontSize: '0.78rem' }}>
                              Edit
                            </button>
                            <button onClick={() => cancel(s.id)}
                              style={{ padding: '2px 10px', border: '1px solid var(--red-500)', color: 'var(--red-500)', borderRadius: '4px', cursor: 'pointer', background: '#fff', fontSize: '0.78rem' }}>
                              Cancel
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScheduleManager;
