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

function getMaterialRectOnCanvas() {
  const canvasRect = canvas.getBoundingClientRect();
  const imageRect = bgImage.getBoundingClientRect();
  const hasVisibleMaterial = imageContainer.style.display !== 'none' &&
    bgImage.complete &&
    bgImage.naturalWidth > 0 &&
    imageRect.width > 0 &&
    imageRect.height > 0;

  if (!hasVisibleMaterial || canvasRect.width === 0 || canvasRect.height === 0) {
    return { left: 0, top: 0, width: canvas.width, height: canvas.height };
  }

  const scaleX = canvas.width / canvasRect.width;
  const scaleY = canvas.height / canvasRect.height;

  return {
    left: (imageRect.left - canvasRect.left) * scaleX,
    top: (imageRect.top - canvasRect.top) * scaleY,
    width: imageRect.width * scaleX,
    height: imageRect.height * scaleY
  };
}

function makeDrawPayload(point) {
  const materialRect = getMaterialRectOnCanvas();
  return {
    roomId,
    x: (point.x - materialRect.left) / materialRect.width,
    y: (point.y - materialRect.top) / materialRect.height,
    color: penColor,
    width: penSize / materialRect.width
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

  socket.emit("draw-begin", makeDrawPayload({ x: lastX, y: lastY }));

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

  socket.emit("draw", makeDrawPayload(p));

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
  approveStudentMic(nextStudent.studentId, nextStudent.studentName);
  showToast(`✅ Approved ${nextStudent.studentName} to speak`, "#16c24a", "rgba(22,194,74,0.12)", "rgba(22,194,74,0.35)");
  
  updatePendingPopup();
  updateStudentList();
  updateHandButtonState();
}

function approveStudentMic(studentId, studentName) {
  pendingQueue = pendingQueue.filter(s => s.studentId !== studentId);
  const student = students.get(studentId);
  if (student) {
    student.handRaised = false;
    student.approved = true;
  }
  socket.emit("approve-speaker", { roomId, studentId });
  showToast("Requesting mic permission from " + (studentName || student?.name || "student"), "#16c24a", "rgba(22,194,74,0.12)", "rgba(22,194,74,0.35)");
  updatePendingPopup();
  updateStudentList();
  updateHandButtonState();
}

function toggleMiddleMicButton() {
  if (currentSpeaker !== "teacher") {
    revokeSpeaker();
    return;
  }

  if (pendingQueue.length > 0) {
    approveNextStudent();
    return;
  }

  const firstStudent = Array.from(students.entries())[0];
  if (!firstStudent) {
    socket.emit("teacher-broadcasting");
    showToast("No students connected", "#ffcc00");
    return;
  }

  const [studentId, student] = firstStudent;
  approveStudentMic(studentId, student.name);
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
  setTimeout(() => { window.location.href = 'https://darutehsinquran.center/dashboard?room=' + roomId; }, 3000);
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
  // Ensure student is tracked even if they joined before teacher started
  if (!students.has(studentId)) {
    students.set(studentId, { name: studentName, handRaised: true, approved: false });
  } else {
    students.get(studentId).handRaised = true;
  }
  // Only add to queue if not already in it
  if (!pendingQueue.find(s => s.studentId === studentId)) {
    pendingQueue.push({ studentId, studentName });
  }
  updateStudentList();
  updatePendingPopup();
  updateHandButtonState();
  showToast(`🙋 ${studentName} raised hand`, "#ffcc00", "rgba(255,204,0,0.12)", "rgba(255,204,0,0.35)");
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
    students.forEach(info => { info.approved = false; });
  } else {
    currentSpeaker = speakerId;
    const student = students.get(speakerId);
    if (student) {
      student.approved = true;
      student.handRaised = false;
    }
    pendingQueue = pendingQueue.filter(s => s.studentId !== speakerId);
  }
  updatePendingPopup();
  updateStudentList();
  updateHandButtonState();
  if (!isTeacher) {
    showToast(`🎤 ${speakerName} is now speaking`, "#16c24a", "rgba(22,194,74,0.12)", "rgba(22,194,74,0.35)");
  }
});

