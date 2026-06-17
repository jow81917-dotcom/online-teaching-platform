const params = new URLSearchParams(window.location.search);
const roomId = params.get("room") || "test";
const moderatorName = params.get("name") || "Moderator";
const moderatorRole = params.get("role") || "supervisor";
const SERVER_URL = window.location.origin;
const socket = io(SERVER_URL, { transports: ["websocket", "polling"], upgrade: true, autoConnect: false });

const ICE_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
};

const el = {
  socketDot: document.getElementById("socketDot"),
  socketState: document.getElementById("socketState"),
  roomValue: document.getElementById("roomValue"),
  nameValue: document.getElementById("nameValue"),
  joinBtn: document.getElementById("joinBtn"),
  speakBtn: document.getElementById("speakBtn"),
  stopSpeakBtn: document.getElementById("stopSpeakBtn"),
  muteTeacherBtn: document.getElementById("muteTeacherBtn"),
  unmuteTeacherBtn: document.getElementById("unmuteTeacherBtn"),
  endBtn: document.getElementById("endBtn"),
  teacherStat: document.getElementById("teacherStat"),
  studentStat: document.getElementById("studentStat"),
  audioStat: document.getElementById("audioStat"),
  speakingStat: document.getElementById("speakingStat"),
  participantWrap: document.getElementById("participantWrap"),
  teacherAudioDot: document.getElementById("teacherAudioDot"),
  teacherAudioText: document.getElementById("teacherAudioText"),
  micMeter: document.getElementById("micMeter"),
  logList: document.getElementById("logList"),
  imageContainer: document.getElementById("image-container"),
  bgImage: document.getElementById("bg-image"),
  canvas: document.getElementById("draw-canvas"),
  placeholder: document.getElementById("placeholder")
};

el.roomValue.textContent = roomId;
el.nameValue.textContent = `${moderatorName} (${moderatorRole})`;

let participants = [];
let sessionData = null;
let audioStreams = null;
let localStream = null;
let audioContext = null;
let analyser = null;
let meterFrame = null;
let isSpeaking = false;
let inboundPeer = null;
let teacherAudio = null;
const outboundPeers = new Map();

// Canvas & drawing state
let ctx = null;
let currentDrawX = 0, currentDrawY = 0;
let lastReceivedColor = '#ffffff', lastReceivedWidth = 4;

function initCanvas() {
  if (el.canvas) {
    ctx = el.canvas.getContext('2d');
    window.addEventListener('resize', () => setTimeout(resizeCanvas, 100));
    window.addEventListener('load',   () => setTimeout(resizeCanvas, 100));
    setTimeout(resizeCanvas, 100);
  }
}

function resizeCanvas() {
  if (!el.canvas) return;
  const rect = el.canvas.getBoundingClientRect();
  if (el.canvas.width !== rect.width || el.canvas.height !== rect.height) {
    const saved = ctx.getImageData(0, 0, el.canvas.width, el.canvas.height);
    el.canvas.width = rect.width;
    el.canvas.height = rect.height;
    if (saved.width > 0 && saved.height > 0) {
      try { ctx.putImageData(saved, 0, 0); } catch(e) {}
    }
  }
}

function getMaterialRectOnCanvas() {
  const canvasRect = el.canvas.getBoundingClientRect();
  const imageRect = el.bgImage.getBoundingClientRect();
  const hasVisibleMaterial = el.imageContainer.style.display !== 'none' &&
    el.bgImage.complete &&
    el.bgImage.naturalWidth > 0 &&
    imageRect.width > 0 &&
    imageRect.height > 0;

  if (!hasVisibleMaterial || canvasRect.width === 0 || canvasRect.height === 0) {
    return { left: 0, top: 0, width: el.canvas.width, height: el.canvas.height };
  }

  const scaleX = el.canvas.width / canvasRect.width;
  const scaleY = el.canvas.height / canvasRect.height;

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

function showMaterial(url) {
  if (!el.bgImage) return;
  el.bgImage.src = url;
  el.bgImage.style.display = 'block';
  el.imageContainer.style.display = 'flex';
  el.placeholder.style.display = 'none';
  el.bgImage.onload = () => {
    resizeCanvas();
    ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
    ctx.beginPath();
  };
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;"
  }[char]));
}

function preferOpus(sdp) {
  const lines = sdp.split("\r\n");
  const opusLine = lines.find(line => /^a=rtpmap:\d+ opus\/48000/i.test(line));
  if (!opusLine) return sdp;
  const opusPayload = opusLine.match(/^a=rtpmap:(\d+)/)[1];
  return lines.map(line => {
    if (!line.startsWith("m=audio")) return line;
    const parts = line.split(" ");
    return [...parts.slice(0, 3), opusPayload, ...parts.slice(3).filter(p => p !== opusPayload)].join(" ");
  }).join("\r\n");
}

