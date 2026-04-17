import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const HomeworkViewer = ({ homework }) => {
  const [submitting, setSubmitting] = useState(null);
  const [contentType, setContentType] = useState('image');
  const [contentUrl, setContentUrl] = useState('');

  const handleSubmit = async (e, hwId) => {
    e.preventDefault();
    try {
      await axios.post(`/api/homework/${hwId}/submit`, { content_type: contentType, content_url: contentUrl });
      toast.success('Homework submitted!');
      setSubmitting(null); setContentUrl('');
    } catch (err) { toast.error(err.response?.data?.message || 'Error submitting'); }
  };

  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)', fontSize: '0.85rem' };
  const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.88rem' };

  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold mb-4">My Homework ({homework.length})</h2>
      {homework.length === 0 && <p className="text-gray-500 text-sm">No homework assigned yet.</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr><th style={th}>Title</th><th style={th}>Due Date</th><th style={th}>Max Score</th><th style={th}>Status</th><th style={th}>Actions</th></tr>
        </thead>
        <tbody>
          {homework.map(h => (
            <React.Fragment key={h.id}>
              <tr>
                <td style={td}>{h.title}</td>
                <td style={td}>{new Date(h.due_date).toLocaleDateString()}</td>
                <td style={td}>{h.max_score}</td>
                <td style={td}><span style={{ textTransform: 'capitalize', color: h.status === 'active' ? 'var(--green-500)' : 'var(--gray-500)', fontWeight: 600 }}>{h.status}</span></td>
                <td style={td}>
                  <a href={h.content_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', marginRight: '0.5rem', fontSize: '0.8rem' }}>View</a>
                  {h.status === 'active' && (
                    <button onClick={() => setSubmitting(submitting === h.id ? null : h.id)}
                      style={{ padding: '2px 10px', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: '4px', cursor: 'pointer', background: '#fff', fontSize: '0.8rem' }}>
                      Submit
                    </button>
                  )}
                </td>
              </tr>
              {submitting === h.id && (
                <tr>
                  <td colSpan={5} style={{ padding: '0.75rem', background: 'var(--gray-50)' }}>
                    <form onSubmit={e => handleSubmit(e, h.id)} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                      <div>
                        <label className="block text-gray-700 mb-1" style={{ fontSize: '0.85rem' }}>Type</label>
                        <select className="input-field" style={{ width: '120px' }} value={contentType} onChange={e => setContentType(e.target.value)}>
                          <option value="image">Image</option>
                          <option value="audio">Audio</option>
                          <option value="mixed">Mixed</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label className="block text-gray-700 mb-1" style={{ fontSize: '0.85rem' }}>Content URL</label>
                        <input className="input-field" required value={contentUrl} onChange={e => setContentUrl(e.target.value)} placeholder="https://..." />
                      </div>
                      <button type="submit" className="btn-primary">Submit</button>
                      <button type="button" onClick={() => setSubmitting(null)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem', cursor: 'pointer', background: '#fff' }}>Cancel</button>
                    </form>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default HomeworkViewer;
