import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';

const CLASSROOM_URL = import.meta.env.VITE_CLASSROOM_URL || 'https://online-teaching-platform-1-j4f0.onrender.com';

const LiveClassManager = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    axios.get('/api/sessions').then(r => setSessions(r.data)).catch(() => {});
  }, []);

  const startClass = (roomName) => {
    window.open(`${CLASSROOM_URL}/teacher.html?room=${roomName}`, '_blank');
  };

  const startDemo = () => {
    window.open(`${CLASSROOM_URL}/teacher.html?room=demo`, '_blank');
  };

  const active = sessions.filter(s => s.status === 'active' || s.status === 'scheduled');
  const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.88rem' };
  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)', fontSize: '0.85rem' };

  return (
    <div>
      {/* Demo banner */}
      <div className="card p-6 mb-6" style={{ background: 'linear-gradient(135deg, #059669, #0d9488)', color: '#fff', border: 'none' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>🎙️ Test Demo Class</h2>
        <p style={{ fontSize: '0.9rem', opacity: 0.85, marginBottom: '1rem' }}>
          Open a demo room to test your mic and audio before a real session.
        </p>
        <button onClick={startDemo} className="btn-primary"
          style={{ background: '#fff', color: '#059669', fontWeight: 700, padding: '0.5rem 1.5rem' }}>
          🚀 Start Demo Class
        </button>
      </div>

      {/* Sessions */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">My Sessions ({active.length})</h2>
        {active.length === 0 && <p className="text-gray-500 text-sm">No active or upcoming sessions.</p>}
        {active.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Title</th>
                <th style={th}>Subject</th>
                <th style={th}>Start</th>
                <th style={th}>Status</th>
                <th style={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {active.map(s => (
                <tr key={s.id}>
                  <td style={td}>{s.title}</td>
                  <td style={td}>{s.subject || '—'}</td>
                  <td style={td}>{new Date(s.scheduled_start).toLocaleString()}</td>
                  <td style={td}>
                    <span style={{ color: s.status === 'active' ? 'var(--green-500)' : 'var(--primary)', fontWeight: 600, textTransform: 'capitalize' }}>
                      {s.status}
                    </span>
                  </td>
                  <td style={td}>
                    <button
                      onClick={() => startClass(s.room_name || s.id)}
                      className="btn-primary"
                      style={{ fontSize: '0.8rem', padding: '4px 14px' }}>
                      Start Class
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default LiveClassManager;
