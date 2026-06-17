import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { eatTime, eatFull, eatDate, eatTodayISO, eatTodayLabel } from '../../utils/eatTime';

const CLASSROOM_URL = import.meta.env.VITE_CLASSROOM_URL || 'http://localhost:3000';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  purple: '#a855f7', purpleLight: '#c084fc', purpleBg: 'rgba(168, 85, 247, 0.08)',
  pink: '#f472b6', pinkLight: '#fbcfe8', pinkBg: 'rgba(244, 114, 182, 0.08)',
  blue: '#8b5cf6', blueLight: '#a78bfa', blueBg: 'rgba(139, 92, 246, 0.08)',
  green: '#10b981', greenLight: '#34d399', greenBg: 'rgba(16, 185, 129, 0.08)',
  red: '#ef4444', redLight: '#f87171', redBg: 'rgba(239, 68, 68, 0.08)',
  amber: '#f59e0b', amberLight: '#fbbf24', amberBg: 'rgba(245, 158, 11, 0.08)',
  gray: '#8b8b9a', grayLight: '#e5e7eb', grayBg: 'rgba(255, 255, 255, 0.4)',
  text: '#2d2d3a', sub: '#8b8b9a', light: 'rgba(255, 255, 255, 0.55)',
  border: 'rgba(233, 213, 255, 0.5)',
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const STATUS_CFG = {
  scheduled        : { color: C.blue,   bg: C.blueBg,   label: 'Scheduled'       },
  active           : { color: C.green,  bg: C.greenBg,  label: 'Live'            },
  completed        : { color: C.gray,   bg: C.grayBg,   label: 'Completed'       },
  cancelled        : { color: C.red,    bg: C.redBg,    label: 'Cancelled'       },
  conflict_blocked : { color: C.amber,  bg: C.amberBg,  label: 'Conflict'        },
  replaced         : { color: C.purple, bg: C.purpleBg, label: 'Replaced'        },
};

// ── SVG Icon Components ───────────────────────────────────────────────────────
const Icons = {
  Calendar: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  Activity: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  CheckCircle: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  XCircle: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  Users: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  User: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  GraduationCap: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  Clock: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  Play: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>,
  Eye: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  X: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  Search: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  ChevronLeft: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  ChevronRight: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  Loader: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>,
  MapPin: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  TrendingUp: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  TrendingDown: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
  Minus: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  ArrowRight: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  ChevronUp: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>,
  ChevronDown: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  Info: ({size=16}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt      = eatTime;
const fmtFull  = eatFull;
const fmtDate  = eatDate;
const todayISO = eatTodayISO;
const isLiveFn = s   => {
  if (s.status === 'active') return true;
  if (s.status !== 'scheduled') return false;
  const n = Date.now();
  return new Date(s.scheduled_start) <= n && new Date(s.scheduled_end) > n;
};

// ── Global styles ─────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes sv-pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes sv-slide  { from{transform:translateX(105%)} to{transform:translateX(0)} }
  @keyframes sv-fadein { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sv-blink  { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,.4)} 70%{box-shadow:0 0 0 8px rgba(16,185,129,0)} }
  @keyframes sv-spin   { to{transform:rotate(360deg)} }
  .sv-day:hover   { background:rgba(192,132,252,.08) !important; cursor:pointer; }
  .sv-scard:hover { background:rgba(255,255,255,.7) !important; transform:translateY(-1px); box-shadow:0 8px 32px rgba(168,85,247,.1)!important; }
  .sv-btn:hover   { filter:brightness(.92); }
  .sv-trow:hover  { background:rgba(192,132,252,.06) !important; cursor:pointer; }
`;

// ── Glassmorphism Components ──────────────────────────────────────────────────
const GlassCard = ({ children, style = {}, padding = '28px' }) => (
  <div style={{
    background: 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: 24,
    padding,
    border: '1px solid rgba(255, 255, 255, 0.6)',
    boxShadow: '0 8px 32px rgba(155, 89, 182, 0.06)',
    ...style,
  }}>{children}</div>
);

const Btn = ({ color = C.purple, outline, small, disabled, onClick, children, style = {} }) => (
  <button className="sv-btn" onClick={onClick} disabled={disabled} style={{
    padding: small ? '6px 14px' : '8px 18px',
    fontSize: small ? '.75rem' : '.85rem',
    fontWeight: 600, borderRadius: 12,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: `1.5px solid ${color}`,
    background: outline ? 'rgba(255, 255, 255, 0.5)' : `linear-gradient(135deg, ${C.purpleLight}, ${color})`,
    color: outline ? color : '#fff',
    opacity: disabled ? .55 : 1,
    transition: 'all .2s',
    boxShadow: outline ? 'none' : `0 4px 15px ${color}40`,
    display: 'flex', alignItems: 'center', gap: 6,
    ...style,
  }}>{children}</button>
);

const Pill = ({ children, color }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center', gap: 4,
    borderRadius: '999px', padding: '3px 12px',
    background: `${color}14`, color,
    fontWeight: 600, fontSize: '0.76rem',
    textTransform: 'capitalize', border: `1px solid ${color}28`,
  }}>{children}</span>
);

const StatusBadge = ({ status, sm }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.scheduled;
  return (
    <Pill color={cfg.color}>
      {status === 'active' && <span style={{ width:6,height:6,borderRadius:'50%',background:C.green,animation:'sv-pulse 1.4s infinite' }} />}
      {cfg.label}
    </Pill>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon: Icon, label, value, color, sub, trend }) => {
  const up   = trend > 0;
  const down = trend < 0;
  return (
    <GlassCard style={{ padding: '20px 24px', borderTop: `3px solid ${color}`, flex: '1 1 150px', minWidth: 0, animation: 'sv-fadein .3s ease' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 10 }}>
        <div style={{ color, opacity: 0.9 }}><Icon size={20} /></div>
        {trend !== undefined && trend !== null && (
          <span style={{
            fontSize:'.68rem', fontWeight:600, padding:'2px 8px', borderRadius:9999,
            background: up ? C.greenBg : down ? C.redBg : C.grayBg,
            color:      up ? C.green : down ? C.red : C.gray,
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            {up ? <Icons.TrendingUp size={10} /> : down ? <Icons.TrendingDown size={10} /> : <Icons.Minus size={10} />}
            {Math.abs(trend)}
          </span>
        )}
      </div>
      <div style={{ fontSize:'1.85rem', fontWeight:700, color, lineHeight:1.1, letterSpacing: '-0.5px' }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize:'.8rem', fontWeight:600, color: C.sub, marginTop: 8 }}>{label}</div>
      {sub && <div style={{ fontSize:'.7rem', color: C.sub, marginTop: 4, opacity: 0.8 }}>{sub}</div>}
    </GlassCard>
  );
};

const formatDuration = (session) => {
  const startValue = session?.actual_start_time || session?.scheduled_start;
  if (!startValue) return '0m';
  const start = new Date(startValue);
  const end = session?.actual_end_time ? new Date(session.actual_end_time) : new Date();
  const minutes = Math.max(0, Math.floor((end - start) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${rest}m` : `${rest}m`;
};

