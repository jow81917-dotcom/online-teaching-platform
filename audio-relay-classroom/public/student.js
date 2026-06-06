// =============================================================================
// STUDENT — WebRTC Audio Classroom
// =============================================================================

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("room") || "test";
let studentName = urlParams.get("name") || "Student-" + Math.random().toString(36).substr(2, 6);

const SERVER_URL = window.location.origin;
const socket = io(SERVER_URL, { transports: ["websocket", "polling"], upgrade: true });

// ── DOM refs ──────────────────────────────────────────────────────────────
const imageContainer     = document.getElementById('image-container');
const bgImage            = document.getElementById('bg-image');
const canvas             = document.getElementById('draw-canvas');
const ctx                = canvas.getContext('2d');
const placeholder        = document.getElementById('placeholder');
const btnHand            = document.getElementById('btn-hand');
const pillAudio          = document.getElementById('pill-audio');
const pillSpeaking       = document.getElementById('pill-speaking');
const toast              = document.getElementById('toast');
const audioUnlockOverlay = document.getElementById('audio-unlock-overlay');
const unlockAudioBtn     = document.getElementById('unlockAudioBtn');
const teacherDot         = document.getElementById('teacherDot');
const teacherStatusText  = document.getElementById('teacherStatusText');
const speakerDisplay     = document.getElementById('speakerDisplay');
const roomDisplaySpan    = document.getElementById('roomDisplay');

roomDisplaySpan.textContent = `Room: ${roomId}`;

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

// ── Helpers ───────────────────────────────────────────────────────────────
function logCandidate(label, c) {
  if (!c) return;
  const type = c.type || "?", proto = c.protocol || "?";
  const addr = c.address || c.ip || "?", port = c.port || "?";
  console.log(`[ICE][${label}] ${type} ${proto} ${addr}:${port}`);
  if (type === "relay") console.log(`%c[ICE][${label}] ✅ TURN relay`, "color:green;font-weight:bold");
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

function flushIceBuf(peer, label) {
  while (peer.iceBuf.length) {
    const c = peer.iceBuf.shift();
    peer.pc.addIceCandidate(new RTCIceCandidate(c))
      .catch(e => console.warn(`[ice:${label}] flush:`, e));
  }
}

function showToast(msg, bgColor, textColor) {
  toast.textContent = msg;
  toast.style.background = bgColor || 'rgba(0,0,0,0.8)';
  toast.style.color = textColor || '#fff';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

// ── Canvas ────────────────────────────────────────────────────────────────
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

function materialPointToCanvas(x, y, width) {
  const materialRect = getMaterialRectOnCanvas();
  return {
    x: materialRect.left + x * materialRect.width,
    y: materialRect.top + y * materialRect.height,
    width: width * materialRect.width
  };
}

// Drawing state
let currentDrawX = 0, currentDrawY = 0;
let lastReceivedColor = '#ffffff', lastReceivedWidth = 4;

// ── State ─────────────────────────────────────────────────────────────────
let inboundPeer  = null;
let outboundPeer = null;
let teacherAudio = null;
let localStream  = null;

let myId          = null;
let teacherId     = null;
let handRaised    = false;
let canSpeak      = false;
let audioEnabled  = false;
let isInCall      = false;
let audioUnlocked = false;
let micRequestInProgress = false;

// ── Socket ────────────────────────────────────────────────────────────────
socket.on("connect", () => {
  myId = socket.id;
  console.log("[student] connected:", socket.id);
  socket.emit("join-as-student", roomId, studentName);
  showToast("Connected to server", "rgba(52,199,89,0.2)", "#34c759");
});

socket.on("disconnect", () => {
  updateTeacherStatus(false);
  updateCallState(false);
  closeInboundPeer();
  closeOutboundPeer();
  showToast("Disconnected from server", "rgba(255,69,58,0.2)", "#ff453a");
});

socket.on("student-joined", ({ hasTeacher, activeSpeaker, material }) => {
  updateTeacherStatus(hasTeacher);
  updateActiveSpeakerUI(activeSpeaker);
  if (material) showMaterial(material.url || material);
});

socket.on("teacher-arrived", () => {
  updateTeacherStatus(true);
  showToast("Teacher is online", "rgba(52,199,89,0.2)", "#34c759");
});

socket.on("teacher-left", () => {
  updateTeacherStatus(false);
  updateCallState(false);
  closeInboundPeer();
  closeOutboundPeer();
  showToast("Teacher left the session", "rgba(255,69,58,0.2)", "#ff453a");
});

socket.on("session-ended", () => {
  closeInboundPeer();
  closeOutboundPeer();
  updateCallState(false);
  showToast("⏰ Session time is up", "rgba(255,204,0,0.8)", "#ffcc00");
  setTimeout(() => { window.location.href = 'https://darutehsinquran.center/dashboard?room=' + roomId; }, 3000);
});

// ── WebRTC signaling ──────────────────────────────────────────────────────
socket.on("webrtc-offer", async ({ fromId, sdp }) => {
  teacherId = fromId;
  await createInboundPeer(fromId, sdp);
});

socket.on("webrtc-answer-student", ({ sdp }) => {
  if (!outboundPeer) return;
  outboundPeer.pc.setRemoteDescription(new RTCSessionDescription(sdp))
    .then(() => flushIceBuf(outboundPeer, "outbound"))
    .catch(e => console.error("[outbound] setRemoteDescription:", e));
});

socket.on("ice-candidate", ({ candidate, peerType }) => {
  const peer = peerType === "outbound" ? outboundPeer : inboundPeer;
  if (!peer || !candidate) return;
  const pc = peer.pc;
  if (pc.remoteDescription && pc.remoteDescription.type) {
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
  } else {
    peer.iceBuf.push(candidate);
  }
});

// ── Inbound peer: receive teacher audio ───────────────────────────────────
async function createInboundPeer(fromId, offerSdp) {
  closeInboundPeer();
  const pc = new RTCPeerConnection(ICE_CONFIG);
  inboundPeer = { pc, iceBuf: [], restartTimer: null };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      logCandidate("inbound", candidate);
      socket.emit("ice-candidate", { targetId: fromId, candidate, peerType: "outbound" });
    }
  };

  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    console.log("[inbound] conn:", s);
    if (inboundPeer?.restartTimer) { clearTimeout(inboundPeer.restartTimer); inboundPeer.restartTimer = null; }
    if (s === "connected") {
      updateCallState(true);
      if (teacherAudio && audioUnlocked) teacherAudio.play().catch(() => {});
    }
    if (s === "failed") { updateCallState(false); pc.restartIce(); }
    if (s === "disconnected") {
      updateCallState(false);
      inboundPeer.restartTimer = setTimeout(() => {
        if (pc.connectionState !== "connected" && pc.connectionState !== "closed") pc.restartIce();
      }, 4000);
    }
  };

  pc.ontrack = ({ streams }) => {
    if (!teacherAudio) {
      teacherAudio = new Audio();
      teacherAudio.autoplay = true;
      teacherAudio.playsInline = true;
      teacherAudio.muted = false;
      document.body.appendChild(teacherAudio);
    }
    teacherAudio.srcObject = streams[0];
    teacherAudio.play()
      .then(() => {
        audioEnabled = true;
        audioUnlocked = true;
        updateCallState(true);
        updateAudioEnabledState(true);
        audioUnlockOverlay.classList.add('hidden');
      })
      .catch(e => console.warn("[inbound] play() blocked:", e.name));
  };

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    flushIceBuf(inboundPeer, "inbound");
    const answer = await pc.createAnswer();
    answer.sdp = preferOpus(answer.sdp);
    await pc.setLocalDescription(answer);
    socket.emit("webrtc-answer", { targetId: fromId, sdp: pc.localDescription });
  } catch (e) {
    console.error("[inbound] answer failed:", e);
  }
}

function closeInboundPeer() {
  if (inboundPeer) {
    if (inboundPeer.restartTimer) clearTimeout(inboundPeer.restartTimer);
    inboundPeer.pc.close();
    inboundPeer = null;
  }
  if (teacherAudio) { teacherAudio.srcObject = null; teacherAudio.remove(); teacherAudio = null; }
  updateCallState(false);
}

