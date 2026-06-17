import React, { useEffect, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import UserManagement from '../admin/UserManagement';
import ScheduleManager from '../admin/ScheduleManager';
import AnalyticsDashboard from '../admin/AnalyticsDashboard';
import ReportsExport from '../admin/ReportsExport';

const StatCard = ({ label, value, color, icon }) => (
  <div className="card p-4" style={{ textAlign: 'center' }}>
    <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
    <p className="text-gray-500 text-sm">{label}</p>
    <p className="text-2xl font-bold" style={{ color }}>{value}</p>
  </div>
);

const SessionsOverview = () => {
  const [sessions, setSessions] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    axios.get('/api/sessions').then(r => setSessions(r.data)).catch(() => {});
    const interval = setInterval(() => {
      axios.get('/api/sessions').then(r => setSessions(r.data)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = filter === 'all' ? sessions : sessions.filter(s => s.status === filter);
  const statusColor = { 
    scheduled: 'var(--primary)', 
    active: 'var(--green-500)', 
    completed: 'var(--gray-500)', 
    cancelled: 'var(--red-500)' 
  };

  const th = { 
    padding: '0.75rem', 
    textAlign: 'left', 
    fontWeight: 600, 
    color: 'var(--gray-700)', 
    borderBottom: '2px solid var(--gray-200)', 
    fontSize: '0.875rem' 
  };
  
  const td = { 
    padding: '0.75rem', 
    borderBottom: '1px solid var(--gray-100)', 
    fontSize: '0.875rem' 
  };

  return (
    <div className="card p-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="text-xl font-semibold">Sessions Overview ({filtered.length})</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['all', 'scheduled', 'active', 'completed', 'cancelled'].map(status => (
            <button 
              key={status}
              onClick={() => setFilter(status)}
              style={{
                padding: '4px 12px',
                borderRadius: '20px',
                border: '1px solid var(--gray-300)',
                background: filter === status ? 'var(--primary)' : '#fff',
                color: filter === status ? '#fff' : 'var(--gray-700)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: 600,
                textTransform: 'capitalize'
              }}
            >
              {status}
            </button>
          ))}
        </div>
      </div>
      
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-sm">No sessions found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={th}>Title</th>
                <th style={th}>Teacher</th>
                <th style={th}>Student</th>
                <th style={th}>Date & Time</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 10).map(session => (
                <tr key={session.id}>
                  <td style={td}>{session.title}</td>
                  <td style={td}>{session.teacher_name || '—'}</td>
                  <td style={td}>{session.student_name || '—'}</td>
                  <td style={{ ...td, whiteSpace: 'nowrap' }}>
                    {new Date(session.scheduled_start).toLocaleString()}
                  </td>
                  <td style={td}>
                    <span style={{ 
                      color: statusColor[session.status], 
                      fontWeight: 600, 
                      textTransform: 'capitalize' 
                    }}>
                      {session.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const QuickActions = ({ setActiveTab }) => (
  <div className="card p-6">
    <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <button 
        className="btn-primary text-left p-4"
        onClick={() => setActiveTab('users')}
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
      >
        <span style={{ fontSize: '1.5rem' }}>👥</span>
        <div>
          <div style={{ fontWeight: 600 }}>Manage Users</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Teachers & Students</div>
        </div>
      </button>
      
      <button 
        className="btn-primary text-left p-4"
        onClick={() => setActiveTab('schedule')}
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
      >
        <span style={{ fontSize: '1.5rem' }}>📅</span>
        <div>
          <div style={{ fontWeight: 600 }}>Schedule Sessions</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Create & Manage</div>
        </div>
      </button>
      
      <button 
        className="btn-primary text-left p-4"
        onClick={() => setActiveTab('reports')}
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
      >
        <span style={{ fontSize: '1.5rem' }}>📊</span>
        <div>
          <div style={{ fontWeight: 600 }}>View Reports</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Analytics & Export</div>
        </div>
      </button>
      
      <button 
        className="btn-primary text-left p-4"
        onClick={() => setActiveTab('analytics')}
        style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
      >
        <span style={{ fontSize: '1.5rem' }}>📈</span>
        <div>
          <div style={{ fontWeight: 600 }}>Analytics</div>
          <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>Performance Metrics</div>
        </div>
      </button>
    </div>
  </div>
);

const ManagerDashboard = ({ activeTab, setActiveTab }) => {
  const [stats, setStats] = useState({
    totalTeachers: 0,
    totalStudents: 0,
    activeSessions: 0,
    totalSessions: 0,
    completionRate: 0
  });

  useEffect(() => {
    axios.get('/api/analytics/manager/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Manager Dashboard</h1>
        <p className="text-gray-600">Comprehensive management and oversight</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard 
          label="Teachers" 
          value={stats.totalTeachers} 
          color="var(--blue-500)" 
          icon="👨🏫" 
        />
        <StatCard 
          label="Students" 
          value={stats.totalStudents} 
          color="var(--green-500)" 
          icon="🎓" 
        />
        <StatCard 
          label="Active Sessions" 
          value={stats.activeSessions} 
          color="var(--amber-500)" 
          icon="📹" 
        />
        <StatCard 
          label="Total Sessions" 
          value={stats.totalSessions} 
          color="var(--purple-500)" 
          icon="📊" 
        />
        <StatCard 
          label="Completion Rate" 
          value={`${stats.completionRate}%`} 
          color="var(--primary)" 
          icon="✅" 
        />
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SessionsOverview />
          <QuickActions setActiveTab={setActiveTab} />
        </div>
      )}

      {activeTab === 'users' && <UserManagement />}
      {activeTab === 'schedule' && <ScheduleManager />}
      {activeTab === 'analytics' && <AnalyticsDashboard />}
      {activeTab === 'reports' && <ReportsExport />}
    </div>
  );
};

export default ManagerDashboard;