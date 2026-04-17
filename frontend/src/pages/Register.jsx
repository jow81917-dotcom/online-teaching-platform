import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';

const Register = () => {
  const [form, setForm] = useState({ full_name: '', email: '', password: '', role: 'student' });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/auth/register', form);
      toast.success('Account created! Please login.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-login-gradient flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Create Account</h1>
          <p className="text-gray-600 mt-2">Join the school management system</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-700 mb-2">Full Name</label>
            <input className="input-field" required value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})} placeholder="John Doe" />
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Email</label>
            <input className="input-field" type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="you@school.com" />
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Password</label>
            <input className="input-field" type="password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-gray-700 mb-2">Role</label>
            <select className="input-field" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Creating...' : 'Create Account'}</button>
        </form>
        <p className="text-center text-gray-600 mt-6">Already have an account? <Link to="/login" style={{ color: 'var(--primary)' }}>Login</Link></p>
      </div>
    </div>
  );
};

export default Register;