// ── Outbound peer: send mic to teacher when approved ──────────────────────
async function createOutboundPeer(toTeacherId) {
  if (micRequestInProgress) return false;
  closeOutboundPeer();
  micRequestInProgress = true;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1, sampleRate: 48000 }
    });
  } catch (e) {
    micRequestInProgress = false;
    socket.emit("student-mic-failed", { roomId, reason: e?.name || "permission denied" });
    showToast("Microphone access denied", "rgba(229,32,46,0.2)", "#ff453a");
    return false;
  }

  const pc = new RTCPeerConnection(ICE_CONFIG);
  outboundPeer = { pc, iceBuf: [] };
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      logCandidate("outbound", candidate);
      socket.emit("ice-candidate", { targetId: toTeacherId, candidate, peerType: "inbound" });
    }
  };

  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    if (s === "connected") pillSpeaking.classList.add('show');
    if (s === "failed") { pc.restartIce(); pillSpeaking.classList.remove('show'); }
    if (s === "closed" || s === "disconnected") pillSpeaking.classList.remove('show');
  };

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc-offer-student", { targetId: toTeacherId, sdp: pc.localDescription });
    micRequestInProgress = false;
    return true;
  } catch (e) {
    micRequestInProgress = false;
    socket.emit("student-mic-failed", { roomId, reason: e?.name || "offer failed" });
    closeOutboundPeer();
    console.error("[outbound] createOffer:", e);
    return false;
  }
}

function closeOutboundPeer() {
  micRequestInProgress = false;
  if (localStream)  { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (outboundPeer) { outboundPeer.pc.close(); outboundPeer = null; }
  pillSpeaking.classList.remove('show');
}

// ── UI Update Functions ───────────────────────────────────────────────────
function updateTeacherStatus(online) {
  if (online) {
    teacherDot.classList.add('online');
    teacherStatusText.textContent = 'Teacher Online';
  } else {
    teacherDot.classList.remove('online');
    teacherStatusText.textContent = 'Teacher Offline';
  }
}

function updateCallState(active) {
  isInCall = active;
  pillAudio.classList.toggle('show', active && audioEnabled);
}

function updateAudioEnabledState(enabled) {
  audioEnabled = enabled;
  pillAudio.classList.toggle('show', enabled && isInCall);
}

function updateHandButtonState() {
  if (canSpeak) {
    btnHand.classList.add('speaking');
    btnHand.classList.remove('raised');
    btnHand.innerHTML = '🎤';
  } else if (handRaised) {
    btnHand.classList.add('raised');
    btnHand.classList.remove('speaking');
    btnHand.innerHTML = '✋';
  } else {
    btnHand.classList.remove('raised', 'speaking');
    btnHand.innerHTML = '✋';
  }
}

function updateActiveSpeakerUI(speakerId) {
  if (speakerId === "teacher") speakerDisplay.innerHTML = '👨🏫 Teacher speaking';
  else if (speakerId === myId) speakerDisplay.innerHTML = '🎤 You are speaking';
  else speakerDisplay.innerHTML = '👨🎓 Student speaking';
}

// ── Audio Unlock ──────────────────────────────────────────────────────────
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  audioEnabled  = true;
  audioUnlockOverlay.classList.add('hidden');
  if (teacherAudio) {
    teacherAudio.muted = false;
    teacherAudio.play()
      .then(() => { updateCallState(true); updateAudioEnabledState(true); })
      .catch(e => console.warn("[audio] play() after unlock:", e));
  }
  showToast("Audio enabled!", "rgba(52,199,89,0.2)", "#34c759");
}

unlockAudioBtn.addEventListener('click', (e) => { e.stopPropagation(); unlockAudio(); });
document.addEventListener('click', () => { if (!audioUnlocked) unlockAudio(); }, { once: true });

// ── Leave button ──────────────────────────────────────────────────────────
document.getElementById('btn-leave').addEventListener('click', () => {
  if (confirm('Leave this session?')) {
    closeInboundPeer();
    closeOutboundPeer();
    sessionStorage.removeItem('classroom_room');
    sessionStorage.removeItem('classroom_name');
    window.location.href = '/dashboard';
  }
});

