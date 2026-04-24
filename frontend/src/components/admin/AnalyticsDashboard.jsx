import React, { useState, useEffect } from 'react';

// Circular Progress Component
const CircularProgress = ({ label, value, total, color, icon }) => {
  const percentage = (value / total) * 100;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      padding: '1rem',
      background: 'white',
      borderRadius: '28px',
      border: '1px solid #ecf0f5',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 12px 20px -12px rgba(0,0,0,0.1)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
      <div style={{ position: 'relative', width: '120px', height: '120px', margin: '0.5rem 0' }}>
        <svg style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke="#eef2f8"
            strokeWidth="8"
          />
          <circle
            cx="60"
            cy="60"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>{value}</div>
          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>out of {total}</div>
        </div>
      </div>
      <div style={{ fontWeight: 700, marginTop: '0.5rem', color: '#1e293b' }}>{label}</div>
      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>{percentage.toFixed(1)}%</div>
    </div>
  );
};

// Simple Bar Component
const Bar = ({ label, value, max, gradient, suffix = '' }) => (
  <div style={{ marginBottom: '1.2rem' }}>
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      marginBottom: '6px', 
      fontSize: '0.8rem',
      fontWeight: 600,
      color: '#1e293b'
    }}>
      <span style={{ textTransform: 'capitalize' }}>{label}</span>
      <span style={{ 
        fontWeight: 700,
        background: gradient,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent'
      }}>{value}{suffix}</span>
    </div>
    <div style={{ 
      background: '#eef2f8', 
      borderRadius: '10px', 
      height: '8px',
      overflow: 'hidden'
    }}>
      <div style={{ 
        width: `${(value / max) * 100}%`, 
        background: gradient,
        height: '8px', 
        borderRadius: '10px', 
        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
      }} />
    </div>
  </div>
);

// Stat Box Component
const StatBox = ({ label, value, gradient, icon, subtitle }) => (
  <div style={{
    background: 'white',
    borderRadius: '24px',
    padding: '1.2rem 0.8rem',
    textAlign: 'center',
    border: '1px solid #ecf0f5',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    cursor: 'pointer'
  }}
  onMouseEnter={(e) => {
    e.currentTarget.style.transform = 'translateY(-4px)';
    e.currentTarget.style.boxShadow = '0 12px 20px -12px rgba(0,0,0,0.1)';
  }}
  onMouseLeave={(e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.boxShadow = 'none';
  }}>
    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{icon}</div>
    <div style={{ 
      fontSize: '1.8rem', 
      fontWeight: 800, 
      background: gradient,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      marginBottom: '0.3rem'
    }}>{value}</div>
    <div style={{ 
      color: '#617388', 
      fontSize: '0.7rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    }}>{label}</div>
    {subtitle && <div style={{ fontSize: '0.65rem', color: '#94a3b8', marginTop: '0.25rem' }}>{subtitle}</div>}
  </div>
);

// Card Component
const Card = ({ title, accentColor, badge, children }) => (
  <div style={{
    background: 'white',
    borderRadius: '28px',
    padding: '1.2rem 1.5rem 1.5rem',
    border: '1px solid #ecf0f5',
    marginBottom: '1.5rem'
  }}>
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderBottom: '2px solid #f0f3f9',
      paddingBottom: '0.8rem',
      marginBottom: '1.2rem'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '6px', height: '28px', background: accentColor, borderRadius: '20px' }} />
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f2b3d' }}>{title}</h3>
      </div>
      {badge && <span style={{ background: '#f0f3f9', padding: '4px 12px', borderRadius: '60px', fontSize: '0.7rem', fontWeight: 700, color: '#2c3e66' }}>{badge}</span>}
    </div>
    {children}
  </div>
);

const AnalyticsDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [studentData, setStudentData] = useState({
    totalStudents: 1250,
    activeStudents: 980,
    pendingApproval: 45,
    suspended: 28,
    graduated: 197,
    attendanceRate: 87.5,
    averageScore: 76.4,
    completionRate: 82.3
  });

  // Grade distribution data
  const gradeDistribution = [
    { grade: 'A (90-100%)', count: 245, percentage: 19.6, color: 'linear-gradient(90deg, #10b981, #34d399)' },
    { grade: 'B (80-89%)', count: 412, percentage: 33.0, color: 'linear-gradient(90deg, #3b82f6, #60a5fa)' },
    { grade: 'C (70-79%)', count: 356, percentage: 28.5, color: 'linear-gradient(90deg, #f59e0b, #fbbf24)' },
    { grade: 'D (60-69%)', count: 158, percentage: 12.6, color: 'linear-gradient(90deg, #f97316, #fb923c)' },
    { grade: 'F (<60%)', count: 79, percentage: 6.3, color: 'linear-gradient(90deg, #ef4444, #f87171)' }
  ];

  // Course enrollment data
  const courseEnrollment = [
    { course: 'Mathematics', students: 890, max: 1250, color: 'linear-gradient(90deg, #8b5cf6, #a78bfa)' },
    { course: 'Science', students: 756, max: 1250, color: 'linear-gradient(90deg, #06b6d4, #22d3ee)' },
    { course: 'English', students: 823, max: 1250, color: 'linear-gradient(90deg, #ec4899, #f472b6)' },
    { course: 'History', students: 567, max: 1250, color: 'linear-gradient(90deg, #84cc16, #a3e635)' },
    { course: 'Computer Science', students: 654, max: 1250, color: 'linear-gradient(90deg, #6366f1, #818cf8)' }
  ];

  // Monthly enrollment trend
  const enrollmentTrend = [
    { month: 'Jan', students: 1120 },
    { month: 'Feb', students: 1150 },
    { month: 'Mar', students: 1180 },
    { month: 'Apr', students: 1205 },
    { month: 'May', students: 1225 },
    { month: 'Jun', students: 1250 }
  ];

  const gradients = {
    primary: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    green: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    yellow: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    blue: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
    purple: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    orange: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
    pink: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)',
    teal: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)'
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        fontSize: '1rem',
        color: '#64748b'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #f1f5f9',
          borderTop: '3px solid #667eea',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ 
      background: '#f1f4f9',
      minHeight: '100vh',
      padding: '2rem'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '1.8rem',
        borderBottom: '1px solid #e4e9f0',
        paddingBottom: '1.2rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        flexWrap: 'wrap'
      }}>
        <div>
          <h1 style={{
            fontSize: '1.8rem',
            fontWeight: 700,
            background: gradients.primary,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.3rem'
          }}>📊 Student Analytics Dashboard</h1>
          <p style={{ fontSize: '0.85rem', color: '#5a6e8a', fontWeight: 500 }}>Real-time student performance & engagement metrics</p>
        </div>
        <div style={{
          background: 'white',
          padding: '0.5rem 1.2rem',
          borderRadius: '100px',
          fontSize: '0.7rem',
          fontWeight: 600,
          color: '#1f3a6b',
          border: '1px solid #e9edf4'
        }}>
          🎓 Academic Year 2024 | Last Updated: Today
        </div>
      </div>

      {/* Circular Progress Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1.2rem',
        marginBottom: '2rem'
      }}>
        <CircularProgress 
          label="Active Students" 
          value={studentData.activeStudents} 
          total={studentData.totalStudents} 
          color="#10b981"
          icon="👨‍🎓"
        />
        <CircularProgress 
          label="Attendance Rate" 
          value={studentData.attendanceRate} 
          total={100} 
          color="#3b82f6"
          icon="📅"
        />
        <CircularProgress 
          label="Course Completion" 
          value={studentData.completionRate} 
          total={100} 
          color="#8b5cf6"
          icon="✅"
        />
        <CircularProgress 
          label="Average Score" 
          value={studentData.averageScore} 
          total={100} 
          color="#f59e0b"
          icon="📊"
        />
      </div>

      {/* KPI Stats Row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <StatBox label="Total Students" value={studentData.totalStudents} gradient={gradients.primary} icon="🎓" />
        <StatBox label="Pending Approval" value={studentData.pendingApproval} gradient={gradients.yellow} icon="⏳" subtitle="awaiting verification" />
        <StatBox label="Graduated" value={studentData.graduated} gradient={gradients.green} icon="🏆" />
        <StatBox label="Suspended" value={studentData.suspended} gradient={gradients.orange} icon="⚠️" />
      </div>

      {/* Two Column Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.8rem',
        marginBottom: '2rem'
      }}>
        {/* LEFT COLUMN */}
        <div>
          {/* Grade Distribution Card */}
          <Card title="Grade Distribution" accentColor="linear-gradient(135deg, #8b5cf6, #a78bfa)" badge="current term">
            {gradeDistribution.map((item, idx) => (
              <Bar 
                key={idx}
                label={item.grade}
                value={item.percentage}
                max={100}
                gradient={item.color}
                suffix="%"
              />
            ))}
            <div style={{ 
              marginTop: '1rem', 
              padding: '0.75rem', 
              background: '#f8fafc', 
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <span style={{ fontWeight: 700, color: '#1e293b' }}>Average GPA: 3.2</span>
              <span style={{ marginLeft: '1rem', color: '#64748b' }}>|</span>
              <span style={{ marginLeft: '1rem', fontWeight: 700, color: '#1e293b' }}>Pass Rate: 93.7%</span>
            </div>
          </Card>

          {/* Course Enrollment Card */}
          <Card title="Course Enrollment" accentColor="linear-gradient(135deg, #06b6d4, #22d3ee)" badge="active enrollments">
            {courseEnrollment.map((course, idx) => (
              <div key={idx} style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b' }}>{course.course}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#3b82f6' }}>{course.students} / {studentData.totalStudents}</span>
                </div>
                <div style={{ background: '#eef2f8', borderRadius: '10px', height: '8px', overflow: 'hidden' }}>
                  <div style={{ 
                    width: `${(course.students / studentData.totalStudents) * 100}%`, 
                    background: course.color,
                    height: '8px', 
                    borderRadius: '10px'
                  }} />
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* RIGHT COLUMN */}
        <div>
          {/* Monthly Enrollment Trend Card */}
          <Card title="Monthly Enrollment Trend" accentColor="linear-gradient(135deg, #ec4899, #f472b6)" badge="2024">
            <div style={{ marginBottom: '1rem' }}>
              {enrollmentTrend.map((item, idx) => (
                <div key={idx} style={{ marginBottom: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>{item.month}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ec4899' }}>{item.students}</span>
                  </div>
                  <div style={{ background: '#eef2f8', borderRadius: '8px', height: '6px' }}>
                    <div style={{ 
                      width: `${(item.students / studentData.totalStudents) * 100}%`, 
                      background: 'linear-gradient(90deg, #ec4899, #f472b6)',
                      height: '6px', 
                      borderRadius: '8px'
                    }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ 
              marginTop: '0.5rem', 
              padding: '0.75rem', 
              background: 'linear-gradient(135deg, #ec489910, #f472b610)',
              borderRadius: '12px',
              textAlign: 'center'
            }}>
              <span style={{ fontSize: '0.75rem', color: '#475569' }}>📈 +11.6% growth since January</span>
            </div>
          </Card>

          {/* Quick Stats Card */}
          <Card title="Quick Statistics" accentColor="linear-gradient(135deg, #f59e0b, #fbbf24)" badge="insights">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '16px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{((studentData.activeStudents / studentData.totalStudents) * 100).toFixed(1)}%</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>Active Rate</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '16px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3b82f6' }}>{studentData.averageScore}%</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>Avg Score</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '16px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#8b5cf6' }}>87%</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>Retention Rate</div>
              </div>
              <div style={{ textAlign: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '16px' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>94%</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>Parent Satisfaction</div>
              </div>
            </div>
          </Card>

          {/* Department Performance Card */}
          <Card title="Top Performing Departments" accentColor="linear-gradient(135deg, #14b8a6, #0d9488)" badge="ranking">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '12px' }}>
                <span>🏆 Computer Science</span>
                <span style={{ fontWeight: 700, color: '#14b8a6' }}>94.2%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '12px' }}>
                <span>📐 Mathematics</span>
                <span style={{ fontWeight: 700, color: '#3b82f6' }}>89.7%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '12px' }}>
                <span>🔬 Science</span>
                <span style={{ fontWeight: 700, color: '#8b5cf6' }}>87.3%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', padding: '0.5rem', background: '#f8fafc', borderRadius: '12px' }}>
                <span>📖 English</span>
                <span style={{ fontWeight: 700, color: '#ec4899' }}>85.1%</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '1.8rem',
        background: '#f8fafe',
        borderRadius: '24px',
        padding: '1rem 1.5rem',
        textAlign: 'center',
        fontSize: '0.7rem',
        color: '#5a6f8c',
        border: '1px solid #e9eff6'
      }}>
        📊 Student Analytics Dashboard — Real-time performance metrics, enrollment tracking, and grade distribution
        <div style={{ marginTop: '0.5rem', fontSize: '0.65rem', fontWeight: 500 }}>© Student Management System · Data updated in real-time</div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;