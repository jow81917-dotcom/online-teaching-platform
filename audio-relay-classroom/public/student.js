// =============================================================================
// STUDENT — WebRTC Audio Classroom with Fixed Drawing Sync
// =============================================================================

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get("room") || "test";
let studentName = urlParams.get("name") || "Student-" + Math.random().toString(36).substr(2, 6);

const SERVER_URL = window.location.origin;
const socket = io(SERVER_URL, { transports: ["websocket", "polling"], upgrade: true });

// ── DOM refs (DrawCall style) ──────────────────────────────────────────────
const imageContainer = document.getElementById('image-container');
const bgImage        = document.getElementById('bg-image');
const canvas         = document.getElementById('draw-canvas');
const ctx            = canvas.getContext('2d');
const placeholder    = document.getElementById('placeholder');
const btnHand        = document.getElementById('btn-hand');
const btnCall        = document.getElementById('btn-call');
const pillAudio      = document.getElementById('pill-audio');
const pillSpeaking   = document.getElementById('pill-speaking');
const toast          = document.getElementById('toast');
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

// ── Canvas resize for drawing sync ────────────────────────────────────────
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

// FIXED: Drawing State for Student with proper coordinate scaling
let currentDrawX = 0;
let currentDrawY = 0;
let lastReceivedColor = '#ffffff';
let lastReceivedWidth = 4;

// Helper function to scale coordinates from teacher canvas to student canvas
function scaleCoordinates(x, y) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: x * scaleX,
    y: y * scaleY
  };
}

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

// ── Socket ────────────────────────────────────────────────────────────────
socket.on("connect", () => {
  myId = socket.id;
  console.log("[student] socket connected:", socket.id);
  socket.emit("join-as-student", roomId, studentName);
  showToast("Connected to server", "rgba(52,199,89,0.2)", "#34c759");
});

socket.on("disconnect", () => {
  console.log("[student] disconnected");
  updateTeacherStatus(false);
  updateCallState(false);
  closeInboundPeer();
  closeOutboundPeer();
  showToast("Disconnected from server", "rgba(255,69,58,0.2)", "#ff453a");
});

socket.on("student-joined", ({ hasTeacher, activeSpeaker, material }) => {
  console.log("[student] joined room. hasTeacher:", hasTeacher);
  updateTeacherStatus(hasTeacher);
  updateActiveSpeakerUI(activeSpeaker);
  if (material) showMaterial(material.url || material);
});

socket.on("teacher-arrived", () => {
  console.log("[student] teacher has arrived");
  updateTeacherStatus(true);
  showToast("Teacher is online", "rgba(52,199,89,0.2)", "#34c759");
});

socket.on("teacher-left", () => {
  console.log("[student] teacher left");
  updateTeacherStatus(false);
  updateCallState(false);
  closeInboundPeer();
  closeOutboundPeer();
  showToast("Teacher left the session", "rgba(255,69,58,0.2)", "#ff453a");
});

socket.on("session-ended", () => {
  console.log("[student] session ended by schedule");
  closeInboundPeer();
  closeOutboundPeer();
  updateCallState(false);
  showToast("⏰ Session time is up", "rgba(255,204,0,0.8)", "#ffcc00");
  setTimeout(() => { window.location.href = '/dashboard'; }, 3000);
});

// ── WebRTC signaling ──────────────────────────────────────────────────────
socket.on("webrtc-offer", async ({ fromId, sdp }) => {
  console.log("[student] received webrtc-offer from teacher:", fromId.substr(0,6));
  teacherId = fromId;
  await createInboundPeer(fromId, sdp);
});

socket.on("webrtc-answer-student", ({ sdp }) => {
  if (!outboundPeer) return;
  console.log("[outbound] received answer from teacher");
  outboundPeer.pc.setRemoteDescription(new RTCSessionDescription(sdp))
    .then(() => {
      console.log("[outbound] remote desc set, flushing", outboundPeer.iceBuf.length, "buffered candidates");
      flushIceBuf(outboundPeer, "outbound");
    })
    .catch(e => console.error("[outbound] setRemoteDescription:", e));
});