function setConnected(connected) {
  el.socketDot.classList.toggle("ok", connected);
  el.socketState.textContent = connected ? "Online" : "Offline";
  el.joinBtn.disabled = connected;
}

function renderParticipants() {
  const students = participants.filter(p => p.role === "student");
  const teacher = participants.find(p => p.role === "teacher");

  el.teacherStat.textContent = teacher ? "Online" : "Offline";
  el.studentStat.textContent = String(students.length);

  if (!participants.length) {
    el.participantWrap.className = "empty";
    el.participantWrap.textContent = "No teacher or students are connected.";
    return;
  }

  el.participantWrap.className = "";
  el.participantWrap.innerHTML = `
    <table>
      <thead>
        <tr><th>Name</th><th>Role</th><th>Status</th><th>Controls</th></tr>
      </thead>
      <tbody>
        ${participants.map(p => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td class="role">${escapeHtml(p.role)}</td>
            <td>
              <span class="status"><span class="dot ${p.online ? "ok" : ""}"></span>${p.muted ? "Muted" : "Live"}</span>
            </td>
            <td>
              <div class="row-actions">
                ${p.role === "student" ? `
                  <button data-action="mute_student" data-id="${escapeHtml(p.id)}">Mute</button>
                  <button data-action="unmute_student" data-id="${escapeHtml(p.id)}">Unmute</button>
                ` : `
                  <button data-action="mute_teacher">Mute</button>
                  <button data-action="unmute_teacher">Unmute</button>
                `}
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderAudio() {
  const teacherLive = !!audioStreams?.teacher?.live;
  el.teacherAudioDot.classList.toggle("ok", teacherLive);
  el.teacherAudioText.textContent = teacherLive ? "Live" : "Not live";
  el.audioStat.textContent = teacherLive || audioStreams?.activeSpeaker !== "teacher" ? "Live" : "Idle";
  el.speakingStat.textContent = isSpeaking ? "Yes" : "No";
  el.speakBtn.disabled = isSpeaking || !participants.length;
  el.stopSpeakBtn.disabled = !isSpeaking;
}

function renderLogs(logs) {
  if (!logs.length) {
    el.logList.className = "log-list empty";
    el.logList.textContent = "No moderation events yet.";
    return;
  }
  el.logList.className = "log-list";
  el.logList.innerHTML = logs.slice().reverse().map(log => `
    <div class="log">
      <b>${escapeHtml(log.action)}</b>
      <span>${escapeHtml(log.actor)} ${log.target ? `-> ${escapeHtml(log.target)}` : ""}</span>
      <span>${new Date(log.createdAt).toLocaleString()}</span>
    </div>
  `).join("");
}

function joinSession() {
  if (!socket.connected) socket.connect();
}

function closeInboundPeer() {
  if (inboundPeer) inboundPeer.pc.close();
  inboundPeer = null;
  if (teacherAudio) {
    teacherAudio.srcObject = null;
    teacherAudio.remove();
    teacherAudio = null;
  }
}

async function handleInboundOffer(fromId, sdp) {
  closeInboundPeer();
  const pc = new RTCPeerConnection(ICE_CONFIG);
  inboundPeer = { pc, iceBuf: [] };

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit("ice-candidate", { targetId: fromId, candidate, peerType: "outbound" });
  };
  pc.ontrack = ({ streams }) => {
    if (!teacherAudio) {
      teacherAudio = new Audio();
      teacherAudio.autoplay = true;
      teacherAudio.playsInline = true;
      document.body.appendChild(teacherAudio);
    }
    teacherAudio.srcObject = streams[0];
    teacherAudio.play().catch(() => {});
  };

  await pc.setRemoteDescription(new RTCSessionDescription(sdp));
  const answer = await pc.createAnswer();
  answer.sdp = preferOpus(answer.sdp);
  await pc.setLocalDescription(answer);
  socket.emit("webrtc-answer", { targetId: fromId, sdp: pc.localDescription });
}

function closeOutboundPeer(targetId) {
  const entry = outboundPeers.get(targetId);
  if (!entry) return;
  entry.pc.close();
  outboundPeers.delete(targetId);
}

async function createOutboundPeer(targetId) {
  if (!localStream) return;
  closeOutboundPeer(targetId);
  const pc = new RTCPeerConnection(ICE_CONFIG);
  const entry = { pc, iceBuf: [] };
  outboundPeers.set(targetId, entry);
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.onicecandidate = ({ candidate }) => {
    if (candidate) socket.emit("ice-candidate", { targetId, candidate, peerType: "inbound" });
  };

  const offer = await pc.createOffer();
  offer.sdp = preferOpus(offer.sdp);
  await pc.setLocalDescription(offer);
  socket.emit("webrtc-offer", { targetId, sdp: pc.localDescription });
}

function startMeter() {
  if (!localStream) return;
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  audioContext.createMediaStreamSource(localStream).connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  const tick = () => {
    analyser.getByteFrequencyData(data);
    const avg = data.reduce((sum, value) => sum + value, 0) / data.length;
    el.micMeter.style.width = `${Math.min(100, avg / 160 * 100)}%`;
    meterFrame = requestAnimationFrame(tick);
  };
  tick();
}

async function startSpeaking() {
  localStream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 }
  });
  isSpeaking = true;
  el.speakBtn.classList.add("active");
  socket.emit("start_speaking", { roomId });
  participants.forEach(p => createOutboundPeer(p.id).catch(console.error));
  startMeter();
  renderAudio();
}

function stopSpeaking() {
  outboundPeers.forEach((_, id) => closeOutboundPeer(id));
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  localStream = null;
  if (meterFrame) cancelAnimationFrame(meterFrame);
  if (audioContext) audioContext.close();
  meterFrame = null;
  audioContext = null;
  analyser = null;
  el.micMeter.style.width = "0%";
  isSpeaking = false;
  el.speakBtn.classList.remove("active");
  socket.emit("stop_speaking", { roomId });
  renderAudio();
}

socket.on("connect", () => {
  setConnected(true);
  socket.emit("join-as-moderator", roomId, moderatorName, moderatorRole);
});
socket.on("disconnect", () => {
  setConnected(false);
  stopSpeaking();
  closeInboundPeer();
});
socket.on("session_data", data => {
  sessionData = data;
  renderAudio();
  if (data.material && data.material.url) {
    if (el.bgImage.src !== data.material.url) {
      showMaterial(data.material.url);
    }
  } else {
    el.bgImage.removeAttribute('src');
    el.bgImage.style.display = "none";
    el.imageContainer.style.display = "none";
    el.placeholder.style.display = "block";
    if (ctx) ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
  }
});
socket.on("participant_list", list => {
  participants = list || [];
  renderParticipants();
  renderAudio();
});
socket.on("audio_streams", data => {
  audioStreams = data;
  renderAudio();
});
socket.on("moderation_logs", logs => renderLogs(logs || []));
socket.on("moderation_error", data => alert(data.message || "Moderator action failed"));
socket.on("webrtc-offer", ({ fromId, sdp }) => handleInboundOffer(fromId, sdp).catch(console.error));
socket.on("webrtc-answer", ({ fromId, sdp }) => {
  const entry = outboundPeers.get(fromId);
  if (!entry) return;
  entry.pc.setRemoteDescription(new RTCSessionDescription(sdp)).catch(console.error);
});
socket.on("ice-candidate", ({ fromId, candidate, peerType }) => {
  const entry = peerType === "outbound" ? outboundPeers.get(fromId) : inboundPeer;
  if (!entry || !candidate) return;
  entry.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
});

// Classroom material & draw sync
socket.on("material-shared", ({ url }) => showMaterial(url));

socket.on("draw-begin", ({ x, y, color, width }) => {
  if (!ctx) return;
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
  if (!ctx) return;
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

socket.on("draw-end", () => { if (ctx) ctx.beginPath(); });

socket.on("clear-canvas", () => {
  if (ctx) {
    ctx.clearRect(0, 0, el.canvas.width, el.canvas.height);
    ctx.beginPath();
  }
});

el.joinBtn.addEventListener("click", joinSession);
el.speakBtn.addEventListener("click", () => startSpeaking().catch(err => alert(err.message || "Could not start microphone")));
el.stopSpeakBtn.addEventListener("click", stopSpeaking);
el.muteTeacherBtn.addEventListener("click", () => socket.emit("mute_teacher", { roomId }));
el.unmuteTeacherBtn.addEventListener("click", () => socket.emit("unmute_teacher", { roomId }));
el.endBtn.addEventListener("click", () => {
  if (confirm("End this live session for everyone?")) socket.emit("end_session", { roomId });
});
el.participantWrap.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const action = button.dataset.action;
  const studentId = button.dataset.id;
  socket.emit(action, studentId ? { roomId, studentId } : { roomId });
});

renderParticipants();
renderAudio();
initCanvas();
joinSession();
