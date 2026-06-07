import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { eatTime, eatFull, eatDate, eatTodayISO, eatTodayLabel } from '../../utils/eatTime';

const CLASSROOM_URL = import.meta.env.VITE_CLASSROOM_URL || 'http://localhost:3000';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  blue   : '#2563eb', blueBg  : '#eff6ff', blueMid : '#1d4ed8',
  green  : '#059669', greenBg : '#ecfdf5', greenMid: '#047857',
  gray   : '#6b7280', grayBg  : '#f9fafb',
  red    : '#dc2626', redBg   : '#fef2f2',
  amber  : '#d97706', amberBg : '#fffbeb',
  purple : '#7c3aed', purpleBg: '#f5f3ff',
  cyan   : '#0891b2', cyanBg  : '#ecfeff',
  slate  : '#475569',
  border : '#e5e7eb',
  text   : '#111827',
  sub    : '#6b7280',
  light  : '#f8fafc',
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

// ── Global styles (injected once) ─────────────────────────────────────────────
const GLOBAL_CSS = `
  @keyframes sv-pulse  { 0%,100%{opacity:1} 50%{opacity:.35} }
  @keyframes sv-slide  { from{transform:translateX(105%)} to{transform:translateX(0)} }
  @keyframes sv-fadein { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sv-blink  { 0%,100%{box-shadow:0 0 0 0 rgba(5,150,105,.5)} 70%{box-shadow:0 0 0 8px rgba(5,150,105,0)} }
  .sv-day:hover   { background:#f0f9ff !important; }
  .sv-scard:hover { background:#f8fafc !important; transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,0,0,.08)!important; }
  .sv-btn:hover   { filter:brightness(.92); }
  .sv-trow:hover  { background:#f0f9ff !important; cursor:pointer; }
  .sv-pill { display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:9999px;font-size:.72rem;font-weight:700; }
`;

// ── Badge ─────────────────────────────────────────────────────────────────────
const Badge = ({ status, sm }) => {
  const cfg = STATUS_CFG[status] || STATUS_CFG.scheduled;
  return (
    <span className="sv-pill" style={{
      color: cfg.color, background: cfg.bg,
      border: `1px solid ${cfg.color}28`,
      fontSize: sm ? '.65rem' : '.72rem',
    }}>
      {status === 'active' && <span style={{ width:6,height:6,borderRadius:'50%',background:C.green,animation:'sv-pulse 1.4s infinite' }} />}
      {cfg.label}
    </span>
  );
};

// ── Action button ─────────────────────────────────────────────────────────────
const Btn = ({ color = C.blue, outline, small, disabled, onClick, children }) => (
  <button className="sv-btn" onClick={onClick} disabled={disabled} style={{
    padding: small ? '3px 10px' : '5px 14px',
    fontSize: small ? '.72rem' : '.78rem',
    fontWeight: 700, borderRadius: 7, cursor: disabled ? 'not-allowed' : 'pointer',
    border: `1.5px solid ${color}`,
    background: outline ? '#fff' : color,
    color: outline ? color : '#fff',
    opacity: disabled ? .55 : 1,
    transition: 'filter .12s',
  }}>{children}</button>
);

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ icon, label, value, color, sub, trend }) => {
  const up   = trend > 0;
  const down = trend < 0;
  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '1.1rem 1.25rem',
      boxShadow: '0 1px 4px rgba(0,0,0,.06)', flex: '1 1 150px', minWidth: 0,
      borderTop: `3px solid ${color}`, display: 'flex', flexDirection: 'column', gap: 6,
      animation: 'sv-fadein .3s ease',
    }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ fontSize:'1.45rem', lineHeight:1 }}>{icon}</div>
        {trend !== undefined && trend !== null && (
          <span style={{
            fontSize:'.68rem', fontWeight:700, padding:'2px 7px', borderRadius:9999,
            background: up ? '#dcfce7' : down ? '#fee2e2' : '#f3f4f6',
            color:      up ? '#15803d' : down ? '#b91c1c' : C.gray,
          }}>
            {up ? '↑' : down ? '↓' : '─'} {Math.abs(trend)}
          </span>
        )}
      </div>
      <div style={{ fontSize:'2rem', fontWeight:900, color, lineHeight:1.1 }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize:'.75rem', fontWeight:700, color: C.gray }}>{label}</div>
      {sub && <div style={{ fontSize:'.68rem', color:'#9ca3af' }}>{sub}</div>}
    </div>
  );
};

