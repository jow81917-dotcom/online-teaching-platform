// =============================================================================
// TEACHER — WebRTC Audio Classroom + DrawCall Canvas Integration
// =============================================================================

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("room") || "test";

const SERVER_URL = window.location.origin;
const socket = io(SERVER_URL, { transports: ["websocket", "polling"], upgrade: true });

// ── DOM refs (DrawCall + Teacher) ──────────────────────────────────────────
// DrawCall elements
const imageContainer = document.getElementById('image-container');
const bgImage        = document.getElementById('bg-image');
const canvas         = document.getElementById('draw-canvas');
const ctx            = canvas.getContext('2d');
const placeholder    = document.getElementById('placeholder');
const blobColor      = document.getElementById('blob-color');
const blobFile       = document.getElementById('blob-file');
const colorPopup     = document.getElementById('color-popup');
const colorDot       = document.getElementById('blob-color-dot');
const swatchGrid     = document.getElementById('swatch-grid');
const hexInput       = document.getElementById('hex-input');
const hexPreviewBox  = document.getElementById('hex-preview-box');
const sliderSize     = document.getElementById('slider-size');
const penSizeVal     = document.getElementById('pen-size-val');
const sizeFill       = document.getElementById('size-fill');
const sizeDotPreview = document.getElementById('size-dot-preview');
const btnPen         = document.getElementById('btn-pen');
const btnHand        = document.getElementById('btn-hand');
const btnCall        = document.getElementById('btn-call');
const btnClear       = document.getElementById('btn-clear');
const pillPen        = document.getElementById('pill-pen');
const pillMic        = document.getElementById('pill-mic');
const pillSpeaking   = document.getElementById('pill-speaking');
const toast          = document.getElementById('toast');
const fileInput      = document.getElementById('file-input');

// Teacher sidebar elements
const studentSidebar   = document.getElementById('studentSidebar');
const sidebarOverlay   = document.getElementById('sidebarOverlay');
const closeSidebar     = document.getElementById('closeSidebar');
const studentsList     = document.getElementById('studentsList');
const studentCountSpan = document.getElementById('studentCount');

// Pending popup elements
const pendingPopup     = document.getElementById('pendingPopup');
const closePopup       = document.getElementById('closePopup');
const pendingQueueList = document.getElementById('pendingQueueList');

// ── ICE configuration ─────────────────────────────────────────────────────
const IS_LOCAL = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const ICE_CONFIG = IS_LOCAL
  ? { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] }
  : {
      iceServers: [
        { urls: "stun:stun.relay.metered.ca:80" },
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "turn:global.relay.metered.ca:80",                 username: "c42ac28730f2eccb2531db32", credential: "Os9aeQUDwLn1A7Qw" },
        { urls: "turn:global.relay.metered.ca:80?transport=tcp",   username: "c42ac28730f2eccb2531db32", credential: "Os9aeQUDwLn1A7Qw" },
        { urls: "turn:global.relay.metered.ca:443",                username: "c42ac28730f2eccb2531db32", credential: "Os9aeQUDwLn1A7Qw" },
        { urls: "turns:global.relay.metered.ca:443?transport=tcp", username: "c42ac28730f2eccb2531db32", credential: "Os9aeQUDwLn1A7Qw" }
      ],
      iceTransportPolicy: "all",
      iceCandidatePoolSize: 10
    };

// ── State ─────────────────────────────────────────────────────────────────
let localStream    = null;
let isBroadcasting = false;
let penActive      = false;
let isDrawing      = false;
let lastX = 0, lastY = 0;
let penColor       = '#ffffff';
let penSize        = 4;
let audioCtxViz    = null;
let analyser       = null;
let animFrame      = null;

// WebRTC peer state
const outboundPeers = new Map();
const inboundPeers  = new Map();
const inboundAudio  = new Map();

// Student data
const students = new Map();
let pendingQueue = [];
let currentSpeaker = "teacher";
let teacherMicLive = false;

// ── Helper Functions ──────────────────────────────────────────────────────
function logCandidate(label, c) {
  if (!c) return;
  const type = c.type || "?";
  const proto = c.protocol || "?";
  const addr = c.address || c.ip || "?";
  const port = c.port || "?";
  console.log(`[ICE][${label}] ${type} ${proto} ${addr}:${port}`);
  if (type === "relay") console.log(`%c[ICE][${label}] ✅ TURN relay candidate gathered`, "color:green;font-weight:bold");
  if (type === "srflx") console.log(`%c[ICE][${label}] ✅ STUN srflx candidate gathered`, "color:blue");
}

