import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { ROLE_LABELS, hasPermission } from '../../utils/permissions';

const C = {
  blue: '#2563eb',
  blueBg: '#eff6ff',
  green: '#059669',
  greenBg: '#ecfdf5',
  red: '#dc2626',
  redBg: '#fef2f2',
  amber: '#d97706',
  amberBg: '#fffbeb',
  purple: '#7c3aed',
  purpleBg: '#f5f3ff',
  gray: '#6b7280',
  grayBg: '#f9fafb',
  border: '#e5e7eb',
  text: '#111827',
  sub: '#6b7280',
  light: '#f8fafc'
};

const ROLE_CONFIG = {
  manager: {
    color: C.purple,
    bg: C.purpleBg,
    label: 'Manager',
    summary: 'Operational management without admin-account control'
  },
  supervisor: {
    color: C.blue,
    bg: C.blueBg,
    label: 'Supervisor',
    summary: 'Read-only oversight plus live session monitoring'
  }
};

const FALLBACK_PERMISSIONS = {
  manager: [
    { permission_name: 'users.view', permission_description: 'View teachers and students', category: 'users' },
    { permission_name: 'users.create', permission_description: 'Create teacher and student accounts', category: 'users' },
    { permission_name: 'sessions.view_all', permission_description: 'View all sessions', category: 'sessions' },
    { permission_name: 'schedule.manage', permission_description: 'Create and update schedules', category: 'schedule' },
    { permission_name: 'reports.export', permission_description: 'Export operational reports', category: 'reports' }
  ],
  supervisor: [
    { permission_name: 'sessions.view_all', permission_description: 'View all sessions', category: 'sessions' },
    { permission_name: 'sessions.monitor_live', permission_description: 'Monitor live classes', category: 'sessions' },
    { permission_name: 'sessions.join_any', permission_description: 'Join sessions as an observer', category: 'sessions' },
    { permission_name: 'analytics.view', permission_description: 'View analytics dashboards', category: 'analytics' },
    { permission_name: 'reports.view', permission_description: 'View reports without export access', category: 'reports' }
  ]
};

const emptyForm = {
  username: '',
  email: '',
  password: '',
  role: 'manager',
  full_name: ''
};

const Btn = ({ color = C.blue, outline, small, disabled, type = 'button', onClick, children, style = {} }) => (
  <button
    type={type}
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: small ? '5px 10px' : '8px 14px',
      fontSize: small ? '.75rem' : '.875rem',
      fontWeight: 700,
      borderRadius: 8,
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: `1px solid ${color}`,
      background: outline ? '#fff' : color,
      color: outline ? color : '#fff',
      opacity: disabled ? 0.6 : 1,
      whiteSpace: 'nowrap',
      ...style
    }}
  >
    {children}
  </button>
);

const Tag = ({ color, bg, children }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 10px',
    borderRadius: 9999,
    fontSize: '.75rem',
    fontWeight: 700,
    color,
    background: bg,
    border: `1px solid ${color}30`
  }}>
    {children}
  </span>
);

const Field = ({ label, error, children }) => (
  <label style={{ display: 'block' }}>
    <span style={{ display: 'block', marginBottom: 4, fontSize: '.78rem', fontWeight: 700, color: C.sub }}>
      {label}
    </span>
    {children}
    {error && <span style={{ display: 'block', marginTop: 4, color: C.red, fontSize: '.72rem' }}>{error}</span>}
  </label>
);

const inputStyle = (hasError) => ({
  width: '100%',
  padding: '8px 10px',
  border: `1.5px solid ${hasError ? C.red : C.border}`,
  borderRadius: 8,
  fontSize: '.875rem',
  outline: 'none'
});

const Modal = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 70,
      background: 'rgba(15,23,42,.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 10,
        padding: '1.25rem',
        maxWidth: 560,
        width: '100%',
        maxHeight: '86vh',
        overflow: 'auto',
        boxShadow: '0 20px 45px rgba(15,23,42,.2)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: C.text }}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: C.grayBg, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer', padding: '4px 9px', color: C.sub }}
          >
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

const validateForm = (form, mode) => {
  const errors = {};
  if (!form.full_name.trim()) errors.full_name = 'Full name is required';
  if (!form.username.trim()) errors.username = 'Username is required';
  if (!form.email.trim()) errors.email = 'Email is required';
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Enter a valid email';
  if (!['manager', 'supervisor'].includes(form.role)) errors.role = 'Choose manager or supervisor';
  if (mode === 'create' && form.password.length < 8) errors.password = 'Password must be at least 8 characters';
  return errors;
};

const isActive = (account) => account.is_active === true || account.is_active === 1;

