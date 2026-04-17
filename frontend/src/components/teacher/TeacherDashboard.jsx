import React, { useState, useEffect } from 'react';
import axios from 'axios';
import HomeworkCreator from './HomeworkCreator';
import SubmissionsReview from './SubmissionsReview';
import LeaveRequest from './LeaveRequest';

const TeacherDashboard = ({ activeTab, setActiveTab }) => {
  const [sessions, setSessions] = useState([]);
  const [homework, setHomework] = useState([]);

  useEffect(() => {
    axios.get('/api/sessions').then(r => setSessions(r.data)).catch(() => {});
    axios.get('/api/homework').then(r => setHomework(r.data)).catch(() => {});
  }, []);

  const statusColor = { scheduled: 'var(--primary)', active: 'var(--green-500)', completed: 'var(--gray-500)', cancelled: 'var(--red-500)' };
  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)', fontSize: '0.85rem' };
  const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.88rem' };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Teacher Dashboard</h1>
        <p className="text-gray-600">Manage your sessions, homework and leave</p>
      </div>

      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Upcoming Sessions ({sessions.filter(s => s.status === 'scheduled').length})</h2>
            {sessions.filter(s => s.status === 'scheduled').length === 0 && <p className="text-gray-500 text-sm">No upcoming sessions.</p>}
            {sessions.filter(s => s.status === 'scheduled').slice(0, 5).map(s => (
              <div key={s.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--gray-100)' }}>
                <p style={{ fontWeight: 600 }}>{s.title}</p>
                <p className="text-sm text-gray-500">{new Date(s.scheduled_start).toLocaleString()}</p>
              </div>
            ))}
            <button className="btn-primary" style={{ marginTop: '1rem', fontSize: '0.85rem' }} onClick={() => setActiveTab('sessions')}>View All Sessions</button>
          </div>
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Active Homework ({homework.filter(h => h.status === 'active').length})</h2>
            {homework.filter(h => h.status === 'active').length === 0 && <p className="text-gray-500 text-sm">No active homework.</p>}
            {homework.filter(h => h.status === 'active').slice(0, 5).map(h => (
              <div key={h.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--gray-100)' }}>
                <p style={{ fontWeight: 600 }}>{h.title}</p>
                <p className="text-sm text-gray-500">Due: {new Date(h.due_date).toLocaleDateString()}</p>
              </div>
            ))}
            <button className="btn-primary" style={{ marginTop: '1rem', fontSize: '0.85rem' }} onClick={() => setActiveTab('homework')}>Manage Homework</button>
          </div>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="card p-6">
          <h2 className="text-xl font-semibold mb-4">My Sessions ({sessions.length})</h2>
          {sessions.length === 0 && <p className="text-gray-500 text-sm">No sessions yet.</p>}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Title</th><th style={th}>Subject</th><th style={th}>Start</th><th style={th}>End</th><th style={th}>Status</th></tr></thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td style={td}>{s.title}</td>
                    <td style={td}>{s.subject || '—'}</td>
                    <td style={td}>{new Date(s.scheduled_start).toLocaleString()}</td>
                    <td style={td}>{new Date(s.scheduled_end).toLocaleString()}</td>
                    <td style={td}><span style={{ color: statusColor[s.status] || 'var(--gray-500)', fontWeight: 600, textTransform: 'capitalize' }}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'homework'    && <HomeworkCreator sessions={sessions} onCreated={() => axios.get('/api/homework').then(r => setHomework(r.data))} />}
      {activeTab === 'submissions' && <SubmissionsReview homework={homework} />}
      {activeTab === 'leave'       && <LeaveRequest sessions={sessions} />}
    </div>
  );
};

export default TeacherDashboard;