function preferOpus(sdp) {
  const lines = sdp.split("\r\n");
  let opusPayload = null;
  for (const line of lines) {
    const m = line.match(/^a=rtpmap:(\d+) opus\/48000/i);
    if (m) { opusPayload = m[1]; break; }
  }
  if (!opusPayload) return sdp;
  const result = [];
  for (const line of lines) {
    if (line.startsWith("m=audio")) {
      const parts = line.split(" ");
      const payloads = parts.slice(3).filter(p => p !== opusPayload);
      result.push([...parts.slice(0, 3), opusPayload, ...payloads].join(" "));
      continue;
    }
    if (line.startsWith(`a=fmtp:${opusPayload}`)) {
      result.push(`a=fmtp:${opusPayload} minptime=10;useinbandfec=1;stereo=0;maxaveragebitrate=32000`);
      continue;
    }
    result.push(line);
  }
  if (!sdp.includes(`a=fmtp:${opusPayload}`)) {
    const idx = result.findIndex(l => l.startsWith(`a=rtpmap:${opusPayload}`));
    if (idx !== -1) result.splice(idx + 1, 0, `a=fmtp:${opusPayload} minptime=10;useinbandfec=1;stereo=0;maxaveragebitrate=32000`);
  }
  return result.join("\r\n");
}

function flushIceBuf(entry, label) {
  while (entry.iceBuf.length) {
    const c = entry.iceBuf.shift();
    entry.pc.addIceCandidate(new RTCIceCandidate(c))
      .catch(e => console.warn(`[${label}] flush addIceCandidate:`, e));
  }
}

function showToast(msg, color, bg, border) {
  toast.textContent = msg;
  toast.style.color = color || '#fff';
  toast.style.background = bg || 'rgba(0,0,0,0.8)';
  toast.style.border = border ? `1px solid ${border}` : '1px solid rgba(255,255,255,0.1)';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

// ── DrawCall Canvas Functions ─────────────────────────────────────────────
const SWATCHES = [
  '#ffffff','#e5e5e5','#a3a3a3','#737373','#404040','#1a1a1a','#000000',
  '#ff0000','#ff3b30','#ff6b35','#ff9500','#ffcc00','#ffe566','#fff3b0',
  '#00ff00','#34c759','#00c7be','#007aff','#0a84ff','#5e5ce6','#bf5af2',
  '#ff2d55','#ff375f','#ff6ef7','#ff9ff3','#74b9ff','#a29bfe','#fd79a8',
  '#55efc4','#00b894','#fdcb6e','#e17055','#d63031','#6c5ce7','#2d3436',
];

function buildSwatches() {
  SWATCHES.forEach(hex => {
    const s = document.createElement('div');
    s.className = 'swatch';
    s.style.background = hex;
    s.dataset.hex = hex;
    if (hex === penColor) s.classList.add('selected');
    s.addEventListener('click', () => selectSwatch(hex, s));
    swatchGrid.appendChild(s);
  });
}

function selectSwatch(hex, el) {
  document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
  if (el) el.classList.add('selected');
  penColor = hex;
  hexInput.value = hex.toUpperCase();
  hexInput.classList.remove('invalid');
  applyColorUI(hex);
}

function applyColorUI(hex) {
  colorDot.style.background = hex;
  hexPreviewBox.style.background = hex;
  blobColor.style.background = hex;
  sizeDotPreview.style.background = hex;
  const lum = (parseInt(hex.slice(1,3),16)/255 * 0.299) + (parseInt(hex.slice(3,5),16)/255 * 0.587) + (parseInt(hex.slice(5,7),16)/255 * 0.114);
  colorDot.style.borderColor = lum > 0.45 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)';
  colorDot.style.boxShadow = lum > 0.45 ? '0 0 0 3px rgba(0,0,0,0.1)' : '0 0 0 3px rgba(255,255,255,0.2)';
}

