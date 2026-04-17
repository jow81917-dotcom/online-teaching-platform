import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Bar = ({ label, value, max, color }) => (
  <div style={{ marginBottom: '0.75rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.85rem' }}>
      <span style={{ textTransform: 'capitalize' }}>{label}</span><span style={{ fontWeight: 600 }}>{value}</span>
    </div>
    <div style={{ background: 'var(--gray-100)', borderRadius: '9999px', height: '8px' }}>
      <div style={{ width: `${max ? (value / max) * 100 : 0}%`, background: color || 'var(--primary)', height: '8px', borderRadius: '9999px', transition: 'width 0.5s' }} />
    </div>
  </div>
);

const AnalyticsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [leave, setLeave] = useState([]);

  useEffect(() => {
    axios.get('/api/analytics/admin/stats').then(r => setStats(r.data)).catch(() => {});
    axios.get('/api/sessions').then(r => setSessions(r.data)).catch(() => {});
    axios.get('/api/users').then(r => setUsers(r.data)).catch(() => {});
    axios.get('/api/leave').then(r => setLeave(r.data)).catch(() => {});
  }, []);

  const sessionByStatus = sessions.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});
  const userByRole = users.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {});
  const leaveByStatus = leave.reduce((acc, l) => { acc[l.status] = (acc[l.status] || 0) + 1; return acc; }, {});
  const maxSessions = Math.max(...Object.values(sessionByStatus), 1);
  const maxUsers = Math.max(...Object.values(userByRole), 1);

  const statBox = (label, value, color) => (
    <div className="card p-4" style={{ textAlign: 'center' }}>
      <p style={{ fontSize: '2rem', fontWeight: 700, color }}>{value ?? '—'}</p>
      <p className="text-gray-500 text-sm">{label}</p>
    </div>
  );

  return (
    <div>
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          {statBox('Students', stats.totalStudents, 'var(--primary)')}
          {statBox('Teachers', stats.totalTeachers, 'var(--primary)')}
          {statBox('Active Sessions', stats.activeSessions, 'var(--green-500)')}
          {statBox('Pending Leave', stats.pendingLeave, 'var(--yellow-500)')}
          {statBox('Total Sessions', sessions.length, 'var(--blue-500)')}
          {statBox('Total Users', users.length, 'var(--purple-500)')}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Sessions by Status</h2>
          {Object.entries(sessionByStatus).map(([k, v]) => <Bar key={k} label={k} value={v} max={maxSessions} color="var(--primary)" />)}
          {!sessions.length && <p className="text-gray-500 text-sm">No session data.</p>}
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Users by Role</h2>
          {Object.entries(userByRole).map(([k, v]) => <Bar key={k} label={k} value={v} max={maxUsers} color="var(--purple-500)" />)}
          {!users.length && <p className="text-gray-500 text-sm">No user data.</p>}
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Leave Requests by Status</h2>
          {Object.entries(leaveByStatus).map(([k, v]) => <Bar key={k} label={k} value={v} max={Math.max(...Object.values(leaveByStatus), 1)} color="var(--yellow-500)" />)}
          {!leave.length && <p className="text-gray-500 text-sm">No leave data.</p>}
        </div>

        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
          {sessions.slice(0, 8).map(s => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--gray-100)', fontSize: '0.88rem' }}>
              <span>{s.title}</span>
              <span style={{ textTransform: 'capitalize', color: 'var(--gray-500)' }}>{s.status}</span>
            </div>
          ))}
          {!sessions.length && <p className="text-gray-500 text-sm">No sessions yet.</p>}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
