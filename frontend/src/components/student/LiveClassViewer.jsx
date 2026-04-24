import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const CLASSROOM_URL = import.meta.env.VITE_CLASSROOM_URL || 'http://localhost:3000';
const JOIN_WINDOW_MS = 15 * 60 * 1000;

const LiveClassViewer = () => {
  const { user }   = useAuth();
  const [sessions, setSessions] = useState([]);
  const [joining,  setJoining]  = useState(null);
  const [now,      setNow]      = useState(new Date());

  const load = useCallback(() => {
    axios.get('/api/sessions').then(r => setSessions(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isJoinable = (s) => {
    if (s.status === 'cancelled' || s.status === 'completed') return false;
    if (s.status === 'active') return true;
    const start = new Date(s.scheduled_start);
    const end   = new Date(s.scheduled_end);
    return (start - now) <= JOIN_WINDOW_MS && now < end;
  };

  const countdown = (s) => {
    const diff = new Date(s.scheduled_start) - now;
    if (diff <= 0 && s.status === 'scheduled') return 'Starting now...';
    if (diff <= 0) return null;
    const totalSec = Math.floor(diff / 1000);
    const h   = Math.floor(totalSec / 3600);
    const m   = Math.floor((totalSec % 3600) / 60);
    const sec = totalSec % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${String(sec).padStart(2,'0')}s`;
    return `${sec}s`;
  };

  const joinClass = async (sessionId) => {
    setJoining(sessionId);
    try {
      const { data } = await axios.get(`/api/sessions/classroom/join/${sessionId}`);
      window.location.href = data.url;
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg) { toast.error(msg); setJoining(null); }
      else {
        const s    = sessions.find(x => x.id === sessionId);
        const room = s?.room_name || sessionId;
        const name = encodeURIComponent(user?.full_name || 'Student');
        window.location.href = `${CLASSROOM_URL}/student.html?room=${encodeURIComponent(room)}&name=${name}`;
      }
    }
  };

  const joinDemo = () => {
    const name = encodeURIComponent(user?.full_name || 'Student');
    window.location.href = `${CLASSROOM_URL}/student.html?room=demo&name=${name}`;
  };

  const active = sessions.filter(s => s.status === 'active' || s.status === 'scheduled');

  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)', fontSize: '0.85rem' };
  const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.88rem', verticalAlign: 'middle' };

  return (
    <div>
      {/* Demo banner */}
      <div className="card p-6 mb-6" style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', color: '#fff', border: 'none' }}>
        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>🎧 Test Demo Class</h2>
        <p style={{ fontSize: '0.9rem', opacity: 0.85, marginBottom: '1rem' }}>
          Try the audio classroom before your real session.
        </p>
        <button onClick={joinDemo} className="btn-primary"
          style={{ background: '#fff', color: '#4f46e5', fontWeight: 700, padding: '0.5rem 1.5rem' }}>
          🚀 Join Demo Class
        </button>
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">My Sessions ({active.length})</h2>
        {active.length === 0 && <p className="text-gray-500 text-sm">No active or upcoming sessions.</p>}
        {active.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={th}>Title</th>
                  <th style={th}>Subject</th>
                  <th style={th}>Start</th>
                  <th style={th}>End</th>
                  <th style={th}>Status</th>
                  <th style={th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {active.map(s => {
                  const joinable = isJoinable(s);
                  const cd       = countdown(s);
                  return (
                    <tr key={s.id}>
                      <td style={td}>{s.title}</td>
                      <td style={td}>{s.subject || '—'}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(s.scheduled_start).toLocaleString()}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{new Date(s.scheduled_end).toLocaleString()}</td>
                      <td style={td}>
                        <span style={{ color: s.status === 'active' ? 'var(--green-500)' : 'var(--primary)', fontWeight: 600, textTransform: 'capitalize' }}>
                          {s.status}
                        </span>
                        {!joinable && cd && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: '2px' }}>
                            opens in {cd}
                          </span>
                        )}
                        {joinable && s.status === 'scheduled' && (
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#059669', marginTop: '2px' }}>
                            🟢 Open now
                          </span>
                        )}
                      </td>
                      <td style={td}>
                        <button
                          onClick={() => joinClass(s.id)}
                          disabled={!joinable || joining === s.id}
                          className="btn-primary"
                          style={{ fontSize: '0.8rem', padding: '5px 14px', opacity: joinable ? 1 : 0.4, cursor: joinable ? 'pointer' : 'not-allowed' }}
                          title={!joinable ? 'Opens 15 min before start' : 'Join Class'}
                        >
                          {joining === s.id ? '...' : '🎓 Join Class'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveClassViewer;