const RoleManagement = () => {
  const { user } = useAuth();
  const [subAdmins, setSubAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modalMode, setModalMode] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [permissions, setPermissions] = useState([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);

  const canManageSubAdmins = hasPermission(user?.role, 'sub_admins.create');

  const loadSubAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/users/sub-admins');
      setSubAdmins(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load role accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManageSubAdmins) loadSubAdmins();
  }, [canManageSubAdmins, loadSubAdmins]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return subAdmins.filter(account => {
      const matchesSearch = !q
        || account.username?.toLowerCase().includes(q)
        || account.email?.toLowerCase().includes(q)
        || account.full_name?.toLowerCase().includes(q);
      const matchesRole = !filterRole || account.role === filterRole;
      const matchesStatus = !filterStatus
        || (filterStatus === 'active' && isActive(account))
        || (filterStatus === 'inactive' && !isActive(account));
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [filterRole, filterStatus, search, subAdmins]);

  if (!canManageSubAdmins) {
    return (
      <div className="card p-6" style={{ textAlign: 'center' }}>
        <h2 style={{ color: C.red, marginBottom: '.5rem' }}>Access Denied</h2>
        <p style={{ color: C.sub }}>Only admins can manage manager and supervisor accounts.</p>
      </div>
    );
  }

  const openCreateModal = () => {
    setSelectedUser(null);
    setErrors({});
    setForm(emptyForm);
    setModalMode('create');
  };

  const openEditModal = (account) => {
    setSelectedUser(account);
    setErrors({});
    setForm({
      username: account.username || '',
      email: account.email || '',
      password: '',
      role: account.role,
      full_name: account.full_name || ''
    });
    setModalMode('edit');
  };

  const submitForm = async (event) => {
    event.preventDefault();
    const nextErrors = validateForm(form, modalMode);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      if (modalMode === 'create') {
        await axios.post('/api/users/sub-admins', form);
        toast.success(`${ROLE_LABELS[form.role]} account created`);
      } else {
        await axios.put(`/api/users/${selectedUser.id}`, {
          username: form.username,
          email: form.email,
          full_name: form.full_name,
          role: form.role
        });
        toast.success('Account updated');
      }
      setModalMode(null);
      await loadSubAdmins();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to save account');
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (account) => {
    try {
      await axios.put(`/api/users/${account.id}`, { is_active: isActive(account) ? 0 : 1 });
      toast.success(isActive(account) ? 'Account deactivated' : 'Account activated');
      await loadSubAdmins();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update account status');
    }
  };

  const resetPassword = async (account) => {
    const confirmed = window.confirm(`Reset password for ${account.full_name || account.username}?`);
    if (!confirmed) return;

    try {
      const { data } = await axios.post(`/api/users/${account.id}/reset-password`);
      toast.success(`Temporary password: ${data.newPassword}`, { duration: 10000 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to reset password');
    }
  };

  const openPermissionsModal = async (account) => {
    setSelectedUser(account);
    setPermissions(FALLBACK_PERMISSIONS[account.role] || []);
    setModalMode('permissions');
    setPermissionsLoading(true);
    try {
      const { data } = await axios.get(`/api/users/roles/${account.role}/permissions`);
      setPermissions(Array.isArray(data) && data.length ? data : FALLBACK_PERMISSIONS[account.role] || []);
    } catch {
      setPermissions(FALLBACK_PERMISSIONS[account.role] || []);
    } finally {
      setPermissionsLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui,-apple-system,sans-serif', color: C.text }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.7rem', fontWeight: 800, marginBottom: '.25rem' }}>Role Management</h1>
          <p style={{ color: C.sub, fontSize: '.875rem' }}>
            Manage manager and supervisor accounts with admin-only controls.
          </p>
        </div>
        <Btn onClick={openCreateModal}>Add Sub-Admin</Btn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        {Object.entries(ROLE_CONFIG).map(([role, config]) => {
          const total = subAdmins.filter(account => account.role === role).length;
          const active = subAdmins.filter(account => account.role === role && isActive(account)).length;
          return (
            <button
              key={role}
              type="button"
              onClick={() => setFilterRole(filterRole === role ? '' : role)}
              className="card p-4"
              style={{
                textAlign: 'left',
                border: `2px solid ${filterRole === role ? config.color : 'transparent'}`,
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: config.color }}>{total}</div>
                  <div style={{ fontSize: '.9rem', fontWeight: 800 }}>{config.label}s</div>
                </div>
                <Tag color={active ? C.green : C.gray} bg={active ? C.greenBg : C.grayBg}>{active} active</Tag>
              </div>
              <p style={{ marginTop: '.6rem', fontSize: '.78rem', color: C.sub }}>{config.summary}</p>
            </button>
          );
        })}
      </div>

      <div className="card p-4" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="search"
            placeholder="Search by name, username, or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            style={{ ...inputStyle(false), flex: '1 1 260px' }}
          />
          <select value={filterRole} onChange={(event) => setFilterRole(event.target.value)} style={{ ...inputStyle(false), width: 'auto' }}>
            <option value="">All roles</option>
            <option value="manager">Manager</option>
            <option value="supervisor">Supervisor</option>
          </select>
          <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} style={{ ...inputStyle(false), width: 'auto' }}>
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: C.sub }}>Loading role accounts...</div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: C.sub }}>No manager or supervisor accounts found.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
              <thead>
                <tr style={{ background: C.light }}>
                  {['Name', 'Email', 'Role', 'Status', 'Created Date', 'Actions'].map(header => (
                    <th key={header} style={{
                      padding: '.85rem 1rem',
                      textAlign: 'left',
                      fontSize: '.72rem',
                      fontWeight: 800,
                      color: C.sub,
                      borderBottom: `2px solid ${C.border}`,
                      textTransform: 'uppercase'
                    }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(account => {
                  const config = ROLE_CONFIG[account.role] || ROLE_CONFIG.manager;
                  const displayName = account.full_name || account.username;
                  return (
                    <tr key={account.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
                          <div style={{
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            background: config.color,
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 900
                          }}>
                            {displayName?.charAt(0)?.toUpperCase() || 'U'}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '.9rem' }}>{displayName}</div>
                            <div style={{ color: C.sub, fontSize: '.75rem' }}>@{account.username}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '1rem', fontSize: '.875rem' }}>{account.email}</td>
                      <td style={{ padding: '1rem' }}>
                        <Tag color={config.color} bg={config.bg}>{config.label}</Tag>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <Tag color={isActive(account) ? C.green : C.red} bg={isActive(account) ? C.greenBg : C.redBg}>
                          {isActive(account) ? 'Active' : 'Inactive'}
                        </Tag>
                      </td>
                      <td style={{ padding: '1rem', color: C.sub, fontSize: '.875rem', whiteSpace: 'nowrap' }}>
                        {account.created_at ? new Date(account.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ display: 'flex', gap: '.45rem', flexWrap: 'wrap' }}>
                          <Btn small outline color={C.blue} onClick={() => openEditModal(account)}>Edit</Btn>
                          <Btn small outline color={isActive(account) ? C.red : C.green} onClick={() => toggleUserStatus(account)}>
                            {isActive(account) ? 'Deactivate' : 'Activate'}
                          </Btn>
                          <Btn small outline color={C.amber} onClick={() => resetPassword(account)}>Reset</Btn>
                          <Btn small outline color={C.purple} onClick={() => openPermissionsModal(account)}>Permissions</Btn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        isOpen={modalMode === 'create' || modalMode === 'edit'}
        onClose={() => setModalMode(null)}
        title={modalMode === 'create' ? 'Create Sub-Admin' : 'Edit Sub-Admin'}
      >
        <form onSubmit={submitForm}>
          <div style={{ display: 'grid', gap: '.9rem' }}>
            <Field label="Full Name" error={errors.full_name}>
              <input value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} style={inputStyle(errors.full_name)} />
            </Field>
            <Field label="Username" error={errors.username}>
              <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} style={inputStyle(errors.username)} />
            </Field>
            <Field label="Email" error={errors.email}>
              <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} style={inputStyle(errors.email)} />
            </Field>
            {modalMode === 'create' && (
              <Field label="Password" error={errors.password}>
                <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} style={inputStyle(errors.password)} />
              </Field>
            )}
            <Field label="Role" error={errors.role}>
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} style={inputStyle(errors.role)}>
                <option value="manager">Manager</option>
                <option value="supervisor">Supervisor</option>
              </select>
            </Field>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <Btn type="submit" disabled={saving}>{saving ? 'Saving...' : modalMode === 'create' ? 'Create Account' : 'Save Changes'}</Btn>
            <Btn outline color={C.gray} onClick={() => setModalMode(null)}>Cancel</Btn>
          </div>
        </form>
      </Modal>

      <Modal isOpen={modalMode === 'permissions'} onClose={() => setModalMode(null)} title="Role Permissions">
        {selectedUser && (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <Tag color={ROLE_CONFIG[selectedUser.role].color} bg={ROLE_CONFIG[selectedUser.role].bg}>
                {ROLE_CONFIG[selectedUser.role].label}
              </Tag>
              <p style={{ color: C.sub, marginTop: '.65rem', fontSize: '.85rem' }}>
                {ROLE_CONFIG[selectedUser.role].summary}
              </p>
            </div>
            {permissionsLoading ? (
              <p style={{ color: C.sub }}>Loading permissions...</p>
            ) : (
              <div style={{ display: 'grid', gap: '.5rem' }}>
                {permissions.map(permission => (
                  <div key={permission.permission_name} style={{
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    padding: '.7rem .8rem',
                    background: C.light
                  }}>
                    <div style={{ fontWeight: 800, fontSize: '.86rem' }}>{permission.permission_name}</div>
                    <div style={{ color: C.sub, fontSize: '.78rem', marginTop: 2 }}>
                      {permission.permission_description || permission.category}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default RoleManagement;
