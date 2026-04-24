import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import AdminDashboard from '../components/admin/AdminDashboard';
import TeacherDashboard from '../components/teacher/TeacherDashboard';
import StudentDashboard from '../components/student/StudentDashboard';

const Dashboard = () => {
  const { user } = useAuth();
  const defaultTab = user?.role === 'admin' ? 'overview' : 'overview';
  const [active, setActive] = useState(defaultTab);

  // Admin keeps the full desktop layout
  if (user?.role === 'admin') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <div style={{ display: 'flex', flex: 1 }}>
          <Sidebar active={active} setActive={setActive} />
          <main style={{ flex: 1, padding: '1.5rem', background: 'var(--gray-50)', overflowY: 'auto' }}>
            <AdminDashboard activeTab={active} setActiveTab={setActive} />
          </main>
        </div>
      </div>
    );
  }

  // Teacher and Student get the phone-shell layout
  return (
    <div style={{
      width: '100%', minHeight: '100vh',
      background: '#111',
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      fontFamily: "'Outfit', 'Segoe UI', sans-serif"
    }}>
      <div style={{
        width: '100%', maxWidth: '390px',
        minHeight: '100vh',
        background: '#0d0d0d',
        position: 'relative',
        boxShadow: '0 0 80px rgba(0,0,0,0.9)',
        display: 'flex', flexDirection: 'column'
      }}>
        {user?.role === 'teacher'
          ? <TeacherDashboard activeTab={active} setActiveTab={setActive} />
          : <StudentDashboard activeTab={active} setActiveTab={setActive} />
        }
      </div>
    </div>
  );
};

export default Dashboard;
