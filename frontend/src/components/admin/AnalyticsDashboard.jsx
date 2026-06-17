import React, { useState, useEffect } from 'react';

// ── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  purple: '#a855f7', purpleLight: '#c084fc', purpleBg: 'rgba(168, 85, 247, 0.08)',
  blue: '#8b5cf6', blueLight: '#a78bfa', blueBg: 'rgba(139, 92, 246, 0.08)',
  green: '#10b981', greenLight: '#34d399', greenBg: 'rgba(16, 185, 129, 0.08)',
  red: '#ef4444', redLight: '#f87171', redBg: 'rgba(239, 68, 68, 0.08)',
  amber: '#f59e0b', amberLight: '#fbbf24', amberBg: 'rgba(245, 158, 11, 0.08)',
  cyan: '#06b6d4', cyanLight: '#22d3ee', cyanBg: 'rgba(6, 182, 212, 0.08)',
  gray: '#8b8b9a', grayLight: '#e5e7eb', grayBg: 'rgba(255, 255, 255, 0.4)',
  text: '#2d2d3a', sub: '#8b8b9a', light: 'rgba(255, 255, 255, 0.55)',
  border: 'rgba(233, 213, 255, 0.5)',
};

// ── SVG Icons ─────────────────────────────────────────────────────────────────
const Icons = {
  Users: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  UserCheck: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/></svg>,
  Clock: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  CheckCircle: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  BarChart: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>,
  TrendingUp: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  TrendingDown: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  Minus: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  AlertCircle: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  Shield: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  Award: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>,
  BookOpen: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  Loader: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>,
  Info: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  ArrowUp: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  ArrowDown: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
  Zap: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  PieChart: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
  Layers: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
};

const CSS = `
  @keyframes sv-pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes sv-fadein { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sv-spin   { to{transform:rotate(360deg)} }
  @keyframes sv-blink  { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.4)} 70%{box-shadow:0 0 0 8px rgba(16,185,129,0)} }
  .sv-card:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(168,85,247,.1)!important; }
`;

// ── Glassmorphism Card ────────────────────────────────────────────────────────
const GlassCard = ({ children, style = {} }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: 24,
    padding: '28px',
    border: '1px solid rgba(255, 255, 255, 0.6)',
    boxShadow: '0 8px 32px rgba(155, 89, 182, 0.06)',
    ...style,
  }}>{children}</div>
);

// ── Circular Progress ─────────────────────────────────────────────────────────
const CircularProgress = ({ label, value, total, color, icon: Icon }) => {
  const percentage = Math.min(100, Math.max(0, (value / total) * 100));
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <GlassCard style={{ padding: '24px', textAlign: 'center', animation: 'sv-fadein .3s ease', flex: '1 1 200px', minWidth: 0 }}>
      <div style={{ color, marginBottom: 12, display: 'flex', justifyContent: 'center' }}><Icon size={22} /></div>
      <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 12px' }}>
        <svg style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
          <circle cx="60" cy="60" r="45" fill="none" stroke="rgba(233,213,255,.4)" strokeWidth="8" />
          <circle cx="60" cy="60" r="45" fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
        </svg>
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center',
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: C.text }}>{value}</div>
          <div style={{ fontSize: '.65rem', color: C.sub }}>out of {total}</div>
        </div>
      </div>
      <div style={{ fontWeight: 600, fontSize: '.85rem', color: C.text }}>{label}</div>
      <div style={{ fontSize: '.75rem', color: C.sub, marginTop: 4 }}>{percentage.toFixed(1)}%</div>
    </GlassCard>
  );
};