socket.on("student-mic-failed", ({ studentId, studentName, reason }) => {
  const student = students.get(studentId);
  if (student) {
    student.approved = false;
    student.handRaised = false;
  }
  pendingQueue = pendingQueue.filter(s => s.studentId !== studentId);
  currentSpeaker = "teacher";
  closeInboundPeer(studentId);
  updatePendingPopup();
  updateStudentList();
  updateHandButtonState();
  showToast((studentName || "Student") + " could not open mic" + (reason ? ": " + reason : ""), "#ff6b6b", "rgba(255,69,58,0.12)", "rgba(255,69,58,0.35)");
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
// ── Leave button ─────────────────────────────────────────────────────────
document.getElementById('btn-leave').addEventListener('click', () => {
  if (confirm('Leave this session?')) {
    stopBroadcasting();
    sessionStorage.removeItem('classroom_room');
    window.location.href = '/dashboard';
  }
});

// ── Refresh persistence: restore room from sessionStorage ─────────────────
// Store room so a refresh reconnects to the same room automatically
sessionStorage.setItem('classroom_room', roomId);
window.addEventListener('beforeunload', () => {
  // Keep sessionStorage on refresh (not on leave button)
});

btnPen.addEventListener('click', () => {
  penActive = !penActive;
  btnPen.classList.toggle('active', penActive);
  canvas.classList.toggle('pen-active', penActive);
  // Also update PDF draw canvas cursor
  const pdfDc = document.getElementById('qpdf-draw-canvas');
  if (pdfDc) pdfDc.style.cursor = penActive ? 'crosshair' : 'default';
});

btnHand.addEventListener('click', () => {
  toggleMiddleMicButton();
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
  // Also clear PDF draw canvas
  const pdfDc = document.getElementById('qpdf-draw-canvas');
  if (pdfDc && pdfDrawCtx) pdfDrawCtx.clearRect(0, 0, pdfDc.width, pdfDc.height);
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

blobFile.addEventListener('click', () => {
  const menu = document.getElementById('source-menu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('src-image').addEventListener('click', () => {
  document.getElementById('source-menu').style.display = 'none';
  fileInput.click();
});

document.getElementById('src-quran').addEventListener('click', () => {
  document.getElementById('source-menu').style.display = 'none';
  openQuranPanel();
});

document.getElementById('src-qaida').addEventListener('click', () => {
  document.getElementById('source-menu').style.display = 'none';
  openQaidaPanel();
});

// ── Qaida Integration ─────────────────────────────────────────────────────
const QAIDA_API = 'https://qaidaapi.onrender.com';
let qaidaLessons = [];
let currentQaidaPage = 1;

function openQaidaPanel() {
  const panel = document.getElementById('qaida-panel');
  panel.style.display = 'flex';
  if (qaidaLessons.length === 0) loadQaidaLessons();
}

async function loadQaidaLessons() {
  const sel = document.getElementById('qaida-page');
  sel.innerHTML = '<option value="">Loading...</option>';
  try {
    const res  = await fetch(`${QAIDA_API}/lessons`);
    const data = await res.json();
    qaidaLessons = data;
    sel.innerHTML = '';
    // Add all 23 pages directly by number
    for (let i = 1; i <= 23; i++) {
      const lesson = data.find(l => l.page === i || l.id === i || l.pageNumber === i) || { title: `Page ${i}` };
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Page ${i}${lesson.title && lesson.title !== `Page ${i}` ? ' — ' + lesson.title : ''}`;
      sel.appendChild(opt);
    }
    // Preview first page
    previewQaidaPage(1);
  } catch (e) {
    // Fallback: just list pages 1-23 without lesson titles
    sel.innerHTML = '';
    for (let i = 1; i <= 23; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Page ${i}`;
      sel.appendChild(opt);
    }
    previewQaidaPage(1);
  }
}

function previewQaidaPage(pageNum) {
  const img = document.getElementById('qaida-img');
  img.style.display = 'none';
  img.src = `${QAIDA_API}/pages/page${pageNum}.jpg`;
  img.onload  = () => { img.style.display = 'block'; };
  img.onerror = () => { img.style.display = 'none'; };
  currentQaidaPage = pageNum;
}

document.getElementById('qaida-page').addEventListener('change', (e) => {
  if (e.target.value) previewQaidaPage(parseInt(e.target.value));
});

document.getElementById('qaida-close').addEventListener('click', () => {
  document.getElementById('qaida-panel').style.display = 'none';
});

document.getElementById('qaida-share').addEventListener('click', () => {
  const pageNum = parseInt(document.getElementById('qaida-page').value) || currentQaidaPage;
  const url = `${QAIDA_API}/pages/page${pageNum}.jpg`;

  // Load image, convert to data URL so it can be shared via socket
  const tempImg = new Image();
  tempImg.crossOrigin = 'anonymous';
  tempImg.onload = () => {
    const offscreen = document.createElement('canvas');
    offscreen.width  = tempImg.naturalWidth;
    offscreen.height = tempImg.naturalHeight;
    offscreen.getContext('2d').drawImage(tempImg, 0, 0);
    const dataUrl = offscreen.toDataURL('image/jpeg', 0.92);

    bgImage.src = dataUrl;
    imageContainer.style.display = 'flex';
    placeholder.style.display = 'none';
    btnClear.style.display = 'block';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setTimeout(() => resizeCanvas(), 50);
    socket.emit('share-material', { roomId, url: dataUrl });
    document.getElementById('qaida-panel').style.display = 'none';
    showToast(`🅰️ Page ${pageNum} shared`, '#16c24a', 'rgba(22,194,74,0.12)', 'rgba(22,194,74,0.35)');

    // Show quick-change bar for Qaida
    showQaidaBar(pageNum);
  };
  tempImg.onerror = () => showToast('Failed to load page', '#ff6b6b');
  tempImg.src = url;
});

function showQaidaBar(pageNum) {
  let bar = document.getElementById('qaida-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'qaida-bar';
    bar.style.cssText = `
      position:absolute; bottom:105px; left:50%; transform:translateX(-50%);
      z-index:15; background:rgba(10,10,15,0.92); border:1px solid rgba(255,255,255,0.12);
      border-radius:20px; padding:6px 12px; display:flex; align-items:center;
      gap:8px; backdrop-filter:blur(12px); white-space:nowrap;
    `;
    document.getElementById('phone').appendChild(bar);
  }
  bar.innerHTML = `
    <span style="color:rgba(255,255,255,0.5);font-size:11px;">🅰️</span>
    <button id="qb-prev" style="background:rgba(255,255,255,0.1);border:none;border-radius:8px;color:#fff;padding:4px 10px;font-size:14px;cursor:pointer;">&#8592;</button>
    <span id="qb-label" style="color:#fff;font-size:12px;font-weight:700;min-width:50px;text-align:center;">Page ${pageNum}</span>
    <button id="qb-next" style="background:rgba(255,255,255,0.1);border:none;border-radius:8px;color:#fff;padding:4px 10px;font-size:14px;cursor:pointer;">&#8594;</button>
    <button id="qb-close" style="background:none;border:none;color:rgba(255,255,255,0.3);font-size:14px;cursor:pointer;padding:0 2px;">✕</button>
  `;
  bar.style.display = 'flex';
  bar._page = pageNum;

  const shareQaidaPage = (p) => {
    p = Math.max(1, Math.min(23, p));
    bar._page = p;
    document.getElementById('qb-label').textContent = `Page ${p}`;
    const url = `${QAIDA_API}/pages/page${p}.jpg`;
    const tmp = new Image();
    tmp.crossOrigin = 'anonymous';
    tmp.onload = () => {
      const oc = document.createElement('canvas');
      oc.width = tmp.naturalWidth; oc.height = tmp.naturalHeight;
      oc.getContext('2d').drawImage(tmp, 0, 0);
      const du = oc.toDataURL('image/jpeg', 0.92);
      bgImage.src = du;
      imageContainer.style.display = 'flex';
      placeholder.style.display = 'none';
      btnClear.style.display = 'block';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setTimeout(() => resizeCanvas(), 50);
      socket.emit('share-material', { roomId, url: du });
    };
    tmp.src = url;
  };

  document.getElementById('qb-prev').onclick  = () => shareQaidaPage(bar._page - 1);
  document.getElementById('qb-next').onclick  = () => shareQaidaPage(bar._page + 1);
  document.getElementById('qb-close').onclick = () => { bar.style.display = 'none'; };
}

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) shareMaterial(file);
  fileInput.value = '';
});

// ── Quran Integration ─────────────────────────────────────────────────────
const SURAHS = [
  {n:1,name:"Al-Fatihah",v:7},{n:2,name:"Al-Baqarah",v:286},{n:3,name:"Aal-E-Imran",v:200},
  {n:4,name:"An-Nisa",v:176},{n:5,name:"Al-Ma'idah",v:120},{n:6,name:"Al-An'am",v:165},
  {n:7,name:"Al-A'raf",v:206},{n:8,name:"Al-Anfal",v:75},{n:9,name:"At-Tawbah",v:129},
  {n:10,name:"Yunus",v:109},{n:11,name:"Hud",v:123},{n:12,name:"Yusuf",v:111},
  {n:13,name:"Ar-Ra'd",v:43},{n:14,name:"Ibrahim",v:52},{n:15,name:"Al-Hijr",v:99},
  {n:16,name:"An-Nahl",v:128},{n:17,name:"Al-Isra",v:111},{n:18,name:"Al-Kahf",v:110},
  {n:19,name:"Maryam",v:98},{n:20,name:"Ta-Ha",v:135},{n:21,name:"Al-Anbiya",v:112},
  {n:22,name:"Al-Hajj",v:78},{n:23,name:"Al-Mu'minun",v:118},{n:24,name:"An-Nur",v:64},
  {n:25,name:"Al-Furqan",v:77},{n:26,name:"Ash-Shu'ara",v:227},{n:27,name:"An-Naml",v:93},
  {n:28,name:"Al-Qasas",v:88},{n:29,name:"Al-Ankabut",v:69},{n:30,name:"Ar-Rum",v:60},
  {n:31,name:"Luqman",v:34},{n:32,name:"As-Sajdah",v:30},{n:33,name:"Al-Ahzab",v:73},
  {n:34,name:"Saba",v:54},{n:35,name:"Fatir",v:45},{n:36,name:"Ya-Sin",v:83},
  {n:37,name:"As-Saffat",v:182},{n:38,name:"Sad",v:88},{n:39,name:"Az-Zumar",v:75},
  {n:40,name:"Ghafir",v:85},{n:41,name:"Fussilat",v:54},{n:42,name:"Ash-Shura",v:53},
  {n:43,name:"Az-Zukhruf",v:89},{n:44,name:"Ad-Dukhan",v:59},{n:45,name:"Al-Jathiyah",v:37},
  {n:46,name:"Al-Ahqaf",v:35},{n:47,name:"Muhammad",v:38},{n:48,name:"Al-Fath",v:29},
  {n:49,name:"Al-Hujurat",v:18},{n:50,name:"Qaf",v:45},{n:51,name:"Adh-Dhariyat",v:60},
  {n:52,name:"At-Tur",v:49},{n:53,name:"An-Najm",v:62},{n:54,name:"Al-Qamar",v:55},
  {n:55,name:"Ar-Rahman",v:78},{n:56,name:"Al-Waqi'ah",v:96},{n:57,name:"Al-Hadid",v:29},
  {n:58,name:"Al-Mujadila",v:22},{n:59,name:"Al-Hashr",v:24},{n:60,name:"Al-Mumtahanah",v:13},
  {n:61,name:"As-Saf",v:14},{n:62,name:"Al-Jumu'ah",v:11},{n:63,name:"Al-Munafiqun",v:11},
  {n:64,name:"At-Taghabun",v:18},{n:65,name:"At-Talaq",v:12},{n:66,name:"At-Tahrim",v:12},
  {n:67,name:"Al-Mulk",v:30},{n:68,name:"Al-Qalam",v:52},{n:69,name:"Al-Haqqah",v:52},
  {n:70,name:"Al-Ma'arij",v:44},{n:71,name:"Nuh",v:28},{n:72,name:"Al-Jinn",v:28},
  {n:73,name:"Al-Muzzammil",v:20},{n:74,name:"Al-Muddaththir",v:56},{n:75,name:"Al-Qiyamah",v:40},
  {n:76,name:"Al-Insan",v:31},{n:77,name:"Al-Mursalat",v:50},{n:78,name:"An-Naba",v:40},
  {n:79,name:"An-Nazi'at",v:46},{n:80,name:"Abasa",v:42},{n:81,name:"At-Takwir",v:29},
  {n:82,name:"Al-Infitar",v:19},{n:83,name:"Al-Mutaffifin",v:36},{n:84,name:"Al-Inshiqaq",v:25},
  {n:85,name:"Al-Buruj",v:22},{n:86,name:"At-Tariq",v:17},{n:87,name:"Al-A'la",v:19},
  {n:88,name:"Al-Ghashiyah",v:26},{n:89,name:"Al-Fajr",v:30},{n:90,name:"Al-Balad",v:20},
  {n:91,name:"Ash-Shams",v:15},{n:92,name:"Al-Layl",v:21},{n:93,name:"Ad-Duha",v:11},
  {n:94,name:"Ash-Sharh",v:8},{n:95,name:"At-Tin",v:8},{n:96,name:"Al-Alaq",v:19},
  {n:97,name:"Al-Qadr",v:5},{n:98,name:"Al-Bayyinah",v:8},{n:99,name:"Az-Zalzalah",v:8},
  {n:100,name:"Al-Adiyat",v:11},{n:101,name:"Al-Qari'ah",v:11},{n:102,name:"At-Takathur",v:8},
  {n:103,name:"Al-Asr",v:3},{n:104,name:"Al-Humazah",v:9},{n:105,name:"Al-Fil",v:5},
  {n:106,name:"Quraysh",v:4},{n:107,name:"Al-Ma'un",v:7},{n:108,name:"Al-Kawthar",v:3},
  {n:109,name:"Al-Kafirun",v:6},{n:110,name:"An-Nasr",v:3},{n:111,name:"Al-Masad",v:5},
  {n:112,name:"Al-Ikhlas",v:4},{n:113,name:"Al-Falaq",v:5},{n:114,name:"An-Nas",v:6}
];

let currentQuranSurah = null; // tracks active surah for quick-change bar

// Populate surah dropdown once
function initSurahDropdown() {
  const sel = document.getElementById('quran-surah');
  if (sel.options.length > 0) return;
  SURAHS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.n;
    opt.textContent = `${s.n}. ${s.name}`;
    sel.appendChild(opt);
  });
}

