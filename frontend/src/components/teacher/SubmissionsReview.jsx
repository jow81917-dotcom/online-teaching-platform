import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const SubmissionsReview = ({ homework }) => {
  const [selected, setSelected] = useState('');
  const [submissions, setSubmissions] = useState([]);
  const [grading, setGrading] = useState(null);
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadSubmissions = (hwId) => {
    setSelected(hwId);
    axios.get(`/api/homework/${hwId}/submissions`).then(r => setSubmissions(r.data)).catch(() => {});
  };

  const submitGrade = async (subId) => {
    try {
      await axios.put(`/api/homework/${selected}/submissions/${subId}/grade`, { score: parseInt(score), feedback });
      toast.success('Graded successfully');
      setGrading(null); setScore(''); setFeedback('');
      loadSubmissions(selected);
    } catch { toast.error('Error grading'); }
  };

  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)', fontSize: '0.85rem' };
  const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.88rem' };

  return (
    <div>
      <div className="card p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Select Homework to Review</h2>
        <select className="input-field" style={{ maxWidth: '400px' }} value={selected} onChange={e => loadSubmissions(e.target.value)}>
          <option value="">-- Select homework --</option>
          {homework.map(h => <option key={h.id} value={h.id}>{h.title}</option>)}
        </select>
      </div>

      {selected && (
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Submissions ({submissions.length})</h2>
          {submissions.length === 0 && <p className="text-gray-500 text-sm">No submissions yet.</p>}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr><th style={th}>Student ID</th><th style={th}>Type</th><th style={th}>Status</th><th style={th}>Score</th><th style={th}>Submitted</th><th style={th}>Actions</th></tr></thead>
            <tbody>
              {submissions.map(s => (
                <React.Fragment key={s.id}>
                  <tr>
                    <td style={td}>{s.student_id.slice(0,8)}...</td>
                    <td style={td} style={{ textTransform: 'capitalize' }}>{s.content_type}</td>
                    <td style={td}><span style={{ textTransform: 'capitalize', color: s.status === 'reviewed' ? 'var(--green-500)' : 'var(--yellow-500)', fontWeight: 600 }}>{s.status}</span></td>
                    <td style={td}>{s.score ?? '—'}</td>
                    <td style={td}>{new Date(s.submitted_at).toLocaleDateString()}</td>
                    <td style={td}>
                      <a href={s.content_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', marginRight: '0.5rem', fontSize: '0.8rem' }}>View</a>
                      <button onClick={() => { setGrading(s.id); setScore(s.score || ''); setFeedback(s.feedback || ''); }}
                        style={{ padding: '2px 10px', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: '4px', cursor: 'pointer', background: '#fff', fontSize: '0.8rem' }}>Grade</button>
                    </td>
                  </tr>
                  {grading === s.id && (
                    <tr>
                      <td colSpan={6} style={{ padding: '0.75rem', background: 'var(--gray-50)' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                          <div><label className="block text-gray-700 mb-1" style={{ fontSize: '0.85rem' }}>Score</label>
                            <input type="number" className="input-field" style={{ width: '100px' }} value={score} onChange={e => setScore(e.target.value)} /></div>
                          <div style={{ flex: 1 }}><label className="block text-gray-700 mb-1" style={{ fontSize: '0.85rem' }}>Feedback</label>
                            <input className="input-field" value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Optional feedback..." /></div>
                          <button className="btn-primary" onClick={() => submitGrade(s.id)}>Save</button>
                          <button onClick={() => setGrading(null)} style={{ padding: '0.5rem 1rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem', cursor: 'pointer', background: '#fff' }}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SubmissionsReview;
