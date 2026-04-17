import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

const SIGNALING = import.meta.env.VITE_SIGNALING_SERVER || 'http://localhost:5001';

const PHONE_W = 390;
const PHONE_H = 720;

export default function LiveRoom() {
  const { sessionId } = useParams();
  const { user }      = useAuth();
  const navigate      = useNavigate();

  const [session,      setSession]      = useState(null);
  const [status,       setStatus]       = useState('connecting');
  const [isMuted,      setIsMuted]      = useState(false);
  const [participants, setParticipants] = useState([]);
  const [elapsed,      setElapsed]      = useState(0);
  const [sharedImage,  setSharedImage]  = useState(null);
  const [isDrawing,    setIsDrawing]    = useState(false);
  const [drawColor,    setDrawColor]    = useState('#ff0000');
  const [drawSize,     setDrawSize]     = useState(4);
  const [tool,         setTool]         = useState('pen');

  const socketRef  = useRef(null);
  const streamRef  = useRef(null);
  const peersRef   = useRef({});   // remoteUserId → RTCPeerConnection
  const iceBufRef  = useRef({});   // remoteUserId → RTCIceCandidate[]
  const timerRef   = useRef(null);
  const canvasRef  = useRef(null);
  const lastPos    = useRef(null);
  const fileInput  = useRef(null);
  const iceConfig  = useRef(null);

  const isTeacher = user?.role === 'teacher';

  // ── Session load ───────────────────────────────────────────────────
  useEffect(() => {
    if (sessionId === 'demo-session') {
      setSession({ title: 'Demo Class Room', subject: 'Audio Test' });
      return;
    }
    axios.get(`/api/sessions/${sessionId}`)
      .then(r => setSession(r.data))
      .catch(() => { toast.error('Session not found'); navigate('/dashboard'); });
  }, [sessionId]);

  // ── Main WebRTC init ───────────────────────────────────────────────
  useEffect(() => {
    if (!session || !user) return;
    let mounted = true;

    const init = async () => {
      // 1. Fetch ICE config (STUN + TURN) from signaling server
      try {
        const { data } = await axios.get(`${SIGNALING}/ice-config`);
        iceConfig.current = data;
        console.log('[ICE] config loaded:', data.iceServers.length, 'servers');
      } catch {
        // fallback to Google STUN only
        iceConfig.current = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
        console.warn('[ICE] failed to fetch config, using fallback STUN');
      }

      // 2. Get mic
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false
        });
        streamRef.current = stream;
      } catch {
        setStatus('error');
        toast.error('Microphone access denied.');
        return;
      }

      // 3. Connect to signaling server
      const token  = localStorage.getItem('token');
      const socket = io(SIGNALING, { query: { sessionId, userId: user.id, token } });
      socketRef.current = socket;

      socket.on('connect', () => {
        if (!mounted) return;
        setStatus('waiting');
        socket.emit('join-room', { sessionId, role: user.role, userId: user.id });
      });

      socket.on('connect_error', () => {
        setStatus('error');
        toast.error('Cannot connect to signaling server');
      });

      // Remote peer joined → we initiate the offer
      socket.on('user-joined', ({ userId: remoteId, socketId: remoteSocket, role }) => {
        if (!mounted) return;
        setParticipants(p => [...p.filter(x => x.userId !== remoteId), { userId: remoteId, role }]);
        startTimer();
        setStatus('live');
        createPeer(remoteId, remoteSocket, true, stream, socket);
      });

      // We received an offer → create answering peer
      socket.on('receive-offer', ({ from: remoteId, socketId: remoteSocket, offer }) => {
        if (!mounted) return;
        startTimer();
        setStatus('live');
        createPeer(remoteId, remoteSocket, false, stream, socket, offer);
      });

      socket.on('receive-answer', ({ from: remoteId, answer }) => {
        const pc = peersRef.current[remoteId];
        if (!pc) return;
        pc.setRemoteDescription(new RTCSessionDescription(answer))
          .then(() => flushIce(remoteId))
          .catch(e => console.error('[answer] setRemoteDescription:', e));
      });

      socket.on('receive-ice-candidate', ({ from: remoteId, candidate }) => {
        if (!candidate) return;
        const pc = peersRef.current[remoteId];
        if (pc && pc.remoteDescription) {
          pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
        } else {
          if (!iceBufRef.current[remoteId]) iceBufRef.current[remoteId] = [];
          iceBufRef.current[remoteId].push(candidate);
        }
      });

      socket.on('user-left', uid => {
        if (!mounted) return;
        destroyPeer(uid);
        setParticipants(p => p.filter(x => x.userId !== uid));
        toast('A participant left', { icon: '👋' });
        if (Object.keys(peersRef.current).length === 0) setStatus('waiting');
      });

      socket.on('session-ended', () => { cleanup(); setStatus('ended'); });

      // Image & canvas events
      socket.on('image-shared',  ({ dataUrl, width, height }) => { setSharedImage({ dataUrl, width, height }); clearCanvas(); });
      socket.on('image-cleared', () => { setSharedImage(null); clearCanvas(); });
      socket.on('draw-stroke',   ({ x0, y0, x1, y1, color, size, erase }) => drawLine(x0, y0, x1, y1, color, size, erase, false));
      socket.on('canvas-cleared', () => clearCanvas());
    };

    init();
    return () => { mounted = false; cleanup(); };
  }, [session, user]);

  // ── Peer creation (native RTCPeerConnection) ───────────────────────
  const createPeer = (remoteId, remoteSocket, initiator, stream, socket, offer = null) => {
    if (peersRef.current[remoteId]) return;

    const pc = new RTCPeerConnection(iceConfig.current);
    peersRef.current[remoteId] = pc;
    iceBufRef.current[remoteId] = [];

    // Add local tracks
    stream.getTracks().forEach(t => pc.addTrack(t, stream));

    // ICE candidate → send to remote
    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return;
      logCandidate(remoteId, candidate);
      socket.emit('send-ice-candidate', { to: remoteId, socketId: remoteSocket, candidate });
    };

    pc.onicegatheringstatechange = () => console.log(`[ICE:${remoteId.substr(0,6)}] gathering: ${pc.iceGatheringState}`);
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      console.log(`[ICE:${remoteId.substr(0,6)}] connection: ${s}`);
      if (s === 'failed') { console.warn('[ICE] failed — restarting'); pc.restartIce(); }
    };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log(`[PC:${remoteId.substr(0,6)}] state: ${s}`);
      if (s === 'connected') console.log(`%c[PC:${remoteId.substr(0,6)}] ✅ CONNECTED`, 'color:green;font-weight:bold');
    };

    // Remote audio track
    pc.ontrack = ({ streams }) => {
      const audio = new Audio();
      audio.srcObject = streams[0];
      audio.autoplay  = true;
      audio.playsInline = true;
      audio.play().catch(() => {});
    };

    if (initiator) {
      // Create and send offer
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('send-offer', { to: remoteId, socketId: remoteSocket, offer: pc.localDescription });
          console.log(`[offer] sent to ${remoteId.substr(0,6)}`);
        })
        .catch(e => console.error('[offer] createOffer:', e));
    } else if (offer) {
      // Receive offer, send answer
      pc.setRemoteDescription(new RTCSessionDescription(offer))
        .then(() => flushIce(remoteId))
        .then(() => pc.createAnswer())
        .then(answer => pc.setLocalDescription(answer))
        .then(() => {
          socket.emit('send-answer', { to: remoteId, socketId: remoteSocket, answer: pc.localDescription });
          console.log(`[answer] sent to ${remoteId.substr(0,6)}`);
        })
        .catch(e => console.error('[answer]:', e));
    }
  };

  const flushIce = (remoteId) => {
    const pc  = peersRef.current[remoteId];
    const buf = iceBufRef.current[remoteId] || [];
    buf.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
    iceBufRef.current[remoteId] = [];
  };

  const destroyPeer = uid => {
    peersRef.current[uid]?.close();
    delete peersRef.current[uid];
    delete iceBufRef.current[uid];
  };

  const cleanup = () => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    Object.keys(peersRef.current).forEach(destroyPeer);
    socketRef.current?.emit('clear-image', { sessionId });
    socketRef.current?.emit('leave-room', { sessionId, userId: user?.id });
    socketRef.current?.disconnect();
    setSharedImage(null);
    clearCanvas();
  };

  const startTimer = () => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  };

  const logCandidate = (remoteId, c) => {
    const label = remoteId.substr(0, 6);
    if (c.type === 'relay') console.log(`%c[ICE:${label}] ✅ TURN relay`, 'color:green;font-weight:bold');
    else if (c.type === 'srflx') console.log(`%c[ICE:${label}] ✅ STUN srflx`, 'color:blue');
  };

  // ── Canvas helpers ─────────────────────────────────────────────────
  const clearCanvas = () => {
    const c = canvasRef.current;
    if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
  };

  const toRelative = (e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const touch  = e.touches ? e.touches[0] : e;
    return { x: (touch.clientX - rect.left) / rect.width, y: (touch.clientY - rect.top) / rect.height };
  };

  const drawLine = (x0, y0, x1, y1, color, size, erase, emit) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth   = size;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(x0 * canvas.width, y0 * canvas.height);
    ctx.lineTo(x1 * canvas.width, y1 * canvas.height);
    ctx.stroke();
    ctx.restore();
    if (emit && socketRef.current)
      socketRef.current.emit('draw-stroke', { sessionId, x0, y0, x1, y1, color, size, erase: erase || false });
  };

  const onPointerDown = (e) => { if (!isTeacher || !sharedImage) return; e.preventDefault(); setIsDrawing(true); lastPos.current = toRelative(e); };
  const onPointerMove = (e) => {
    if (!isDrawing || !isTeacher) return;
    e.preventDefault();
    const pos = toRelative(e);
    drawLine(lastPos.current.x, lastPos.current.y, pos.x, pos.y, drawColor, drawSize, tool === 'eraser', true);
    lastPos.current = pos;
  };
  const onPointerUp = (e) => { e.preventDefault(); setIsDrawing(false); lastPos.current = null; };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const dataUrl = ev.target.result;
        setSharedImage({ dataUrl, width: img.width, height: img.height });
        clearCanvas();
        socketRef.current?.emit('share-image', { sessionId, dataUrl, width: img.width, height: img.height });
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const clearImage   = () => { setSharedImage(null); clearCanvas(); socketRef.current?.emit('clear-image', { sessionId }); };
  const clearDrawing = () => { clearCanvas(); socketRef.current?.emit('clear-canvas', { sessionId }); };
  const toggleMute   = () => { const t = streamRef.current?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; setIsMuted(!t.enabled); } };
  const endCall      = () => { cleanup(); navigate('/dashboard'); };
  const fmt          = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const statusBg = { connecting: '#6b7280', waiting: '#eab308', live: '#22c55e', ended: '#6b7280', error: '#ef4444' };
  const statusTx = { connecting: '🔄 Connecting', waiting: '⏳ Waiting...', live: '🔴 Live', ended: '✅ Ended', error: '❌ Error' };

  return (
    <div style={{ minHeight: '100vh', background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', padding: '1rem' }}>
      <div style={{ width: PHONE_W, maxWidth: '100vw', height: PHONE_H, maxHeight: '100vh', background: '#1e1b4b', borderRadius: '2rem', boxShadow: '0 0 0 8px #0f0f1a, 0 0 40px rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', color: '#fff' }}>

        {/* Top bar */}
        <div style={{ background: '#0f0e2a', padding: '0.6rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '0.9rem' }}>{session?.title || 'Live Class'}</p>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)' }}>{session?.subject || ''}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {status === 'live' && <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>⏱ {fmt(elapsed)}</span>}
            <span style={{ background: statusBg[status], padding: '2px 8px', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 600 }}>{statusTx[status]}</span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex', flexDirection: 'column' }}>
          {sharedImage ? (
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: '#000' }}>
              <img src={sharedImage.dataUrl} alt="shared" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', userSelect: 'none', pointerEvents: 'none' }} />
              <canvas
                ref={canvasRef}
                width={PHONE_W}
                height={PHONE_H - 120}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: isTeacher ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default', touchAction: 'none' }}
                onMouseDown={onPointerDown} onMouseMove={onPointerMove} onMouseUp={onPointerUp} onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown} onTouchMove={onPointerMove} onTouchEnd={onPointerUp}
              />
              {isTeacher && (
                <div style={{ position: 'absolute', top: '0.5rem', right: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', background: 'rgba(0,0,0,0.6)', borderRadius: '0.75rem', padding: '0.5rem' }}>
                  <input type="color" value={drawColor} onChange={e => setDrawColor(e.target.value)} style={{ width: '32px', height: '32px', border: 'none', borderRadius: '50%', cursor: 'pointer', padding: 0, background: 'none' }} />
                  <button onClick={() => setTool('pen')}    style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: '1rem', background: tool === 'pen'    ? '#4f46e5' : 'rgba(255,255,255,0.15)', color: '#fff' }}>✏️</button>
                  <button onClick={() => setTool('eraser')} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: '1rem', background: tool === 'eraser' ? '#4f46e5' : 'rgba(255,255,255,0.15)', color: '#fff' }}>🧹</button>
                  <input type="range" min="2" max="20" value={drawSize} onChange={e => setDrawSize(+e.target.value)} style={{ width: '32px', writingMode: 'vertical-lr', direction: 'rtl', cursor: 'pointer' }} />
                  <button onClick={clearDrawing} style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: '0.9rem', background: 'rgba(255,255,255,0.15)', color: '#fff' }}>🗑️</button>
                  <button onClick={clearImage}   style={{ width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: '0.9rem', background: '#ef4444', color: '#fff' }}>✕</button>
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', padding: '1rem' }}>
              <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {/* Self */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: isMuted ? '#374151' : '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto', boxShadow: !isMuted && status === 'live' ? '0 0 0 4px rgba(79,70,229,0.5)' : 'none' }}>
                    {user?.full_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <p style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)' }}>{user?.full_name} (You)</p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: isMuted ? '#ef4444' : '#22c55e' }}>{isMuted ? '🔇 Muted' : '🎤 Active'}</p>
                </div>

                {/* Remote participants */}
                {participants.map(p => (
                  <div key={p.userId} style={{ textAlign: 'center' }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto', boxShadow: '0 0 0 4px rgba(5,150,105,0.4)' }}>
                      {p.role === 'teacher' ? '👨🏫' : '👨🎓'}
                    </div>
                    <p style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.8)', textTransform: 'capitalize' }}>{p.role}</p>
                    <p style={{ margin: 0, fontSize: '0.7rem', color: '#22c55e' }}>🎤 Connected</p>
                  </div>
                ))}

                {status === 'waiting' && (
                  <div style={{ textAlign: 'center', opacity: 0.4 }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', margin: '0 auto' }}>
                      {user?.role === 'teacher' ? '👨🎓' : '👨🏫'}
                    </div>
                    <p style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>Waiting...</p>
                  </div>
                )}
              </div>

              {status === 'ended' && (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ marginBottom: '0.75rem' }}>Session ended.</p>
                  <button onClick={() => navigate('/dashboard')} style={{ padding: '0.5rem 1.2rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>Dashboard</button>
                </div>
              )}
              {status === 'error' && (
                <div style={{ textAlign: 'center' }}>
                  <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>Connection failed. Is the signaling server running?</p>
                  <button onClick={() => window.location.reload()} style={{ padding: '0.5rem 1.2rem', background: '#4f46e5', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>Retry</button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom controls */}
        {(status === 'live' || status === 'waiting') && (
          <div style={{ background: '#0f0e2a', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
            <button onClick={toggleMute} style={{ width: '48px', height: '48px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: isMuted ? '#ef4444' : '#374151', color: '#fff', fontSize: '1.2rem' }} title={isMuted ? 'Unmute' : 'Mute'}>
              {isMuted ? '🔇' : '🎤'}
            </button>
            {isTeacher && (
              <>
                <button onClick={() => fileInput.current.click()} style={{ width: '48px', height: '48px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#4f46e5', color: '#fff', fontSize: '1.2rem' }} title="Share image">🖼️</button>
                <input ref={fileInput} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />
              </>
            )}
            <button onClick={endCall} style={{ width: '48px', height: '48px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#ef4444', color: '#fff', fontSize: '1.2rem' }} title="Leave">📵</button>
          </div>
        )}
      </div>
    </div>
  );
}
