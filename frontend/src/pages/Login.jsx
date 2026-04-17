// frontend/src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await login(email, password);
    if (result.success) navigate('/dashboard');
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-login-gradient flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">School Management</h1>
          <p className="text-gray-600 mt-2">Welcome back! Please login to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 mb-2">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="admin@school.com"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        {/* Add New User button — opens Register in a new tab */}
        <div style={{ marginTop: '1rem', textAlign: 'center' }}>
          <button
            onClick={() => window.open('/register', '_blank')}
            style={{
              width: '100%',
              padding: '0.5rem 1rem',
              border: '2px solid var(--primary)',
              borderRadius: '0.5rem',
              background: 'transparent',
              color: 'var(--primary)',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'background 0.2s, color 0.2s'
            }}
            onMouseOver={e => { e.target.style.background = 'var(--primary)'; e.target.style.color = '#fff'; }}
            onMouseOut={e => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--primary)'; }}
          >
            + Add New User
          </button>
        </div>

        <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--gray-50)', borderRadius: '0.5rem', fontSize: '0.85rem', color: 'var(--gray-600)' }}>
          <strong>Default Admin Account:</strong><br />
          Email: admin@school.com<br />
          Password: password
        </div>

      </div>
    </div>
  );
};

export default Login;
