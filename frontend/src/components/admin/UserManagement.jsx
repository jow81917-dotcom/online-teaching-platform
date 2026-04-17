import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const EMPTY = { full_name: '', email: '', password: '', role: 'student' };

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState('');

  const load = () => axios.get('/api/users').then(r => setUsers(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await axios.put(`/api/users/${editing}`, { full_name: form.full_name });
        toast.success('User updated');
      } else {
        await axios.post('/api/auth/register', form);
        toast.success('User created');
      }
      setForm(EMPTY); setEditing(null); setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const toggleActive = async (u) => {
    await axios.put(`/api/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
    toast.success(u.is_active ? 'User deactivated' : 'User activated');
    load();
  };

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(filter.toLowerCase()) ||
    u.email.toLowerCase().includes(filter.toLowerCase()) ||
    u.role.includes(filter.toLowerCase())
  );

  const th = { padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: 600, color: 'var(--gray-700)', borderBottom: '2px solid var(--gray-200)' };
  const td = { padding: '0.6rem 0.75rem', borderBottom: '1px solid var(--gray-100)', fontSize: '0.9rem' };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <input placeholder="Search users..." value={filter} onChange={e => setFilter(e.target.value)}
          style={{ padding: '0.4rem 0.75rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem', width: '220px' }} />
        <button className="btn-primary" onClick={() => { setForm(EMPTY); setEditing(null); setShowForm(true); }}>+ Add User</button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">{editing ? 'Edit User' : 'New User'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-2">Full Name</label>
                <input className="input-field" required value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
              </div>
              {!editing && <>
                <div>
                  <label className="block text-gray-700 mb-2">Email</label>
                  <input className="input-field" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Password</label>
                  <input className="input-field" type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                </div>
                <div>
                  <label className="block text-gray-700 mb-2">Role</label>
                  <select className="input-field" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </>}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button type="submit" className="btn-primary">{editing ? 'Update' : 'Create'}</button>
              <button type="button" onClick={() => setShowForm(false)}
                style={{ padding: '0.5rem 1rem', border: '1px solid var(--gray-300)', borderRadius: '0.5rem', cursor: 'pointer', background: '#fff' }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">All Users ({filtered.length})</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Role</th><th style={th}>Status</th><th style={th}>Actions</th></tr></thead>
          <tbody>
            {filtered.map(u => (
              <tr key={u.id}>
                <td style={td}>{u.full_name}</td>
                <td style={td}>{u.email}</td>
                <td style={td}><span style={{ textTransform: 'capitalize', background: 'var(--gray-100)', padding: '2px 8px', borderRadius: '9999px', fontSize: '0.8rem' }}>{u.role}</span></td>
                <td style={td}><span style={{ color: u.is_active ? 'var(--green-500)' : 'var(--red-500)', fontWeight: 600 }}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td style={td}>
                  <button onClick={() => { setForm({ full_name: u.full_name, email: u.email, password: '', role: u.role }); setEditing(u.id); setShowForm(true); }}
                    style={{ marginRight: '0.5rem', padding: '2px 10px', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: '4px', cursor: 'pointer', background: '#fff', fontSize: '0.8rem' }}>Edit</button>
                  <button onClick={() => toggleActive(u)}
                    style={{ padding: '2px 10px', border: `1px solid ${u.is_active ? 'var(--red-500)' : 'var(--green-500)'}`, color: u.is_active ? 'var(--red-500)' : 'var(--green-500)', borderRadius: '4px', cursor: 'pointer', background: '#fff', fontSize: '0.8rem' }}>
                    {u.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement;