function openQuranPanel() {
  initSurahDropdown();
  document.getElementById('quran-panel').style.display = 'flex';
}

document.getElementById('quran-close').addEventListener('click', () => {
  document.getElementById('quran-panel').style.display = 'none';
});

document.getElementById('quran-surah').addEventListener('change', (e) => {
  const s = SURAHS.find(x => x.n == e.target.value);
  if (!s) return;
  document.getElementById('quran-from').max = s.v;
  document.getElementById('quran-to').max   = s.v;
  document.getElementById('quran-to').value = Math.min(5, s.v);
});

document.getElementById('quran-load').addEventListener('click', async () => {
  const surahNum = parseInt(document.getElementById('quran-surah').value);
  const from     = parseInt(document.getElementById('quran-from').value);
  const to       = parseInt(document.getElementById('quran-to').value);
  if (!surahNum || isNaN(from) || isNaN(to) || from > to) {
    showToast('Invalid range', '#ff6b6b'); return;
  }
  await loadAndShareQuran(surahNum, from, to);
});

document.getElementById('quran-share').addEventListener('click', async () => {
  const surahNum = parseInt(document.getElementById('quran-surah').value);
  const from     = parseInt(document.getElementById('quran-from').value);
  const to       = parseInt(document.getElementById('quran-to').value);
  await loadAndShareQuran(surahNum, from, to, true);
});

async function loadAndShareQuran(surahNum, from, to, shareNow = false) {
  const loadBtn = document.getElementById('quran-load');
  loadBtn.textContent = 'Loading...';
  loadBtn.disabled = true;

  try {
    const res  = await fetch(`https://api.alquran.cloud/v1/surah/${surahNum}/quran-uthmani`);
    const data = await res.json();
    if (data.code !== 200 || !data.data?.ayahs) { showToast('API error', '#ff6b6b'); return; }

    const verses = data.data.ayahs.slice(from - 1, to);
    const surah  = SURAHS.find(s => s.n === surahNum);

    const preview = document.getElementById('quran-preview');
    preview.innerHTML = '';
    verses.forEach(v => {
      const div = document.createElement('div');
      div.style.cssText = 'background:rgba(255,255,255,0.06);border-radius:12px;padding:14px 12px;border:1px solid rgba(255,255,255,0.08);';
      div.innerHTML = `
        <p style="color:#fff;font-size:26px;line-height:2.2;text-align:right;direction:rtl;font-family:serif;">${v.text}</p>
        <p style="color:rgba(255,255,255,0.35);font-size:11px;margin-top:6px;text-align:right;">آية ${v.numberInSurah}</p>
      `;
      preview.appendChild(div);
    });

    document.getElementById('quran-share').style.display = 'block';
    showToast('Verses loaded ✔', '#16c24a');

    if (shareNow) {
      renderAndShareQuran(verses, surah, from, to);
      document.getElementById('quran-panel').style.display = 'none';
    }
  } catch (e) {
    showToast('Failed to load Quran', '#ff6b6b');
    console.error('[quran]', e);
  } finally {
    loadBtn.textContent = 'Load Verses';
    loadBtn.disabled = false;
  }
}

function renderAndShareQuran(verses, surah, from, to) {
  const W = 800, PAD = 40, LINE = 60;
  const offscreen = document.createElement('canvas');
  offscreen.width  = W;
  offscreen.height = verses.length * LINE * 2 + PAD * 2 + 60;
  const octx = offscreen.getContext('2d');

  // Cream background
  octx.fillStyle = '#fdf6e3';
  octx.fillRect(0, 0, offscreen.width, offscreen.height);

  // Header
  octx.fillStyle = '#2d5016';
  octx.font = 'bold 18px serif';
  octx.textAlign = 'center';
  octx.fillText(`سورة ${surah?.name || ''} — آيات ${from}–${to}`, W / 2, PAD);

  // Divider
  octx.strokeStyle = '#c8a96e';
  octx.lineWidth = 1;
  octx.beginPath();
  octx.moveTo(PAD, PAD + 14);
  octx.lineTo(W - PAD, PAD + 14);
  octx.stroke();

  let y = PAD + 40;
  octx.textAlign = 'right';
  octx.fillStyle = '#1a1a1a';

  verses.forEach(v => {
    // Wrap long text
    const words = v.text.split(' ');
    let line = '';
    const maxW = W - PAD * 2;
    octx.font = '32px serif';
    const lines = [];
    for (const word of words) {
      const test = line ? word + ' ' + line : word;
      if (octx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);

    lines.forEach(l => {
      octx.font = '32px serif';
      octx.fillStyle = '#1a1a1a';
      octx.fillText(l, W - PAD, y);
      y += LINE;
    });

    octx.font = '12px serif';
    octx.fillStyle = '#c8a96e';
    octx.textAlign = 'left';
    octx.fillText(`● ${v.numberInSurah}`, PAD, y - LINE + 20);
    octx.textAlign = 'right';

    y += 10;
  });

  const dataUrl = offscreen.toDataURL('image/png');
  bgImage.src = dataUrl;
  imageContainer.style.display = 'flex';
  placeholder.style.display = 'none';
  btnClear.style.display = 'block';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  setTimeout(() => resizeCanvas(), 50);
  socket.emit('share-material', { roomId, url: dataUrl });

  // Show quick-change bar
  currentQuranSurah = surah?.n || 1;
  showQuranBar(surah, from, to);
  showToast('📖 Quran shared', '#16c24a', 'rgba(22,194,74,0.12)', 'rgba(22,194,74,0.35)');
}

// ── Quick-change Quran bar (shown while Quran is active on canvas) ───────────────
function showQuranBar(surah, from, to) {
  let bar = document.getElementById('quran-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'quran-bar';
    bar.style.cssText = `
      position:absolute; bottom:105px; left:50%; transform:translateX(-50%);
      z-index:15; background:rgba(10,10,15,0.92); border:1px solid rgba(255,255,255,0.12);
      border-radius:20px; padding:6px 10px; display:flex; align-items:center;
      gap:8px; backdrop-filter:blur(12px); white-space:nowrap;
    `;
    document.getElementById('phone').appendChild(bar);
  }

  bar.innerHTML = `
    <span style="color:rgba(255,255,255,0.5);font-size:11px;">📖</span>
    <select id="qbar-surah" style="background:#1a1a2e;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;padding:4px 8px;font-size:12px;max-width:130px;">
      ${SURAHS.map(s => `<option value="${s.n}" ${s.n === surah?.n ? 'selected' : ''}>${s.n}. ${s.name}</option>`).join('')}
    </select>
    <input id="qbar-from" type="number" min="1" value="${from}" style="width:40px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;padding:4px 6px;font-size:12px;text-align:center;">
    <span style="color:rgba(255,255,255,0.3);font-size:11px;">-</span>
    <input id="qbar-to" type="number" min="1" value="${to}" style="width:40px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;padding:4px 6px;font-size:12px;text-align:center;">
    <button id="qbar-go" style="background:#4f46e5;border:none;border-radius:8px;color:#fff;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer;">Go</button>
    <button id="qbar-close" style="background:none;border:none;color:rgba(255,255,255,0.3);font-size:14px;cursor:pointer;padding:0 2px;">✕</button>
  `;
  bar.style.display = 'flex';

  // Update max when surah changes
  document.getElementById('qbar-surah').addEventListener('change', (e) => {
    const s = SURAHS.find(x => x.n == e.target.value);
    if (s) {
      document.getElementById('qbar-from').max = s.v;
      document.getElementById('qbar-to').max   = s.v;
      document.getElementById('qbar-to').value = Math.min(5, s.v);
    }
  });

  document.getElementById('qbar-go').addEventListener('click', async () => {
    const sn  = parseInt(document.getElementById('qbar-surah').value);
    const fr  = parseInt(document.getElementById('qbar-from').value);
    const t   = parseInt(document.getElementById('qbar-to').value);
    const s   = SURAHS.find(x => x.n === sn);
    if (!sn || isNaN(fr) || isNaN(t) || fr > t) { showToast('Invalid range', '#ff6b6b'); return; }
    const res  = await fetch(`https://api.alquran.cloud/v1/surah/${sn}/quran-uthmani`);
    const data = await res.json();
    if (data.code !== 200 || !data.data?.ayahs) { showToast('API error', '#ff6b6b'); return; }
    renderAndShareQuran(data.data.ayahs.slice(fr - 1, t), s, fr, t);
  });

  document.getElementById('qbar-close').addEventListener('click', () => {
    bar.style.display = 'none';
    currentQuranSurah = null;
  });
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('source-menu');
  if (menu && !menu.contains(e.target) && !blobFile.contains(e.target)) {
    menu.style.display = 'none';
  }
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


// ── Quran PDF Viewer (renders to main canvas like Qaida) ──────────────────
const QURAN_PDF_URL = '/assets/quran.pdf';

document.getElementById('src-quran-pdf').addEventListener('click', () => {
  document.getElementById('source-menu').style.display = 'none';
  openQuranPDF();
});

let pdfDoc = null;
let pdfCurrentPage = 1;

function openQuranPDF() {
  if (pdfDoc) {
    renderPDFPageToCanvas(pdfCurrentPage);
    return;
  }

  // Load PDF.js from CDN if not already loaded
  if (!window.pdfjsLib) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      loadPDF();
    };
    document.head.appendChild(script);
  } else {
    loadPDF();
  }
}

