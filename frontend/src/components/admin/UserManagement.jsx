import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { eatTime, eatShortDate, eatAgo } from '../../utils/eatTime';
import { useAuth } from '../../contexts/AuthContext';

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

const ROLE_CFG = {
  admin  : { color: C.purple, bg: C.purpleBg, icon: '🛡️',  label: 'Admins'   },
  teacher: { color: C.blue,   bg: C.blueBg,   icon: '👨🏫', label: 'Teachers' },
  student: { color: C.green,  bg: C.greenBg,  icon: '🎓',  label: 'Students' },
};

const CSS = `
  @keyframes um-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes um-slide  { from{transform:translateX(105%)} to{transform:translateX(0)} }
  .um-row:hover  { background:rgba(192, 132, 252, 0.08) !important; cursor:pointer; }
  .um-card:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(168, 85, 247, 0.12)!important; }
  .um-btn:hover  { filter:brightness(.92); }
  .um-inp:focus  { outline:none; border-color:${C.purpleLight}; box-shadow:0 0 0 3px ${C.purpleBg}; }
`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt     = eatTime;
const fmtDate = eatShortDate;
const fmtAgo  = eatAgo;

const Btn = ({ color = C.purple, outline, small, disabled, onClick, children, style = {} }) => (
  <button className="um-btn" onClick={onClick} disabled={disabled} style={{
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
    ...style,
  }}>{children}</button>
);

const Tag = ({ color, bg, children }) => (
  <span style={{
    display:'inline-flex', alignItems:'center', padding:'3px 12px',
    borderRadius: 9999, fontSize:'.72rem', fontWeight: 600,
    color, background: bg, border:`1px solid ${color}28`,
  }}>{children}</span>
);

// ── Workload bar ──────────────────────────────────────────────────────────────
const WorkloadBar = ({ value, max = 20, color }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const bg  = pct > 75 ? C.red : pct > 40 ? C.amber : C.green;
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:5, background:'rgba(233, 213, 255, 0.4)', borderRadius:9999, overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background: color || bg, borderRadius:9999, transition:'width .3s' }} />
      </div>
      <span style={{ fontSize:'.7rem', fontWeight:600, color: C.sub, minWidth:24 }}>{value}</span>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════════