function updateSize() {
  penSize = parseInt(sliderSize.value);
  penSizeVal.textContent = penSize + 'px';
  const pct = ((penSize - 1) / 29) * 100;
  sizeFill.style.width = pct + '%';
  const dot = Math.max(5, Math.min(penSize, 24));
  sizeDotPreview.style.width = dot + 'px';
  sizeDotPreview.style.height = dot + 'px';
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== rect.width || canvas.height !== rect.height) {
    const saved = ctx.getImageData(0, 0, canvas.width, canvas.height);
    canvas.width = rect.width;
    canvas.height = rect.height;
    if (saved.width > 0 && saved.height > 0) {
      try { ctx.putImageData(saved, 0, 0); } catch(e) {}
    }
  }
}

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) * (canvas.width / rect.width),
    y: (src.clientY - rect.top) * (canvas.height / rect.height)
  };
}

// FIXED: Added draw-begin event
function startDraw(e) {
  if (!penActive) return;
  isDrawing = true;
  const p = getCanvasPos(e);
  lastX = p.x; lastY = p.y;
  
  // Local drawing
  ctx.beginPath();
  ctx.arc(lastX, lastY, penSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = penColor;
  ctx.fill();
  
  // Send draw-begin to students - starts a new stroke
  socket.emit("draw-begin", { roomId, x: lastX, y: lastY, color: penColor, width: penSize });
  
  e.preventDefault();
}

function draw(e) {
  if (!penActive || !isDrawing) return;
  const p = getCanvasPos(e);
  
  // Local drawing
  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = penColor;
  ctx.lineWidth = penSize;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.stroke();
  
  // Send draw event to students
  socket.emit("draw", { roomId, x: p.x, y: p.y, color: penColor, width: penSize });
  
  lastX = p.x; lastY = p.y;
  e.preventDefault();
}

// FIXED: Added draw-end event
function stopDraw() { 
  if (isDrawing) {
    isDrawing = false;
    // Send draw-end to students - ends the current stroke
    socket.emit("draw-end", { roomId });
  }
}

// ── WebRTC Outbound Peer (Teacher → Student) ─────────────────────────────
async function createOutboundPeer(studentId, studentName) {
  closeOutboundPeer(studentId);
  const label = `out→${studentId.substr(0,6)}`;
  console.log(`[${label}] creating peer for ${studentName || studentId.substr(0,6)}`);

  const pc = new RTCPeerConnection(ICE_CONFIG);
  const entry = { pc, iceBuf: [], restartTimer: null };
  outboundPeers.set(studentId, entry);

  if (localStream) {
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
  }

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      logCandidate(label, candidate);
      socket.emit("ice-candidate", { targetId: studentId, candidate, peerType: "inbound" });
    } else {
      console.log(`[${label}] ICE gathering complete`);
    }
  };

  pc.onicegatheringstatechange = () => {
    console.log(`[${label}] gathering: ${pc.iceGatheringState}`);
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`[${label}] ICE: ${pc.iceConnectionState}`);
  };

  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    console.log(`[${label}] conn: ${s}`);

    if (entry.restartTimer) { clearTimeout(entry.restartTimer); entry.restartTimer = null; }

    if (s === "connected") {
      console.log(`%c[${label}] ✅ CONNECTED`, "color:green;font-weight:bold");
    }

    if (s === "failed") {
      console.warn(`[${label}] ❌ FAILED — restarting ICE`);
      pc.createOffer({ iceRestart: true })
        .then(o => { o.sdp = preferOpus(o.sdp); return pc.setLocalDescription(o); })
        .then(() => {
          console.log(`[${label}] ICE restart offer sent`);
          socket.emit("webrtc-offer", { targetId: studentId, sdp: pc.localDescription });
        })
        .catch(e => console.error(`[${label}] ICE restart failed:`, e));
    }

    if (s === "disconnected") {
      console.warn(`[${label}] disconnected — will restart in 4s if not recovered`);
      entry.restartTimer = setTimeout(() => {
        if (pc.connectionState !== "connected" && pc.connectionState !== "closed") {
          console.warn(`[${label}] still disconnected, forcing ICE restart`);
          pc.createOffer({ iceRestart: true })
            .then(o => { o.sdp = preferOpus(o.sdp); return pc.setLocalDescription(o); })
            .then(() => socket.emit("webrtc-offer", { targetId: studentId, sdp: pc.localDescription }))
            .catch(() => {});
        }
      }, 4000);
    }
  };

  try {
    const offer = await pc.createOffer();
    offer.sdp = preferOpus(offer.sdp);
    await pc.setLocalDescription(offer);
    console.log(`[${label}] offer sent`);
    socket.emit("webrtc-offer", { targetId: studentId, sdp: pc.localDescription });
  } catch (e) {
    console.error(`[${label}] createOffer:`, e);
  }
}