// ── Today timeline entry ──────────────────────────────────────────────────────
const TimelineRow = ({ s, onDetail, onJoin, joining }) => {
  const live = isLiveFn(s);
  const cfg  = STATUS_CFG[s.status] || STATUS_CFG.scheduled;
  const dur  = Math.round((new Date(s.scheduled_end) - new Date(s.scheduled_start)) / 60000);
  return (
    <div className="sv-trow" onClick={() => onDetail(s)} style={{
      display:'flex', alignItems:'stretch', gap:0,
      borderRadius:16, overflow:'hidden',
      border:`1px solid ${live ? 'rgba(16,185,129,.2)' : C.border}`,
      background: live ? 'rgba(16,185,129,.04)' : 'rgba(255,255,255,.3)',
      boxShadow: live ? '0 0 0 1px rgba(16,185,129,.15)' : 'none',
      animation: 'sv-fadein .25s ease',
      transition: 'background .15s',
    }}>
      {/* Color stripe */}
      <div style={{ width:4, flexShrink:0, background: cfg.color }} />

      {/* Time column */}
      <div style={{
        width:70, flexShrink:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', padding:'12px 0',
        borderRight:`1px solid ${C.border}`, background: 'rgba(255,255,255,.3)',
        fontSize:'.72rem', fontWeight:600, color: C.sub, gap:3,
      }}>
        <span>{fmt(s.scheduled_start)}</span>
        <span style={{ color:C.sub, fontWeight:400, fontSize:'.65rem' }}>{dur}m</span>
        <span>{fmt(s.scheduled_end)}</span>
      </div>

      {/* Content */}
      <div style={{ flex:1, padding:'12px 16px', display:'flex', flexDirection:'column', gap:6, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
          <span style={{ fontWeight:600, fontSize:'.88rem', color: C.text }}>{s.teacher_name}</span>
          <Icons.ArrowRight size={14} style={{ color: C.sub }} />
          <span style={{ fontWeight:600, fontSize:'.88rem', color: C.text }}>{s.student_name}</span>
          {live && (
            <span style={{
              background:C.greenBg, color:C.green, padding:'2px 10px',
              borderRadius:9999, fontSize:'.65rem', fontWeight:600,
              display:'flex', alignItems:'center', gap:4,
              border: `1px solid ${C.green}30`,
            }}>
              <span style={{ width:5,height:5,borderRadius:'50%',background:C.green,animation:'sv-pulse 1.4s infinite' }} />
              LIVE
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <StatusBadge status={s.status} sm />
          {s.room_name && (
            <code style={{ fontSize:'.65rem', background:'rgba(139,92,246,.08)', padding:'2px 8px', borderRadius:6, color: C.blue, fontWeight: 600 }}>
              {s.room_name}
            </code>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'0 16px', flexShrink:0 }}
           onClick={e => e.stopPropagation()}>
        {live && (
          <Btn color={C.green} small disabled={joining === s.id} onClick={() => onJoin(s)}>
            {joining === s.id ? <Icons.Loader size={12} /> : <Icons.Play size={12} />} Join
          </Btn>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════
const SessionViewer = () => {
  const now = new Date();

  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calData,  setCalData]  = useState([]);
  const [stats, setStats] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [todayLoading,  setTodayLoading]  = useState(true);
  const [showTimeline,  setShowTimeline]  = useState(true);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [selectedDay,  setSelectedDay]  = useState(null);
  const [daySessions,  setDaySessions]  = useState([]);
  const [dayLoading,   setDayLoading]   = useState(false);
  const [search,         setSearch]         = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterTeacher,  setFilterTeacher]  = useState('');
  const [teachers,       setTeachers]       = useState([]);
  const [detailSess, setDetailSess] = useState(null);
  const [joining,    setJoining]    = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const drawerRef = useRef(null);
  const todayStr  = todayISO();

  const loadStats = useCallback(async () => {
    try { const { data } = await axios.get('/api/sessions/admin/stats'); setStats(data); }
    catch { /* silent */ }
  }, []);

  const loadCalendar = useCallback(async () => {
    try {
      const { data } = await axios.get('/api/sessions/admin/calendar', { params: { year: calYear, month: calMonth } });
      setCalData(data);
    } catch { toast.error('Failed to load calendar'); }
  }, [calYear, calMonth]);

  const loadToday = useCallback(async () => {
    setTodayLoading(true);
    try { const { data } = await axios.get(`/api/sessions/admin/day/${todayStr}`); setTodaySessions(data); }
    catch { /* silent */ }
    finally { setTodayLoading(false); }
  }, [todayStr]);

  const loadTeachers = useCallback(async () => {
    try { const { data } = await axios.get('/api/users'); setTeachers(data.filter(u => u.role === 'teacher')); }
    catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadStats(); loadCalendar(); loadToday(); loadTeachers();
  }, [loadStats, loadCalendar, loadToday, loadTeachers]);

  useEffect(() => {
    const t = setInterval(() => {
      loadStats(); loadToday();
      if (selectedDay) openDay(selectedDay);
    }, 20000);
    return () => clearInterval(t);
  }, [selectedDay]);

  useEffect(() => {
    const h = e => { if (drawerRef.current && !drawerRef.current.contains(e.target)) setDrawerOpen(false); };
    if (drawerOpen) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [drawerOpen]);

  const openDay = async dateStr => {
    setSelectedDay(dateStr);
    setDrawerOpen(true);
    setDayLoading(true);
    setSearch(''); setFilterStatus(''); setFilterTeacher('');
    try { const { data } = await axios.get(`/api/sessions/admin/day/${dateStr}`); setDaySessions(data); }
    catch { toast.error('Failed to load sessions'); }
    finally { setDayLoading(false); }
  };

  const joinLive = async s => {
    setJoining(s.id);
    try {
      const { data } = await axios.get(`/api/sessions/classroom/join/${s.id}`);
      window.open(data.url, '_blank');
    } catch {
      window.open(`${CLASSROOM_URL}/moderator.html?room=${encodeURIComponent(s.room_name || s.id)}&name=Admin&role=admin`, '_blank');
    } finally { setJoining(null); }
  };

  const cancelSession = async s => {
    if (!window.confirm(`Cancel session: ${s.teacher_name} -> ${s.student_name}?`)) return;
    setCancelling(s.id);
    try {
      await axios.put(`/api/sessions/${s.id}`, { status: 'cancelled' });
      toast.success('Session cancelled');
      openDay(selectedDay); loadStats(); loadCalendar(); loadToday();
    } catch { toast.error('Failed to cancel'); }
    finally { setCancelling(null); }
  };

  const buildCells = () => {
    const first      = new Date(calYear, calMonth - 1, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();
    const cells = [];
    for (let i = 0; i < first; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  };

  const calMap = {};
  calData.forEach(r => { calMap[new Date(r.day).getUTCDate()] = r; });
  const cells    = buildCells();
  const todayDate = new Date(todayStr);

  const visibleSessions = daySessions.filter(s => {
    const q = search.toLowerCase();
    if (q && !s.teacher_name?.toLowerCase().includes(q) && !s.student_name?.toLowerCase().includes(q)) return false;
    if (filterTeacher && s.teacher_id !== filterTeacher) return false;
    if (filterStatus  && s.status    !== filterStatus)   return false;
    return true;
  });

  const prevMonth = () => { if (calMonth === 1) { setCalYear(y => y-1); setCalMonth(12); } else setCalMonth(m => m-1); };
  const nextMonth = () => { if (calMonth === 12) { setCalYear(y => y+1); setCalMonth(1); } else setCalMonth(m => m+1); };
  const goToday   = () => { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()+1); };

  const trend = (cur, prev) => (cur == null || prev == null) ? null : Number(cur) - Number(prev);

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: C.text,
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 50%, #fbcfe8 100%)',
      padding: '32px',
    }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── Stats ── */}
      <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
        <StatCard icon={Icons.Calendar} label="Scheduled" color={C.blue} value={stats?.scheduled} sub="Upcoming" trend={trend(stats?.scheduled, null)} />
        <StatCard icon={Icons.Activity} label="Live Right Now" color={C.green} value={stats?.active} sub="Active sessions" />
        <StatCard icon={Icons.CheckCircle} label="Completed" color={C.gray} value={stats?.completed} sub="All time" />
        <StatCard icon={Icons.XCircle} label="Cancelled" color={C.red} value={stats?.cancelled} sub="All time" />
        <StatCard icon={Icons.Users} label="Teachers Teaching" color={C.purple} value={stats?.teachers_teaching ?? '—'} sub="Right now" />
        <StatCard icon={Icons.GraduationCap} label="Students In Class" color={C.blue} value={stats?.students_in_class ?? '—'} sub="Right now" />
        <StatCard icon={Icons.Clock} label="Today" color={C.amber} value={stats?.today_total} sub={stats?.today_active > 0 ? `${stats.today_active} live` : 'No live'} trend={trend(stats?.today_total, stats?.yesterday_total)} />
        <StatCard icon={Icons.Calendar} label="Next 7 Days" color={C.blue} value={stats?.upcoming_7d} sub="Scheduled ahead" />
      </div>

      {/* ── Today's Timeline ── */}
      <GlassCard style={{ padding: 0, overflow: 'hidden', marginBottom: '1.5rem' }}>
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'20px 24px', borderBottom:`2px solid ${C.border}`,
          background: 'rgba(255, 255, 255, 0.3)',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ color: C.purple }}><Icons.Clock size={20} /></div>
            <div>
              <div style={{ fontWeight:700, fontSize:'1rem', color: C.text }}>Today's Schedule</div>
              <div style={{ fontSize:'.78rem', color: C.sub, marginTop:3 }}>{eatTodayLabel()}</div>
            </div>
            {stats?.today_active > 0 && (
              <span style={{
                display:'flex', alignItems:'center', gap:5,
                background:C.greenBg, color:C.green,
                padding:'3px 12px', borderRadius:9999,
                fontSize:'.72rem', fontWeight:600,
                animation:'sv-blink 2s infinite',
                border: `1px solid ${C.green}30`,
              }}>
                <span style={{ width:6,height:6,borderRadius:'50%',background:C.green,animation:'sv-pulse 1.4s infinite' }} />
                {stats.today_active} LIVE NOW
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <span style={{ fontSize:'.8rem', color: C.sub, fontWeight:600 }}>{todaySessions.length} sessions today</span>
            <Btn outline color={C.gray} small onClick={() => setShowTimeline(v => !v)}>
              {showTimeline ? <><Icons.ChevronUp size={12} /> Hide</> : <><Icons.ChevronDown size={12} /> Show</>}
            </Btn>
          </div>
        </div>

        {showTimeline && (
          <div style={{ padding:'16px 20px' }}>
            {todayLoading ? (
              <div style={{ textAlign:'center', padding:'3rem', color: C.sub }}>
                <div style={{ fontSize:'2rem', marginBottom:8, animation:'sv-spin 1s linear infinite', display:'inline-block' }}><Icons.Loader size={28} /></div>
                <div>Loading today's sessions...</div>
              </div>
            ) : todaySessions.length === 0 ? (
              <div style={{ textAlign:'center', padding:'3rem', color: C.sub }}>
                <div style={{ color: C.sub, marginBottom:8 }}><Icons.Calendar size={32} /></div>
                <div>No sessions scheduled for today</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {todaySessions.map(s => (
                  <TimelineRow key={s.id} s={s} onDetail={setDetailSess} onJoin={joinLive} joining={joining} />
                ))}
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* ── Calendar ── */}
      <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
        {/* Calendar toolbar */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'20px 24px',
          background: `linear-gradient(135deg, ${C.purpleLight}, ${C.purple})`,
        }}>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={prevMonth} style={{
              background:'rgba(255,255,255,.18)', border:'none', color:'#fff',
              borderRadius:10, padding:'8px 14px', cursor:'pointer',
              display:'flex', alignItems:'center',
            }}><Icons.ChevronLeft size={18} /></button>
            <button onClick={nextMonth} style={{
              background:'rgba(255,255,255,.18)', border:'none', color:'#fff',
              borderRadius:10, padding:'8px 14px', cursor:'pointer',
              display:'flex', alignItems:'center',
            }}><Icons.ChevronRight size={18} /></button>
          </div>

          <div style={{ textAlign:'center' }}>
            <div style={{ color:'#fff', fontWeight:700, fontSize:'1.15rem', letterSpacing:'.01em' }}>
              {MONTH_NAMES[calMonth-1]} {calYear}
            </div>
            <div style={{ color:'rgba(255,255,255,.7)', fontSize:'.75rem', marginTop:3 }}>
              {calData.reduce((a,b) => a + Number(b.total), 0)} sessions this month
            </div>
          </div>

          <Btn outline color="#fff" onClick={goToday} style={{ background: 'rgba(255,255,255,.15)', borderColor: 'rgba(255,255,255,.35)' }}>
            Today
          </Btn>
        </div>

        {/* Weekday row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background: 'rgba(255,255,255,.3)' }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{
              textAlign:'center', padding:'12px 0',
              fontSize:'.72rem', fontWeight:600, color: C.sub, letterSpacing:'.06em',
              borderBottom:`2px solid ${C.border}`,
            }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
          {cells.map((day, i) => {
            if (!day) return (
              <div key={`e-${i}`} style={{
                minHeight:90, background:'rgba(255,255,255,.15)',
                borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`,
              }} />
            );
            const ds        = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isToday   = ds === todayStr;
            const isPast    = new Date(ds) < todayDate;
            const r         = calMap[day];
            const isSelected = selectedDay === ds && drawerOpen;
            const hasActive  = r && Number(r.active) > 0;

            return (
              <div key={day} className="sv-day" onClick={() => openDay(ds)} style={{
                minHeight:90, padding:'10px 8px', position:'relative',
                borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`,
                background: isSelected ? 'rgba(192,132,252,.08)' : isToday ? 'rgba(245,158,11,.06)' : 'rgba(255,255,255,.4)',
                transition:'background .12s',
                outline: isToday ? `2px solid ${C.amber}` : 'none',
                outlineOffset:'-2px',
              }}>
                {hasActive && (
                  <span style={{
                    position:'absolute', top:8, right:8,
                    width:8, height:8, borderRadius:'50%', background: C.green,
                    animation:'sv-blink 2s infinite',
                  }} />
                )}

                <div style={{
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                  width:28, height:28, borderRadius:'50%', fontSize:'.85rem', fontWeight:700,
                  background: isToday ? `linear-gradient(135deg, ${C.purpleLight}, ${C.purple})` : 'transparent',
                  color: isToday ? '#fff' : isPast ? C.sub : C.text,
                  boxShadow: isToday ? `0 4px 12px ${C.purple}40` : 'none',
                }}>{day}</div>

                {r && Number(r.total) > 0 && (
                  <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:3 }}>
                    <span style={{
                      display:'inline-block', background: C.blueBg, color: C.blue,
                      borderRadius:9999, padding:'2px 10px', fontSize:'.65rem', fontWeight:600,
                      border: `1px solid ${C.blue}20`,
                    }}>{r.total} session{r.total !== '1' ? 's' : ''}</span>
                    <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                      {Number(r.active) > 0 && (
                        <span style={{
                          background:C.greenBg, color:C.green, borderRadius:9999,
                          padding:'1px 7px', fontSize:'.6rem', fontWeight:600,
                          display:'flex', alignItems:'center', gap:2,
                          border: `1px solid ${C.green}20`,
                        }}>
                          <span style={{ width:4,height:4,borderRadius:'50%',background:C.green,animation:'sv-pulse 1.4s infinite' }} />
                          {r.active}
                        </span>
                      )}
                      {Number(r.cancelled) > 0 && (
                        <span style={{
                          background:C.redBg, color:C.red, borderRadius:9999,
                          padding:'1px 7px', fontSize:'.6rem', fontWeight:600,
                          border: `1px solid ${C.red}20`,
                        }}>{r.cancelled}</span>
                      )}
                      {Number(r.completed) > 0 && (
                        <span style={{
                          background:C.grayBg, color:C.gray, borderRadius:9999,
                          padding:'1px 7px', fontSize:'.6rem', fontWeight:600,
                          border: `1px solid ${C.gray}20`,
                        }}>{r.completed}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Legend footer */}
        <div style={{
          padding:'14px 24px', borderTop:`1px solid ${C.border}`,
          background: 'rgba(255,255,255,.3)', display:'flex', gap:'1.5rem', flexWrap:'wrap',
          fontSize:'.72rem', color: C.sub, alignItems: 'center',
        }}>
          {[
            { bg:C.blueBg, dot:C.blue, label:'Total sessions' },
            { bg:C.greenBg, dot:C.green, label:'Live' },
            { bg:C.redBg, dot:C.red, label:'Cancelled' },
            { bg:C.grayBg, dot:C.gray, label:'Completed' },
          ].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:8,height:8,background:l.dot,borderRadius:'50%',flexShrink:0 }} />
              {l.label}
            </div>
          ))}
          <div style={{ marginLeft:'auto', fontStyle:'italic', opacity: 0.7 }}>Click any day to view sessions</div>
        </div>
      </GlassCard>

      {/* ── Day Drawer ── */}
      {drawerOpen && (
        <div style={{
          position:'fixed', inset:0, zIndex:60,
          background:'rgba(15,23,42,.3)', backdropFilter:'blur(8px)',
        }}>
          <div ref={drawerRef} style={{
            position:'absolute', right:0, top:0, bottom:0,
            width:'min(540px,100vw)', background:'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display:'flex', flexDirection:'column',
            boxShadow:'-8px 0 32px rgba(168, 85, 247, 0.15)',
            animation:'sv-slide .28s cubic-bezier(.4,0,.2,1)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.6)',
          }}>
            {/* Drawer header */}
            <div style={{
              background:`linear-gradient(135deg, ${C.purpleLight}, ${C.purple})`,
              padding:'24px 28px', flexShrink:0,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ color:'rgba(255,255,255,.65)', fontSize:'.72rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em' }}>
                    Sessions for
                  </div>
                  <div style={{ color:'#fff', fontWeight:700, fontSize:'1.1rem', marginTop:4 }}>
                    {selectedDay ? fmtDate(selectedDay + 'T00:00:00') : ''}
                  </div>
                  {!dayLoading && (
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:6 }}>
                      <span style={{ color:'rgba(255,255,255,.7)', fontSize:'.78rem' }}>
                        {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
                      </span>
                      {daySessions.filter(s => s.status === 'active').length > 0 && (
                        <span style={{
                          background:C.greenBg, color:C.green,
                          padding:'2px 10px', borderRadius:9999,
                          fontSize:'.68rem', fontWeight:600,
                          display:'flex', alignItems:'center', gap:4,
                          border: `1px solid ${C.green}30`,
                        }}>
                          <span style={{ width:5,height:5,borderRadius:'50%',background:C.green,animation:'sv-pulse 1.4s infinite' }} />
                          {daySessions.filter(s => s.status === 'active').length} LIVE
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => setDrawerOpen(false)} style={{
                  background:'rgba(255,255,255,.18)', border:'none', color:'#fff',
                  borderRadius:10, padding:'8px 12px', cursor:'pointer',
                  display:'flex', alignItems:'center',
                }}><Icons.X size={16} /></button>
              </div>

              {/* Status summary pills */}
              {!dayLoading && daySessions.length > 0 && (
                <div style={{ display:'flex', gap:6, marginTop:'1rem', flexWrap:'wrap' }}>
                  {Object.entries(STATUS_CFG).map(([k, v]) => {
                    const count = daySessions.filter(s => s.status === k).length;
                    if (!count) return null;
                    return (
                      <button key={k} onClick={() => setFilterStatus(filterStatus === k ? '' : k)} style={{
                        padding:'4px 12px', borderRadius:9999, fontSize:'.72rem', fontWeight:600,
                        background: filterStatus === k ? '#fff' : 'rgba(255,255,255,.18)',
                        color:      filterStatus === k ? v.color : 'rgba(255,255,255,.85)',
                        border:'1px solid rgba(255,255,255,.25)', cursor:'pointer',
                        transition: 'all .15s',
                      }}>
                        {v.label} {count}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Search + teacher filter */}
              <div style={{ display:'flex', gap:8, marginTop:'1rem', flexWrap:'wrap' }}>
                <div style={{ flex:'1 1 150px', position:'relative' }}>
                  <div style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,.5)' }}>
                    <Icons.Search size={14} />
                  </div>
                  <input
                    placeholder="Search teacher or student..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{
                      width:'100%', padding:'8px 12px 8px 34px', borderRadius:10, fontSize:'.8rem',
                      border:'1px solid rgba(255,255,255,.25)', background:'rgba(255,255,255,.12)',
                      color:'#fff', outline:'none', boxSizing:'border-box',
                    }}
                  />
                </div>
                <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} style={{
                  padding:'8px 12px', borderRadius:10, fontSize:'.8rem',
                  border:'1px solid rgba(255,255,255,.25)', background:'rgba(255,255,255,.12)',
                  color: filterTeacher ? '#fff' : 'rgba(255,255,255,.6)', outline:'none',
                }}>
                  <option value="" style={{ color: C.text }}>All Teachers</option>
                  {teachers.map(t => <option key={t.id} value={t.id} style={{ color: C.text }}>{t.username}</option>)}
                </select>
              </div>
            </div>

            {/* Session list */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
              {dayLoading ? (
                <div style={{ textAlign:'center', padding:'3rem', color: C.sub }}>
                  <div style={{ animation:'sv-spin 1s linear infinite', display:'inline-block', marginBottom:8 }}>
                    <Icons.Loader size={28} />
                  </div>
                  <div>Loading sessions...</div>
                </div>
              ) : visibleSessions.length === 0 ? (
                <div style={{ textAlign:'center', padding:'3rem', color: C.sub }}>
                  <div style={{ marginBottom:8 }}><Icons.Calendar size={32} /></div>
                  <div>{search || filterStatus || filterTeacher ? 'No sessions match your filters' : 'No sessions on this day'}</div>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {visibleSessions.map(s => (
                    <DrawerSessionCard
                      key={s.id} s={s}
                      joining={joining} cancelling={cancelling}
                      onDetail={setDetailSess} onJoin={joinLive} onCancel={cancelSession}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Drawer footer */}
            <div style={{
              padding:'14px 24px', borderTop:`1px solid ${C.border}`,
              background: 'rgba(255,255,255,.3)', display:'flex', gap:'1.25rem', flexWrap:'wrap',
              fontSize:'.72rem', color: C.sub, flexShrink:0,
            }}>
              {Object.entries(STATUS_CFG).map(([k,v]) => {
                const count = daySessions.filter(s => s.status === k).length;
                return (
                  <span key={k} style={{ display:'flex', alignItems:'center', gap:5 }}>
                    <span style={{ width:7,height:7,borderRadius:'50%',background:v.color }} />
                    {v.label}: {count}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detailSess && (
        <DetailModal
          s={detailSess} joining={joining}
          onJoin={joinLive} onClose={() => setDetailSess(null)}
        />
      )}
    </div>
  );
};

// ── Drawer session card ───────────────────────────────────────────────────────
const DrawerSessionCard = ({ s, joining, cancelling, onDetail, onJoin, onCancel }) => {
  const live = isLiveFn(s);
  const cfg  = STATUS_CFG[s.status] || STATUS_CFG.scheduled;
  const dur  = Math.round((new Date(s.scheduled_end) - new Date(s.scheduled_start)) / 60000);
  return (
    <div className="sv-scard" onClick={() => onDetail(s)} style={{
      background: live ? 'rgba(16,185,129,.04)' : 'rgba(255,255,255,.5)',
      border:`1px solid ${live ? 'rgba(16,185,129,.15)' : C.border}`,
      borderLeft:`4px solid ${cfg.color}`,
      borderRadius:14, padding:'16px 18px',
      cursor:'pointer', transition:'transform .12s, box-shadow .12s',
      boxShadow:'0 1px 3px rgba(0,0,0,.04)',
      animation:'sv-fadein .2s ease',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontWeight:600, fontSize:'.9rem', color: C.text }}>
            {fmt(s.scheduled_start)} – {fmt(s.scheduled_end)}
          </span>
          <span style={{ fontSize:'.68rem', color: C.sub, background:'rgba(255,255,255,.5)', padding:'2px 8px', borderRadius:9999, fontWeight: 600 }}>
            {dur}m
          </span>
          {live && (
            <span style={{
              background:C.greenBg, color:C.green, padding:'2px 10px', borderRadius:9999,
              fontSize:'.65rem', fontWeight:600,
              display:'flex', alignItems:'center', gap:3,
              border: `1px solid ${C.green}30`,
            }}>
              <span style={{ width:5,height:5,borderRadius:'50%',background:C.green,animation:'sv-pulse 1.4s infinite' }} />
              LIVE
            </span>
          )}
        </div>
        <StatusBadge status={s.status} sm />
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
        <div style={{
          display:'flex', alignItems:'center', gap:6, background: 'rgba(255,255,255,.4)',
          borderRadius:10, padding:'6px 12px', fontSize:'.82rem',
          border: `1px solid ${C.border}`,
        }}>
          <Icons.User size={14} style={{ color: C.blue }} />
          <span style={{ fontWeight:600, color: C.text }}>{s.teacher_name}</span>
          <Icons.ArrowRight size={12} style={{ color: C.sub }} />
          <Icons.GraduationCap size={14} style={{ color: C.green }} />
          <span style={{ fontWeight:600, color: C.text }}>{s.student_name}</span>
        </div>
      </div>

      {s.room_name && (
        <div style={{ fontSize:'.7rem', color: C.sub, marginBottom:10, display:'flex', alignItems:'center', gap:5 }}>
          <Icons.MapPin size={12} />
          <code style={{ background:'rgba(139,92,246,.08)', padding:'2px 8px', borderRadius:6, color: C.blue, fontWeight: 600 }}>
            {s.room_name}
          </code>
        </div>
      )}

      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }} onClick={e => e.stopPropagation()}>
        <Btn color={C.blue} small onClick={() => onDetail(s)}><Icons.Eye size={12} /> Details</Btn>
        {live && (
          <Btn color={C.green} small disabled={joining === s.id} onClick={() => onJoin(s)}>
            {joining === s.id ? <Icons.Loader size={12} /> : <Icons.Play size={12} />} Join Live
          </Btn>
        )}
        {s.status === 'scheduled' && (
          <Btn color={C.red} outline small disabled={cancelling === s.id} onClick={() => onCancel(s)}>
            {cancelling === s.id ? <Icons.Loader size={12} /> : <Icons.X size={12} />} Cancel
          </Btn>
        )}
      </div>
    </div>
  );
};

// ── Detail modal ──────────────────────────────────────────────────────────────
const DetailModal = ({ s, joining, onJoin, onClose }) => {
  const live = isLiveFn(s);
  const cfg  = STATUS_CFG[s.status] || STATUS_CFG.scheduled;
  const dur  = Math.round((new Date(s.scheduled_end) - new Date(s.scheduled_start)) / 60000);

  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, zIndex:110,
      background:'rgba(15,23,42,.4)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'rgba(255, 255, 255, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius:24, width:'100%', maxWidth:500,
        boxShadow:'0 24px 64px rgba(168, 85, 247, 0.15)',
        overflow:'hidden',
        animation:'sv-fadein .22s ease',
        border: '1px solid rgba(255, 255, 255, 0.6)',
      }}>
        {/* Modal header */}
        <div style={{
          padding:'24px 28px',
          background:`linear-gradient(135deg, ${cfg.color}e0, ${cfg.color})`,
          display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        }}>
          <div>
            <div style={{ color:'rgba(255,255,255,.7)', fontSize:'.68rem', fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:6 }}>
              Session Details
            </div>
            <div style={{ color:'#fff', fontWeight:700, fontSize:'1.1rem', marginBottom:10 }}>
              {s.title || `${s.teacher_name} -> ${s.student_name}`}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <StatusBadge status={s.status} />
              {live && (
                <span style={{
                  background:C.greenBg, color:C.green, padding:'2px 10px', borderRadius:9999,
                  fontSize:'.65rem', fontWeight:600,
                  display:'flex', alignItems:'center', gap:4,
                  border: `1px solid ${C.green}30`,
                }}>
                  <span style={{ width:6,height:6,borderRadius:'50%',background:C.green,animation:'sv-pulse 1.4s infinite' }} />
                  LIVE NOW
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,.18)', border:'none', color:'#fff',
            borderRadius:10, padding:'8px 12px', cursor:'pointer',
            display:'flex', alignItems:'center',
          }}><Icons.X size={16} /></button>
        </div>

        {/* Modal body */}
        <div style={{ padding:'24px 28px' }}>
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'1.25rem',
          }}>
            {[
              { icon:Icons.Clock, label:'Start',    val: fmtFull(s.scheduled_start) },
              { icon:Icons.Clock, label:'End',      val: fmtFull(s.scheduled_end) },
              { icon:Icons.Activity, label:'Duration', val: `${dur} minutes` },
              { icon:Icons.Info, label:'Status',   val: cfg.label },
              { icon:Icons.User, label:'Teacher',  val: s.teacher_name },
              { icon:Icons.GraduationCap, label:'Student',  val: s.student_name },
            ].map(r => (
              <div key={r.label} style={{ background: 'rgba(255,255,255,.5)', borderRadius:12, padding:'12px 14px', border: `1px solid ${C.border}` }}>
                <div style={{ fontSize:'.7rem', color:C.sub, fontWeight:600, marginBottom:4, display:'flex', alignItems:'center', gap:4 }}>
                  <r.icon size={12} /> {r.label}
                </div>
                <div style={{ fontSize:'.85rem', fontWeight:600, color: C.text }}>{r.val || '—'}</div>
              </div>
            ))}
          </div>

          {s.room_name && (
            <div style={{
              background:'rgba(139,92,246,.06)', border:`1px solid ${C.blue}20`, borderRadius:12,
              padding:'12px 16px', marginBottom:'1.25rem', fontSize:'.85rem',
              display:'flex', alignItems:'center', gap:8,
            }}>
              <Icons.MapPin size={14} style={{ color: C.blue }} />
              <span style={{ color: C.sub }}>Room ID:</span>
              <code style={{ fontWeight:700, color: C.blue, letterSpacing:'.03em' }}>{s.room_name}</code>
            </div>
          )}

          {s.actual_start_time && (
            <div style={{
              background:'rgba(16,185,129,.06)', border:`1px solid ${C.green}20`, borderRadius:12,
              padding:'12px 16px', marginBottom:'1.25rem', fontSize:'.82rem',
            }}>
              <div style={{ color:C.green, fontWeight:700, marginBottom:6, display:'flex', alignItems:'center', gap:6 }}>
                <Icons.CheckCircle size={14} /> Actual Session Times
              </div>
              <div style={{ color: C.text }}>Started: <strong>{fmtFull(s.actual_start_time)}</strong></div>
              {s.actual_end_time && <div style={{ color: C.text, marginTop:4 }}>Ended: <strong>{fmtFull(s.actual_end_time)}</strong></div>}
            </div>
          )}

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            {live && (
              <Btn color={C.green} disabled={joining === s.id} onClick={() => onJoin(s)}>
                {joining === s.id ? <Icons.Loader size={14} /> : <Icons.Play size={14} />} Join Live Class
              </Btn>
            )}
            <Btn color={C.gray} outline onClick={onClose}>Close</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionViewer;