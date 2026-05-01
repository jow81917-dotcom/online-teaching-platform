import React, { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const CLASSROOM_URL = import.meta.env.VITE_CLASSROOM_URL || 'http://localhost:3000';
const JOIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const toEAT = (d) => new Date(d).toLocaleString('en-US', { timeZone: 'Africa/Nairobi', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });

const LiveClassManager = ({ overviewMode = false }) => {
  const [sessions, setSessions] = useState([]);
  const [joining,  setJoining]  = useState(null);
  const [now,      setNow]      = useState(new Date());

  const load = useCallback(() => {
    axios.get('/api/sessions').then(r => setSessions(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  // Refresh session list every 30s (picks up cron-driven status changes)
  useEffect(() => {
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  // Tick every second so countdown and button state update live
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
    const start = new Date(s.scheduled_start);
    const diff  = start - now;
    // Start has passed but cron hasn't flipped to active yet
    if (diff <= 0 && s.status === 'scheduled') return 'Starting now...';
    if (diff <= 0) return null;
    const totalSec = Math.floor(diff / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
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
        const s = sessions.find(x => x.id === sessionId);
        const room = s?.room_name || sessionId;
        window.location.href = `${CLASSROOM_URL}/teacher.html?room=${encodeURIComponent(room)}`;
      }
    }
  };

  const startDemo = () => { window.location.href = `${CLASSROOM_URL}/teacher.html?room=demo`; };

  const active = sessions.filter(s => s.status === 'active' || s.status === 'scheduled');

  // Overview mode: compact card for dashboard
  if (overviewMode) {
    const joinable = active.find(s => isJoinable(s));
    const next     = active.find(s => !isJoinable(s));
    const shown    = joinable || next;
    const card = {
      background: joinable ? 'linear-gradient(135deg,#16c24a22,#16c24a11)' : '#1a1a2e',
      border: joinable ? '1px solid #16c24a55' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: '16px', padding: '16px', marginBottom: '12px'
    };
    return (
      <div style={card}>
        <p style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', marginBottom: '10px' }}>
          {joinable ? '🟢 Live Class' : '🎙️ Live Class'}
        </p>
        {!shown ? (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>No upcoming sessions.</p>
        ) : (
          <>
            <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '0.9rem' }}>{shown.title}</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', marginTop: '4px' }}>
              {toEAT(shown.scheduled_start)} EAT
              {joinable && <span style={{ color: '#16c24a', marginLeft: '8px', fontWeight: 700 }}>● Open now</span>}
              {!joinable && countdown(shown) && <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '8px' }}>opens in {countdown(shown)}</span>}
            </p>
            <button
              onClick={() => joinClass(shown.id)}
              disabled={!joinable || joining === shown.id}
              style={{ marginTop: '12px', width: '100%', padding: '11px', borderRadius: '10px', border: 'none', background: joinable ? '#16c24a' : 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700, fontSize: '0.9rem', cursor: joinable ? 'pointer' : 'not-allowed', opacity: joinable ? 1 : 0.5 }}
            >
              {joining === shown.id ? '...' : joinable ? '🎙️ Start Class Now' : '🎙️ Start Class'}
            </button>
          </>
        )}
      </div>
    );
  }

  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)', fontSize: '0.85rem' };
  const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.88rem', verticalAlign: 'middle' };

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
                  <th style={th}>Room Code</th>
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
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{toEAT(s.scheduled_start)} EAT</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{toEAT(s.scheduled_end)} EAT</td>
                      <td style={td}>
                        <code style={{ fontSize: '0.78rem', background: 'var(--gray-100)', padding: '2px 6px', borderRadius: '4px' }}>
                          {s.room_name || s.id}
                        </code>
                      </td>
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
                          title={!joinable ? `Opens 15 min before start` : 'Start Class'}
                        >
                          {joining === s.id ? '...' : '▶ Start Class'}
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

export default LiveClassManager;
