import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import AdminDashboard from '../components/admin/AdminDashboard';
import TeacherDashboard from '../components/teacher/TeacherDashboard';
import StudentDashboard from '../components/student/StudentDashboard';

const adminDefault = 'overview';
const teacherDefault = 'overview';
const studentDefault = 'overview';

const Dashboard = () => {
  const { user } = useAuth();
  const defaultTab = user?.role === 'admin' ? adminDefault : user?.role === 'teacher' ? teacherDefault : studentDefault;
  const [active, setActive] = useState(defaultTab);

  const renderContent = () => {
    if (user?.role === 'admin')   return <AdminDashboard activeTab={active} setActiveTab={setActive} />;
    if (user?.role === 'teacher') return <TeacherDashboard activeTab={active} setActiveTab={setActive} />;
    return <StudentDashboard activeTab={active} setActiveTab={setActive} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header />
      <div style={{ display: 'flex', flex: 1 }}>
        <Sidebar active={active} setActive={setActive} />
        <main style={{ flex: 1, padding: '1.5rem', background: 'var(--gray-50)', overflowY: 'auto' }}>
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