// ── Stat Box ──────────────────────────────────────────────────────────────────
const StatBox = ({ label, value, color, icon: Icon, subtitle, trend }) => {
  const up = trend > 0;
  const down = trend < 0;
  return (
    <GlassCard style={{ padding: '20px 24px', textAlign: 'center', animation: 'sv-fadein .3s ease', flex: '1 1 150px', minWidth: 0 }}>
      <div style={{ color, marginBottom: 10, display: 'flex', justifyContent: 'center' }}><Icon size={20} /></div>
      <div style={{ fontSize: '1.8rem', fontWeight: 700, color, lineHeight: 1, letterSpacing: '-0.5px' }}>{value}</div>
      <div style={{ fontSize: '.75rem', fontWeight: 600, color: C.sub, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      {subtitle && <div style={{ fontSize: '.7rem', color: C.sub, marginTop: 4, opacity: 0.8 }}>{subtitle}</div>}
      {trend !== undefined && trend !== null && (
        <div style={{
          marginTop: 8, fontSize: '.7rem', fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          color: up ? C.green : down ? C.red : C.gray,
        }}>
          {up ? <Icons.ArrowUp size={12} /> : down ? <Icons.ArrowDown size={12} /> : <Icons.Minus size={12} />}
          {Math.abs(trend)}%
        </div>
      )}
    </GlassCard>
  );
};

// ── Bar Component ─────────────────────────────────────────────────────────────
const Bar = ({ label, value, max, color, suffix = '' }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '.8rem', fontWeight: 600, color: C.text }}>
        <span style={{ textTransform: 'capitalize' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}{suffix}</span>
      </div>
      <div style={{ background: 'rgba(233, 213, 255, 0.4)', borderRadius: 10, height: 8, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`, background: color, height: 8, borderRadius: 10,
          transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
        }} />
      </div>
    </div>
  );
};

// ── Section Card ──────────────────────────────────────────────────────────────
const SectionCard = ({ title, accentColor, badge, icon: Icon, children }) => (
  <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '20px 24px', borderBottom: `2px solid ${C.border}`,
      background: 'rgba(255, 255, 255, 0.3)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 4, height: 28, background: accentColor, borderRadius: 20 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <div style={{ color: accentColor }}><Icon size={18} /></div>}
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: C.text }}>{title}</h3>
        </div>
      </div>
      {badge && <span style={{ background: 'rgba(139, 92, 246, 0.08)', padding: '4px 14px', borderRadius: 9999, fontSize: '.7rem', fontWeight: 600, color: C.purple }}>{badge}</span>}
    </div>
    <div style={{ padding: '24px' }}>{children}</div>
  </GlassCard>
);

// ── Trend Indicator ───────────────────────────────────────────────────────────
const TrendIndicator = ({ value, label }) => {
  const isUp = value > 0;
  const isDown = value < 0;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 9999, fontSize: '.75rem', fontWeight: 600,
      background: isUp ? C.greenBg : isDown ? C.redBg : C.grayBg,
      color: isUp ? C.green : isDown ? C.red : C.gray,
    }}>
      {isUp ? <Icons.TrendingUp size={12} /> : isDown ? <Icons.TrendingDown size={12} /> : <Icons.Minus size={12} />}
      {Math.abs(value)}% {label}
    </div>
  );
};

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
    completionRate: 82.3,
    retentionRate: 87.0,
    parentSatisfaction: 94.0,
  });

  // Grade distribution data (must sum to 100%)
  const gradeDistribution = [
    { grade: 'A (90-100%)', count: 245, color: C.green },
    { grade: 'B (80-89%)', count: 412, color: C.blue },
    { grade: 'C (70-79%)', count: 356, color: C.amber },
    { grade: 'D (60-69%)', count: 158, color: C.red },
    { grade: 'F (<60%)', count: 79, color: C.gray },
  ];
  const totalGraded = gradeDistribution.reduce((a, b) => a + b.count, 0);
  const gradeDistributionWithPct = gradeDistribution.map(g => ({
    ...g,
    percentage: ((g.count / totalGraded) * 100).toFixed(1),
  }));

  // Course enrollment data
  const courseEnrollment = [
    { course: 'Mathematics', students: 890, color: C.purple },
    { course: 'Science', students: 756, color: C.cyan },
    { course: 'English', students: 823, color: C.blue },
    { course: 'History', students: 567, color: C.green },
    { course: 'Computer Science', students: 654, color: C.amber },
  ];

  // Monthly enrollment trend (realistic data)
  const enrollmentTrend = [
    { month: 'Jan', students: 1120, prev: 1100 },
    { month: 'Feb', students: 1150, prev: 1120 },
    { month: 'Mar', students: 1180, prev: 1150 },
    { month: 'Apr', students: 1205, prev: 1180 },
    { month: 'May', students: 1225, prev: 1205 },
    { month: 'Jun', students: 1250, prev: 1225 },
  ];

  // Department performance (sorted by score)
  const departmentPerformance = [
    { name: 'Computer Science', score: 94.2, color: C.green },
    { name: 'Mathematics', score: 89.7, color: C.blue },
    { name: 'Science', score: 87.3, color: C.purple },
    { name: 'English', score: 85.1, color: C.amber },
    { name: 'History', score: 82.5, color: C.red },
  ].sort((a, b) => b.score - a.score);

  // Calculate derived metrics
  const activeRate = ((studentData.activeStudents / studentData.totalStudents) * 100).toFixed(1);
  const passRate = ((totalGraded - 79) / totalGraded * 100).toFixed(1);
  const avgGPA = (gradeDistributionWithPct.reduce((a, g) => {
    const gradePoints = { 'A (90-100%)': 4.0, 'B (80-89%)': 3.0, 'C (70-79%)': 2.0, 'D (60-69%)': 1.0, 'F (<60%)': 0.0 };
    return a + (gradePoints[g.grade] || 0) * (g.count / totalGraded);
  }, 0)).toFixed(1);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px',
        fontSize: '1rem', color: C.sub,
      }}>
        <div style={{ animation: 'sv-spin 1s linear infinite', display: 'inline-block', marginRight: 12 }}>
          <Icons.Loader size={32} />
        </div>
        Loading analytics...
        <style>{CSS}</style>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: C.text,
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 50%, #fbcfe8 100%)',
      padding: '32px',
    }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: '-0.5px' }}>
            Student Analytics Dashboard
          </h1>
          <p style={{ fontSize: '.85rem', color: C.sub, fontWeight: 500 }}>Real-time student performance and engagement metrics</p>
        </div>
        <div style={{
          background: 'rgba(255, 255, 255, 0.55)', backdropFilter: 'blur(20px)',
          padding: '8px 18px', borderRadius: 12, fontSize: '.75rem', fontWeight: 600,
          color: C.text, border: '1px solid rgba(255, 255, 255, 0.6)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Icons.Info size={14} style={{ color: C.purple }} />
          Academic Year 2024 | Last Updated: Today
        </div>
      </div>

      {/* Circular Progress Row */}
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <CircularProgress label="Active Students" value={studentData.activeStudents} total={studentData.totalStudents} color={C.green} icon={Icons.UserCheck} />
        <CircularProgress label="Attendance Rate" value={studentData.attendanceRate} total={100} color={C.blue} icon={Icons.Clock} />
        <CircularProgress label="Course Completion" value={studentData.completionRate} total={100} color={C.purple} icon={Icons.CheckCircle} />
        <CircularProgress label="Average Score" value={studentData.averageScore} total={100} color={C.amber} icon={Icons.BarChart} />
      </div>

      {/* KPI Stats Row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <StatBox label="Total Students" value={studentData.totalStudents} color={C.purple} icon={Icons.Users} />
        <StatBox label="Pending Approval" value={studentData.pendingApproval} color={C.amber} icon={Icons.AlertCircle} subtitle="awaiting verification" trend={-2.5} />
        <StatBox label="Graduated" value={studentData.graduated} color={C.green} icon={Icons.Award} trend={5.2} />
        <StatBox label="Suspended" value={studentData.suspended} color={C.red} icon={Icons.Shield} trend={-1.8} />
      </div>

      {/* Two Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px', marginBottom: '24px' }}>
        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Grade Distribution Card */}
          <SectionCard title="Grade Distribution" accentColor={C.purple} badge="Current Term" icon={Icons.PieChart}>
            {gradeDistributionWithPct.map((item, idx) => (
              <Bar key={idx} label={item.grade} value={item.percentage} max={100} color={item.color} suffix="%" />
            ))}
            <div style={{
              marginTop: '16px', padding: '14px', background: 'rgba(255, 255, 255, 0.4)',
              borderRadius: 14, border: `1px solid ${C.border}`, display: 'flex', justifyContent: 'center', gap: '24px', flexWrap: 'wrap',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: C.text, fontSize: '1.1rem' }}>GPA {avgGPA}</div>
                <div style={{ fontSize: '.7rem', color: C.sub }}>Average GPA</div>
              </div>
              <div style={{ width: 1, background: C.border }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: C.text, fontSize: '1.1rem' }}>{passRate}%</div>
                <div style={{ fontSize: '.7rem', color: C.sub }}>Pass Rate</div>
              </div>
              <div style={{ width: 1, background: C.border }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: C.text, fontSize: '1.1rem' }}>{totalGraded}</div>
                <div style={{ fontSize: '.7rem', color: C.sub }}>Total Graded</div>
              </div>
            </div>
          </SectionCard>

          {/* Course Enrollment Card */}
          <SectionCard title="Course Enrollment" accentColor={C.cyan} badge="Active Enrollments" icon={Icons.BookOpen}>
            {courseEnrollment.map((course, idx) => (
              <div key={idx} style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '.85rem' }}>
                  <span style={{ fontWeight: 600, color: C.text }}>{course.course}</span>
                  <span style={{ fontWeight: 700, color: course.color }}>{course.students} / {studentData.totalStudents}</span>
                </div>
                <div style={{ background: 'rgba(233, 213, 255, 0.4)', borderRadius: 10, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(course.students / studentData.totalStudents) * 100}%`,
                    background: course.color, height: 8, borderRadius: 10,
                    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  }} />
                </div>
              </div>
            ))}
          </SectionCard>
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Monthly Enrollment Trend Card */}
          <SectionCard title="Monthly Enrollment Trend" accentColor={C.blue} badge="2024" icon={Icons.TrendingUp}>
            <div style={{ marginBottom: '8px' }}>
              {enrollmentTrend.map((item, idx) => {
                const growth = ((item.students - item.prev) / item.prev * 100).toFixed(1);
                return (
                  <div key={idx} style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: '.82rem', fontWeight: 600, color: C.text }}>{item.month}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '.82rem', fontWeight: 700, color: C.blue }}>{item.students}</span>
                        <span style={{
                          fontSize: '.65rem', fontWeight: 600, padding: '2px 6px', borderRadius: 6,
                          background: C.greenBg, color: C.green,
                        }}>+{growth}%</span>
                      </div>
                    </div>
                    <div style={{ background: 'rgba(233, 213, 255, 0.4)', borderRadius: 8, height: 6 }}>
                      <div style={{
                        width: `${(item.students / studentData.totalStudents) * 100}%`,
                        background: `linear-gradient(90deg, ${C.blue}, ${C.blueLight})`,
                        height: 6, borderRadius: 8,
                        transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{
              marginTop: '12px', padding: '12px', background: 'rgba(139, 92, 246, 0.06)',
              borderRadius: 14, border: `1px solid ${C.border}`, textAlign: 'center',
            }}>
              <TrendIndicator value={11.6} label="growth since January" />
            </div>
          </SectionCard>

          {/* Quick Stats Card */}
          <SectionCard title="Quick Statistics" accentColor={C.amber} badge="Insights" icon={Icons.Zap}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255, 255, 255, 0.4)', borderRadius: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: C.green }}>{activeRate}%</div>
                <div style={{ fontSize: '.72rem', color: C.sub, marginTop: 4, fontWeight: 600 }}>Active Rate</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255, 255, 255, 0.4)', borderRadius: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: C.blue }}>{studentData.averageScore}%</div>
                <div style={{ fontSize: '.72rem', color: C.sub, marginTop: 4, fontWeight: 600 }}>Avg Score</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255, 255, 255, 0.4)', borderRadius: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: C.purple }}>{studentData.retentionRate}%</div>
                <div style={{ fontSize: '.72rem', color: C.sub, marginTop: 4, fontWeight: 600 }}>Retention Rate</div>
              </div>
              <div style={{ textAlign: 'center', padding: '16px', background: 'rgba(255, 255, 255, 0.4)', borderRadius: 16, border: `1px solid ${C.border}` }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: C.amber }}>{studentData.parentSatisfaction}%</div>
                <div style={{ fontSize: '.72rem', color: C.sub, marginTop: 4, fontWeight: 600 }}>Parent Satisfaction</div>
              </div>
            </div>
          </SectionCard>

          {/* Department Performance Card */}
          <SectionCard title="Top Performing Departments" accentColor={C.green} badge="Ranking" icon={Icons.Layers}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {departmentPerformance.map((dept, idx) => (
                <div key={idx} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', background: 'rgba(255, 255, 255, 0.4)', borderRadius: 12,
                  border: `1px solid ${C.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', background: dept.color, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.7rem', fontWeight: 700,
                    }}>{idx + 1}</div>
                    <span style={{ fontWeight: 600, fontSize: '.85rem', color: C.text }}>{dept.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 100, height: 6, background: 'rgba(233, 213, 255, 0.4)', borderRadius: 10, overflow: 'hidden',
                    }}>
                      <div style={{
                        width: `${dept.score}%`, height: 6, background: dept.color, borderRadius: 10,
                      }} />
                    </div>
                    <span style={{ fontWeight: 700, fontSize: '.85rem', color: dept.color, minWidth: 40, textAlign: 'right' }}>{dept.score}%</span>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '24px',
        background: 'rgba(255, 255, 255, 0.4)',
        borderRadius: 16,
        padding: '16px 24px',
        textAlign: 'center',
        fontSize: '.75rem',
        color: C.sub,
        border: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 4 }}>
          <Icons.BarChart size={14} /> Student Analytics Dashboard — Real-time performance metrics
        </div>
        <div style={{ fontSize: '.7rem', opacity: 0.7 }}>Student Management System | Data updated in real-time</div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;