function loadPDF() {
  showToast('Loading Quran PDF...', '#6096ff');
  pdfjsLib.getDocument(QURAN_PDF_URL).promise.then(pdf => {
    pdfDoc = pdf;
    renderPDFPageToCanvas(pdfCurrentPage);
  }).catch(e => {
    showToast('Failed to load PDF', '#ff6b6b');
    console.error('[pdf]', e);
  });
}

function renderPDFPageToCanvas(num) {
  if (!pdfDoc) return;
  pdfCurrentPage = num;

  pdfDoc.getPage(num).then(page => {
    // Render at high quality
    const scale = 2.0;
    const viewport = page.getViewport({ scale });

    const offscreen = document.createElement('canvas');
    offscreen.width = viewport.width;
    offscreen.height = viewport.height;
    const octx = offscreen.getContext('2d');

    page.render({ canvasContext: octx, viewport }).promise.then(() => {
      const dataUrl = offscreen.toDataURL('image/png');
      bgImage.src = dataUrl;
      imageContainer.style.display = 'flex';
      placeholder.style.display = 'none';
      btnClear.style.display = 'block';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setTimeout(() => resizeCanvas(), 50);
      socket.emit('share-material', { roomId, url: dataUrl });
      showToast(`📄 Quran page ${num} shared`, '#16c24a', 'rgba(22,194,74,0.12)', 'rgba(22,194,74,0.35)');
      showQuranPDFBar(num);
    });
  });
}