const UserManagement = () => {
  const { user } = useAuth();
  const [stats,       setStats]       = useState(null);
  const [users,       setUsers]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [activeRole,  setActiveRole]  = useState('teacher');
  const [search,      setSearch]      = useState('');
  const [filterActive,setFilterActive]= useState('');
  const [sortBy,      setSortBy]      = useState('created_at');
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
  const visibleRoleEntries = Object.entries(ROLE_CFG)
    .filter(([role]) => user?.role === 'admin' || role !== 'admin');
  const canCreateInActiveRole = activeRole !== 'admin';

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: C.text,
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 50%, #fbcfe8 100%)',
      padding: '32px',
    }}>
      <style>{CSS}</style>

      {/* ── Page header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.5rem', flexWrap:'wrap', gap:'0.75rem' }}>
        <div>
          <div style={{ fontWeight:700, fontSize:'1.5rem', color: C.text, letterSpacing: '-0.5px' }}>User Management</div>
          <div style={{ fontSize:'.85rem', color: C.sub, marginTop:4 }}>
            {stats ? `${stats.total} total users · ${stats.active_total} active` : 'Loading…'}
          </div>
        </div>
        {canCreateInActiveRole && (
          <Btn onClick={() => { setForm({ username:'', password:'', role: activeRole }); setEditId(null); setShowForm(true); }}>
            + Add User
          </Btn>
        )}
      </div>

      {/* ── Role cards ── */}
      <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap', marginBottom:'1.5rem' }}>
        {visibleRoleEntries.map(([role, rc]) => {
          const count = stats?.[`${role}s`] ?? '—';
          const active = activeRole === role;
          return (
            <div key={role} className="um-card" onClick={() => setActiveRole(role)} style={{
              flex:'1 1 150px', minWidth:140, borderRadius:20, padding:'1.25rem 1.5rem',
              background: active ? `linear-gradient(135deg, ${C.purpleLight}, ${C.purple})` : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: active ? 'none' : 'blur(20px)',
              WebkitBackdropFilter: active ? 'none' : 'blur(20px)',
              boxShadow: active ? `0 8px 32px ${C.purple}40` : '0 8px 32px rgba(155, 89, 182, 0.08)',
              border: active ? `2px solid ${C.purple}` : '1px solid rgba(255, 255, 255, 0.5)',
              cursor:'pointer', transition:'transform .15s, box-shadow .15s',
              animation:'um-fadein .25s ease',
            }}>
              <div style={{ fontSize:'1.6rem', marginBottom:8 }}>{rc.icon}</div>
              <div style={{ fontSize:'1.9rem', fontWeight:700, color: active ? '#fff' : rc.color, lineHeight:1, letterSpacing: '-0.5px' }}>{count}</div>
              <div style={{ fontSize:'.82rem', fontWeight:600, color: active ? 'rgba(255,255,255,.85)' : C.sub, marginTop:6 }}>{rc.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Create / Edit form ── */}
      {showForm && (
        <div style={{
          background:'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius:24, padding:'1.5rem 1.75rem',
          boxShadow:'0 8px 32px rgba(155, 89, 182, 0.1)',
          border:'1px solid rgba(255, 255, 255, 0.6)',
          marginBottom:'1.5rem',
          animation:'um-fadein .2s ease',
        }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
            <div style={{ fontWeight:700, fontSize:'1.1rem', color: C.text }}>{editId ? 'Edit User' : 'Create New User'}</div>
            <button onClick={() => setShowForm(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem', color: C.sub }}>✕</button>
          </div>
          <form onSubmit={handleSubmit}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'1rem' }}>
              <div>
                <label style={{ display:'block', fontSize:'.8rem', fontWeight:600, color: C.sub, marginBottom:6 }}>Username *</label>
                <input className="um-inp" required value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  style={{ width:'100%', padding:'10px 14px', border:`1.5px solid ${C.border}`, borderRadius:12, fontSize:'.9rem', boxSizing:'border-box', background: 'rgba(255, 255, 255, 0.4)' }} />
              </div>
              {!editId && <>
                <div>
                  <label style={{ display:'block', fontSize:'.8rem', fontWeight:600, color: C.sub, marginBottom:6 }}>Password *</label>
                  <input className="um-inp" required type="password" value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    style={{ width:'100%', padding:'10px 14px', border:`1.5px solid ${C.border}`, borderRadius:12, fontSize:'.9rem', boxSizing:'border-box', background: 'rgba(255, 255, 255, 0.4)' }} />
                </div>
                <div>
                  <label style={{ display:'block', fontSize:'.8rem', fontWeight:600, color: C.sub, marginBottom:6 }}>Role *</label>
                  <select className="um-inp" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                    style={{ width:'100%', padding:'10px 14px', border:`1.5px solid ${C.border}`, borderRadius:12, fontSize:'.9rem', boxSizing:'border-box', background: 'rgba(255, 255, 255, 0.4)' }}>
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                  </select>
                </div>
              </>}
            </div>
            <div style={{ display:'flex', gap:10, marginTop:'1.25rem' }}>
              <Btn type="submit" disabled={saving}>{saving ? 'Saving…' : editId ? 'Update User' : 'Create User'}</Btn>
              <Btn outline color={C.gray} onClick={() => setShowForm(false)}>Cancel</Btn>
            </div>
          </form>
        </div>
      )}

      {/* ── User list card ── */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius:24,
        boxShadow: '0 8px 32px rgba(155, 89, 182, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.6)',
        overflow:'hidden',
      }}>

        {/* List header */}
        <div style={{
          padding:'1.1rem 1.5rem', borderBottom:`2px solid ${C.border}`,
          background: 'rgba(255, 255, 255, 0.3)',
          display:'flex', gap:'1rem', flexWrap:'wrap', alignItems:'center',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, flex:'0 0 auto' }}>
            <span style={{ fontSize:'1.2rem' }}>{cfg.icon}</span>
            <span style={{ fontWeight:700, fontSize:'1rem', color: C.text }}>{cfg.label}</span>
            <span style={{
              background: `linear-gradient(135deg, ${C.purpleLight}, ${C.purple})`, color:'#fff',
              borderRadius:9999, padding:'2px 12px', fontSize:'.75rem', fontWeight:600,
            }}>{visible.length}</span>
          </div>

          {/* Search */}
          <input
            className="um-inp" placeholder="🔍  Search by username…"
            value={search} onChange={e => setSearch(e.target.value)}
            style={{
              flex:'1 1 180px', padding:'8px 14px', border:`1.5px solid ${C.border}`,
              borderRadius:12, fontSize:'.85rem', background: 'rgba(255, 255, 255, 0.4)',
            }}
          />

          {/* Active filter */}
          <select value={filterActive} onChange={e => setFilterActive(e.target.value)}
            style={{ padding:'8px 14px', border:`1.5px solid ${C.border}`, borderRadius:12, fontSize:'.82rem', background: 'rgba(255, 255, 255, 0.4)' }}>
            <option value="">All Status</option>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>

          {/* Sort */}
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ padding:'8px 14px', border:`1.5px solid ${C.border}`, borderRadius:12, fontSize:'.82rem', background: 'rgba(255, 255, 255, 0.4)' }}>
            <option value="created_at">Newest First</option>
            <option value="upcoming">Most Upcoming</option>
            <option value="completed">Most Completed</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign:'center', padding:'3rem', color: C.sub }}>
            <div style={{ fontSize:'2rem', marginBottom:8 }}>⏳</div>Loading users…
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign:'center', padding:'3rem', color: C.sub }}>
            <div style={{ fontSize:'2.5rem', marginBottom:8 }}>👤</div>
            No {cfg.label.toLowerCase()} found
          </div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.3)' }}>
                  {['User', 'Status', 'Upcoming', 'Completed', activeRole !== 'admin' ? 'Workload' : null, 'Joined', 'Last Login', 'Actions']
                    .filter(Boolean).map(h => (
                    <th key={h} style={{
                      padding:'.85rem 1rem', textAlign:'left', fontSize:'.75rem',
                      fontWeight:600, color: C.sub, letterSpacing:'.05em',
                      borderBottom:`2px solid ${C.border}`, whiteSpace:'nowrap',
                    }}>{h.toUpperCase()}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map(u => (
                  <tr key={u.id} className="um-row" onClick={() => openDrawer(u)}
                    style={{ background: drawerUser?.id === u.id ? 'rgba(192, 132, 252, 0.08)' : 'transparent', transition:'background .12s' }}>

                    {/* User */}
                    <td style={{ padding:'.85rem 1rem', borderBottom:`1px solid ${C.border}` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <div style={{
                          width:40, height:40, borderRadius:'50%', flexShrink:0,
                          background: `linear-gradient(135deg,${cfg.color},${cfg.color}99)`,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          color:'#fff', fontWeight:700, fontSize:'.9rem',
                          boxShadow: `0 4px 12px ${cfg.color}40`,
                        }}>
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight:600, fontSize:'.9rem', color: C.text }}>{u.username}</div>
                          <div style={{ fontSize:'.7rem', color: C.sub }}>{u.id.slice(0,8)}…</div>
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td style={{ padding:'.85rem 1rem', borderBottom:`1px solid ${C.border}` }}>
                      <Tag color={isActive(u) ? C.green : C.red} bg={isActive(u) ? C.greenBg : C.redBg}>
                        {isActive(u) ? '● Active' : '○ Inactive'}
                      </Tag>
                    </td>

                    {/* Upcoming */}
                    <td style={{ padding:'.85rem 1rem', borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ fontWeight:700, color: C.blue, fontSize:'.9rem' }}>
                        {u.upcoming_sessions ?? '—'}
                      </span>
                    </td>

                    {/* Completed */}
                    <td style={{ padding:'.85rem 1rem', borderBottom:`1px solid ${C.border}` }}>
                      <span style={{ fontWeight:700, color: C.gray, fontSize:'.9rem' }}>
                        {u.completed_sessions ?? '—'}
                      </span>
                    </td>

                    {/* Workload bar (not for admin) */}
                    {activeRole !== 'admin' && (
                      <td style={{ padding:'.85rem 1rem', borderBottom:`1px solid ${C.border}`, minWidth:120 }}>
                        <WorkloadBar value={Number(u.upcoming_sessions) || 0} color={cfg.color} />
                      </td>
                    )}

                    {/* Joined */}
                    <td style={{ padding:'.85rem 1rem', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>
                      <span style={{ fontSize:'.82rem', color: C.sub }}>{fmtDate(u.created_at)}</span>
                    </td>

                    {/* Last login */}
                    <td style={{ padding:'.85rem 1rem', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' }}>
                      <span style={{ fontSize:'.82rem', color: C.sub }}>{fmtAgo(u.last_login)}</span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding:'.85rem 1rem', borderBottom:`1px solid ${C.border}` }}
                        onClick={e => e.stopPropagation()}>
                      <div style={{ display:'flex', gap:6 }}>
                        {u.role !== 'admin' && (
                          <Btn small outline color={C.purple} onClick={() => {
                            setForm({ username: u.username, password:'', role: u.role });
                            setEditId(u.id); setShowForm(true);
                          }}>Edit</Btn>
                        )}
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
          background:'rgba(15,23,42,.3)', backdropFilter:'blur(8px)',
        }}>
          <div ref={drawerRef} style={{
            position:'absolute', right:0, top:0, bottom:0,
            width:'min(460px,100vw)', background:'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display:'flex', flexDirection:'column',
            boxShadow:'-8px 0 32px rgba(168, 85, 247, 0.15)',
            animation:'um-slide .25s cubic-bezier(.4,0,.2,1)',
            borderLeft: '1px solid rgba(255, 255, 255, 0.6)',
          }}>
            {/* Drawer header */}
            <div style={{
              background:`linear-gradient(135deg,${C.purpleLight},${C.purple})`,
              padding:'1.5rem 1.75rem', flexShrink:0,
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{
                    width:52, height:52, borderRadius:'50%',
                    background:'rgba(255,255,255,.25)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    color:'#fff', fontWeight:800, fontSize:'1.3rem',
                    border: '2px solid rgba(255,255,255,.3)',
                  }}>
                    {drawerUser.username.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ color:'#fff', fontWeight:700, fontSize:'1.1rem' }}>{drawerUser.username}</div>
                    <div style={{ color:'rgba(255,255,255,.75)', fontSize:'.8rem', marginTop:3 }}>
                      {cfg.label.slice(0,-1)} · {isActive(drawerUser) ? '● Active' : '○ Inactive'}
                    </div>
                  </div>
                </div>
                <button onClick={() => setDrawerUser(null)} style={{
                  background:'rgba(255,255,255,.2)', border:'none', color:'#fff',
                  borderRadius:10, padding:'8px 14px', cursor:'pointer', fontSize:'1rem',
                }}>✕</button>
              </div>

              {/* Quick stats */}
              <div style={{ display:'flex', gap:10, marginTop:'1.25rem', flexWrap:'wrap' }}>
                {[
                  { label:'Upcoming', value: drawerUser.upcoming_sessions ?? '—' },
                  { label:'Completed', value: drawerUser.completed_sessions ?? '—' },
                  { label:'Active Now', value: drawerUser.active_sessions ?? '—' },
                ].map(s => (
                  <div key={s.label} style={{
                    flex:'1 1 80px', background:'rgba(255,255,255,.2)',
                    borderRadius:14, padding:'.75rem 1rem', textAlign:'center',
                    border: '1px solid rgba(255,255,255,.15)',
                  }}>
                    <div style={{ color:'#fff', fontWeight:700, fontSize:'1.3rem', lineHeight:1 }}>{s.value}</div>
                    <div style={{ color:'rgba(255,255,255,.75)', fontSize:'.7rem', marginTop:4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drawer body */}
            <div style={{ flex:1, overflowY:'auto', padding:'1.25rem 1.5rem' }}>
              {drawerLoading ? (
                <div style={{ textAlign:'center', padding:'3rem', color: C.sub }}>⏳ Loading details…</div>
              ) : (
                <>
                  {/* Info rows */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.4)', borderRadius:16, padding:'1rem 1.25rem', marginBottom:'1.25rem', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
                    {[
                      { icon:'🆔', label:'User ID',    val: drawerUser.id },
                      { icon:'📅', label:'Joined',     val: fmtDate(drawerUser.created_at) },
                      { icon:'🕐', label:'Last Login', val: fmtAgo(drawerUser.last_login) },
                      { icon:'📊', label:'Status',     val: isActive(drawerUser) ? 'Active' : 'Inactive' },
                    ].map(r => (
                      <div key={r.label} style={{
                        display:'flex', justifyContent:'space-between',
                        padding:'.55rem 0', borderBottom:`1px solid ${C.border}`,
                        fontSize:'.88rem',
                      }}>
                        <span style={{ color: C.sub, fontWeight:600 }}>{r.icon} {r.label}</span>
                        <span style={{ fontWeight:600, color: C.text, maxWidth:'55%', textAlign:'right', wordBreak:'break-all' }}>{r.val}</span>
                      </div>
                    ))}
                  </div>

                  {/* Today's sessions */}
                  {drawerDetail?.today_sessions?.length > 0 && (
                    <div style={{ marginBottom:'1.25rem' }}>
                      <div style={{ fontWeight:700, fontSize:'.9rem', color: C.text, marginBottom:8 }}>
                        📆 Today's Sessions ({drawerDetail.today_sessions.length})
                      </div>
                      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                        {drawerDetail.today_sessions.map(s => (
                          <div key={s.id} style={{
                            display:'flex', alignItems:'center', gap:12,
                            background:'rgba(255, 255, 255, 0.4)',
                            border:`1px solid rgba(233, 213, 255, 0.4)`,
                            borderLeft:`3px solid ${s.status === 'active' ? C.green : C.blue}`,
                            borderRadius:12, padding:'.65rem 1rem', fontSize:'.85rem',
                          }}>
                            <span style={{ fontWeight:600, color: C.sub, minWidth:90 }}>
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
                      textAlign:'center', padding:'1.5rem', color: C.sub,
                      background: 'rgba(255, 255, 255, 0.4)', borderRadius:16,
                      marginBottom:'1.25rem', fontSize:'.85rem',
                      border: '1px solid rgba(255, 255, 255, 0.5)',
                    }}>
                      📭 No sessions scheduled for today
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Drawer footer actions */}
            <div style={{
              padding:'1.25rem 1.5rem', borderTop:`1px solid ${C.border}`,
              background: 'rgba(255, 255, 255, 0.3)',
              display:'flex', gap:10, flexWrap:'wrap', flexShrink:0,
            }}>
              {drawerUser.role !== 'admin' && <Btn color={C.purple} onClick={() => {
                setForm({ username: drawerUser.username, password:'', role: drawerUser.role });
                setEditId(drawerUser.id); setShowForm(true); setDrawerUser(null);
              }}>Edit</Btn>}
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