function closeOutboundPeer(studentId) {
  const entry = outboundPeers.get(studentId);
  if (entry) {
    if (entry.restartTimer) clearTimeout(entry.restartTimer);
    entry.pc.close();
    outboundPeers.delete(studentId);
  }
}

function closeAllOutboundPeers() {
  outboundPeers.forEach((_, id) => closeOutboundPeer(id));
}

// ── Inbound Peer (Student → Teacher when approved) ───────────────────────
async function createInboundPeer(studentId, offerSdp) {
  closeInboundPeer(studentId);
  const label = `in←${studentId.substr(0,6)}`;

  const pc = new RTCPeerConnection(ICE_CONFIG);
  const entry = { pc, iceBuf: [] };
  inboundPeers.set(studentId, entry);

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      logCandidate(label, candidate);
      socket.emit("ice-candidate", { targetId: studentId, candidate, peerType: "outbound" });
    } else {
      console.log(`[${label}] ICE gathering complete`);
    }
  };

  pc.onicegatheringstatechange = () => {
    console.log(`[${label}] gathering: ${pc.iceGatheringState}`);
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`[${label}] ICE: ${pc.iceConnectionState}`);
  };

  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    console.log(`[${label}] conn: ${s}`);
    if (s === "connected") console.log(`%c[${label}] ✅ CONNECTED`, "color:green;font-weight:bold");
    if (s === "failed") { console.warn(`[${label}] ❌ FAILED — restarting ICE`); pc.restartIce(); }
  };

  pc.ontrack = ({ streams }) => {
    console.log(`[${label}] audio track received`);
    let el = inboundAudio.get(studentId);
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      el.playsInline = true;
      document.body.appendChild(el);
      inboundAudio.set(studentId, el);
    }
    el.srcObject = streams[0];
    el.play().catch(() => {});
  };

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    flushIceBuf(entry, label);
    const answer = await pc.createAnswer();
    answer.sdp = preferOpus(answer.sdp);
    await pc.setLocalDescription(answer);
    socket.emit("webrtc-answer-student", { targetId: studentId, sdp: pc.localDescription });
    console.log(`[${label}] answer sent`);
  } catch (e) {
    console.error(`[${label}] answer:`, e);
  }
}

function closeInboundPeer(studentId) {
  const entry = inboundPeers.get(studentId);
  if (entry) { entry.pc.close(); inboundPeers.delete(studentId); }
  const el = inboundAudio.get(studentId);
  if (el) { el.srcObject = null; el.remove(); inboundAudio.delete(studentId); }
}

function closeAllInboundPeers() {
  inboundPeers.forEach((_, id) => closeInboundPeer(id));
}

// ── Audio Visualizer ─────────────────────────────────────────────────────
function setupVisualizer() {
  if (!localStream) return;
  if (audioCtxViz) {
    if (animFrame) cancelAnimationFrame(animFrame);
    audioCtxViz.close();
  }
  audioCtxViz = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioCtxViz.createAnalyser();
  analyser.fftSize = 256;
  audioCtxViz.createMediaStreamSource(localStream).connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  const visualizer = document.getElementById('audioVisualizer');
  if (!visualizer) return;
  (function tick() {
    if (!analyser || !isBroadcasting) return;
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((a, b) => a + b, 0) / data.length;
    visualizer.style.setProperty("--width", (avg / 255 * 100) + "%");
    animFrame = requestAnimationFrame(tick);
  })();
}

// ── Broadcast Control ────────────────────────────────────────────────────
async function startBroadcasting() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000
      }
    });
    isBroadcasting = true;
    teacherMicLive = true;
    pillMic.classList.add('show');
    setupVisualizer();
    socket.emit("teacher-broadcasting");
    showToast("🎙️ Broadcasting started", "#16c24a", "rgba(22,194,74,0.12)", "rgba(22,194,74,0.35)");
    
    students.forEach((info, studentId) => {
      createOutboundPeer(studentId, info.name);
    });
  } catch (e) {
    console.error("[teacher] getUserMedia:", e);
    showToast("❌ Microphone access denied", "#ff6b6b", "rgba(229,32,46,0.12)", "rgba(229,32,46,0.35)");
  }
}