function showQuranPDFBar(pageNum) {
  let bar = document.getElementById('quran-pdf-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'quran-pdf-bar';
    bar.style.cssText = `
      position:absolute; bottom:105px; left:50%; transform:translateX(-50%);
      z-index:15; background:rgba(10,10,15,0.92); border:1px solid rgba(255,255,255,0.12);
      border-radius:20px; padding:6px 12px; display:flex; align-items:center;
      gap:8px; backdrop-filter:blur(12px); white-space:nowrap;
    `;
    document.getElementById('phone').appendChild(bar);
  }
  bar.innerHTML = `
    <span style="color:rgba(255,255,255,0.5);font-size:11px;">📄</span>
    <button id="qpdf-bar-prev" style="background:rgba(255,255,255,0.1);border:none;border-radius:8px;color:#fff;padding:4px 10px;font-size:14px;cursor:pointer;">&#8592;</button>
    <input id="qpdf-bar-input" type="number" min="1" max="${pdfDoc.numPages}" value="${pageNum}" style="width:50px;background:#1a1a2e;border:1px solid rgba(255,255,255,0.2);border-radius:8px;color:#fff;padding:4px 6px;font-size:12px;text-align:center;">
    <span style="color:rgba(255,255,255,0.3);font-size:11px;">/ ${pdfDoc.numPages}</span>
    <button id="qpdf-bar-next" style="background:rgba(255,255,255,0.1);border:none;border-radius:8px;color:#fff;padding:4px 10px;font-size:14px;cursor:pointer;">&#8594;</button>
    <button id="qpdf-bar-close" style="background:none;border:none;color:rgba(255,255,255,0.3);font-size:14px;cursor:pointer;padding:0 2px;">✕</button>
  `;
  bar.style.display = 'flex';

  document.getElementById('qpdf-bar-prev').onclick = () => {
    if (pdfCurrentPage > 1) renderPDFPageToCanvas(pdfCurrentPage - 1);
  };
  document.getElementById('qpdf-bar-next').onclick = () => {
    if (pdfCurrentPage < pdfDoc.numPages) renderPDFPageToCanvas(pdfCurrentPage + 1);
  };
  document.getElementById('qpdf-bar-input').onchange = (e) => {
    const p = parseInt(e.target.value);
    if (p >= 1 && p <= pdfDoc.numPages) renderPDFPageToCanvas(p);
  };
  document.getElementById('qpdf-bar-close').onclick = () => {
    bar.style.display = 'none';
  };
}

console.log("[teacher] ready, room:", roomId);
