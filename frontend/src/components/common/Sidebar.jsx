import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';

const adminLinks  = [
  { label: 'Overview',    id: 'overview'  },
  { label: 'Users',       id: 'users'     },
  { label: 'Sessions',    id: 'sessions'  },
  { label: 'Schedule',    id: 'schedule'  },
  { label: 'Analytics',   id: 'analytics' },
  { label: 'Reports',     id: 'reports'   },
  { label: 'Leave',       id: 'leave'     },
];
const teacherLinks = [
  { label: 'Overview',    id: 'overview'    },
  { label: 'Live Class',  id: 'live'        },
  { label: 'Sessions',    id: 'sessions'    },
  { label: 'Homework',    id: 'homework'    },
  { label: 'Submissions', id: 'submissions' },
  { label: 'Leave',       id: 'leave'       },
];
const studentLinks = [
  { label: 'Overview',   id: 'overview'  },
  { label: 'Live Class', id: 'live'      },
  { label: 'Sessions',   id: 'sessions'  },
  { label: 'Homework',   id: 'homework'  },
  { label: 'Videos',     id: 'videos'    },
  { label: 'Leave',      id: 'leave'     },
];

const Sidebar = ({ active, setActive }) => {
  const { user } = useAuth();
  const [liveData, setLiveData] = useState(null);
  const [now, setNow] = useState(new Date());
  const showJoin = user?.role === 'teacher' || user?.role === 'student';
  const links = user?.role === 'admin' ? adminLinks : user?.role === 'teacher' ? teacherLinks : studentLinks;

  useEffect(() => {
    if (!showJoin) return;
    const check = () => {
      axios.get('/api/sessions/my/live')
        .then(r => setLiveData(r.data))
        .catch(() => {});
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [showJoin]);

  // Tick every second for live countdown
  useEffect(() => {
    if (!showJoin) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [showJoin]);

  const AUDIO_RELAY = import.meta.env.VITE_CLASSROOM_URL || 'http://localhost:3000';
  const page = user?.role === 'teacher' ? 'teacher.html' : 'student.html';

  const handleJoinClass = async () => {
    // Always fetch fresh live data before joining to avoid stale session IDs
    let fresh = liveData;
    try {
      const r = await axios.get('/api/sessions/my/live');
      fresh = r.data;
      setLiveData(fresh);
    } catch { /* use existing liveData */ }

    if (!fresh?.session) {
      // Use validNext: ignore any next session whose end has already passed
      const nextSession = fresh?.next && new Date(fresh.next.scheduled_end) > new Date()
        ? fresh.next : null;

      if (nextSession) {
        const start     = new Date(nextSession.scheduled_start);
        const diffMs    = start - new Date();
        const totalSecs = Math.floor(diffMs / 1000);
        const hrs  = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        let timeStr;
        if (hrs > 0)       timeStr = `${hrs}h ${mins}m`;
        else if (mins > 0) timeStr = `${mins} minute${mins !== 1 ? 's' : ''}`;
        else if (secs > 0) timeStr = `${secs} second${secs !== 1 ? 's' : ''}`;
        else               timeStr = 'now';
        toast(`⏰ Next class "${nextSession.title}" starts in ${timeStr}`, {
          duration: 5000,
          style: { background: '#1e1b4b', color: '#fff', borderRadius: '10px' }
        });
      } else {
        toast('📅 No upcoming sessions scheduled.', {
          duration: 4000,
          style: { background: '#1e1b4b', color: '#fff', borderRadius: '10px' }
        });
      }
      return;
    }

    try {
      const { data } = await axios.get(`/api/sessions/classroom/join/${fresh.session.id}`);
      window.open(data.url, '_blank');
    } catch (err) {
      const msg = err.response?.data?.message;
      if (msg) {
        toast.error(msg, { style: { background: '#1e1b4b', color: '#fff' } });
      } else {
        const room = fresh.session.room_name || fresh.session.id;
        const name = encodeURIComponent(user?.full_name || user?.role || 'User');
        window.open(`${AUDIO_RELAY}/${page}?room=${encodeURIComponent(room)}&name=${name}`, '_blank');
      }
    }
  };

  // A session is only considered live if its end time hasn't passed yet
  const isLive = liveData?.session != null && new Date(liveData.session.scheduled_end) > now;

  const JOIN_WINDOW_MS = 15 * 60 * 1000;

  // Ignore next session if its end time has already passed (stale liveData)
  const validNext = liveData?.next && new Date(liveData.next.scheduled_end) > now
    ? liveData.next : null;

  const nextOpenCountdown = (() => {
    if (isLive || !validNext) return null;
    const start      = new Date(validNext.scheduled_start);
    const opensAt    = new Date(start.getTime() - JOIN_WINDOW_MS);
    const diffToOpen  = opensAt - now;
    const diffToStart = start - now;

    if (diffToOpen > 0) {
      const s = Math.floor(diffToOpen / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      if (h > 0) return `opens in ${h}h ${m}m`;
      return `opens in ${m}m ${String(s % 60).padStart(2,'0')}s`;
    }
    if (diffToStart > 0) {
      const s = Math.floor(diffToStart / 1000);
      const m = Math.floor(s / 60);
      return `starts in ${m}m ${String(s % 60).padStart(2,'0')}s`;
    }
    return null;
  })();

  const handleDemo = () => {
    const name = encodeURIComponent(user?.full_name || user?.role || 'User');
    window.open(`${AUDIO_RELAY}/${page}?room=demo&name=${name}`, '_blank');
  };

  return (
    <aside style={{ width: '220px', background: '#1e1b4b', minHeight: '100%', padding: '1.5rem 0', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1 }}>
        {links.map(link => (
          <button
            key={link.id}
            onClick={() => setActive(link.id)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '0.75rem 1.5rem', border: 'none', cursor: 'pointer',
              background: active === link.id ? 'rgba(255,255,255,0.15)' : 'transparent',
              color: active === link.id ? '#fff' : 'rgba(255,255,255,0.65)',
              fontWeight: active === link.id ? 600 : 400,
              fontSize: '0.95rem',
              borderLeft: active === link.id ? '3px solid #818cf8' : '3px solid transparent'
            }}
          >
            {link.label}
          </button>
        ))}
      </div>

      {showJoin && (
        <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <button
            onClick={handleJoinClass}
            style={{
              width: '100%',
              padding: '0.65rem 0',
              borderRadius: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '0.9rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
              background: isLive ? '#22c55e' : 'rgba(255,255,255,0.12)',
              color: isLive ? '#fff' : 'rgba(255,255,255,0.7)',
              transition: 'background 0.2s',
              position: 'relative'
            }}
          >
            {isLive && (
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#fff', display: 'inline-block',
                boxShadow: '0 0 0 2px rgba(255,255,255,0.4)',
                animation: 'pulse 1.5s infinite'
              }} />
            )}
            {isLive ? 'Join Class Now' : '🎓 Join Class'}
          </button>
          {isLive && (
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.72rem', textAlign: 'center', marginTop: '0.4rem' }}>
              {liveData.session.title}
            </p>
          )}
          {!isLive && validNext && nextOpenCountdown && (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', textAlign: 'center', marginTop: '0.4rem' }}>
              {validNext.title} — {nextOpenCountdown}
            </p>
          )}
          <button
            onClick={handleDemo}
            style={{
              width: '100%',
              marginTop: '0.5rem',
              padding: '0.5rem 0',
              borderRadius: '0.5rem',
              border: '1px dashed rgba(255,255,255,0.25)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.8rem',
              background: 'transparent',
              color: 'rgba(255,255,255,0.45)',
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.target.style.background = 'rgba(255,255,255,0.08)'; e.target.style.color = 'rgba(255,255,255,0.8)'; }}
            onMouseOut={e => { e.target.style.background = 'transparent'; e.target.style.color = 'rgba(255,255,255,0.45)'; }}
          >
            🧪 Demo Room
          </button>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(255,255,255,0.4); }
          50%       { box-shadow: 0 0 0 5px rgba(255,255,255,0.1); }
        }
      `}</style>
    </aside>
  );
};

export default Sidebar;
