import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import HomeworkViewer from './HomeworkViewer';
import VideoLibrary from './VideoLibrary';
import LiveClassViewer from './LiveClassViewer';
import LeaveRequest from './LeaveRequest';

const CLASSROOM_URL = import.meta.env.VITE_CLASSROOM_URL || 'http://localhost:3000';

const links = [
  { id: 'overview',  label: '🏠 Overview',   icon: '🏠' },
  { id: 'live',      label: '🎧 Live Class', icon: '🎧' },
  { id: 'sessions',  label: '📅 Sessions',   icon: '📅' },
  { id: 'homework',  label: '📝 Homework',   icon: '📝' },
  { id: 'videos',    label: '🎬 Videos',     icon: '🎬' },
  { id: 'leave',     label: '🏖️ Leave',      icon: '🏖️' },
];

const s = {
  screen:   { flex: 1, overflowY: 'auto', paddingBottom: '100px' },
  topBar:   { background: '#0d0d0d', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 20 },
  title:    { color: '#fff', fontWeight: 700, fontSize: '1rem', margin: 0 },
  hamburger:{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', flexDirection: 'column', gap: '5px' },
  bar:      { width: '22px', height: '2px', background: '#fff', borderRadius: '2px', display: 'block' },
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, backdropFilter: 'blur(4px)' },
  drawer:   { position: 'fixed', top: 0, right: 0, width: '260px', height: '100%', background: '#0d0d0d', zIndex: 50, display: 'flex', flexDirection: 'column', borderLeft: '1px solid rgba(255,255,255,0.08)', boxShadow: '-8px 0 32px rgba(0,0,0,0.6)' },
  drawerTop:{ padding: '20px 20px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.07)' },
  drawerName:{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' },
  closeBtn: { background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '1.2rem', padding: '4px' },
  navBtn:   (active) => ({ display: 'flex', alignItems: 'center', gap: '12px', width: '100%', padding: '14px 20px', border: 'none', cursor: 'pointer', background: active ? 'rgba(255,255,255,0.1)' : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: active ? 600 : 400, fontSize: '0.95rem', textAlign: 'left', borderLeft: active ? '3px solid #818cf8' : '3px solid transparent' }),
  content:  { padding: '16px' },
  card:     { background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '16px', marginBottom: '12px' },
  cardTitle:{ color: '#fff', fontWeight: 700, fontSize: '0.95rem', marginBottom: '12px' },
  row:      { padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' },
  rowTitle: { color: '#e2e8f0', fontWeight: 600, fontSize: '0.88rem' },
  rowSub:   { color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem', marginTop: '2px' },
  badge:    (c) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 700, textTransform: 'capitalize', background: c + '22', color: c }),
  bottomBar:{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '390px', background: '#0d0d0d', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '12px 16px', zIndex: 30, display: 'flex', flexDirection: 'column', gap: '8px' },
  joinBtn:  (live) => ({ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: live ? '#22c55e' : 'rgba(255,255,255,0.1)', color: live ? '#fff' : 'rgba(255,255,255,0.6)' }),
  demoBtn:  { width: '100%', padding: '10px', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.2)', cursor: 'pointer', fontWeight: 600, fontSize: '0.82rem', background: 'transparent', color: 'rgba(255,255,255,0.4)' },
};

const statusColor = { scheduled: '#818cf8', active: '#22c55e', completed: '#64748b', cancelled: '#ef4444' };

const StudentDashboard = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen]   = useState(false);
  const [sessions, setSessions]   = useState([]);
  const [homework, setHomework]   = useState([]);
  const [liveData, setLiveData]   = useState(null);
  const [now, setNow]             = useState(new Date());

  useEffect(() => {
    axios.get('/api/sessions').then(r => setSessions(r.data)).catch(() => {});
    axios.get('/api/homework').then(r => setHomework(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const check = () => axios.get('/api/sessions/my/live').then(r => setLiveData(r.data)).catch(() => {});
    check();
    const t = setInterval(check, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const isLive = liveData?.session != null && new Date(liveData.session.scheduled_end) > now;
  const validNext = liveData?.next && new Date(liveData.next.scheduled_end) > now ? liveData.next : null;

  const countdown = (() => {
    if (isLive || !validNext) return null;
    const diff = new Date(validNext.scheduled_start) - now - 15 * 60 * 1000;
    if (diff <= 0) {
      const d2 = new Date(validNext.scheduled_start) - now;
      if (d2 <= 0) return null;
      const m = Math.floor(d2 / 60000), sc = Math.floor((d2 % 60000) / 1000);
      return `starts in ${m}m ${String(sc).padStart(2,'0')}s`;
    }
    const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `opens in ${h}h ${m}m` : `opens in ${m}m`;
  })();

  const handleJoin = async () => {
    let fresh = liveData;
    try { const r = await axios.get('/api/sessions/my/live'); fresh = r.data; setLiveData(fresh); } catch {}
    if (!fresh?.session) {
      const next = fresh?.next && new Date(fresh.next.scheduled_end) > new Date() ? fresh.next : null;
      if (next) {
        const diff = new Date(next.scheduled_start) - new Date();
        const m = Math.floor(diff / 60000);
        toast(`⏰ "${next.title}" starts in ${m > 0 ? m + 'm' : 'now'}`, { style: { background: '#1e1b4b', color: '#fff' } });
      } else {
        toast('📅 No upcoming sessions.', { style: { background: '#1e1b4b', color: '#fff' } });
      }
      return;
    }
    try {
      const { data } = await axios.get(`/api/sessions/classroom/join/${fresh.session.id}`);
      window.open(data.url, '_blank');
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg) toast.error(msg);
      else window.open(`${CLASSROOM_URL}/student.html?room=${fresh.session.room_name || fresh.session.id}&name=${encodeURIComponent(user?.full_name || 'Student')}`, '_blank');
    }
  };

  const handleDemo = () => window.open(`${CLASSROOM_URL}/student.html?room=demo&name=${encodeURIComponent(user?.full_name || 'Student')}`, '_blank');

  const navigate = (id) => { setActiveTab(id); setMenuOpen(false); };
  const tabLabel = links.find(l => l.id === activeTab)?.label || 'Overview';

  return (
    <>
      <div style={s.topBar}>
        <p style={s.title}>{tabLabel}</p>
        <button style={s.hamburger} onClick={() => setMenuOpen(true)} aria-label="Menu">
          <span style={s.bar} /><span style={s.bar} /><span style={s.bar} />
        </button>
      </div>

      {menuOpen && (
        <>
          <div style={s.overlay} onClick={() => setMenuOpen(false)} />
          <div style={s.drawer}>
            <div style={s.drawerTop}>
              <div>
                <p style={s.drawerName}>👨🎓 {user?.full_name || 'Student'}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>{user?.email}</p>
              </div>
              <button style={s.closeBtn} onClick={() => setMenuOpen(false)}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', paddingTop: '8px' }}>
              {links.map(l => (
                <button key={l.id} style={s.navBtn(activeTab === l.id)} onClick={() => navigate(l.id)}>
                  <span>{l.icon}</span><span>{l.label.split(' ').slice(1).join(' ')}</span>
                </button>
              ))}
            </div>
            <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
              <button onClick={logout} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.08)', color: '#ef4444', cursor: 'pointer', fontWeight: 600, fontSize: '0.88rem' }}>
                🚪 Logout
              </button>
            </div>
          </div>
        </>
      )}

      <div style={s.screen}>
        <div style={s.content}>

          {activeTab === 'overview' && (
            <>
              <div style={s.card}>
                <p style={s.cardTitle}>📅 Upcoming Sessions</p>
                {sessions.filter(x => x.status === 'scheduled').length === 0
                  ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>No upcoming sessions.</p>
                  : sessions.filter(x => x.status === 'scheduled').slice(0, 5).map(x => (
                    <div key={x.id} style={s.row}>
                      <p style={s.rowTitle}>{x.title}</p>
                      <p style={s.rowSub}>{new Date(x.scheduled_start).toLocaleString()}</p>
                    </div>
                  ))
                }
                <button onClick={() => navigate('sessions')} style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                  View All
                </button>
              </div>
              <div style={s.card}>
                <p style={s.cardTitle}>📝 Pending Homework</p>
                {homework.filter(h => h.status === 'active').length === 0
                  ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>No pending homework.</p>
                  : homework.filter(h => h.status === 'active').slice(0, 5).map(h => (
                    <div key={h.id} style={s.row}>
                      <p style={s.rowTitle}>{h.title}</p>
                      <p style={s.rowSub}>Due: {new Date(h.due_date).toLocaleDateString()}</p>
                    </div>
                  ))
                }
                <button onClick={() => navigate('homework')} style={{ marginTop: '12px', padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#4f46e5', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600 }}>
                  View
                </button>
              </div>
            </>
          )}

          {activeTab === 'sessions' && (
            <div style={s.card}>
              <p style={s.cardTitle}>📅 My Sessions ({sessions.length})</p>
              {sessions.length === 0
                ? <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.85rem' }}>No sessions yet.</p>
                : sessions.map(x => (
                  <div key={x.id} style={s.row}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p style={s.rowTitle}>{x.title}</p>
                      <span style={s.badge(statusColor[x.status] || '#64748b')}>{x.status}</span>
                    </div>
                    <p style={s.rowSub}>{new Date(x.scheduled_start).toLocaleString()}</p>
                  </div>
                ))
              }
            </div>
          )}

          {activeTab === 'live'     && <LiveClassViewer />}
          {activeTab === 'homework' && <HomeworkViewer homework={homework} />}
          {activeTab === 'videos'   && <VideoLibrary />}
          {activeTab === 'leave'    && <LeaveRequest sessions={sessions} />}
        </div>
      </div>

      <div style={s.bottomBar}>
        <button style={s.joinBtn(isLive)} onClick={handleJoin}>
          {isLive && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 2px rgba(255,255,255,0.4)', animation: 'pulse 1.5s infinite', display: 'inline-block' }} />}
          {isLive ? `🎧 Join Class — ${liveData.session.title}` : '🎓 Join Class'}
        </button>
        {!isLive && validNext && countdown && (
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem', textAlign: 'center' }}>
            {validNext.title} — {countdown}
          </p>
        )}
        <button style={s.demoBtn} onClick={handleDemo}>🧪 Demo Room</button>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
        @keyframes pulse {
          0%,100% { box-shadow: 0 0 0 2px rgba(255,255,255,0.4); }
          50%      { box-shadow: 0 0 0 5px rgba(255,255,255,0.1); }
        }
      `}</style>
    </>
  );
};

export default StudentDashboard;
