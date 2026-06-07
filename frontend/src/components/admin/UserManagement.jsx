import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { eatTime, eatShortDate, eatAgo } from '../../utils/eatTime';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  blue  : '#2563eb', blueBg  : '#eff6ff', blueMid : '#1d4ed8',
  green : '#059669', greenBg : '#ecfdf5',
  red   : '#dc2626', redBg   : '#fef2f2',
  amber : '#d97706', amberBg : '#fffbeb',
  purple: '#7c3aed', purpleBg: '#f5f3ff',
  gray  : '#6b7280', grayBg  : '#f9fafb',
  border: '#e5e7eb', text: '#111827', sub: '#6b7280', light: '#f8fafc',
};

const ROLE_CFG = {
  admin  : { color: C.purple, bg: C.purpleBg, icon: '🛡️',  label: 'Admins'   },
  teacher: { color: C.blue,   bg: C.blueBg,   icon: '👨🏫', label: 'Teachers' },
  student: { color: C.green,  bg: C.greenBg,  icon: '🎓',  label: 'Students' },
};

const CSS = `
  @keyframes um-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes um-slide  { from{transform:translateX(105%)} to{transform:translateX(0)} }
  .um-row:hover  { background:#f0f9ff !important; cursor:pointer; }
  .um-card:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(0,0,0,.1)!important; }
  .um-btn:hover  { filter:brightness(.92); }
  .um-inp:focus  { outline:none; border-color:${C.blue}; box-shadow:0 0 0 3px ${C.blueBg}; }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt     = eatTime;
const fmtDate = eatShortDate;
const fmtAgo  = eatAgo;

const Btn = ({ color = C.blue, outline, small, disabled, onClick, children, style = {} }) => (
  <button className="um-btn" onClick={onClick} disabled={disabled} style={{
    padding: small ? '3px 10px' : '6px 16px',
    fontSize: small ? '.72rem' : '.8rem',
    fontWeight: 700, borderRadius: 7,
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: `1.5px solid ${color}`,
    background: outline ? '#fff' : color,
    color: outline ? color : '#fff',
    opacity: disabled ? .55 : 1,
    transition: 'filter .12s',
    ...style,
  }}>{children}</button>
);

const Tag = ({ color, bg, children }) => (
  <span style={{
    display:'inline-flex', alignItems:'center', padding:'2px 9px',
    borderRadius:9999, fontSize:'.68rem', fontWeight:700,
    color, background: bg, border:`1px solid ${color}28`,
  }}>{children}</span>
);

// ── Workload bar ──────────────────────────────────────────────────────────────
const WorkloadBar = ({ value, max = 20, color }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const bg  = pct > 75 ? C.red : pct > 40 ? C.amber : C.green;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ flex:1, height:5, background:'#e5e7eb', borderRadius:9999, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background: color || bg, borderRadius:9999, transition:'width .3s' }} />
      </div>
      <span style={{ fontSize:'.65rem', fontWeight:700, color: C.sub, minWidth:24 }}>{value}</span>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
const UserManagement = () => {
  const [stats,       setStats]       = useState(null);
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [activeRole,  setActiveRole]  = useState('teacher');
  const [search,      setSearch]      = useState('');
  const [filterActive,setFilterActive]= useState('');   // '' | '1' | '0'
  const [sortBy,      setSortBy]      = useState('created_at'); // created_at | upcoming | completed
  const [drawerUser,  setDrawerUser]  = useState(null);
  const [drawerDetail,setDrawerDetail]= useState(null);
  const [drawerLoading,setDrawerLoading] = useState(false);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState({ username:'', password:'', role:'student' });
  const [editId,      setEditId]      = useState(null);
  const [saving,      setSaving]      = useState(false);
  const drawerRef = useRef(null);

  // ── Loaders ──────────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try { const { data } = await axios.get('/api/users/stats'); setStats(data); }
    catch { /* silent */ }
  }, []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get('/api/users', { params: { role: activeRole } });
      setUsers(data);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, [activeRole]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

  // Close drawer on outside click
  useEffect(() => {
    const h = e => { if (drawerRef.current && !drawerRef.current.contains(e.target)) setDrawerUser(null); };
    if (drawerUser) document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [drawerUser]);

  // ── Open drawer ───────────────────────────────────────────────────────────────
  const openDrawer = async u => {
    setDrawerUser(u);
    setDrawerDetail(null);
    setDrawerLoading(true);
    try { const { data } = await axios.get(`/api/users/${u.id}`); setDrawerDetail(data); }
    catch { /* silent */ }
    finally { setDrawerLoading(false); }
  };

  // ── Toggle active ─────────────────────────────────────────────────────────────
  const toggleActive = async u => {
    try {
      await axios.put(`/api/users/${u.id}`, { is_active: (u.is_active == 1 || u.is_active === true) ? 0 : 1 });
      toast.success(u.is_active ? 'User deactivated' : 'User activated');
      loadUsers(); loadStats();
      if (drawerUser?.id === u.id) openDrawer({ ...u, is_active: u.is_active ? 0 : 1 });
    } catch { toast.error('Error'); }
  };

  // ── Create / edit user ────────────────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editId) {
        await axios.put(`/api/users/${editId}`, { username: form.username });
        toast.success('User updated');
      } else {
        await axios.post('/api/auth/register', form);
        toast.success('User created');
      }
      setShowForm(false); setForm({ username:'', password:'', role:'student' }); setEditId(null);
      loadUsers(); loadStats();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setSaving(false); }
  };

  // ── Filtered + sorted users ───────────────────────────────────────────────────
  const visible = users
    .filter(u => {
      if (search && !u.username.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterActive === '1' && !(u.is_active == 1 || u.is_active === true)) return false;
      if (filterActive === '0' &&  (u.is_active == 1 || u.is_active === true)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'upcoming')   return Number(b.upcoming_sessions)  - Number(a.upcoming_sessions);
      if (sortBy === 'completed')  return Number(b.completed_sessions) - Number(a.completed_sessions);
      return new Date(b.created_at) - new Date(a.created_at);
    });

  const isActive = u => u.is_active == 1 || u.is_active === true;
  const cfg = ROLE_CFG[activeRole];

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily:'system-ui,-apple-system,sans-serif', color: C.text }}>
      <style>{CSS}</style>

      {/* ── Page header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <div style={{ fontWeight:800, fontSize:'1.25rem', color: C.text }}>User Management</div>
          <div style={{ fontSize:'.78rem', color: C.sub, marginTop:2 }}>
            {stats ? `${stats.total} total users · ${stats.active_total} active` : 'Loading…'}
          </div>
        </div>
        <Btn onClick={() => { setForm({ username:'', password:'', role: activeRole }); setEditId(null); setShowForm(true); }}>
          + Add User
        </Btn>
      </div>

      {/* ── Role cards ── */}
      <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
        {Object.entries(ROLE_CFG).map(([role, rc]) => {
          const count = stats?.[`${role}s`] ?? '—';
          const active = activeRole === role;
          return (
            <div key={role} className="um-card" onClick={() => setActiveRole(role)} style={{
              flex:'1 1 150px', minWidth:140, borderRadius:14, padding:'1.1rem 1.25rem',
              background: active ? rc.color : '#fff',
              boxShadow: active ? `0 4px 20px ${rc.color}40` : '0 1px 4px rgba(0,0,0,.06)',
              border: active ? `2px solid ${rc.color}` : `2px solid ${C.border}`,
              cursor:'pointer', transition:'transform .15s, box-shadow .15s',
              animation:'um-fadein .25s ease',
            }}>
              <div style={{ fontSize:'1.6rem', marginBottom:6 }}>{rc.icon}</div>
              <div style={{ fontSize:'1.9rem', fontWeight:900, color: active ? '#fff' : rc.color, lineHeight:1 }}>{count}</div>
              <div style={{ fontSize:'.78rem', fontWeight:700, color: active ? 'rgba(255,255,255,.85)' : C.sub, marginTop:4 }}>{rc.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Create / Edit form ── */}
      {showForm && (
        <div style={{
          background:'#fff', borderRadius:14, padding:'1.25rem 1.5rem',
          boxShadow:'0 4px 24px rgba(0,0,0,.1)', marginBottom:'1.5rem',
          border:`1px solid ${C.border}`, animation:'um-fadein .2s ease',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
            <div style={{ fontWeight:800, fontSize:'1rem' }}>{editId ? 'Edit User' : 'Create New User'}</div>
            <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.1rem', color: C.sub }}>✕</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'0.9rem' }}>
              <div>
                <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color: C.sub, marginBottom:4 }}>Username *</label>
                <input className="um-inp" required value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  style={{ width:'100%', padding:'7px 10px', border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:'.85rem', boxSizing:'border-box' }} />
              </div>
              {!editId && <>
                <div>
                  <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color: C.sub, marginBottom:4 }}>Password *</label>
                  <input className="um-inp" required type="password" value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    style={{ width:'100%', padding:'7px 10px', border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:'.85rem', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'.75rem', fontWeight:700, color: C.sub, marginBottom:4 }}>Role *</label>
                  <select className="um-inp" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                    style={{ width:'100%', padding:'7px 10px', border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:'.85rem', boxSizing:'border-box' }}>
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </>}
            </div>
            <div style={{ display:'flex', gap:8, marginTop:'1rem' }}>
              <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update User' : 'Create User'}</Btn>
              <Btn outline color={C.gray} onClick={() => setShowForm(false)}>Cancel</Btn>
            </div>
          </form>
        </div>
      )}

      {/* ── User list card ── */}
      <div style={{ background:'#fff', borderRadius:14, boxShadow:'0 1px 6px rgba(0,0,0,.07)', overflow:'hidden' }}>

        {/* List header */}
        <div style={{
          padding:'0.9rem 1.25rem', borderBottom:`1px solid ${C.border}`,
          background: C.light, display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'center',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, flex:'0 0 auto' }}>
            <span style={{ fontSize:'1.1rem' }}>{cfg.icon}</span>
            <span style={{ fontWeight:800, fontSize:'.95rem', color: C.text }}>{cfg.label}</span>
            <span style={{
              background: cfg.color, color:'#fff',
              borderRadius:9999, padding:'1px 9px', fontSize:'.7rem', fontWeight:800,
            }}>{visible.length}</span>
          </div>

          {/* Search */}
          <input
            className="um-inp" placeholder="🔍  Search by username…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              flex:'1 1 180px', padding:'6px 10px', border:`1.5px solid ${C.border}`,
              borderRadius:8, fontSize:'.8rem',
            }}
          />

          {/* Active filter */}
          <select value={filterActive} onChange={e => setFilterActive(e.target.value)}
            style={{ padding:'6px 10px', border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:'.78rem' }}>
            <option value="">All Status</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>

          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding:'6px 10px', border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:'.78rem' }}>
            <option value="created_at">Newest First</option>
            <option value="upcoming">Most Upcoming</option>
            <option value="completed">Most Completed</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>
            <div style={{ fontSize:'2rem', marginBottom:8 }}>⏳</div>Loading users…
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:8 }}>👤</div>
            No {cfg.label.toLowerCase()} found
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background: C.light }}>
                  {['User', 'Status', 'Upcoming', 'Completed', activeRole !== 'admin' ? 'Workload' : null, 'Joined', 'Last Login', 'Actions']
                    .filter(Boolean).map(h => (
                    <th key={h} style={{
                      padding:'.6rem .9rem', textAlign:'left', fontSize:'.7rem',
                      fontWeight:700, color: C.sub, letterSpacing:'.05em',
                      borderBottom:`2px solid ${C.border}`, whiteSpace:'nowrap',
                    }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(u => (
                  <tr key={u.id} className="um-row" onClick={() => openDrawer(u)}
                    style={{ background: drawerUser?.id === u.id ? '#eff6ff' : '#fff', transition:'background .12s' }}>

                    {/* User */}
                    <td style={{ padding:'.65rem .9rem', borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{
                          width:34, height:34, borderRadius:'50%', flexShrink:0,
                          background: `linear-gradient(135deg,${cfg.color},${cfg.color}99)`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color:'#fff', fontWeight:800, fontSize:'.82rem',
                        }}>
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight:700, fontSize:'.85rem', color: C.text }}>{u.username}</div>
                          <div style={{ fontSize:'.65rem', color:'#9ca3af' }}>{u.id.slice(0,8)}…</div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding:'.65rem .9rem', borderBottom:`1px solid ${C.border}` }}>
                      <Tag color={isActive(u) ? C.green : C.red} bg={isActive(u) ? C.greenBg : C.redBg}>
                        {isActive(u) ? '● Active' : '○ Inactive'}
                      </Tag>
                    </td>

                    {/* Upcoming */}
                    <td style={{ padding:'.65rem .9rem', borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ fontWeight:700, color: C.blue, fontSize:'.88rem' }}>
                        {u.upcoming_sessions ?? '—'}
                      </span>
                    </td>

                    {/* Completed */}
                    <td style={{ padding:'.65rem .9rem', borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ fontWeight:700, color: C.gray, fontSize:'.88rem' }}>
                        {u.completed_sessions ?? '—'}
                      </span>
                    </td>

                    {/* Workload bar (not for admin) */}
                    {activeRole !== 'admin' && (
                      <td style={{ padding:'.65rem .9rem', borderBottom:`1px solid ${C.border}`, minWidth:100 }}>
                        <WorkloadBar value={Number(u.upcoming_sessions) || 0} color={cfg.color} />
                      </td>
                    )}

                    {/* Joined */}
                    <td style={{ padding:'.65rem .9rem', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>
                      <span style={{ fontSize:'.78rem', color: C.sub }}>{fmtDate(u.created_at)}</span>
                    </td>

                    {/* Last login */}
                    <td style={{ padding:'.65rem .9rem', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>
                      <span style={{ fontSize:'.78rem', color: C.sub }}>{fmtAgo(u.last_login)}</span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding:'.65rem .9rem', borderBottom:`1px solid ${C.border}` }}
                        onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:5 }}>
                        <Btn small outline color={C.blue} onClick={() => {
                          setForm({ username: u.username, password:'', role: u.role });
                          setEditId(u.id); setShowForm(true);
                        }}>Edit</Btn>
                        <Btn small outline color={isActive(u) ? C.red : C.green} onClick={() => toggleActive(u)}>
                          {isActive(u) ? 'Disable' : 'Enable'}
                        </Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── User Detail Drawer ── */}
      {drawerUser && (
        <div style={{
          position:'fixed', inset:0, zIndex:60,
          background:'rgba(15,23,42,.4)', backdropFilter:'blur(3px)',
        }}>
          <div ref={drawerRef} style={{
            position:'absolute', right:0, top:0, bottom:0,
            width:'min(460px,100vw)', background:'#fff',
            display:'flex', flexDirection:'column',
            boxShadow:'-6px 0 32px rgba(0,0,0,.15)',
            animation:'um-slide .25s cubic-bezier(.4,0,.2,1)',
          }}>
            {/* Drawer header */}
            <div style={{
              background:`linear-gradient(135deg,${cfg.color}dd,${cfg.color})`,
              padding:'1.25rem 1.5rem', flexShrink:0,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{
                    width:48, height:48, borderRadius:'50%',
                    background:'rgba(255,255,255,.25)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'#fff', fontWeight:900, fontSize:'1.2rem',
                  }}>
                    {drawerUser.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color:'#fff', fontWeight:800, fontSize:'1.05rem' }}>{drawerUser.username}</div>
                    <div style={{ color:'rgba(255,255,255,.7)', fontSize:'.75rem', marginTop:2 }}>
                      {cfg.label.slice(0,-1)} · {isActive(drawerUser) ? '● Active' : '○ Inactive'}
                    </div>
                  </div>
                </div>
                <button onClick={() => setDrawerUser(null)} style={{
                  background:'rgba(255,255,255,.2)', border:'none', color:'#fff',
                  borderRadius:8, padding:'6px 11px', cursor:'pointer', fontSize:'.9rem',
                }}>✕</button>
              </div>

              {/* Quick stats */}
              <div style={{ display:'flex', gap:8, marginTop:'1rem', flexWrap:'wrap' }}>
                {[
                  { label:'Upcoming', value: drawerUser.upcoming_sessions ?? '—' },
                  { label:'Completed', value: drawerUser.completed_sessions ?? '—' },
                  { label:'Active Now', value: drawerUser.active_sessions ?? '—' },
                ].map(s => (
                  <div key={s.label} style={{
                    flex:'1 1 80px', background:'rgba(255,255,255,.18)',
                    borderRadius:10, padding:'.55rem .75rem', textAlign:'center',
                  }}>
                    <div style={{ color:'#fff', fontWeight:800, fontSize:'1.2rem', lineHeight:1 }}>{s.value}</div>
                    <div style={{ color:'rgba(255,255,255,.7)', fontSize:'.65rem', marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drawer body */}
            <div style={{ flex:1, overflowY:'auto', padding:'1.1rem 1.25rem' }}>
              {drawerLoading ? (
                <div style={{ textAlign:'center', padding:'3rem', color:'#9ca3af' }}>⏳ Loading details…</div>
              ) : (
                <>
                  {/* Info rows */}
                  <div style={{ background: C.light, borderRadius:10, padding:'0.85rem 1rem', marginBottom:'1rem' }}>
                    {[
                      { icon:'🆔', label:'User ID',    val: drawerUser.id },
                      { icon:'📅', label:'Joined',     val: fmtDate(drawerUser.created_at) },
                      { icon:'🕐', label:'Last Login', val: fmtAgo(drawerUser.last_login) },
                      { icon:'📊', label:'Status',     val: isActive(drawerUser) ? 'Active' : 'Inactive' },
                    ].map(r => (
                      <div key={r.label} style={{
                        display:'flex', justifyContent:'space-between',
                        padding:'.45rem 0', borderBottom:`1px solid ${C.border}`,
                        fontSize:'.82rem',
                      }}>
                        <span style={{ color: C.sub, fontWeight:600 }}>{r.icon} {r.label}</span>
                        <span style={{ fontWeight:700, color: C.text, maxWidth:'55%', textAlign:'right', wordBreak:'break-all' }}>{r.val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Today's sessions */}
                  {drawerDetail?.today_sessions?.length > 0 && (
                    <div style={{ marginBottom:'1rem' }}>
                      <div style={{ fontWeight:800, fontSize:'.82rem', color: C.text, marginBottom:6 }}>
                        📆 Today's Sessions ({drawerDetail.today_sessions.length})
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                        {drawerDetail.today_sessions.map(s => (
                          <div key={s.id} style={{
                            display:'flex', alignItems:'center', gap:10,
                            background:'#fff', border:`1px solid ${C.border}`,
                            borderLeft:`3px solid ${s.status === 'active' ? C.green : C.blue}`,
                            borderRadius:8, padding:'.55rem .75rem', fontSize:'.8rem',
                          }}>
                            <span style={{ fontWeight:700, color: C.slate, minWidth:90 }}>
                              {fmt(s.scheduled_start)} – {fmt(s.scheduled_end)}
                            </span>
                            <span style={{ flex:1, fontWeight:600, color: C.text }}>→ {s.other_name || '—'}</span>
                            <Tag color={s.status === 'active' ? C.green : C.blue}
                                 bg={s.status === 'active' ? C.greenBg : C.blueBg}>
                              {s.status}
                            </Tag>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* No today sessions */}
                  {drawerDetail && drawerDetail.today_sessions?.length === 0 && (
                    <div style={{
                      textAlign:'center', padding:'1.25rem', color:'#9ca3af',
                      background: C.light, borderRadius:10, marginBottom:'1rem', fontSize:'.82rem',
                    }}>
                      📭 No sessions scheduled for today
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Drawer footer actions */}
            <div style={{
              padding:'1rem 1.25rem', borderTop:`1px solid ${C.border}`,
              background: C.light, display:'flex', gap:8, flexWrap:'wrap', flexShrink:0,
            }}>
              <Btn color={C.blue} onClick={() => {
                setForm({ username: drawerUser.username, password:'', role: drawerUser.role });
                setEditId(drawerUser.id); setShowForm(true); setDrawerUser(null);
              }}>✏️ Edit</Btn>
              <Btn color={isActive(drawerUser) ? C.red : C.green} outline onClick={() => toggleActive(drawerUser)}>
                {isActive(drawerUser) ? '🚫 Disable' : '✅ Enable'}
              </Btn>
              <Btn color={C.gray} outline onClick={() => setDrawerUser(null)} style={{ marginLeft:'auto' }}>Close</Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
