import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import UserManagement from './UserManagement';
import ScheduleManager from './ScheduleManager';
import AnalyticsDashboard from './AnalyticsDashboard';
import ReportsExport from './ReportsExport';
import RoleManagement from './RoleManagement';
import SessionModeration from './SessionModeration';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_LABELS, canAccessTab, hasPermission } from '../../utils/permissions';

const StatCard = ({ label, value, color }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.6)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '20px',
    padding: '20px 24px',
    border: '1px solid rgba(255, 255, 255, 0.5)',
    boxShadow: '0 8px 32px rgba(155, 89, 182, 0.08)',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease',
    cursor: 'default',
  }}>
    <p style={{ color: '#8b8b9a', fontSize: '13px', fontWeight: 500, marginBottom: '8px', letterSpacing: '0.3px' }}>{label}</p>
    <p style={{ fontSize: '28px', fontWeight: 700, color, margin: 0, letterSpacing: '-0.5px' }}>{value}</p>
  </div>
);

const LeaveManagement = () => {
  const [requests, setRequests] = useState([]);
  const load = () => axios.get('/api/leave').then(r => setRequests(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const handle = async (id, status) => {
    try { await axios.put(`/api/leave/${id}/status`, { status }); toast.success(`Leave ${status}`); load(); }
    catch { toast.error('Error'); }
  };

  const statusColor = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.55)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: '24px',
      padding: '28px',
      border: '1px solid rgba(255, 255, 255, 0.6)',
      boxShadow: '0 8px 32px rgba(155, 89, 182, 0.06)',
    }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#2d2d3a', marginBottom: '20px', letterSpacing: '-0.3px' }}>Leave Requests ({requests.length})</h2>
      {requests.length === 0 && <p style={{ color: '#9ca3af', fontSize: '14px' }}>No leave requests.</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Role', 'Date', 'Time', 'Reason', 'Status', 'Actions'].map(h => (
                <th key={h} style={{
                  padding: '14px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#6b7280',
                  borderBottom: '2px solid rgba(233, 213, 255, 0.5)',
                  fontSize: '13px',
                  letterSpacing: '0.3px',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id} style={{ transition: 'background 0.2s' }}>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(233, 213, 255, 0.3)', fontSize: '14px', color: '#4b5563' }}>
                  <span style={{ textTransform: 'capitalize' }}>{r.user_role}</span>
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(233, 213, 255, 0.3)', fontSize: '14px', color: '#4b5563' }}>{r.leave_date}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(233, 213, 255, 0.3)', fontSize: '14px', color: '#4b5563' }}>{r.start_time} – {r.end_time}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(233, 213, 255, 0.3)', fontSize: '14px', color: '#4b5563' }}>{r.reason || '—'}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(233, 213, 255, 0.3)', fontSize: '14px' }}>
                  <span style={{ color: statusColor[r.status], fontWeight: 600, textTransform: 'capitalize' }}>{r.status}</span>
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(233, 213, 255, 0.3)', fontSize: '14px' }}>
                  {r.status === 'pending' && <>
                    <button onClick={() => handle(r.id, 'approved')} style={{
                      marginRight: '8px',
                      padding: '6px 14px',
                      border: '1.5px solid #10b981',
                      color: '#10b981',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: 'rgba(16, 185, 129, 0.08)',
                      fontSize: '12px',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}>Approve</button>
                    <button onClick={() => handle(r.id, 'rejected')} style={{
                      padding: '6px 14px',
                      border: '1.5px solid #ef4444',
                      color: '#ef4444',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: 'rgba(239, 68, 68, 0.08)',
                      fontSize: '12px',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}>Reject</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SessionsView = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [joining, setJoining] = useState(null);
  const CLASSROOM_URL = import.meta.env.VITE_CLASSROOM_URL || 'https://online-teaching-platform-1-j4f0.onrender.com';

  useEffect(() => {
    axios.get('/api/sessions').then(r => setSessions(r.data)).catch(() => {});
    const t = setInterval(() => axios.get('/api/sessions').then(r => setSessions(r.data)).catch(() => {}), 30000);
    return () => clearInterval(t);
  }, []);

  const supervise = async (sessionId, roomName) => {
    setJoining(sessionId);
    try {
      const { data } = await axios.get(`/api/sessions/classroom/join/${sessionId}`);
      window.open(data.url, '_blank');
    } catch {
      const name = encodeURIComponent(user?.full_name || user?.username || ROLE_LABELS[user?.role] || 'Observer');
      window.open(`${CLASSROOM_URL}/moderator.html?room=${encodeURIComponent(roomName || sessionId)}&name=${name}&role=${encodeURIComponent(user?.role || 'moderator')}`, '_blank');
    } finally {
      setJoining(null);
    }
  };

  const isSuperviseble = (s) => {
    if (s.status === 'cancelled' || s.status === 'completed') return false;
    if (s.status === 'active') return true;
    const now = new Date();
    return s.status === 'scheduled'
      && new Date(s.scheduled_start) <= now
      && new Date(s.scheduled_end) > now;
  };

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.status === filter);
  const statusColor = { scheduled: '#8b5cf6', active: '#10b981', completed: '#9ca3af', cancelled: '#ef4444', replaced: '#f59e0b' };

  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.55)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: '24px',
      padding: '28px',
      border: '1px solid rgba(255, 255, 255, 0.6)',
      boxShadow: '0 8px 32px rgba(155, 89, 182, 0.06)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#2d2d3a', letterSpacing: '-0.3px' }}>All Sessions ({filtered.length})</h2>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {['all','scheduled','active','completed','cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{
              padding: '6px 16px',
              borderRadius: '12px',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              background: filter === s ? 'linear-gradient(135deg, #c084fc, #a855f7)' : 'rgba(255, 255, 255, 0.5)',
              color: filter === s ? '#fff' : '#6b7280',
              textTransform: 'capitalize',
              transition: 'all 0.2s',
              boxShadow: filter === s ? '0 4px 15px rgba(168, 85, 247, 0.3)' : 'none',
            }}>{s}</button>
          ))}
        </div>
      </div>
      {filtered.length === 0 && <p style={{ color: '#9ca3af', fontSize: '14px' }}>No sessions found.</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Title', 'Subject', 'Start', 'End', 'Status', 'Action'].map(h => (
                <th key={h} style={{
                  padding: '14px 16px',
                  textAlign: 'left',
                  fontWeight: 600,
                  color: '#6b7280',
                  borderBottom: '2px solid rgba(233, 213, 255, 0.5)',
                  fontSize: '13px',
                  letterSpacing: '0.3px',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} style={{ transition: 'background 0.2s' }}>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(233, 213, 255, 0.3)', fontSize: '14px', color: '#4b5563', verticalAlign: 'middle' }}>{s.title}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(233, 213, 255, 0.3)', fontSize: '14px', color: '#4b5563', verticalAlign: 'middle' }}>{s.subject || '—'}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(233, 213, 255, 0.3)', fontSize: '14px', color: '#4b5563', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{new Date(s.scheduled_start).toLocaleString()}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(233, 213, 255, 0.3)', fontSize: '14px', color: '#4b5563', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{new Date(s.scheduled_end).toLocaleString()}</td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(233, 213, 255, 0.3)', fontSize: '14px', verticalAlign: 'middle' }}>
                  <span style={{ color: statusColor[s.status], fontWeight: 600, textTransform: 'capitalize' }}>{s.status}</span>
                </td>
                <td style={{ padding: '14px 16px', borderBottom: '1px solid rgba(233, 213, 255, 0.3)', fontSize: '14px', verticalAlign: 'middle' }}>
                  {isSuperviseble(s) && (
                    <button
                      onClick={() => supervise(s.id, s.room_name)}
                      disabled={joining === s.id}
                      style={{
                        padding: '6px 16px',
                        background: 'linear-gradient(135deg, #c084fc, #a855f7)',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 600,
                        opacity: joining === s.id ? 0.6 : 1,
                        boxShadow: '0 4px 15px rgba(168, 85, 247, 0.3)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {joining === s.id ? '...' : '👁️ Supervise'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AdminDashboard = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({ totalStudents: 0, totalTeachers: 0, activeSessions: 0, pendingLeave: 0, completionRate: 0, engagementScore: 0 });
  const [recentActivities, setRecentActivities] = useState([]);
  const [showActivities, setShowActivities] = useState(false);
  const roleLabel = ROLE_LABELS[user?.role] || 'Admin';

  useEffect(() => {
    axios.get('/api/analytics/admin/stats').then(r => setStats(r.data)).catch(() => {});
    if (hasPermission(user?.role, 'users.view')) {
      axios.get('/api/analytics/admin/recent-activities').then(r => setRecentActivities(r.data)).catch(() => {});
    }
  }, [user?.role]);

  useEffect(() => {
    if (!canAccessTab(user?.role, activeTab)) {
      setActiveTab('overview');
    }
  }, [activeTab, setActiveTab, user?.role]);

  const quickActions = [
    { label: 'Create Schedule', tab: 'schedule', permission: 'schedule.manage' },
    { label: 'Manage Users', tab: 'users', permission: 'users.view' },
    { label: 'Role Management', tab: 'roles', permission: 'sub_admins.view' },
    { label: 'Monitor Sessions', tab: 'moderation', permission: 'sessions.monitor_live' },
    { label: 'View Reports', tab: 'reports', permission: 'reports.view' },
    { label: 'Analytics', tab: 'analytics', permission: 'analytics.view' }
  ].filter(action => hasPermission(user?.role, action.permission));

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 50%, #fbcfe8 100%)',
      padding: '32px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: '#2d2d3a', marginBottom: '6px', letterSpacing: '-0.5px' }}>{roleLabel} Dashboard</h1>
        <p style={{ color: '#6b7280', fontSize: '15px', fontWeight: 400 }}>
          {user?.role === 'supervisor'
            ? 'Read-only oversight with live session monitoring'
            : 'Manage operations, users, schedules, and reporting'}
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '20px',
        marginBottom: '32px',
      }}>
        <StatCard label="Total Students" value={stats.totalStudents} color="#a855f7" />
        <StatCard label="Total Teachers" value={stats.totalTeachers} color="#a855f7" />
        <StatCard label="Active Sessions" value={stats.activeSessions} color="#10b981" />
        <StatCard label="Pending Leave" value={stats.pendingLeave} color="#f59e0b" />
        <StatCard label="Completion Rate" value={`${stats.completionRate}%`} color="#3b82f6" />
        <StatCard label="Engagement" value={`${stats.engagementScore}%`} color="#8b5cf6" />
      </div>

      {activeTab === 'overview' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '24px',
        }}>
          <div style={{
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '28px',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            boxShadow: '0 8px 32px rgba(155, 89, 182, 0.06)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#2d2d3a', letterSpacing: '-0.3px' }}>Recent Activities</h2>
              <button
                onClick={() => setShowActivities(!showActivities)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '12px',
                  border: '1px solid rgba(139, 92, 246, 0.2)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  background: showActivities ? 'linear-gradient(135deg, #c084fc, #a855f7)' : 'rgba(255, 255, 255, 0.5)',
                  color: showActivities ? '#fff' : '#7c3aed',
                  transition: 'all 0.2s',
                  boxShadow: showActivities ? '0 4px 15px rgba(168, 85, 247, 0.3)' : 'none',
                }}
              >
                {showActivities ? 'Hide Activities' : `View Activities (${recentActivities.length})`}
              </button>
            </div>
            {showActivities && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentActivities.length === 0 && <p style={{ color: '#9ca3af', fontSize: '14px' }}>No recent activity.</p>}
                {recentActivities.map((a, i) => (
                  <div key={i} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '16px',
                    background: 'rgba(255, 255, 255, 0.4)',
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 255, 255, 0.5)',
                    transition: 'transform 0.2s',
                  }}>
                    <div style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #c084fc, #a855f7)',
                      flexShrink: 0,
                      boxShadow: '0 0 8px rgba(168, 85, 247, 0.4)',
                    }}></div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '14px', color: '#374151', margin: 0, fontWeight: 500 }}>{a.description}</p>
                      <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0 0' }}>{a.time ? new Date(a.time).toLocaleString() : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.55)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderRadius: '24px',
            padding: '28px',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            boxShadow: '0 8px 32px rgba(155, 89, 182, 0.06)',
          }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#2d2d3a', marginBottom: '20px', letterSpacing: '-0.3px' }}>Quick Actions</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '14px',
            }}>
              {quickActions.map(action => (
                <button key={action.tab} onClick={() => setActiveTab(action.tab)} style={{
                  padding: '14px 20px',
                  borderRadius: '16px',
                  border: '1px solid rgba(139, 92, 246, 0.15)',
                  background: 'linear-gradient(135deg, rgba(192, 132, 252, 0.1), rgba(168, 85, 247, 0.05))',
                  color: '#7c3aed',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 4px 15px rgba(139, 92, 246, 0.08)',
                }}>
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users'     && canAccessTab(user?.role, 'users') && <UserManagement />}
      {activeTab === 'roles'     && canAccessTab(user?.role, 'roles') && <RoleManagement />}
      {activeTab === 'sessions'  && canAccessTab(user?.role, 'sessions') && <SessionsView />}
      {activeTab === 'moderation' && canAccessTab(user?.role, 'moderation') && <SessionModeration />}
      {activeTab === 'schedule'  && canAccessTab(user?.role, 'schedule') && <ScheduleManager />}
      {activeTab === 'leave'     && canAccessTab(user?.role, 'leave') && <LeaveManagement />}
      {activeTab === 'analytics' && canAccessTab(user?.role, 'analytics') && <AnalyticsDashboard />}
      {activeTab === 'reports'   && canAccessTab(user?.role, 'reports') && <ReportsExport />}
    </div>
  );
};

export default AdminDashboard;