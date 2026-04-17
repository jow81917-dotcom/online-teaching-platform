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
  { label: 'Sessions',    id: 'sessions'    },
  { label: 'Homework',    id: 'homework'    },
  { label: 'Submissions', id: 'submissions' },
  { label: 'Leave',       id: 'leave'       },
];
const studentLinks = [
  { label: 'Overview',  id: 'overview'  },
  { label: 'Sessions',  id: 'sessions'  },
  { label: 'Homework',  id: 'homework'  },
  { label: 'Videos',    id: 'videos'    },
  { label: 'Leave',     id: 'leave'     },
];

const Sidebar = ({ active, setActive }) => {
  const { user } = useAuth();
  const [liveData, setLiveData] = useState(null);
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
    const interval = setInterval(check, 60000); // re-check every minute
    return () => clearInterval(interval);
  }, [showJoin]);

  const AUDIO_RELAY = 'http://localhost:3000';
  const page = user?.role === 'teacher' ? 'teacher.html' : 'student.html';

  const handleJoinClass = () => {
    if (!liveData) return;

    if (liveData.session) {
      const room = liveData.session.room_name || liveData.session.id;
      window.open(`${AUDIO_RELAY}/${page}?room=${encodeURIComponent(room)}`, '_blank');
      return;
    }

    if (liveData.next) {
      const start = new Date(liveData.next.scheduled_start);
      const now = new Date();
      const diffMs = start - now;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHrs = Math.floor(diffMins / 60);
      const remMins = diffMins % 60;

      let timeStr = '';
      if (diffHrs > 0) timeStr = `${diffHrs}h ${remMins}m`;
      else timeStr = `${diffMins} minute${diffMins !== 1 ? 's' : ''}`;

      toast(`⏰ Next class "${liveData.next.title}" starts in ${timeStr}`, {
        duration: 5000,
        style: { background: '#1e1b4b', color: '#fff', borderRadius: '10px' }
      });
      return;
    }

    toast('📅 No upcoming sessions scheduled.', {
      duration: 4000,
      style: { background: '#1e1b4b', color: '#fff', borderRadius: '10px' }
    });
  };

  const isLive = liveData?.session != null;

  const handleDemo = () => {
    window.open(`${AUDIO_RELAY}/${page}?room=test`, '_blank');
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