function stopBroadcasting() {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  if (animFrame) {
    cancelAnimationFrame(animFrame);
    animFrame = null;
  }
  if (audioCtxViz) {
    audioCtxViz.close();
    audioCtxViz = null;
  }
  closeAllOutboundPeers();
  closeAllInboundPeers();
  isBroadcasting = false;
  teacherMicLive = false;
  pillMic.classList.remove('show');
  showToast("📵 Broadcast ended", "rgba(255,255,255,0.5)", "rgba(255,255,255,0.05)", "rgba(255,255,255,0.12)");
}

// ── Student Management UI ────────────────────────────────────────────────
function updateStudentList() {
  if (students.size === 0) {
    studentsList.innerHTML = '<div style="text-align:center; color:rgba(255,255,255,0.3); padding:40px;">No students connected</div>';
    studentCountSpan.textContent = '0';
    return;
  }
  
  studentCountSpan.textContent = students.size;
  let html = '';
  students.forEach((info, id) => {
    let statusClass = 'idle';
    let statusIcon = '';
    if (currentSpeaker === id) {
      statusClass = 'speaking';
      statusIcon = '🎤';
    } else if (info.handRaised) {
      statusClass = 'hand-raised';
      statusIcon = '🙋';
    } else {
      statusClass = 'online';
    }
    
    html += `
      <div class="student-item">
        <div class="student-info">
          <div class="student-status ${statusClass}"></div>
          <span class="student-name">${escapeHtml(info.name)}</span>
        </div>
        <div class="student-hand-icon">${statusIcon}</div>
      </div>
    `;
  });
  studentsList.innerHTML = html;
}

function escapeHtml(str) {
  return str.replace(/[&<>]/g, function(m) {
    if (m === '&') return '&amp;';
    if (m === '<') return '&lt;';
    if (m === '>') return '&gt;';
    return m;
  });
}

function updateHandButtonState() {
  if (currentSpeaker !== "teacher") {
    btnHand.classList.add('speaking');
    btnHand.classList.remove('has-pending');
    pillSpeaking.classList.add('show');
    pillSpeaking.textContent = `🎤 ${students.get(currentSpeaker)?.name || 'Student'} Speaking`;
  } else if (pendingQueue.length > 0) {
    btnHand.classList.add('has-pending');
    btnHand.classList.remove('speaking');
    pillSpeaking.classList.remove('show');
  } else {
    btnHand.classList.remove('has-pending', 'speaking');
    pillSpeaking.classList.remove('show');
  }
}

function updatePendingPopup() {
  if (pendingQueue.length === 0) {
    pendingQueueList.innerHTML = '<div style="text-align:center; color:rgba(255,255,255,0.3); padding:20px;">No pending requests</div>';
    return;
  }
  
  let html = '';
  pendingQueue.forEach((item, idx) => {
    html += `
      <div class="pending-queue-item">
        <span style="color:#fff;">${escapeHtml(item.studentName)}</span>
        <span style="color:#ffcc00; font-size:12px;">🙋 Waiting</span>
      </div>
    `;
  });
  pendingQueueList.innerHTML = html;
}

function approveNextStudent() {
  if (pendingQueue.length === 0) return;
  
  const nextStudent = pendingQueue.shift();
  socket.emit("approve-speaker", { roomId, studentId: nextStudent.studentId });
  showToast(`✅ Approved ${nextStudent.studentName} to speak`, "#16c24a", "rgba(22,194,74,0.12)", "rgba(22,194,74,0.35)");
  
  updatePendingPopup();
  updateHandButtonState();
}

function revokeSpeaker() {
  if (currentSpeaker !== "teacher") {
    socket.emit("revoke-speaker", roomId);
    showToast("🔇 Speaker revoked", "rgba(255,255,255,0.5)", "rgba(255,255,255,0.05)", "rgba(255,255,255,0.12)");
  }
}

// ── Material Sharing ─────────────────────────────────────────────────────
async function shareMaterial(file) {
  const fd = new FormData();
  fd.append("file", file);
  try {
    const res = await fetch(`${SERVER_URL}/upload`, { method: "POST", body: fd });
    const data = await res.json();
    if (data.error) { showToast(data.error, "#ff6b6b"); return; }
    const absoluteUrl = data.url.startsWith('http') ? data.url : `${SERVER_URL}${data.url}`;
    bgImage.src = absoluteUrl;
    imageContainer.style.display = 'flex';
    placeholder.style.display = 'none';
    btnClear.style.display = 'block';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTimeout(() => resizeCanvas(), 50);
    socket.emit("share-material", { roomId, url: absoluteUrl });
    showToast("📎 Material shared with students", "#16c24a", "rgba(22,194,74,0.12)", "rgba(22,194,74,0.35)");
  } catch (e) {
    showToast("Upload failed", "#ff6b6b");
  }
}

