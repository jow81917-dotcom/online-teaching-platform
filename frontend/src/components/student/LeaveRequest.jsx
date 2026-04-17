import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const EMPTY = { session_id: '', leave_date: '', start_time: '', end_time: '', reason: '' };

const LeaveRequest = ({ sessions = [] }) => {
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);

  const load = () => axios.get('/api/leave').then(r => setRequests(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/leave', form);
      toast.success('Leave request submitted');
      setForm(EMPTY); setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const statusColor = { pending: 'var(--yellow-500)', approved: 'var(--green-500)', rejected: 'var(--red-500)' };
  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)', fontSize: '0.85rem' };
  const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.88rem' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Request Leave</button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">New Leave Request</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">Session (optional)</label>
                <select className="input-field" value={form.session_id} onChange={e => setForm({ ...form, session_id: e.target.value })}>
                  <option value="">No specific session</option>
                  {sessions.filter(s => s.status === 'scheduled').map(s => (
                    <option key={s.id} value={s.id}>{s.title} — {new Date(s.scheduled_start).toLocaleDateString()}</option>
                  ))}
                </select>
              </div>
              <div><label className="block text-gray-700 mb-2">Leave Date</label><input className="input-field" type="date" required value={form.leave_date} onChange={e => setForm({ ...form, leave_date: e.target.value })} /></div>
              <div><label className="block text-gray-700 mb-2">Start Time</label><input className="input-field" type="time" required value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div>
              <div><label className="block text-gray-700 mb-2">End Time</label><input className="input-field" type="time" required value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></div>
              <div style={{ gridColumn: 'span 2' }}><label className="block text-gray-700 mb-2">Reason</label><textarea className="input-field" rows={3} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn-primary">Submit</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem', cursor: 'pointer', background: '#fff' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">My Leave Requests ({requests.length})</h2>
        {requests.length === 0 && <p className="text-gray-500 text-sm">No leave requests yet.</p>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Date</th><th style={th}>Time</th><th style={th}>Reason</th><th style={th}>Status</th></tr></thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id}>
                <td style={td}>{r.leave_date}</td>
                <td style={td}>{r.start_time} – {r.end_time}</td>
                <td style={td}>{r.reason || '—'}</td>
                <td style={td}><span style={{ color: statusColor[r.status], fontWeight: 600, textTransform: 'capitalize' }}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeaveRequest;