// ── Today timeline entry ──────────────────────────────────────────────────────
const TimelineRow = ({ s, onDetail, onJoin, joining }) => {
  const live = isLiveFn(s);
  const cfg  = STATUS_CFG[s.status] || STATUS_CFG.scheduled;
  const dur  = Math.round((new Date(s.scheduled_end) - new Date(s.scheduled_start)) / 60000);
  return (
    <div className="sv-trow" onClick={() => onDetail(s)} style={{
      display:'flex', alignItems:'stretch', gap:0,
      borderRadius:10, overflow:'hidden',
      border:`1px solid ${live ? '#86efac' : C.border}`,
      background: live ? '#f0fdf4' : '#fff',
      boxShadow: live ? '0 0 0 2px #86efac' : 'none',
      animation: 'sv-fadein .25s ease',
      transition: 'background .15s',
    }}>
      {/* Color stripe */}
      <div style={{ width:4, flexShrink:0, background: cfg.color }} />

      {/* Time column */}
      <div style={{
        width:70, flexShrink:0, display:'flex', flexDirection:'column',
        alignItems:'center', justifyContent:'center', padding:'0.6rem 0',
        borderRight:`1px solid ${C.border}`, background: C.light,
        fontSize:'.72rem', fontWeight:700, color: C.slate, gap:2,
      }}>
        <span>{fmt(s.scheduled_start)}</span>
        <span style={{ color:'#9ca3af', fontWeight:400 }}>{dur}m</span>
        <span>{fmt(s.scheduled_end)}</span>
      </div>

      {/* Content */}
      <div style={{ flex:1, padding:'0.6rem 0.9rem', display:'flex', flexDirection:'column', gap:4, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ fontWeight:700, fontSize:'.85rem', color: C.text }}>
            {s.teacher_name}
          </span>
          <span style={{ color:'#9ca3af', fontSize:'.8rem' }}>→</span>
          <span style={{ fontWeight:700, fontSize:'.85rem', color: C.text }}>
            {s.student_name}
          </span>
          {live && (
            <span style={{
              background:'#dcfce7', color:'#15803d', padding:'1px 8px',
              borderRadius:9999, fontSize:'.62rem', fontWeight:800, letterSpacing:'.05em',
              display:'flex', alignItems:'center', gap:4,
            }}>
              <span style={{ width:5,height:5,borderRadius:'50%',background:'#16a34a',animation:'sv-pulse 1.4s infinite' }} />
              LIVE
            </span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Badge status={s.status} sm />
          {s.room_name && (
            <code style={{ fontSize:'.65rem', background:'#f1f5f9', padding:'1px 6px', borderRadius:4, color: C.slate }}>
              {s.room_name}
            </code>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'0 0.75rem', flexShrink:0 }}
           onClick={e => e.stopPropagation()}>
        {live && (
          <Btn color={C.green} small disabled={joining === s.id} onClick={() => onJoin(s)}>
            {joining === s.id ? '…' : '▶ Join'}
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

  // Calendar state
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);
  const [calData,  setCalData]  = useState([]);

  // Stats
  const [stats, setStats] = useState(null);

  // Today timeline
  const [todaySessions, setTodaySessions] = useState([]);
  const [todayLoading,  setTodayLoading]  = useState(true);
  const [showTimeline,  setShowTimeline]  = useState(true);

  // Drawer
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const [selectedDay,  setSelectedDay]  = useState(null);
  const [daySessions,  setDaySessions]  = useState([]);
  const [dayLoading,   setDayLoading]   = useState(false);

  // Filters (drawer)
  const [search,         setSearch]         = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterTeacher,  setFilterTeacher]  = useState('');
  const [teachers,       setTeachers]       = useState([]);

  // Detail modal
  const [detailSess, setDetailSess] = useState(null);

  // Actions
  const [joining,    setJoining]    = useState(null);
  const [cancelling, setCancelling] = useState(null);

  const drawerRef = useRef(null);
  const todayStr  = todayISO();

  // ── Loaders ──────────────────────────────────────────────────────────────────
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

  // Auto-refresh every 20 s
  useEffect(() => {
    const t = setInterval(() => {
      loadStats(); loadToday();
      if (selectedDay) openDay(selectedDay);
    }, 20000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  // Close drawer on outside click
  useEffect(() => {
    const h = e => { if (drawerRef.current && !drawerRef.current.contains(e.target)) setDrawerOpen(false); };
    if (drawerOpen) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [drawerOpen]);

  // ── Day drawer ────────────────────────────────────────────────────────────────
  const openDay = async dateStr => {
    setSelectedDay(dateStr);
    setDrawerOpen(true);
    setDayLoading(true);
    setSearch(''); setFilterStatus(''); setFilterTeacher('');
    try { const { data } = await axios.get(`/api/sessions/admin/day/${dateStr}`); setDaySessions(data); }
    catch { toast.error('Failed to load sessions'); }
    finally { setDayLoading(false); }
  };

  // ── Session actions ───────────────────────────────────────────────────────────
  const joinLive = async s => {
    setJoining(s.id);
    try {
      const { data } = await axios.get(`/api/sessions/classroom/join/${s.id}`);
      window.open(data.url, '_blank');
    } catch {
      window.open(`${CLASSROOM_URL}/student.html?room=${encodeURIComponent(s.room_name || s.id)}&name=Admin`, '_blank');
    } finally { setJoining(null); }
  };

  const cancelSession = async s => {
    if (!window.confirm(`Cancel session: ${s.teacher_name} → ${s.student_name}?`)) return;
    setCancelling(s.id);
    try {
      await axios.put(`/api/sessions/${s.id}`, { status: 'cancelled' });
      toast.success('Session cancelled');
      openDay(selectedDay); loadStats(); loadCalendar(); loadToday();
    } catch { toast.error('Failed to cancel'); }
    finally { setCancelling(null); }
  };

  // ── Calendar build ────────────────────────────────────────────────────────────
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

  // ── Drawer filters ────────────────────────────────────────────────────────────
  const visibleSessions = daySessions.filter(s => {
    const q = search.toLowerCase();
    if (q && !s.teacher_name?.toLowerCase().includes(q) && !s.student_name?.toLowerCase().includes(q)) return false;
    if (filterTeacher && s.teacher_id !== filterTeacher) return false;
    if (filterStatus  && s.status    !== filterStatus)   return false;
    return true;
  });

  // ── Calendar nav ─────────────────────────────────────────────────────────────
  const prevMonth = () => { if (calMonth === 1) { setCalYear(y => y-1); setCalMonth(12); } else setCalMonth(m => m-1); };
  const nextMonth = () => { if (calMonth === 12) { setCalYear(y => y+1); setCalMonth(1); } else setCalMonth(m => m+1); };
  const goToday   = () => { setCalYear(now.getFullYear()); setCalMonth(now.getMonth()+1); };

  // ── Trend helper ──────────────────────────────────────────────────────────────
  const trend = (cur, prev) => (cur == null || prev == null) ? null : Number(cur) - Number(prev);

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily:'system-ui,-apple-system,sans-serif', color: C.text }}>
      <style>{GLOBAL_CSS}</style>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 1 — STAT CARDS
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
        <StatCard icon="📅" label="Scheduled"         color={C.blue}
          value={stats?.scheduled}   sub="Upcoming"
          trend={trend(stats?.scheduled, null)} />
        <StatCard icon="🔴" label="Live Right Now"     color={C.green}
          value={stats?.active}      sub="Active sessions"
          trend={null} />
        <StatCard icon="✅" label="Completed"          color={C.gray}
          value={stats?.completed}   sub="All time"
          trend={null} />
        <StatCard icon="✕"  label="Cancelled"          color={C.red}
          value={stats?.cancelled}   sub="All time"
          trend={null} />
        <StatCard icon="👨‍🏫" label="Teachers Teaching"  color={C.purple}
          value={stats?.teachers_teaching ?? '—'} sub="Right now"
          trend={null} />
        <StatCard icon="🎓" label="Students In Class"  color={C.cyan}
          value={stats?.students_in_class ?? '—'} sub="Right now"
          trend={null} />
        <StatCard icon="🗓" label="Today"              color={C.amber}
          value={stats?.today_total} sub={stats?.today_active > 0 ? `${stats.today_active} live` : 'No live'}
          trend={trend(stats?.today_total, stats?.yesterday_total)} />
        <StatCard icon="📆" label="Next 7 Days"        color={C.blueMid}
          value={stats?.upcoming_7d} sub="Scheduled ahead"
          trend={null} />
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 2 — TODAY'S TIMELINE
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{
        background:'#fff', borderRadius:14, marginBottom:'1.5rem',
        boxShadow:'0 1px 6px rgba(0,0,0,.07)', overflow:'hidden',
      }}>
        {/* Timeline header */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'0.85rem 1.25rem', borderBottom:`1px solid ${C.border}`,
          background: C.light,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <span style={{ fontSize:'1.1rem' }}>🕐</span>
            <div>
              <div style={{ fontWeight:800, fontSize:'.9rem', color: C.text }}>Today's Schedule</div>
              <div style={{ fontSize:'.72rem', color: C.sub }}>
                {eatTodayLabel()}
              </div>
            </div>
            {stats?.today_active > 0 && (
              <span style={{
                display:'flex', alignItems:'center', gap:5,
                background:'#dcfce7', color:'#15803d',
                padding:'3px 10px', borderRadius:9999,
                fontSize:'.72rem', fontWeight:800,
                animation:'sv-blink 2s infinite',
              }}>
                <span style={{ width:7,height:7,borderRadius:'50%',background:'#16a34a',animation:'sv-pulse 1.4s infinite' }} />
                {stats.today_active} LIVE NOW
              </span>
            )}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span style={{ fontSize:'.78rem', color: C.sub, fontWeight:600 }}>
              {todaySessions.length} sessions today
            </span>
            <button onClick={() => setShowTimeline(v => !v)} style={{
              background:'none', border:`1px solid ${C.border}`, borderRadius:7,
              padding:'4px 10px', cursor:'pointer', fontSize:'.75rem', color: C.sub, fontWeight:600,
            }}>
              {showTimeline ? '▲ Hide' : '▼ Show'}
            </button>
          </div>
        </div>

        {showTimeline && (
          <div style={{ padding:'0.75rem 1rem' }}>
            {todayLoading ? (
              <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af', fontSize:'.85rem' }}>
                <span style={{ display:'block', fontSize:'1.5rem', marginBottom:6 }}>⏳</span>
                Loading today's sessions…
              </div>
            ) : todaySessions.length === 0 ? (
              <div style={{ textAlign:'center', padding:'2rem', color:'#9ca3af' }}>
                <span style={{ display:'block', fontSize:'2rem', marginBottom:6 }}>📭</span>
                <span style={{ fontSize:'.85rem' }}>No sessions scheduled for today</span>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {todaySessions.map(s => (
                  <TimelineRow key={s.id} s={s} onDetail={setDetailSess} onJoin={joinLive} joining={joining} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 3 — CALENDAR
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div style={{
        background:'#fff', borderRadius:14,
        boxShadow:'0 1px 6px rgba(0,0,0,.07)', overflow:'hidden',
      }}>
        {/* Calendar toolbar */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'1rem 1.5rem',
          background:`linear-gradient(135deg,${C.blueMid} 0%,${C.blue} 100%)`,
        }}>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={prevMonth} style={{
              background:'rgba(255,255,255,.18)', border:'none', color:'#fff',
              borderRadius:8, padding:'5px 14px', cursor:'pointer', fontWeight:800, fontSize:'1rem',
            }}>‹</button>
            <button onClick={nextMonth} style={{
              background:'rgba(255,255,255,.18)', border:'none', color:'#fff',
              borderRadius:8, padding:'5px 14px', cursor:'pointer', fontWeight:800, fontSize:'1rem',
            }}>›</button>
          </div>

          <div style={{ textAlign:'center' }}>
            <div style={{ color:'#fff', fontWeight:800, fontSize:'1.15rem', letterSpacing:'.01em' }}>
              {MONTH_NAMES[calMonth-1]} {calYear}
            </div>
            <div style={{ color:'rgba(255,255,255,.7)', fontSize:'.72rem', marginTop:2 }}>
              {calData.reduce((a,b) => a + Number(b.total), 0)} sessions this month
            </div>
          </div>

          <button onClick={goToday} style={{
            background:'rgba(255,255,255,.18)', border:'1px solid rgba(255,255,255,.35)',
            color:'#fff', borderRadius:8, padding:'5px 14px',
            cursor:'pointer', fontWeight:700, fontSize:'.78rem',
          }}>Today</button>
        </div>

        {/* Weekday row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', background: C.light }}>
          {WEEKDAYS.map(d => (
            <div key={d} style={{
              textAlign:'center', padding:'.55rem 0',
              fontSize:'.7rem', fontWeight:700, color: C.sub, letterSpacing:'.06em',
              borderBottom:`1px solid ${C.border}`,
            }}>{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
          {cells.map((day, i) => {
            if (!day) return (
              <div key={`e-${i}`} style={{
                minHeight:84, background:'#fafafa',
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
                minHeight:84, padding:'.5rem .45rem', position:'relative',
                borderRight:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`,
                background: isSelected ? '#eff6ff' : isToday ? '#fefce8' : '#fff',
                transition:'background .12s',
                outline: isToday ? `2px solid ${C.blue}` : 'none',
                outlineOffset:'-2px',
              }}>
                {/* Live pulse ring */}
                {hasActive && (
                  <span style={{
                    position:'absolute', top:6, right:6,
                    width:8, height:8, borderRadius:'50%', background: C.green,
                    animation:'sv-blink 2s infinite',
                  }} />
                )}

                {/* Day number */}
                <div style={{
                  display:'inline-flex', alignItems:'center', justifyContent:'center',
                  width:26, height:26, borderRadius:'50%', fontSize:'.82rem', fontWeight:800,
                  background: isToday ? C.blue : 'transparent',
                  color: isToday ? '#fff' : isPast ? '#b0b7c3' : C.text,
                }}>{day}</div>

                {/* Badges */}
                {r && Number(r.total) > 0 && (
                  <div style={{ marginTop:4, display:'flex', flexDirection:'column', gap:3 }}>
                    {/* Total */}
                    <span style={{
                      display:'inline-block', background: C.blueBg, color: C.blue,
                      borderRadius:9999, padding:'1px 8px', fontSize:'.62rem', fontWeight:800,
                    }}>{r.total} session{r.total !== '1' ? 's' : ''}</span>

                    {/* Sub-badges row */}
                    <div style={{ display:'flex', gap:2, flexWrap:'wrap' }}>
                      {Number(r.active) > 0 && (
                        <span style={{
                          background:'#dcfce7', color:'#15803d', borderRadius:9999,
                          padding:'1px 6px', fontSize:'.58rem', fontWeight:700,
                          display:'flex', alignItems:'center', gap:2,
                        }}>
                          <span style={{ width:4,height:4,borderRadius:'50%',background:'#16a34a',animation:'sv-pulse 1.4s infinite' }} />
                          {r.active}
                        </span>
                      )}
                      {Number(r.cancelled) > 0 && (
                        <span style={{
                          background:'#fee2e2', color:'#b91c1c', borderRadius:9999,
                          padding:'1px 6px', fontSize:'.58rem', fontWeight:700,
                        }}>✕{r.cancelled}</span>
                      )}
                      {Number(r.completed) > 0 && (
                        <span style={{
                          background:'#f3f4f6', color: C.gray, borderRadius:9999,
                          padding:'1px 6px', fontSize:'.58rem', fontWeight:700,
                        }}>✓{r.completed}</span>
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
          padding:'.65rem 1.5rem', borderTop:`1px solid ${C.border}`,
          background: C.light, display:'flex', gap:'1.25rem', flexWrap:'wrap',
          fontSize:'.7rem', color: C.sub,
        }}>
          {[
            { bg:'#dbeafe', label:'Total sessions' },
            { bg:'#dcfce7', label:'● Live' },
            { bg:'#fee2e2', label:'✕ Cancelled' },
            { bg:'#f3f4f6', label:'✓ Completed' },
          ].map(l => (
            <div key={l.label} style={{ display:'flex', alignItems:'center', gap:5 }}>
              <span style={{ width:10,height:10,background:l.bg,borderRadius:3,flexShrink:0 }} />
              {l.label}
            </div>
          ))}
          <div style={{ marginLeft:'auto', fontStyle:'italic' }}>Click any day to view sessions</div>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 4 — DAY DRAWER
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {drawerOpen && (
        <div style={{
          position:'fixed', inset:0, zIndex:60,
          background:'rgba(15,23,42,.4)', backdropFilter:'blur(3px)',
        }}>
          <div ref={drawerRef} style={{
            position:'absolute', right:0, top:0, bottom:0,
            width:'min(540px,100vw)', background:'#fff',
            display:'flex', flexDirection:'column',
            boxShadow:'-6px 0 32px rgba(0,0,0,.15)',
            animation:'sv-slide .28s cubic-bezier(.4,0,.2,1)',
          }}>
            {/* Drawer header */}
            <div style={{
              background:`linear-gradient(135deg,${C.blueMid},${C.blue})`,
              padding:'1.25rem 1.5rem', flexShrink:0,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div>
                  <div style={{ color:'rgba(255,255,255,.65)', fontSize:'.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.07em' }}>
                    Sessions for
                  </div>
                  <div style={{ color:'#fff', fontWeight:800, fontSize:'1.05rem', marginTop:3 }}>
                    {selectedDay ? fmtDate(selectedDay + 'T00:00:00') : ''}
                  </div>
                  {!dayLoading && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:5 }}>
                      <span style={{ color:'rgba(255,255,255,.7)', fontSize:'.75rem' }}>
                        {daySessions.length} session{daySessions.length !== 1 ? 's' : ''}
                      </span>
                      {daySessions.filter(s => s.status === 'active').length > 0 && (
                        <span style={{
                          background:'#dcfce7', color:'#15803d',
                          padding:'2px 9px', borderRadius:9999,
                          fontSize:'.65rem', fontWeight:800,
                          display:'flex', alignItems:'center', gap:4,
                        }}>
                          <span style={{ width:5,height:5,borderRadius:'50%',background:'#16a34a',animation:'sv-pulse 1.4s infinite' }} />
                          {daySessions.filter(s => s.status === 'active').length} LIVE
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => setDrawerOpen(false)} style={{
                  background:'rgba(255,255,255,.18)', border:'none', color:'#fff',
                  borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'.95rem', lineHeight:1,
                }}>✕</button>
              </div>

              {/* Status summary pills */}
              {!dayLoading && daySessions.length > 0 && (
                <div style={{ display:'flex', gap:6, marginTop:'0.85rem', flexWrap:'wrap' }}>
                  {Object.entries(STATUS_CFG).map(([k, v]) => {
                    const count = daySessions.filter(s => s.status === k).length;
                    if (!count) return null;
                    return (
                      <button key={k} onClick={() => setFilterStatus(filterStatus === k ? '' : k)} style={{
                        padding:'2px 10px', borderRadius:9999, fontSize:'.68rem', fontWeight:700,
                        background: filterStatus === k ? '#fff' : 'rgba(255,255,255,.18)',
                        color:      filterStatus === k ? v.color : 'rgba(255,255,255,.85)',
                        border:'1px solid rgba(255,255,255,.25)', cursor:'pointer',
                      }}>
                        {v.label} {count}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Search + teacher filter */}
              <div style={{ display:'flex', gap:6, marginTop:'0.75rem', flexWrap:'wrap' }}>
                <input
                  placeholder="🔍  Search teacher or student…"
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{
                    flex:'1 1 150px', padding:'6px 10px', borderRadius:8, fontSize:'.78rem',
                    border:'1px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.15)',
                    color:'#fff', outline:'none',
                  }}
                />
                <select value={filterTeacher} onChange={e => setFilterTeacher(e.target.value)} style={{
                  padding:'6px 10px', borderRadius:8, fontSize:'.78rem',
                  border:'1px solid rgba(255,255,255,.3)', background:'rgba(255,255,255,.15)',
                  color: filterTeacher ? '#fff' : 'rgba(255,255,255,.65)',
                }}>
                  <option value="">All Teachers</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.username}</option>)}
                </select>
              </div>
            </div>

            {/* Session list */}
            <div style={{ flex:1, overflowY:'auto', padding:'0.9rem' }}>
              {dayLoading ? (
                <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>
                  <span style={{ display:'block', fontSize:'2rem', marginBottom:8 }}>⏳</span>
                  Loading sessions…
                </div>
              ) : visibleSessions.length === 0 ? (
                <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>
                  <span style={{ display:'block', fontSize:'2.5rem', marginBottom:8 }}>📭</span>
                  <span style={{ fontSize:'.85rem' }}>
                    {search || filterStatus || filterTeacher ? 'No sessions match your filters' : 'No sessions on this day'}
                  </span>
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
              padding:'.65rem 1.25rem', borderTop:`1px solid ${C.border}`,
              background: C.light, display:'flex', gap:'1rem', flexWrap:'wrap',
              fontSize:'.7rem', color:'#9ca3af', flexShrink:0,
            }}>
              {Object.entries(STATUS_CFG).map(([k,v]) => {
                const count = daySessions.filter(s => s.status === k).length;
                return (
                  <span key={k} style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ width:7,height:7,borderRadius:'50%',background:v.color }} />
                    {v.label}: {count}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION 5 — DETAIL MODAL
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
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
      background: live ? '#f0fdf4' : '#fff',
      border:`1px solid ${live ? '#86efac' : C.border}`,
      borderLeft:`4px solid ${cfg.color}`,
      borderRadius:11, padding:'.85rem 1rem',
      cursor:'pointer', transition:'transform .12s, box-shadow .12s',
      boxShadow:'0 1px 3px rgba(0,0,0,.06)',
      animation:'sv-fadein .2s ease',
    }}>
      {/* Header row */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontWeight:800, fontSize:'.9rem', color: C.text }}>
            {fmt(s.scheduled_start)} – {fmt(s.scheduled_end)}
          </span>
          <span style={{ fontSize:'.68rem', color: C.sub, background:'#f3f4f6', padding:'1px 7px', borderRadius:9999 }}>
            {dur}m
          </span>
          {live && (
            <span style={{
              background:'#dcfce7', color:'#15803d', padding:'1px 8px', borderRadius:9999,
              fontSize:'.62rem', fontWeight:800, letterSpacing:'.05em',
              display:'flex', alignItems:'center', gap:3,
            }}>
              <span style={{ width:5,height:5,borderRadius:'50%',background:'#16a34a',animation:'sv-pulse 1.4s infinite' }} />
              LIVE
            </span>
          )}
        </div>
        <Badge status={s.status} sm />
      </div>

      {/* Participants */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
        <div style={{
          display:'flex', alignItems:'center', gap:5, background: C.light,
          borderRadius:7, padding:'4px 10px', fontSize:'.8rem',
        }}>
          <span style={{ fontSize:'.85rem' }}>👨‍🏫</span>
          <span style={{ fontWeight:700, color: C.text }}>{s.teacher_name}</span>
          <span style={{ color:'#9ca3af' }}>→</span>
          <span style={{ fontSize:'.85rem' }}>🎓</span>
          <span style={{ fontWeight:700, color: C.text }}>{s.student_name}</span>
        </div>
      </div>

      {/* Room code */}
      {s.room_name && (
        <div style={{ fontSize:'.68rem', color:'#9ca3af', marginBottom:8 }}>
          🚪 <code style={{ background:'#f1f5f9', padding:'1px 5px', borderRadius:4 }}>{s.room_name}</code>
        </div>
      )}

      {/* Actions */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap' }} onClick={e => e.stopPropagation()}>
        <Btn color={C.blue} small onClick={() => onDetail(s)}>🔍 Details</Btn>
        {live && (
          <Btn color={C.green} small disabled={joining === s.id} onClick={() => onJoin(s)}>
            {joining === s.id ? '…' : '▶ Join Live'}
          </Btn>
        )}
        {s.status === 'scheduled' && (
          <Btn color={C.red} outline small disabled={cancelling === s.id} onClick={() => onCancel(s)}>
            {cancelling === s.id ? '…' : '✕ Cancel'}
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
      background:'rgba(15,23,42,.5)', backdropFilter:'blur(4px)',
      display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background:'#fff', borderRadius:18, width:'100%', maxWidth:500,
        boxShadow:'0 24px 64px rgba(0,0,0,.22)', overflow:'hidden',
        animation:'sv-fadein .22s ease',
      }}>
        {/* Modal header */}
        <div style={{
          padding:'1.25rem 1.5rem',
          background:`linear-gradient(135deg,${cfg.color}e0,${cfg.color})`,
          display:'flex', justifyContent:'space-between', alignItems:'flex-start',
        }}>
          <div>
            <div style={{ color:'rgba(255,255,255,.7)', fontSize:'.68rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>
              Session Details
            </div>
            <div style={{ color:'#fff', fontWeight:800, fontSize:'1.05rem', marginBottom:8 }}>
              {s.title || `${s.teacher_name} → ${s.student_name}`}
            </div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
              <Badge status={s.status} />
              {live && (
                <span style={{
                  background:'#dcfce7', color:'#15803d', padding:'2px 9px', borderRadius:9999,
                  fontSize:'.65rem', fontWeight:800,
                  display:'flex', alignItems:'center', gap:4,
                }}>
                  <span style={{ width:6,height:6,borderRadius:'50%',background:'#16a34a',animation:'sv-pulse 1.4s infinite' }} />
                  LIVE NOW
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'rgba(255,255,255,.2)', border:'none', color:'#fff',
            borderRadius:8, padding:'6px 12px', cursor:'pointer', fontSize:'.9rem',
          }}>✕</button>
        </div>

        {/* Modal body */}
        <div style={{ padding:'1.5rem' }}>
          {/* Info grid */}
          <div style={{
            display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.9rem', marginBottom:'1.1rem',
          }}>
            {[
              { icon:'🕐', label:'Start',    val: fmtFull(s.scheduled_start) },
              { icon:'🕑', label:'End',      val: fmtFull(s.scheduled_end) },
              { icon:'⏱',  label:'Duration', val: `${dur} minutes` },
              { icon:'📊', label:'Status',   val: cfg.label },
              { icon:'👨‍🏫', label:'Teacher',  val: s.teacher_name },
              { icon:'🎓', label:'Student',  val: s.student_name },
            ].map(r => (
              <div key={r.label} style={{ background: C.light, borderRadius:9, padding:'.65rem .85rem' }}>
                <div style={{ fontSize:'.65rem', color:'#9ca3af', fontWeight:700, marginBottom:3 }}>{r.icon} {r.label}</div>
                <div style={{ fontSize:'.82rem', fontWeight:700, color: C.text }}>{r.val || '—'}</div>
              </div>
            ))}
          </div>

          {/* Room */}
          {s.room_name && (
            <div style={{
              background:'#f0f9ff', border:`1px solid ${C.blueBg}`, borderRadius:9,
              padding:'.65rem .9rem', marginBottom:'0.9rem', fontSize:'.8rem',
              display:'flex', alignItems:'center', gap:8,
            }}>
              <span>🚪</span>
              <span style={{ color: C.sub }}>Room ID:</span>
              <code style={{ fontWeight:800, color: C.blue, letterSpacing:'.03em' }}>{s.room_name}</code>
            </div>
          )}

          {/* Actual times */}
          {s.actual_start_time && (
            <div style={{
              background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:9,
              padding:'.65rem .9rem', marginBottom:'0.9rem', fontSize:'.78rem',
            }}>
              <div style={{ color:'#15803d', fontWeight:800, marginBottom:5 }}>✅ Actual Session Times</div>
              <div style={{ color: C.text }}>Started: <strong>{fmtFull(s.actual_start_time)}</strong></div>
              {s.actual_end_time && <div style={{ color: C.text, marginTop:2 }}>Ended: <strong>{fmtFull(s.actual_end_time)}</strong></div>}
            </div>
          )}

          {/* Actions */}
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            {live && (
              <Btn color={C.green} disabled={joining === s.id} onClick={() => onJoin(s)}>
                {joining === s.id ? '…' : '▶ Join Live Class'}
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