sessionStorage.setItem('classroom_room', roomId);
sessionStorage.setItem('classroom_name', studentName);

// ── Raise Hand ────────────────────────────────────────────────────────────
btnHand.addEventListener('click', () => {
  if (canSpeak) {
    showToast("You are already speaking", "rgba(255,204,0,0.2)", "#ffcc00");
    return;
  }
  if (handRaised) {
    socket.emit("cancel-hand", roomId);
    handRaised = false;
    updateHandButtonState();
    showToast("Hand request cancelled", "rgba(255,255,255,0.2)", "#fff");
  } else {
    socket.emit("raise-hand", roomId);
    handRaised = true;
    updateHandButtonState();
    showToast("Hand raised! Waiting for teacher...", "rgba(255,204,0,0.2)", "#ffcc00");
  }
});

// ── Socket Events for Hand/Speaker ────────────────────────────────────────
socket.on("speak-approved", async ({ teacherSocketId }) => {
  handRaised = false;
  teacherId = teacherSocketId;
  btnHand.classList.remove("raised");
  showToast("Teacher requested your mic. Allow browser permission to speak.", "rgba(22,194,74,0.2)", "#16c24a");
  const started = await createOutboundPeer(teacherSocketId);
  canSpeak = started;
  updateHandButtonState();
  if (started) {
    pillSpeaking.classList.add("show");
    showToast("🎙️ Your mic is now open!", "rgba(22,194,74,0.2)", "#16c24a");
  }
});

socket.on("speak-revoked", () => {
  canSpeak = false;
  handRaised = false;
  updateHandButtonState();
  closeOutboundPeer();
  showToast("You are no longer speaking", "rgba(255,69,58,0.2)", "#ff453a");
});

socket.on("hand-rejected", () => {
  handRaised = false;
  updateHandButtonState();
  showToast("Your request to speak was declined", "rgba(255,69,58,0.2)", "#ff453a");
});

socket.on("speaker-changed", ({ speakerId }) => {
  updateActiveSpeakerUI(speakerId);
  if (speakerId !== myId && canSpeak) {
    canSpeak = false;
    handRaised = false;
    updateHandButtonState();
    closeOutboundPeer();
  }
  if (speakerId === myId && !canSpeak) {
    canSpeak = true;
    updateHandButtonState();
  }
});

// ── Material & Drawing Sync ───────────────────────────────────────────────
socket.on("material-shared", ({ url }) => showMaterial(url));

function showMaterial(url) {
  bgImage.src = url;
  bgImage.style.display = 'block';
  imageContainer.style.display = 'flex';
  placeholder.style.display = 'none';
  bgImage.onload = () => {
    resizeCanvas();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
  };
}

socket.on("draw-begin", ({ x, y, color, width }) => {
  const point = materialPointToCanvas(x, y, width);
  const px = point.x;
  const py = point.y;
  const pw = point.width;
  ctx.beginPath();
  ctx.arc(px, py, pw / 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(px, py);
  currentDrawX = px;
  currentDrawY = py;
  lastReceivedColor = color;
  lastReceivedWidth = pw;
});

socket.on("draw", ({ x, y, color, width }) => {
  const point = materialPointToCanvas(x, y, width);
  const px = point.x;
  const py = point.y;
  const pw = point.width || lastReceivedWidth;
  const useColor = color || lastReceivedColor;
  ctx.beginPath();
  ctx.moveTo(currentDrawX, currentDrawY);
  ctx.lineTo(px, py);
  ctx.strokeStyle = useColor;
  ctx.lineWidth = pw;
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.stroke();
  currentDrawX = px;
  currentDrawY = py;
  lastReceivedColor = useColor;
  lastReceivedWidth = pw;
});

socket.on("draw-end", () => { ctx.beginPath(); });

socket.on("clear-canvas", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
});

// ── Window resize ─────────────────────────────────────────────────────────
window.addEventListener('resize', () => setTimeout(resizeCanvas, 100));
window.addEventListener('load',   () => setTimeout(resizeCanvas, 100));
resizeCanvas();

console.log("[student] ready, room:", roomId);
