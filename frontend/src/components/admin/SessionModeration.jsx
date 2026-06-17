import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const C = {
  text: '#2d2d3a',
  sub: '#8b8b9a',
  line: 'rgba(233, 213, 255, 0.5)',
  panel: 'rgba(255, 255, 255, 0.55)',
  soft: 'rgba(255, 255, 255, 0.3)',
  blue: '#8b5cf6',
  blueLight: '#a78bfa',
  green: '#10b981',
  greenLight: '#34d399',
  red: '#ef4444',
  redLight: '#f87171',
  amber: '#f59e0b',
  amberLight: '#fbbf24',
  violet: '#a855f7',
  violetLight: '#c084fc',
  purple: '#a855f7',
  purpleLight: '#c084fc',
};

const CSS = `
  @keyframes sm-fadein { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sm-slide  { from{transform:translateX(105%)} to{transform:translateX(0)} }
  .sm-row:hover  { background:rgba(192, 132, 252, 0.06) !important; cursor:pointer; }
  .sm-card:hover { transform:translateY(-2px); box-shadow:0 8px 32px rgba(168, 85, 247, 0.12)!important; }
  .sm-btn:hover  { filter:brightness(.92); }
`;

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

const Btn = ({ color = C.purple, outline, small, disabled, onClick, children, style = {} }) => (
  <button className="sm-btn" onClick={onClick} disabled={disabled} style={{
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

const Pill = ({ children, color }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    padding: '3px 12px',
    background: `${color}14`,
    color,
    fontWeight: 600,
    fontSize: '0.76rem',
    textTransform: 'capitalize',
    border: `1px solid ${color}28`,
  }}>
    {children}
  </span>
);

const statusColor = {
  active: C.green,
  scheduled: C.blue,
  completed: C.sub,
  cancelled: C.red,
  replaced: C.amber
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

const displayName = (user) => user?.full_name || user?.username || 'Unknown';

const Stat = ({ label, value, color }) => (
  <GlassCard style={{ padding: '20px 24px' }}>
    <p style={{ margin: 0, color: C.sub, fontSize: '0.82rem', fontWeight: 600 }}>{label}</p>
    <p style={{ margin: '8px 0 0', color, fontSize: '1.85rem', fontWeight: 700, letterSpacing: '-0.5px' }}>{value}</p>
  </GlassCard>
);

const th = {
  padding: '14px 18px',
  textAlign: 'left',
  fontWeight: 600,
  color: C.sub,
  borderBottom: `2px solid ${C.line}`,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
};

const td = {
  padding: '14px 18px',
  borderBottom: `1px solid ${C.line}`,
  fontSize: '0.88rem',
  verticalAlign: 'middle',
};

const ParticipantRow = ({ participant, onMute, onUnmute, disabled }) => (
  <tr>
    <td style={td}>
      <div style={{ fontWeight: 600, color: C.text }}>{participant.name}</div>
      <div style={{ color: C.sub, fontSize: '0.76rem', textTransform: 'capitalize' }}>{participant.role}</div>
    </td>
    <td style={td}>
      <Pill color={participant.muted ? C.red : C.green}>
        {participant.muted ? 'Muted' : 'Open'}
      </Pill>
    </td>
    <td style={{ ...td, textAlign: 'right' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Btn small outline color={C.amber} disabled={disabled || participant.muted} onClick={() => onMute(participant)}>
          Mute
        </Btn>
        <Btn small color={C.green} disabled={disabled || !participant.muted} onClick={() => onUnmute(participant)}>
          Unmute
        </Btn>
      </div>
    </td>
  </tr>
);

const SessionModeration = () => {
  const [sessions, setSessions] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [logs, setLogs] = useState([]);
  const [mutedUsers, setMutedUsers] = useState({});
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const userMap = useMemo(() => {
    const map = new Map();
    users.forEach((user) => map.set(user.id, user));
    return map;
  }, [users]);

  const activeSessions = useMemo(() => {
    const now = new Date();
    return sessions.filter((session) => {
      if (session.status === 'active') return true;
      return session.status === 'scheduled'
        && new Date(session.scheduled_start) <= now
        && new Date(session.scheduled_end) > now;
    });
  }, [sessions]);

  const stats = useMemo(() => ({
    activeSessions: activeSessions.length,
    activeTeachers: new Set(activeSessions.map((session) => session.teacher_id).filter(Boolean)).size,
    activeStudents: new Set(activeSessions.map((session) => session.student_id).filter(Boolean)).size
  }), [activeSessions]);

  const selectedSession = selectedDetail || activeSessions.find((session) => session.id === selectedId) || null;

  const teacher = selectedSession ? userMap.get(selectedSession.teacher_id) : null;
  const student = selectedSession ? userMap.get(selectedSession.student_id) : null;
  const participants = selectedSession
    ? [
        { id: selectedSession.teacher_id, role: 'teacher', name: displayName(teacher), muted: Boolean(mutedUsers[selectedSession.teacher_id]) },
        { id: selectedSession.student_id, role: 'student', name: displayName(student), muted: Boolean(mutedUsers[selectedSession.student_id]) }
      ].filter((participant) => participant.id)
    : [];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sessionRes, userRes] = await Promise.all([
        axios.get('/api/sessions'),
        axios.get('/api/users')
      ]);
      setSessions(Array.isArray(sessionRes.data) ? sessionRes.data : []);
      setUsers(Array.isArray(userRes.data) ? userRes.data : []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load moderation data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSessionDetail = useCallback(async (sessionId) => {
    if (!sessionId) return;
    try {
      const { data } = await axios.get(`/api/moderation/sessions/${sessionId}`);
      if (data.session) setSelectedDetail(data.session);
      if (Array.isArray(data.logs)) setLogs(data.logs);
      if (Array.isArray(data.participants)) {
        const nextMuted = {};
        data.participants.forEach((participant) => {
          nextMuted[participant.user_id || participant.id] = Boolean(participant.is_muted_by_moderator || participant.muted);
        });
        setMutedUsers(nextMuted);
      }
      setIsSpeaking(Boolean(data.state?.is_supervisor_speaking));
    } catch {
      setSelectedDetail(null);
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    if (selectedId) loadSessionDetail(selectedId);
  }, [selectedId, loadSessionDetail]);

  const appendLocalLog = (action, targetName) => {
    setLogs((current) => [
      {
        id: `${Date.now()}-${action}`,
        action,
        target_name: targetName,
        created_at: new Date().toISOString()
      },
      ...current
    ]);
  };

  const moderationAction = async (path, success, localLog, targetId) => {
    if (!selectedSession) return;
    setBusy(true);
    try {
      await axios.post(`/api/moderation/sessions/${selectedSession.id}${path}`);
      toast.success(success);
    } catch (error) {
      const status = error.response?.status;
      if (status === 404) {
        toast('Moderation API is not wired yet; showing the UI state locally.');
      } else {
        toast.error(error.response?.data?.message || 'Moderation action failed');
        return;
      }
    } finally {
      setBusy(false);
    }

    if (targetId) {
      const shouldMute = path.includes('/mute');
      setMutedUsers((current) => ({ ...current, [targetId]: shouldMute }));
    }
    if (localLog) appendLocalLog(localLog.action, localLog.targetName);
    loadSessionDetail(selectedSession.id);
  };

  const monitorSession = async (session) => {
    setSelectedId(session.id);
    appendLocalLog('supervisor_opened_monitor', session.title);
    try {
      await axios.post(`/api/moderation/sessions/${session.id}/join`);
    } catch {}
  };

  const muteParticipant = (participant) => {
    moderationAction(
      `/participants/${participant.id}/mute`,
      `${participant.name} muted`,
      { action: `${participant.role}_muted`, targetName: participant.name },
      participant.id
    );
  };

  const unmuteParticipant = (participant) => {
    moderationAction(
      `/participants/${participant.id}/unmute`,
      `${participant.name} unmuted`,
      { action: `${participant.role}_unmuted`, targetName: participant.name },
      participant.id
    );
  };

  const startSpeaking = () => {
    setIsSpeaking(true);
    moderationAction('/speak/start', 'Moderator audio broadcast started', { action: 'moderator_started_speaking' });
  };

  const stopSpeaking = () => {
    setIsSpeaking(false);
    moderationAction('/speak/stop', 'Moderator audio broadcast stopped', { action: 'moderator_stopped_speaking' });
  };

  const endSession = async () => {
    if (!selectedSession) return;
    if (!window.confirm(`End "${selectedSession.title}" for all participants?`)) return;
    setBusy(true);
    try {
      await axios.post(`/api/moderation/sessions/${selectedSession.id}/end`);
      toast.success('Session ended');
    } catch (error) {
      if (error.response?.status === 404) {
        await axios.put(`/api/sessions/${selectedSession.id}`, {
          status: 'completed',
          actual_end_time: new Date().toISOString()
        });
        toast.success('Session ended');
      } else {
        toast.error(error.response?.data?.message || 'Failed to end session');
        setBusy(false);
        return;
      }
    }
    appendLocalLog('session_ended', selectedSession.title);
    setSelectedId(null);
    setSelectedDetail(null);
    await loadData();
    setBusy(false);
  };

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: C.text,
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 50%, #fbcfe8 100%)',
      padding: '32px',
    }}>
      <style>{CSS}</style>

      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: C.text, fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.5px' }}>Session Moderation</h2>
        <p style={{ margin: '0.35rem 0 0', color: C.sub, fontSize: '0.9rem' }}>
          Monitor active classrooms, control participant audio, and end live sessions when needed.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '20px', marginBottom: '1.5rem' }}>
        <Stat label="Active Sessions" value={stats.activeSessions} color={C.green} />
        <Stat label="Active Teachers" value={stats.activeTeachers} color={C.blue} />
        <Stat label="Active Students" value={stats.activeStudents} color={C.violet} />
      </div>

      {isSpeaking && (
        <GlassCard style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem', borderColor: 'rgba(245, 158, 11, 0.3)', background: 'rgba(255, 251, 235, 0.7)', color: C.amber, fontWeight: 700, animation: 'sm-fadein .3s ease' }}>
          🔊 Moderator is speaking
        </GlassCard>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: selectedSession ? 'minmax(0, 1.05fr) minmax(360px, 0.95fr)' : '1fr',
        gap: '24px',
        alignItems: 'start'
      }}>
        <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: `2px solid ${C.line}`, display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', background: 'rgba(255, 255, 255, 0.3)' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: C.text, fontWeight: 700 }}>Currently Running Sessions</h3>
              <p style={{ margin: '0.3rem 0 0', color: C.sub, fontSize: '0.82rem' }}>
                Refreshes every 30 seconds
              </p>
            </div>
            <Btn outline color={C.gray} onClick={loadData}>Refresh</Btn>
          </div>

          {loading ? (
            <div style={{ padding: '3rem', color: C.sub, textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>⏳</div>Loading active sessions...
            </div>
          ) : activeSessions.length === 0 ? (
            <div style={{ padding: '3rem', color: C.sub, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>📭</div>No live sessions are running right now.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Session</th>
                    <th style={th}>Status</th>
                    <th style={th}>Duration</th>
                    <th style={th}>Teacher</th>
                    <th style={th}>Students</th>
                    <th style={{ ...th, textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSessions.map((session) => {
                    const sessionTeacher = userMap.get(session.teacher_id);
                    const selected = selectedSession?.id === session.id;
                    return (
                      <tr key={session.id} className="sm-row" style={{ background: selected ? 'rgba(192, 132, 252, 0.06)' : 'transparent', transition: 'background .12s' }}>
                        <td style={td}>
                          <div style={{ fontWeight: 600, color: C.text }}>{session.title}</div>
                          <div style={{ color: C.sub, fontSize: '0.76rem' }}>{session.subject || session.room_name || session.id}</div>
                        </td>
                        <td style={td}><Pill color={statusColor[session.status] || C.sub}>{session.status}</Pill></td>
                        <td style={td}>{formatDuration(session)}</td>
                        <td style={td}>{displayName(sessionTeacher)}</td>
                        <td style={td}>1</td>
                        <td style={{ ...td, textAlign: 'right' }}>
                          <Btn small outline={selected} color={selected ? C.gray : C.blue} onClick={() => monitorSession(session)}>
                            {selected ? 'Monitoring' : 'Monitor Session'}
                          </Btn>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {selectedSession && (
          <div style={{ display: 'grid', gap: '24px' }}>
            <GlassCard>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
                <div>
                  <h3 style={{ margin: 0, color: C.text, fontSize: '1.05rem', fontWeight: 700 }}>{selectedSession.title}</h3>
                  <p style={{ margin: '0.3rem 0 0', color: C.sub, fontSize: '0.84rem' }}>{selectedSession.subject || 'Live classroom'}</p>
                </div>
                <Pill color={statusColor[selectedSession.status] || C.sub}>{selectedSession.status}</Pill>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '20px' }}>
                {[
                  ['Teacher', displayName(teacher)],
                  ['Student Count', '1'],
                  ['Start Time', new Date(selectedSession.actual_start_time || selectedSession.scheduled_start).toLocaleString()],
                  ['Duration', formatDuration(selectedSession)]
                ].map(([label, value]) => (
                  <div key={label} style={{ background: 'rgba(255, 255, 255, 0.4)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
                    <div style={{ color: C.sub, fontSize: '0.74rem', fontWeight: 600 }}>{label}</div>
                    <div style={{ color: C.text, fontWeight: 600, marginTop: '6px', fontSize: '0.9rem' }}>{value}</div>
                  </div>
                ))}
              </div>
            </GlassCard>

            <GlassCard>
              <h3 style={{ margin: '0 0 1rem', color: C.text, fontSize: '1rem', fontWeight: 700 }}>Supervisor Controls</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
                <Btn color={C.blue} disabled={busy} onClick={() => moderationAction('/join', 'Monitoring joined', { action: 'supervisor_joined_monitoring' })}>
                  Join Monitoring
                </Btn>
                <Btn color={C.violet} disabled={busy} onClick={startSpeaking}>
                  Speak To Session
                </Btn>
                <Btn color={C.green} disabled={busy || isSpeaking} onClick={startSpeaking}>
                  Start Speaking
                </Btn>
                <Btn outline color={C.gray} disabled={busy || !isSpeaking} onClick={stopSpeaking}>
                  Stop Speaking
                </Btn>
                <Btn outline color={C.amber} disabled={busy || !participants[0]} onClick={() => muteParticipant(participants[0])}>
                  Mute Teacher
                </Btn>
                <Btn color={C.green} disabled={busy || !participants[0]} onClick={() => unmuteParticipant(participants[0])}>
                  Unmute Teacher
                </Btn>
                <Btn outline color={C.amber} disabled={busy || !participants[1]} onClick={() => muteParticipant(participants[1])}>
                  Mute Student
                </Btn>
                <Btn color={C.green} disabled={busy || !participants[1]} onClick={() => unmuteParticipant(participants[1])}>
                  Unmute Student
                </Btn>
                <Btn color={C.red} style={{ gridColumn: '1 / -1' }} disabled={busy} onClick={endSession}>
                  End Session
                </Btn>
              </div>
            </GlassCard>

            <GlassCard style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '20px 24px', borderBottom: `2px solid ${C.line}`, background: 'rgba(255, 255, 255, 0.3)' }}>
                <h3 style={{ margin: 0, color: C.text, fontSize: '1rem', fontWeight: 700 }}>Participant List</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>Participant</th>
                    <th style={th}>Audio Status</th>
                    <th style={{ ...th, textAlign: 'right' }}>Controls</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan="3" style={{ ...td, background: 'rgba(255, 255, 255, 0.3)', color: C.sub, fontWeight: 600, fontSize: '0.8rem' }}>Teacher</td>
                  </tr>
                  {participants.filter((participant) => participant.role === 'teacher').map((participant) => (
                    <ParticipantRow key={participant.id} participant={participant} disabled={busy} onMute={muteParticipant} onUnmute={unmuteParticipant} />
                  ))}
                  <tr>
                    <td colSpan="3" style={{ ...td, background: 'rgba(255, 255, 255, 0.3)', color: C.sub, fontWeight: 600, fontSize: '0.8rem' }}>Students</td>
                  </tr>
                  {participants.filter((participant) => participant.role === 'student').map((participant) => (
                    <ParticipantRow key={participant.id} participant={participant} disabled={busy} onMute={muteParticipant} onUnmute={unmuteParticipant} />
                  ))}
                </tbody>
              </table>
            </GlassCard>

            <GlassCard>
              <h3 style={{ margin: '0 0 1rem', color: C.text, fontSize: '1rem', fontWeight: 700 }}>Moderation Audit</h3>
              {logs.length === 0 ? (
                <p style={{ margin: 0, color: C.sub, fontSize: '0.86rem' }}>No moderation actions recorded for this view.</p>
              ) : (
                <div style={{ display: 'grid', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
                  {logs.slice(0, 10).map((log) => (
                    <div key={log.id} style={{ background: 'rgba(255, 255, 255, 0.4)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(255, 255, 255, 0.5)' }}>
                      <div style={{ color: C.text, fontWeight: 600, fontSize: '0.84rem' }}>
                        {String(log.action || '').replaceAll('_', ' ')}
                      </div>
                      <div style={{ color: C.sub, fontSize: '0.76rem', marginTop: '4px' }}>
                        {log.target_name ? `${log.target_name} - ` : ''}{log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionModeration;