import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import UserManagement from './UserManagement';
import ScheduleManager from './ScheduleManager';
import AnalyticsDashboard from './AnalyticsDashboard';
import ReportsExport from './ReportsExport';

const StatCard = ({ label, value, color }) => (
  <div className="card p-4">
    <p className="text-gray-500 text-sm">{label}</p>
    <p className="text-2xl font-bold" style={{ color }}>{value}</p>
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

  const statusColor = { pending: 'var(--yellow-500)', approved: 'var(--green-500)', rejected: 'var(--red-500)' };
  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)', fontSize: '0.85rem' };
  const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.88rem' };

  return (
    <div className="card p-6">
      <h2 className="text-xl font-semibold mb-4">Leave Requests ({requests.length})</h2>
      {requests.length === 0 && <p className="text-gray-500 text-sm">No leave requests.</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Role</th><th style={th}>Date</th><th style={th}>Time</th><th style={th}>Reason</th><th style={th}>Status</th><th style={th}>Actions</th></tr></thead>
          <tbody>
            {requests.map(r => (
              <tr key={r.id}>
                <td style={td}><span style={{ textTransform: 'capitalize' }}>{r.user_role}</span></td>
                <td style={td}>{r.leave_date}</td>
                <td style={td}>{r.start_time} – {r.end_time}</td>
                <td style={td}>{r.reason || '—'}</td>
                <td style={td}><span style={{ color: statusColor[r.status], fontWeight: 600, textTransform: 'capitalize' }}>{r.status}</span></td>
                <td style={td}>
                  {r.status === 'pending' && <>
                    <button onClick={() => handle(r.id, 'approved')} style={{ marginRight: '0.4rem', padding: '2px 10px', border: '1px solid var(--green-500)', color: 'var(--green-500)', borderRadius: '4px', cursor: 'pointer', background: '#fff', fontSize: '0.8rem' }}>Approve</button>
                    <button onClick={() => handle(r.id, 'rejected')} style={{ padding: '2px 10px', border: '1px solid var(--red-500)', color: 'var(--red-500)', borderRadius: '4px', cursor: 'pointer', background: '#fff', fontSize: '0.8rem' }}>Reject</button>
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
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState('all');
  useEffect(() => { axios.get('/api/sessions').then(r => setSessions(r.data)).catch(() => {}); }, []);

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.status === filter);
  const statusColor = { scheduled: 'var(--primary)', active: 'var(--green-500)', completed: 'var(--gray-500)', cancelled: 'var(--red-500)', replaced: 'var(--yellow-500)' };
  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)', fontSize: '0.85rem' };
  const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.88rem' };

  return (
    <div className="card p-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="text-xl font-semibold">All Sessions ({filtered.length})</h2>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['all','scheduled','active','completed','cancelled'].map(s => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: '3px 10px', borderRadius: '9999px', border: '1px solid var(--gray-300)', cursor: 'pointer', fontSize: '0.8rem', background: filter === s ? 'var(--primary)' : '#fff', color: filter === s ? '#fff' : 'var(--gray-700)', textTransform: 'capitalize' }}>{s}</button>
          ))}
        </div>
      </div>
      {filtered.length === 0 && <p className="text-gray-500 text-sm">No sessions found.</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Title</th><th style={th}>Subject</th><th style={th}>Start</th><th style={th}>End</th><th style={th}>Status</th></tr></thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id}>
                <td style={td}>{s.title}</td>
                <td style={td}>{s.subject || '—'}</td>
                <td style={td}>{new Date(s.scheduled_start).toLocaleString()}</td>
                <td style={td}>{new Date(s.scheduled_end).toLocaleString()}</td>
                <td style={td}><span style={{ color: statusColor[s.status], fontWeight: 600, textTransform: 'capitalize' }}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const AdminDashboard = ({ activeTab, setActiveTab }) => {
  const [stats, setStats] = useState({ totalStudents: 0, totalTeachers: 0, activeSessions: 0, pendingLeave: 0, completionRate: 0, engagementScore: 0 });
  const [recentActivities, setRecentActivities] = useState([]);

  useEffect(() => {
    axios.get('/api/analytics/admin/stats').then(r => setStats(r.data)).catch(() => {});
    axios.get('/api/analytics/admin/recent-activities').then(r => setRecentActivities(r.data)).catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-gray-600">Complete control over your school ecosystem</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <StatCard label="Total Students"  value={stats.totalStudents}         color="var(--primary)" />
        <StatCard label="Total Teachers"  value={stats.totalTeachers}         color="var(--primary)" />
        <StatCard label="Active Sessions" value={stats.activeSessions}        color="var(--green-500)" />
        <StatCard label="Pending Leave"   value={stats.pendingLeave}          color="var(--yellow-500)" />
        <StatCard label="Completion Rate" value={`${stats.completionRate}%`}  color="var(--blue-500)" />
        <StatCard label="Engagement"      value={`${stats.engagementScore}%`} color="var(--purple-500)" />
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Activities</h2>
            <div className="space-y-3">
              {recentActivities.length === 0 && <p className="text-gray-500 text-sm">No recent activity.</p>}
              {recentActivities.map((a, i) => (
                <div key={i} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                  <div className="activity-dot"></div>
                  <div className="flex-1">
                    <p className="text-sm">{a.description}</p>
                    <p className="text-xs text-gray-500">{a.time ? new Date(a.time).toLocaleString() : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-4">
              <button className="btn-primary" onClick={() => setActiveTab('schedule')}>Create Schedule</button>
              <button className="btn-primary" onClick={() => setActiveTab('users')}>Manage Users</button>
              <button className="btn-primary" onClick={() => setActiveTab('reports')}>View Reports</button>
              <button className="btn-primary" onClick={() => setActiveTab('analytics')}>Analytics</button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users'     && <UserManagement />}
      {activeTab === 'sessions'  && <SessionsView />}
      {activeTab === 'schedule'  && <ScheduleManager />}
      {activeTab === 'leave'     && <LeaveManagement />}
      {activeTab === 'analytics' && <AnalyticsDashboard />}
      {activeTab === 'reports'   && <ReportsExport />}
    </div>
  );
};

export default AdminDashboard;