socket.on("ice-candidate", ({ candidate, peerType }) => {
  const peer = peerType === "outbound" ? outboundPeer : inboundPeer;
  if (!peer || !candidate) return;

  const label = peerType === "outbound" ? "outbound" : "inbound";
  const pc = peer.pc;
  if (pc.remoteDescription && pc.remoteDescription.type) {
    pc.addIceCandidate(new RTCIceCandidate(candidate))
      .catch(e => console.warn(`[ice:${label}] addIceCandidate:`, e));
  } else {
    console.log(`[ice:${label}] buffering candidate (no remote desc yet)`);
    peer.iceBuf.push(candidate);
  }
});

// ── Inbound peer: receive teacher audio ───────────────────────────────────
async function createInboundPeer(fromId, offerSdp) {
  closeInboundPeer();
  console.log("[inbound] creating peer to receive teacher audio");

  const pc = new RTCPeerConnection(ICE_CONFIG);
  inboundPeer = { pc, iceBuf: [], restartTimer: null };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      logCandidate("inbound", candidate);
      socket.emit("ice-candidate", { targetId: fromId, candidate, peerType: "outbound" });
    } else {
      console.log("[inbound] ICE gathering complete");
    }
  };

  pc.onicegatheringstatechange = () => {
    console.log("[inbound] gathering:", pc.iceGatheringState);
  };

  pc.oniceconnectionstatechange = () => {
    console.log("[inbound] ICE:", pc.iceConnectionState);
  };

  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    console.log("[inbound] conn:", s);

    if (inboundPeer && inboundPeer.restartTimer) {
      clearTimeout(inboundPeer.restartTimer);
      inboundPeer.restartTimer = null;
    }

    if (s === "connected") {
      console.log("%c[inbound] ✅ CONNECTED — audio should be flowing", "color:green;font-weight:bold");
      updateCallState(true);
      if (teacherAudio && audioUnlocked) {
        teacherAudio.play().catch(e => console.warn("[inbound] play() on connected:", e));
      }
    }

    if (s === "failed") {
      console.warn("[inbound] ❌ FAILED — restarting ICE");
      updateCallState(false);
      pc.restartIce();
    }

    if (s === "disconnected") {
      console.warn("[inbound] disconnected — will restart in 4s if not recovered");
      updateCallState(false);
      inboundPeer.restartTimer = setTimeout(() => {
        if (pc.connectionState !== "connected" && pc.connectionState !== "closed") {
          console.warn("[inbound] still disconnected, forcing ICE restart");
          pc.restartIce();
        }
      }, 4000);
    }
  };

  pc.ontrack = ({ streams }) => {
    console.log("[inbound] track received, streams:", streams.length);
    if (!teacherAudio) {
      teacherAudio = new Audio();
      teacherAudio.autoplay = true;
      teacherAudio.playsInline = true;
      teacherAudio.muted = false;
      document.body.appendChild(teacherAudio);
    }
    teacherAudio.srcObject = streams[0];
    if (audioUnlocked) {
      teacherAudio.play()
        .then(() => { console.log("[inbound] play() succeeded"); updateCallState(true); })
        .catch(e => console.warn("[inbound] play() failed:", e.name));
    } else {
      console.log("[inbound] track ready, waiting for user gesture to play");
    }
  };

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
    console.log("[inbound] remote desc set, flushing", inboundPeer.iceBuf.length, "buffered candidates");
    flushIceBuf(inboundPeer, "inbound");
    const answer = await pc.createAnswer();
    answer.sdp = preferOpus(answer.sdp);
    await pc.setLocalDescription(answer);
    socket.emit("webrtc-answer", { targetId: fromId, sdp: pc.localDescription });
    console.log("[inbound] answer sent");
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
  if (teacherAudio) {
    teacherAudio.srcObject = null;
    teacherAudio.remove();
    teacherAudio = null;
  }
  updateCallState(false);
}

