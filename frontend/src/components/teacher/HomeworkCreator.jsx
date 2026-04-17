import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const EMPTY = { title: '', description: '', session_id: '', content_type: 'image', content_url: '', due_date: '', max_score: 100 };

const HomeworkCreator = ({ sessions, onCreated }) => {
  const [homework, setHomework] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);

  const load = () => axios.get('/api/homework').then(r => setHomework(r.data)).catch(() => {});
  React.useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post('/api/homework', form);
      toast.success('Homework created');
      setForm(EMPTY); setShowForm(false); load(); onCreated && onCreated();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)', fontSize: '0.85rem' };
  const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.88rem' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ Create Homework</button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">New Homework</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-gray-700 mb-2">Title</label><input className="input-field" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div>
                <label className="block text-gray-700 mb-2">Session</label>
                <select className="input-field" required value={form.session_id} onChange={e => setForm({ ...form, session_id: e.target.value })}>
                  <option value="">Select session</option>
                  {sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-gray-700 mb-2">Content Type</label>
                <select className="input-field" value={form.content_type} onChange={e => setForm({ ...form, content_type: e.target.value })}>
                  <option value="image">Image</option>
                  <option value="audio">Audio</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
              <div><label className="block text-gray-700 mb-2">Content URL</label><input className="input-field" required value={form.content_url} onChange={e => setForm({ ...form, content_url: e.target.value })} placeholder="https://..." /></div>
              <div><label className="block text-gray-700 mb-2">Due Date</label><input className="input-field" type="datetime-local" required value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></div>
              <div><label className="block text-gray-700 mb-2">Max Score</label><input className="input-field" type="number" value={form.max_score} onChange={e => setForm({ ...form, max_score: e.target.value })} /></div>
              <div style={{ gridColumn: 'span 2' }}><label className="block text-gray-700 mb-2">Description</label><textarea className="input-field" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn-primary">Create</button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem', cursor: 'pointer', background: '#fff' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">My Homework ({homework.length})</h2>
        {homework.length === 0 && <p className="text-gray-500 text-sm">No homework created yet.</p>}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Title</th><th style={th}>Type</th><th style={th}>Due Date</th><th style={th}>Max Score</th><th style={th}>Status</th></tr></thead>
          <tbody>
            {homework.map(h => (
              <tr key={h.id}>
                <td style={td}>{h.title}</td>
                <td style={td}><span style={{ textTransform: 'capitalize' }}>{h.content_type}</span></td>
                <td style={td}>{new Date(h.due_date).toLocaleDateString()}</td>
                <td style={td}>{h.max_score}</td>
                <td style={td}><span style={{ textTransform: 'capitalize', color: h.status === 'active' ? 'var(--green-500)' : 'var(--gray-500)', fontWeight: 600 }}>{h.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HomeworkCreator;