// ── Socket Event Handlers ────────────────────────────────────────────────
socket.on("connect", () => {
  console.log("[teacher] socket connected:", socket.id);
  socket.emit("join-as-teacher", roomId);
});

socket.on("disconnect", () => {
  console.log("[teacher] disconnected");
  stopBroadcasting();
  btnCall.classList.remove('in-call');
});

socket.on("session-ended", () => {
  console.log("[teacher] session ended by schedule");
  stopBroadcasting();
  showToast("⏰ Session time is up", "#ffcc00", "rgba(255,204,0,0.15)", "rgba(255,204,0,0.4)");
  setTimeout(() => { window.location.href = '/dashboard'; }, 3000);
});

socket.on("teacher-joined", () => {
  console.log("[teacher] joined room:", roomId);
});

socket.on("student-connected", ({ studentId, studentName, totalStudents }) => {
  students.set(studentId, { name: studentName, handRaised: false, approved: false });
  updateStudentList();
  if (isBroadcasting && localStream) {
    createOutboundPeer(studentId, studentName);
  }
  showToast(`📚 ${studentName} joined`, "#6096ff", "rgba(37,99,255,0.12)", "rgba(37,99,255,0.35)");
});

socket.on("student-left", ({ studentId, studentName, totalStudents }) => {
  students.delete(studentId);
  pendingQueue = pendingQueue.filter(s => s.studentId !== studentId);
  closeOutboundPeer(studentId);
  closeInboundPeer(studentId);
  updateStudentList();
  updatePendingPopup();
  updateHandButtonState();
  showToast(`👋 ${studentName} left`, "rgba(255,255,255,0.5)", "rgba(255,255,255,0.05)", "rgba(255,255,255,0.12)");
});

socket.on("hand-raised", ({ studentId, studentName }) => {
  const student = students.get(studentId);
  if (student) {
    student.handRaised = true;
    pendingQueue.push({ studentId, studentName });
    updateStudentList();
    updatePendingPopup();
    updateHandButtonState();
    showToast(`🙋 ${studentName} raised hand`, "#ffcc00", "rgba(255,204,0,0.12)", "rgba(255,204,0,0.35)");
  }
});

socket.on("hand-cancelled", ({ studentId }) => {
  const student = students.get(studentId);
  if (student) {
    student.handRaised = false;
    pendingQueue = pendingQueue.filter(s => s.studentId !== studentId);
    updateStudentList();
    updatePendingPopup();
    updateHandButtonState();
  }
});

socket.on("speaker-changed", ({ speakerId, speakerName, isTeacher }) => {
  if (isTeacher) {
    currentSpeaker = "teacher";
    closeAllInboundPeers();
  } else {
    currentSpeaker = speakerId;
  }
  updateStudentList();
  updateHandButtonState();
  if (!isTeacher) {
    showToast(`🎤 ${speakerName} is now speaking`, "#16c24a", "rgba(22,194,74,0.12)", "rgba(22,194,74,0.35)");
  }
});

socket.on("webrtc-offer-student", async ({ fromId, sdp }) => {
  console.log(`[teacher] inbound offer from student ${fromId.substr(0,6)}`);
  await createInboundPeer(fromId, sdp);
});

socket.on("webrtc-answer", ({ fromId, sdp }) => {
  const entry = outboundPeers.get(fromId);
  if (!entry) return;
  console.log(`[out→${fromId.substr(0,6)}] received answer, setting remote desc`);
  entry.pc.setRemoteDescription(new RTCSessionDescription(sdp))
    .then(() => {
      console.log(`[out→${fromId.substr(0,6)}] remote desc set, flushing ${entry.iceBuf.length} buffered candidates`);
      flushIceBuf(entry, `out→${fromId.substr(0,6)}`);
    })
    .catch(e => console.error(`[out→${fromId.substr(0,6)}] setRemoteDescription:`, e));
});

