import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

const Header = () => {
  const { user, logout } = useAuth();
  return (
    <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 1.5rem', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '1.1rem' }}>School Management</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ color: 'var(--gray-700)' }}>{user?.full_name}</span>
        <span style={{ background: 'var(--primary)', color: '#fff', padding: '2px 10px', borderRadius: '9999px', fontSize: '0.75rem', textTransform: 'capitalize' }}>{user?.role}</span>
        <button onClick={logout} style={{ border: '1px solid var(--gray-300)', background: '#fff', padding: '4px 12px', borderRadius: '6px', cursor: 'pointer' }}>Logout</button>
      </div>
    </header>
  );
};

export default Header;
