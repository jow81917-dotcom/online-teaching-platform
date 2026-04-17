import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const EMPTY = { title: '', subject: '', teacher_id: '', student_id: '', scheduled_start: '', scheduled_end: '', description: '' };

const ScheduleManager = () => {
  const [sessions, setSessions] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('all');

  const load = async () => {
    const [s, u] = await Promise.all([axios.get('/api/sessions'), axios.get('/api/users')]);
    setSessions(s.data);
    setTeachers(u.data.filter(u => u.role === 'teacher'));
    setStudents(u.data.filter(u => u.role === 'student'));
  };
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/sessions', form);
      toast.success('Session created');
      setForm(EMPTY); setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const cancel = async (id) => {
    try {
      await axios.put(`/api/sessions/${id}`, { status: 'cancelled' });
      toast.success('Session cancelled'); load();
    } catch { toast.error('Error'); }
  };

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.status === filter);
  const statusColor = { scheduled: 'var(--primary)', active: 'var(--green-500)', completed: 'var(--gray-500)', cancelled: 'var(--red-500)', replaced: 'var(--yellow-500)' };
  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)' };
  const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.88rem' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['all','scheduled','active','completed','cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{ padding: '4px 12px', borderRadius: '9999px', border: '1px solid var(--gray-300)', cursor: 'pointer', fontSize: '0.85rem',
                background: filter === s ? 'var(--primary)' : '#fff', color: filter === s ? '#fff' : 'var(--gray-700)', textTransform: 'capitalize' }}>{s}</button>
          ))}
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ New Session</button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">Create Session</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-gray-700 mb-2">Title</label><input className="input-field" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><label className="block text-gray-700 mb-2">Subject</label><input className="input-field" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
              <div>
                <label className="block text-gray-700 mb-2">Teacher</label>
                <select className="input-field" required value={form.teacher_id} onChange={e => setForm({ ...form, teacher_id: e.target.value })}>
                  <option value="">Select teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Student</label>
                <select className="input-field" required value={form.student_id} onChange={e => setForm({ ...form, student_id: e.target.value })}>
                  <option value="">Select student</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                </select>
              </div>
              <div><label className="block text-gray-700 mb-2">Start</label><input className="input-field" type="datetime-local" required value={form.scheduled_start} onChange={e => setForm({ ...form, scheduled_start: e.target.value })} /></div>
              <div><label className="block text-gray-700 mb-2">End</label><input className="input-field" type="datetime-local" required value={form.scheduled_end} onChange={e => setForm({ ...form, scheduled_end: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn-primary">Create</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem', cursor: 'pointer', background: '#fff' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Sessions ({filtered.length})</h2>
        {filtered.length === 0 && <p className="text-gray-500 text-sm">No sessions found.</p>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Title</th><th style={th}>Subject</th><th style={th}>Start</th><th style={th}>End</th><th style={th}>Status</th><th style={th}>Actions</th></tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td style={td}>{s.title}</td>
                <td style={td}>{s.subject || '—'}</td>
                <td style={td}>{new Date(s.scheduled_start).toLocaleString()}</td>
                <td style={td}>{new Date(s.scheduled_end).toLocaleString()}</td>
                <td style={td}><span style={{ color: statusColor[s.status], fontWeight: 600, textTransform: 'capitalize' }}>{s.status}</span></td>
                <td style={td}>
                  {s.status === 'scheduled' && (
                    <button onClick={() => cancel(s.id)} style={{ padding: '2px 10px', border: '1px solid var(--red-500)', color: 'var(--red-500)', borderRadius: '4px', cursor: 'pointer', background: '#fff', fontSize: '0.8rem' }}>Cancel</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ScheduleManager;
