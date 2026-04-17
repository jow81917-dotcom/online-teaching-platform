import React, { useState, useEffect } from 'react';
import axios from 'axios';

const ReportsExport = () => {
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [homework, setHomework] = useState([]);
  const [leave, setLeave] = useState([]);

  useEffect(() => {
    axios.get('/api/sessions').then(r => setSessions(r.data)).catch(() => {});
    axios.get('/api/users').then(r => setUsers(r.data)).catch(() => {});
    axios.get('/api/homework').then(r => setHomework(r.data)).catch(() => {});
    axios.get('/api/leave').then(r => setLeave(r.data)).catch(() => {});
  }, []);

  const downloadCSV = (data, filename, cols) => {
    const header = cols.join(',');
    const rows = data.map(row => cols.map(c => `"${(row[c] ?? '').toString().replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)', fontSize: '0.85rem' };
  const td = { padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.85rem' };

  const Section = ({ title, count, onExport, children }) => (
    <div className="card p-6 mb-6">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 className="text-xl font-semibold">{title} ({count})</h2>
        <button onClick={onExport} style={{ padding: '4px 14px', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: '6px', cursor: 'pointer', background: '#fff', fontSize: '0.85rem' }}>⬇ Export CSV</button>
      </div>
      <div style={{ overflowX: 'auto' }}>{children}</div>
    </div>
  );

  return (
    <div>
      <Section title="Sessions" count={sessions.length} onExport={() => downloadCSV(sessions, 'sessions.csv', ['title','subject','status','scheduled_start','scheduled_end'])}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Title</th><th style={th}>Subject</th><th style={th}>Status</th><th style={th}>Start</th><th style={th}>End</th></tr></thead>
          <tbody>{sessions.slice(0,10).map(s => (
            <tr key={s.id}><td style={td}>{s.title}</td><td style={td}>{s.subject||'—'}</td>
              <td style={td}><span style={{ textTransform:'capitalize' }}>{s.status}</span></td>
              <td style={td}>{new Date(s.scheduled_start).toLocaleString()}</td>
              <td style={td}>{new Date(s.scheduled_end).toLocaleString()}</td></tr>
          ))}</tbody>
        </table>
        {sessions.length > 10 && <p className="text-gray-500 text-sm" style={{marginTop:'0.5rem'}}>Showing 10 of {sessions.length}. Export CSV for full data.</p>}
      </Section>

      <Section title="Users" count={users.length} onExport={() => downloadCSV(users, 'users.csv', ['full_name','email','role','is_active','created_at'])}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Role</th><th style={th}>Status</th></tr></thead>
          <tbody>{users.slice(0,10).map(u => (
            <tr key={u.id}><td style={td}>{u.full_name}</td><td style={td}>{u.email}</td>
              <td style={td} style={{textTransform:'capitalize'}}>{u.role}</td>
              <td style={td}><span style={{color: u.is_active ? 'var(--green-500)':'var(--red-500)'}}>{u.is_active?'Active':'Inactive'}</span></td></tr>
          ))}</tbody>
        </table>
      </Section>

      <Section title="Homework" count={homework.length} onExport={() => downloadCSV(homework, 'homework.csv', ['title','status','due_date','max_score'])}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Title</th><th style={th}>Status</th><th style={th}>Due Date</th><th style={th}>Max Score</th></tr></thead>
          <tbody>{homework.slice(0,10).map(h => (
            <tr key={h.id}><td style={td}>{h.title}</td><td style={td} style={{textTransform:'capitalize'}}>{h.status}</td>
              <td style={td}>{new Date(h.due_date).toLocaleDateString()}</td><td style={td}>{h.max_score}</td></tr>
          ))}</tbody>
        </table>
      </Section>

      <Section title="Leave Requests" count={leave.length} onExport={() => downloadCSV(leave, 'leave.csv', ['user_role','leave_date','status','reason'])}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Role</th><th style={th}>Date</th><th style={th}>Status</th><th style={th}>Reason</th></tr></thead>
          <tbody>{leave.slice(0,10).map(l => (
            <tr key={l.id}><td style={td} style={{textTransform:'capitalize'}}>{l.user_role}</td>
              <td style={td}>{l.leave_date}</td><td style={td} style={{textTransform:'capitalize'}}>{l.status}</td>
              <td style={td}>{l.reason||'—'}</td></tr>
          ))}</tbody>
        </table>
      </Section>
    </div>
  );
};

export default ReportsExport;