socket.on("ice-candidate", ({ fromId, candidate, peerType }) => {
  const entry = peerType === "inbound"
    ? inboundPeers.get(fromId)
    : outboundPeers.get(fromId);
  if (!entry || !candidate) return;

  const label = peerType === "inbound" ? `in←${fromId.substr(0,6)}` : `out→${fromId.substr(0,6)}`;
  const pc = entry.pc;
  if (pc.remoteDescription && pc.remoteDescription.type) {
    pc.addIceCandidate(new RTCIceCandidate(candidate))
      .catch(e => console.warn(`[${label}] addIceCandidate:`, e));
  } else {
    console.log(`[${label}] buffering candidate (no remote desc yet)`);
    entry.iceBuf.push(candidate);
  }
});

socket.on("current-students", (studentsList) => {
  studentsList.forEach(({ studentId, studentName }) => {
    if (!students.has(studentId)) {
      students.set(studentId, { name: studentName, handRaised: false, approved: false });
      if (isBroadcasting && localStream) {
        createOutboundPeer(studentId, studentName);
      }
    }
  });
  updateStudentList();
});

// ── UI Event Listeners ───────────────────────────────────────────────────
btnPen.addEventListener('click', () => {
  penActive = !penActive;
  btnPen.classList.toggle('active', penActive);
  canvas.classList.toggle('pen-active', penActive);
  pillPen.classList.toggle('show', penActive);
});

btnHand.addEventListener('click', () => {
  if (currentSpeaker !== "teacher") {
    revokeSpeaker();
  } else if (pendingQueue.length > 0) {
    approveNextStudent();
  } else {
    pendingPopup.classList.add('open');
    setTimeout(() => {
      document.addEventListener('click', function closePopupOnClickOutside(e) {
        if (!pendingPopup.contains(e.target) && !btnHand.contains(e.target)) {
          pendingPopup.classList.remove('open');
          document.removeEventListener('click', closePopupOnClickOutside);
        }
      });
    }, 10);
  }
});

btnCall.addEventListener('click', () => {
  if (isBroadcasting) {
    stopBroadcasting();
    btnCall.classList.remove('in-call');
  } else {
    startBroadcasting();
    btnCall.classList.add('in-call');
  }
});

btnClear.addEventListener('click', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  socket.emit("clear-canvas", roomId);
});

blobColor.addEventListener('click', (e) => {
  e.stopPropagation();
  colorPopup.classList.toggle('open');
});

document.addEventListener('click', (e) => {
  if (!colorPopup.contains(e.target) && !blobColor.contains(e.target)) {
    colorPopup.classList.remove('open');
  }
});

blobFile.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) shareMaterial(file);
  fileInput.value = '';
});

hexInput.addEventListener('input', () => {
  let v = hexInput.value.trim();
  if (!v.startsWith('#')) v = '#' + v;
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    hexInput.classList.remove('invalid');
    penColor = v.toLowerCase();
    document.querySelectorAll('.swatch').forEach(s => {
      s.classList.toggle('selected', s.dataset.hex.toLowerCase() === penColor);
    });
    applyColorUI(penColor);
  } else {
    hexInput.classList.add('invalid');
  }
});

sliderSize.addEventListener('input', updateSize);

canvas.addEventListener('mousedown', startDraw);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDraw);
canvas.addEventListener('mouseleave', () => {
  if (isDrawing) {
    stopDraw();
    socket.emit("draw-end", { roomId });
  }
});
canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
canvas.addEventListener('touchend', stopDraw);
canvas.addEventListener('touchcancel', stopDraw);

let touchStartX = 0;
let touchStartY = 0;
const swipeZone = document.getElementById('swipeZone');

if (swipeZone) {
  swipeZone.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  });

  swipeZone.addEventListener('touchmove', (e) => {
    if (touchStartX === 0) return;
    const diffX = e.touches[0].clientX - touchStartX;
    const diffY = Math.abs(e.touches[0].clientY - touchStartY);
    if (diffX > 20 && diffY < 50) {
      studentSidebar.classList.add('open');
      sidebarOverlay.classList.add('show');
      touchStartX = 0;
    }
  });
}

function closeSidebarFunc() {
  studentSidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
}

closeSidebar.addEventListener('click', closeSidebarFunc);
sidebarOverlay.addEventListener('click', closeSidebarFunc);
closePopup.addEventListener('click', () => {
  pendingPopup.classList.remove('open');
});

window.addEventListener('resize', () => setTimeout(resizeCanvas, 100));
window.addEventListener('load', () => setTimeout(resizeCanvas, 100));

buildSwatches();
applyColorUI(penColor);
updateSize();
setTimeout(resizeCanvas, 100);

console.log("[teacher] ready, room:", roomId);