// ── Outbound peer: send mic to teacher when approved ──────────────────────
async function createOutboundPeer(toTeacherId) {
  closeOutboundPeer();
  console.log("[outbound] creating peer to send mic to teacher");

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
    console.log("[outbound] mic acquired");
  } catch (e) {
    console.error("[outbound] getUserMedia:", e);
    showToast("Microphone access denied", "rgba(229,32,46,0.2)", "#ff453a");
    return;
  }

  const pc = new RTCPeerConnection(ICE_CONFIG);
  outboundPeer = { pc, iceBuf: [] };
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) {
      logCandidate("outbound", candidate);
      socket.emit("ice-candidate", { targetId: toTeacherId, candidate, peerType: "inbound" });
    } else {
      console.log("[outbound] ICE gathering complete");
    }
  };

  pc.onicegatheringstatechange = () => {
    console.log("[outbound] gathering:", pc.iceGatheringState);
  };

  pc.oniceconnectionstatechange = () => {
    console.log("[outbound] ICE:", pc.iceConnectionState);
  };

  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    console.log("[outbound] conn:", s);
    if (s === "connected") {
      console.log("%c[outbound] ✅ CONNECTED — mic flowing to teacher", "color:green;font-weight:bold");
      pillSpeaking.classList.add('show');
    }
    if (s === "failed") { 
      console.warn("[outbound] ❌ FAILED — restarting ICE"); 
      pc.restartIce();
      pillSpeaking.classList.remove('show');
    }
    if (s === "closed" || s === "disconnected") {
      pillSpeaking.classList.remove('show');
    }
  };

  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.emit("webrtc-offer-student", { targetId: toTeacherId, sdp: pc.localDescription });
    console.log("[outbound] offer sent to teacher");
  } catch (e) {
    console.error("[outbound] createOffer:", e);
  }
}

function closeOutboundPeer() {
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
  if (active && audioEnabled) {
    btnCall.classList.add('in-call');
    btnCall.classList.add('audio-on');
    btnCall.innerHTML = '🎙️';
    pillAudio.classList.add('show');
  } else if (active && !audioEnabled) {
    btnCall.classList.add('in-call');
    btnCall.classList.remove('audio-on');
    btnCall.innerHTML = '🔇';
    pillAudio.classList.remove('show');
  } else if (!active) {
    btnCall.classList.remove('in-call');
    btnCall.classList.remove('audio-on');
    btnCall.innerHTML = '🔇';
    pillAudio.classList.remove('show');
  }
}

function updateAudioEnabledState(enabled) {
  audioEnabled = enabled;
  if (enabled && isInCall) {
    btnCall.classList.add('in-call');
    btnCall.classList.add('audio-on');
    btnCall.innerHTML = '🎙️';
    pillAudio.classList.add('show');
  } else if (!enabled && isInCall) {
    btnCall.classList.add('in-call');
    btnCall.classList.remove('audio-on');
    btnCall.innerHTML = '🔇';
    pillAudio.classList.remove('show');
  } else if (!enabled && !isInCall) {
    btnCall.classList.remove('in-call');
    btnCall.classList.remove('audio-on');
    btnCall.innerHTML = '🔇';
    pillAudio.classList.remove('show');
  }
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
  if (speakerId === "teacher") {
    speakerDisplay.innerHTML = '👨🏫 Teacher speaking';
  } else if (speakerId === myId) {
    speakerDisplay.innerHTML = '🎤 You are speaking';
  } else {
    speakerDisplay.innerHTML = '👨🎓 Student speaking';
  }
}

// ── Audio Unlock (Browser Autoplay Policy) ────────────────────────────────
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  audioUnlockOverlay.classList.add('hidden');
  console.log("[audio] unlocked by user gesture");
  
  if (teacherAudio && teacherAudio.srcObject) {
    teacherAudio.muted = false;
    teacherAudio.play()
      .then(() => { 
        console.log("[audio] play() succeeded after unlock"); 
        updateCallState(true);
        updateAudioEnabledState(true);
      })
      .catch(e => console.warn("[audio] play() after unlock:", e));
  }
  
  showToast("Audio enabled! You can now hear the teacher", "rgba(52,199,89,0.2)", "#34c759");
}

unlockAudioBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  unlockAudio();
});

document.addEventListener('click', () => {
  if (!audioUnlocked) unlockAudio();
}, { once: true });

// ── Raise Hand / Cancel Hand ──────────────────────────────────────────────
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

// ── Call/Audio Button ─────────────────────────────────────────────────────
btnCall.addEventListener('click', async () => {
  if (!audioUnlocked) {
    unlockAudio();
    return;
  }
  
  if (isInCall && audioEnabled) {
    if (teacherAudio) {
      teacherAudio.muted = true;
    }
    audioEnabled = false;
    updateAudioEnabledState(false);
    showToast("Audio muted", "rgba(255,255,255,0.2)", "#fff");
  } else if (isInCall && !audioEnabled) {
    if (teacherAudio) {
      teacherAudio.muted = false;
      teacherAudio.play().catch(e => console.warn);
    }
    audioEnabled = true;
    updateAudioEnabledState(true);
    showToast("Audio enabled", "rgba(52,199,89,0.2)", "#34c759");
  } else if (!isInCall) {
    showToast("Waiting for teacher to start broadcast...", "rgba(255,204,0,0.2)", "#ffcc00");
  }
});

// ── Socket Events for Hand/Speaker ────────────────────────────────────────
socket.on("speak-approved", ({ teacherSocketId }) => {
  console.log("[student] speak approved, teacher:", teacherSocketId);
  canSpeak = true;
  handRaised = false;
  teacherId = teacherSocketId;
  updateHandButtonState();
  createOutboundPeer(teacherSocketId);
  showToast("You are now speaking! 🎤", "rgba(22,194,74,0.2)", "#16c24a");
});

socket.on("speak-revoked", () => {
  console.log("[student] speak revoked");
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

socket.on("speaker-changed", ({ speakerId, speakerName, isTeacher }) => {
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

// ── Material & Drawing Sync (FIXED - Proper Y-axis scaling) ─────────────
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

// FIXED: Drawing events from teacher with proper coordinate scaling
socket.on("draw-begin", ({ x, y, color, width }) => {
  // Scale coordinates to match student's canvas size
  const scaled = scaleCoordinates(x, y);
  
  // Start a new path - prevents connecting to previous strokes
  ctx.beginPath();
  
  // Set drawing styles
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  
  // Move to starting position
  ctx.moveTo(scaled.x, scaled.y);
  
  // Store current position for draw events
  currentDrawX = scaled.x;
  currentDrawY = scaled.y;
  lastReceivedColor = color;
  lastReceivedWidth = width;
  
  // Draw starting dot
  ctx.beginPath();
  ctx.arc(scaled.x, scaled.y, width / 2, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(scaled.x, scaled.y);
});

socket.on("draw", ({ x, y, color, width }) => {
  // Scale coordinates to match student's canvas size
  const scaled = scaleCoordinates(x, y);
  
  // Use provided color/width or fall back to last received
  const useColor = color || lastReceivedColor;
  const useWidth = width || lastReceivedWidth;
  
  ctx.lineWidth = useWidth;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = useColor;
  
  // Draw line from last position to new position
  ctx.beginPath();
  ctx.moveTo(currentDrawX, currentDrawY);
  ctx.lineTo(scaled.x, scaled.y);
  ctx.stroke();
  
  // Update current position
  currentDrawX = scaled.x;
  currentDrawY = scaled.y;
  lastReceivedColor = useColor;
  lastReceivedWidth = useWidth;
});

socket.on("draw-end", () => {
  // End the current path - next draw-begin will start a fresh path
  ctx.beginPath();
});

socket.on("clear-canvas", () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
});

// ── Window resize handling ────────────────────────────────────────────────
window.addEventListener('resize', () => setTimeout(resizeCanvas, 100));
window.addEventListener('load', () => setTimeout(resizeCanvas, 100));

resizeCanvas();

console.log("[student] ready, room:", roomId);