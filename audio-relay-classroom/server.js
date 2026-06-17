const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs-extra");
const multer = require("multer");

const app = express();
app.set("trust proxy", 1);
const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["websocket", "polling"],
  allowUpgrades: true
});

const uploadsDir = path.join(__dirname, "uploads");
const publicUploadsDir = path.join(__dirname, "public", "uploads");
fs.ensureDirSync(uploadsDir);
fs.ensureDirSync(publicUploadsDir);

// Clean up any leftover uploads from previous server runs
fs.emptyDir(publicUploadsDir).catch(() => {});
fs.emptyDir(uploadsDir).catch(() => {});
console.log('[upload] cleaned up leftover uploads on startup');

function loadBackendEnvValue(key) {
  if (process.env[key]) return process.env[key];
  try {
    const envPath = path.join(__dirname, "..", "backend", ".env");
    const envText = fs.readFileSync(envPath, "utf8");
    const line = envText.split(/\r?\n/).find((entry) => entry.trim().startsWith(`${key}=`));
    return line ? line.slice(line.indexOf("=") + 1).trim() : "";
  } catch (e) {
    return "";
  }
}

let dbPool = null;
let dbReady = false;
async function getDbPool() {
  if (dbPool) return dbPool;
  const connectionString = loadBackendEnvValue("DATABASE_URL");
  if (!connectionString) return null;
  try {
    let pg;
    try {
      pg = require("pg");
    } catch (e) {
      pg = require(path.join(__dirname, "..", "backend", "node_modules", "pg"));
    }
    dbPool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });
    return dbPool;
  } catch (e) {
    console.warn("[audit-db] PostgreSQL logging unavailable:", e.message);
    return null;
  }
}

async function ensureModerationLogTable(pool) {
  if (dbReady || !pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS session_moderation_logs (
      id VARCHAR(64) PRIMARY KEY,
      room_id VARCHAR(255) NOT NULL,
      action VARCHAR(120) NOT NULL,
      actor VARCHAR(255),
      target VARCHAR(255),
      details JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS idx_session_moderation_logs_room ON session_moderation_logs(room_id, created_at DESC)");
  dbReady = true;
}

async function persistModerationLog(entry) {
  const pool = await getDbPool();
  if (!pool) return;
  await ensureModerationLogTable(pool);
  await pool.query(
    `INSERT INTO session_moderation_logs (id, room_id, action, actor, target, details, created_at)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT (id) DO NOTHING`,
    [entry.id, entry.roomId, entry.action, entry.actor, entry.target, JSON.stringify(entry.details || {}), entry.createdAt]
  );
}

async function markSessionEndedInDb(roomId) {
  const pool = await getDbPool();
  if (!pool) return;
  await pool.query(
    `UPDATE sessions
     SET status = 'completed',
         actual_end_time = COALESCE(actual_end_time, NOW()),
         updated_at = NOW()
     WHERE room_name = $1`,
    [roomId]
  );
  await pool.query(
    `UPDATE live_sessions
     SET status = 'ended',
         actual_end_time = COALESCE(actual_end_time, NOW())
     WHERE room_name = $1`,
    [roomId]
  );
}

app.use(express.static("public"));
app.use("/assets", express.static(path.join(__dirname, "assets")));
app.use(express.json({ limit: "50mb" }));

// ── Room validation endpoint ───────────────────────────────────────────────
app.get("/api/room-info/:roomId", (req, res) => {
  const room = rooms.get(req.params.roomId);
  res.json({
    roomId: req.params.roomId,
    exists: !!room,
    hasTeacher: room ? !!room.teacherSocketId : false,
    studentCount: room ? room.students.size : 0
  });
});

// ── Session end enforcement ────────────────────────────────────────────────
// Rooms store their scheduled_end so the server can auto-terminate them
const roomSchedule = new Map(); // roomId → { scheduledEnd: Date, timer: TimeoutId }

function endRoomBySchedule(roomId) {
  console.log(`[schedule] session ended for room ${roomId}`);

  const room = rooms.get(roomId);

  // 1. ALWAYS broadcast FIRST (so clients receive event before disconnects)
  io.to(roomId).emit("session-ended", {
    roomId,
    reason: "scheduled_end"
  });

  // 2. Add small delay to ensure packets reach clients BEFORE disconnect
  setTimeout(() => {

    // ─────────────────────────────────────────────
    // 3. FORCE DISCONNECT teacher (not just leave)
    // ─────────────────────────────────────────────
    if (room?.teacherSocketId) {
      const teacherSocket = io.sockets.sockets.get(room.teacherSocketId);

      if (teacherSocket) {
        teacherSocket.leave(roomId);        // remove from room
        teacherSocket.disconnect(true);     // FORCE disconnect (IMPORTANT FIX)
      }
    }

    // ─────────────────────────────────────────────
    // 4. FORCE DISCONNECT all students
    // ─────────────────────────────────────────────
    if (room) {
      room.students.forEach((info, studentSocketId) => {
        const studentSocket = io.sockets.sockets.get(studentSocketId);

        if (studentSocket) {
          studentSocket.leave(roomId);        // remove from room
          studentSocket.disconnect(true);     // FORCE disconnect (IMPORTANT FIX)
        }
      });
    }

    // ─────────────────────────────────────────────
    // 5. Cleanup uploaded material
    // ─────────────────────────────────────────────
    if (room?.material?.filename) {
      deleteUpload(room.material.filename);
    }

    // ─────────────────────────────────────────────
    // 6. Delete room state
    // ─────────────────────────────────────────────
    rooms.delete(roomId);

    // ─────────────────────────────────────────────
    // 7. Cleanup schedule timer safely
    // ─────────────────────────────────────────────
    const existing = roomSchedule.get(roomId);
    if (existing?.timer) clearTimeout(existing.timer);
    roomSchedule.delete(roomId);

    console.log(`[schedule] room ${roomId} fully terminated and cleaned up`);

  }, 5000); // ⬅️ CRITICAL: gives clients time to receive event
}

app.post("/api/room-schedule", (req, res) => {
  const { roomId, scheduledEnd } = req.body;
  if (!roomId || !scheduledEnd) return res.status(400).json({ error: 'roomId and scheduledEnd required' });

  // Clear any existing timer for this room
  const existing = roomSchedule.get(roomId);
  if (existing?.timer) clearTimeout(existing.timer);

  const endTime = new Date(scheduledEnd);
  const msUntilEnd = endTime - Date.now();

  if (msUntilEnd <= 0) {
    endRoomBySchedule(roomId);
    return res.json({ ok: true, message: 'ended' });
  }

  const timer = setTimeout(() => {
    endRoomBySchedule(roomId);
  }, msUntilEnd);

  roomSchedule.set(roomId, { scheduledEnd: endTime, timer });
  console.log(`[schedule] room ${roomId} will end in ${Math.round(msUntilEnd/1000)}s`);
  res.json({ ok: true, msUntilEnd });
});

// ── File upload (images only) ──────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype.startsWith("image/") ? cb(null, true) : cb(new Error("Images only"))
});

// ── Helper: delete a file from public/uploads by filename ────────────────
function deleteUpload(filename) {
  if (!filename) return;
  const filePath = path.join(publicUploadsDir, filename);
  fs.remove(filePath).catch(() => {});
  console.log(`[upload] deleted ${filename}`);
}

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const target = path.join(publicUploadsDir, req.file.filename);
  fs.move(req.file.path, target, { overwrite: true })
    .then(() => res.json({ url: `/uploads/${req.file.filename}`, filename: req.file.filename }))
    .catch(() => res.status(500).json({ error: "File processing failed" }));
});

// ── Room state ─────────────────────────────────────────────────────────────
// rooms: Map<roomId, {
//   teacherSocketId: string | null,
//   students: Map<socketId, { name, handRaised, approved, mutedByModerator }>,
//   moderators: Map<socketId, { name, role, speaking }>,
//   moderationLogs: Array<object>,
//   activeSpeaker: "teacher" | socketId,
//   material: object | null,
//   teacherMutedByModerator: boolean,
//   supervisorSpeaking: boolean,
//   teacherBroadcasting: boolean
// }>
const rooms = new Map();

function getRoom(roomId) { return rooms.get(roomId); }

function createRoom() {
  return {
    teacherSocketId: null,
    students: new Map(),
    moderators: new Map(),
    moderationLogs: [],
    activeSpeaker: "teacher",
    material: null,
    teacherMutedByModerator: false,
    supervisorSpeaking: false,
    teacherBroadcasting: false
  };
}

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, createRoom());
  const room = rooms.get(roomId);
  if (!room.moderators) room.moderators = new Map();
  if (!room.moderationLogs) room.moderationLogs = [];
  if (typeof room.teacherMutedByModerator !== "boolean") room.teacherMutedByModerator = false;
  if (typeof room.supervisorSpeaking !== "boolean") room.supervisorSpeaking = false;
  if (typeof room.teacherBroadcasting !== "boolean") room.teacherBroadcasting = false;
  return room;
}

function isModeratorRole(role) {
  return ["admin", "manager", "supervisor", "moderator"].includes(String(role || "").toLowerCase());
}

function addModerationLog(roomId, action, actor, target = null, details = {}) {
  const room = ensureRoom(roomId);
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    roomId,
    action,
    actor: actor || "moderator",
    target,
    details,
    createdAt: new Date().toISOString()
  };
  room.moderationLogs.push(entry);
  if (room.moderationLogs.length > 100) room.moderationLogs.shift();
  persistModerationLog(entry).catch((e) => console.warn("[audit-db] log insert failed:", e.message));
  emitModeratorState(roomId);
  console.log(`[audit] ${roomId} ${action}`, { actor, target });
}

function serializeParticipants(room) {
  const participants = [];
  if (room.teacherSocketId) {
    participants.push({
      id: room.teacherSocketId,
      name: "Teacher",
      role: "teacher",
      online: true,
      muted: !!room.teacherMutedByModerator,
      speaking: room.activeSpeaker === "teacher"
    });
  }
  room.students.forEach((info, id) => {
    participants.push({
      id,
      name: info.name,
      role: "student",
      online: true,
      handRaised: !!info.handRaised,
      approved: !!info.approved,
      muted: !!info.mutedByModerator,
      speaking: room.activeSpeaker === id
    });
  });
  return participants;
}

function emitModeratorState(roomId) {
  const room = getRoom(roomId);
  if (!room?.moderators) return;

  const participants = serializeParticipants(room);
  const sessionData = {
    roomId,
    hasTeacher: !!room.teacherSocketId,
    studentCount: room.students.size,
    moderatorCount: room.moderators.size,
    activeSpeaker: room.activeSpeaker,
    material: room.material,
    state: {
      teacherMutedByModerator: !!room.teacherMutedByModerator,
      isSupervisorSpeaking: !!room.supervisorSpeaking
    }
  };
  const audioStreams = {
    teacher: {
      socketId: room.teacherSocketId,
      live: !!room.teacherSocketId && !!room.teacherBroadcasting,
      muted: !!room.teacherMutedByModerator
    },
    activeSpeaker: room.activeSpeaker,
    supervisorSpeaking: !!room.supervisorSpeaking,
    students: participants.filter(p => p.role === "student").map(p => ({
      socketId: p.id,
      name: p.name,
      live: p.speaking || p.approved,
      muted: p.muted
    }))
  };

  room.moderators.forEach((_, moderatorSocketId) => {
    const target = io.sockets.sockets.get(moderatorSocketId);
    if (!target) return;
    target.emit("session_data", sessionData);
    target.emit("participant_list", participants);
    target.emit("audio_streams", audioStreams);
    target.emit("moderation_logs", room.moderationLogs);
  });
}

function attachTeacherAudioMonitor(roomId, moderatorSocketId) {
  const room = getRoom(roomId);
  if (!room?.teacherSocketId || !room.teacherBroadcasting) return;
  io.to(room.teacherSocketId).emit("audio-monitor-peer", { targetId: moderatorSocketId });
}

// ── Socket.IO signaling ────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id}`);

  // ── Teacher joins ──────────────────────────────────────────────────────
  socket.on("join-as-teacher", (roomId) => {
    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = "teacher";

    const room = ensureRoom(roomId);
    room.teacherSocketId = socket.id;
    room.activeSpeaker = "teacher";
    room.teacherBroadcasting = false;

    socket.emit("teacher-joined", { roomId });

    // Notify any waiting students that teacher has arrived
    room.students.forEach((info, studentSocketId) => {
      io.to(studentSocketId).emit("teacher-arrived", { teacherSocketId: socket.id });
      // Re-notify teacher of each connected student so their Map is populated
      socket.emit("student-connected", {
        studentId: studentSocketId,
        studentName: info.name,
        totalStudents: room.students.size
      });
    });
    emitModeratorState(roomId);

    console.log(`[teacher] ${socket.id} → room ${roomId}`);
  });

  // ── Student joins ──────────────────────────────────────────────────────
  socket.on("join-as-student", (roomId, studentName = "Student") => {
    // Create room if teacher hasn't joined yet — student waits
    const room = ensureRoom(roomId);

    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = "student";

    room.students.set(socket.id, { name: studentName, handRaised: false, approved: false, mutedByModerator: false });

    socket.emit("student-joined", {
      roomId,
      hasTeacher: !!room.teacherSocketId,
      teacherSocketId: room.teacherSocketId,
      activeSpeaker: room.activeSpeaker,
      material: room.material
    });

    // Send material separately to guarantee student receives it
    if (room.material) {
      socket.emit("material-shared", { url: room.material.url });
    }

    // Tell teacher a new student arrived so teacher can initiate WebRTC offer
    if (room.teacherSocketId) {
      io.to(room.teacherSocketId).emit("student-connected", {
        studentId: socket.id,
        studentName,
        totalStudents: room.students.size
      });
    }
    emitModeratorState(roomId);

    console.log(`[student] ${socket.id} (${studentName}) → room ${roomId}`);
  });

  // ── WebRTC signaling relay ─────────────────────────────────────────────
  socket.on("join-as-moderator", (roomId, moderatorName = "Moderator", moderatorRole = "moderator") => {
    if (!isModeratorRole(moderatorRole)) {
      socket.emit("moderation_error", { message: "Moderator access denied" });
      socket.disconnect(true);
      return;
    }

    const room = ensureRoom(roomId);

    socket.join(roomId);
    socket.roomId = roomId;
    socket.role = "moderator";
    socket.participantName = moderatorName;
    socket.participantRole = moderatorRole;

    room.moderators.set(socket.id, { name: moderatorName, role: moderatorRole, speaking: false });
    addModerationLog(roomId, "moderator_joined_silently", `${moderatorName} (${moderatorRole})`);
    addModerationLog(roomId, "moderator_started_monitoring", `${moderatorName} (${moderatorRole})`);
    attachTeacherAudioMonitor(roomId, socket.id);
    emitModeratorState(roomId);

    console.log(`[moderator] ${socket.id} (${moderatorName}/${moderatorRole}) room ${roomId}`);
  });

  function validateModeratorAction(roomId) {
    const room = getRoom(roomId || socket.roomId);
    if (!room || socket.role !== "moderator" || !room.moderators?.has(socket.id)) return null;
    return room;
  }

  socket.on("mute_teacher", ({ roomId } = {}) => {
    const room = validateModeratorAction(roomId);
    if (!room || !room.teacherSocketId) return;
    room.teacherMutedByModerator = true;
    io.to(room.teacherSocketId).emit("moderation-audio-control", { muted: true });
    addModerationLog(socket.roomId, "teacher_muted_by_supervisor", socket.participantName, room.teacherSocketId);
  });

  socket.on("unmute_teacher", ({ roomId } = {}) => {
    const room = validateModeratorAction(roomId);
    if (!room || !room.teacherSocketId) return;
    room.teacherMutedByModerator = false;
    io.to(room.teacherSocketId).emit("moderation-audio-control", { muted: false });
    addModerationLog(socket.roomId, "teacher_unmuted_by_supervisor", socket.participantName, room.teacherSocketId);
  });

  socket.on("mute_student", ({ roomId, studentId } = {}) => {
    const room = validateModeratorAction(roomId);
    const student = room?.students.get(studentId);
    if (!room || !student) return;
    student.mutedByModerator = true;
    io.to(studentId).emit("moderation-audio-control", { muted: true });
    addModerationLog(socket.roomId, "student_muted_by_supervisor", socket.participantName, studentId, { studentName: student.name });
  });

  socket.on("unmute_student", ({ roomId, studentId } = {}) => {
    const room = validateModeratorAction(roomId);
    const student = room?.students.get(studentId);
    if (!room || !student) return;
    student.mutedByModerator = false;
    io.to(studentId).emit("moderation-audio-control", { muted: false });
    addModerationLog(socket.roomId, "student_unmuted_by_supervisor", socket.participantName, studentId, { studentName: student.name });
  });

  socket.on("start_speaking", ({ roomId } = {}) => {
    const room = validateModeratorAction(roomId);
    if (!room) return;
    room.supervisorSpeaking = true;
    const moderator = room.moderators.get(socket.id);
    if (moderator) moderator.speaking = true;
    addModerationLog(socket.roomId, "moderator_started_speaking", socket.participantName);
  });

  socket.on("stop_speaking", ({ roomId } = {}) => {
    const room = validateModeratorAction(roomId);
    if (!room) return;
    room.supervisorSpeaking = false;
    const moderator = room.moderators.get(socket.id);
    if (moderator) moderator.speaking = false;
    addModerationLog(socket.roomId, "moderator_stopped_speaking", socket.participantName);
  });

  socket.on("end_session", ({ roomId } = {}) => {
    const targetRoomId = roomId || socket.roomId;
    const room = validateModeratorAction(targetRoomId);
    if (!room) return;
    addModerationLog(targetRoomId, "session_ended_by_supervisor", socket.participantName);
    markSessionEndedInDb(targetRoomId).catch((e) => console.warn("[audit-db] session update failed:", e.message));
    io.to(targetRoomId).emit("session-ended", { roomId: targetRoomId, reason: "moderator_end_session" });
    setTimeout(() => rooms.delete(targetRoomId), 1000);
  });

  socket.on("webrtc-offer", ({ targetId, sdp }) => {
    io.to(targetId).emit("webrtc-offer", { fromId: socket.id, sdp });
  });

  socket.on("webrtc-answer", ({ targetId, sdp }) => {
    io.to(targetId).emit("webrtc-answer", { fromId: socket.id, sdp });
  });

  socket.on("webrtc-offer-student", ({ targetId, sdp }) => {
    io.to(targetId).emit("webrtc-offer-student", { fromId: socket.id, sdp });
  });

  socket.on("webrtc-answer-student", ({ targetId, sdp }) => {
    io.to(targetId).emit("webrtc-answer-student", { fromId: socket.id, sdp });
  });

  socket.on("ice-candidate", ({ targetId, candidate, peerType }) => {
    io.to(targetId).emit("ice-candidate", { fromId: socket.id, candidate, peerType });
  });

  // ── Raise-hand system ──────────────────────────────────────────────────
  socket.on("raise-hand", (roomId) => {
    console.log(`[server][raise-hand] socket: ${socket.id}, role: ${socket.role}, room: ${roomId}`);
    const room = getRoom(roomId);
    if (!room) {
      console.log(`[server][raise-hand] Room not found: ${roomId}`);
      return;
    }
    if (socket.role !== "student") {
      console.log(`[server][raise-hand] Role is not student: ${socket.role}`);
      return;
    }
    const student = room.students.get(socket.id);
    if (!student) {
      console.log(`[server][raise-hand] Student info not found for ${socket.id}`);
      return;
    }
    if (student.approved) {
      console.log(`[server][raise-hand] Student already approved: ${student.name}`);
      return;
    }

    // Auto-approve: revoke previous student speaker if any
    if (room.activeSpeaker !== "teacher" && room.activeSpeaker !== socket.id) {
      const prevStudent = room.students.get(room.activeSpeaker);
      if (prevStudent) {
        prevStudent.approved = false;
        console.log(`[server][raise-hand] Revoking previous speaker: ${prevStudent.name}`);
      }
      io.to(room.activeSpeaker).emit("speak-revoked");
    }

    // Mark all other students as not approved
    room.students.forEach((info, id) => {
      if (id !== socket.id) info.approved = false;
    });

    student.approved = true;
    student.handRaised = false;
    room.activeSpeaker = socket.id;

    // Notify room of speaker change
    io.to(roomId).emit("speaker-changed", {
      speakerId: socket.id,
      speakerName: student.name,
      isTeacher: false
    });
    emitModeratorState(roomId);

    // Send approval directly to student (with teacher socket for WebRTC)
    const teacherSocketId = room.teacherSocketId || null;
    console.log(`[server][raise-hand] Approving speaker ${student.name}. Teacher socket ID: ${teacherSocketId}`);
    io.to(socket.id).emit("speak-approved", { teacherSocketId });
  });

  socket.on("cancel-hand", (roomId) => {
    const room = getRoom(roomId);
    if (!room || socket.role !== "student") return;
    const student = room.students.get(socket.id);
    if (!student) return;

    student.handRaised = false;
    student.approved = false;

    // If this student was the active speaker, reset to teacher
    if (room.activeSpeaker === socket.id) {
      room.activeSpeaker = "teacher";
      io.to(roomId).emit("speaker-changed", {
        speakerId: "teacher",
        speakerName: "Teacher",
        isTeacher: true
      });
    }

    io.to(socket.id).emit("speak-revoked");
    emitModeratorState(roomId);
    console.log(`[mic-off] ${student.name} turned off mic in ${roomId}`);
  });

  socket.on("approve-speaker", ({ roomId, studentId }) => {
    const room = getRoom(roomId);
    if (!room || socket.role !== "teacher") return;
    const student = room.students.get(studentId);
    if (!student) return;

    if (room.activeSpeaker !== "teacher" && room.activeSpeaker !== studentId) {
      const prevStudent = room.students.get(room.activeSpeaker);
      if (prevStudent) prevStudent.approved = false;
      io.to(room.activeSpeaker).emit("speak-revoked");
    }

    room.students.forEach((info, id) => {
      if (id !== studentId) info.approved = false;
    });
    student.approved = true;
    student.handRaised = false;
    room.activeSpeaker = studentId;

    io.to(roomId).emit("speaker-changed", {
      speakerId: studentId,
      speakerName: student.name,
      isTeacher: false
    });
    emitModeratorState(roomId);

    io.to(studentId).emit("speak-approved", { teacherSocketId: socket.id });
    console.log(`[approve] ${student.name} approved in ${roomId}`);
  });

  socket.on("student-mic-failed", ({ roomId, reason }) => {
    const room = getRoom(roomId);
    if (!room || socket.role !== "student") return;
    const student = room.students.get(socket.id);
    if (!student) return;

    student.approved = false;
    student.handRaised = false;
    if (room.activeSpeaker === socket.id) {
      room.activeSpeaker = "teacher";
      io.to(roomId).emit("speaker-changed", { speakerId: "teacher", speakerName: "Teacher", isTeacher: true });
    }
    emitModeratorState(roomId);

    if (room.teacherSocketId) {
      io.to(room.teacherSocketId).emit("student-mic-failed", {
        studentId: socket.id,
        studentName: student.name,
        reason
      });
    }
    console.log(`[mic-failed] ${student.name} in ${roomId}: ${reason || "unknown"}`);
  });

  socket.on("reject-hand", ({ roomId, studentId }) => {
    const room = getRoom(roomId);
    if (!room || socket.role !== "teacher") return;
    const student = room.students.get(studentId);
    if (student) student.handRaised = false;
    io.to(studentId).emit("hand-rejected");
  });

  socket.on("revoke-speaker", (roomId) => {
    const room = getRoom(roomId);
    if (!room || socket.role !== "teacher") return;

    const prevSpeaker = room.activeSpeaker;
    room.activeSpeaker = "teacher";

    if (prevSpeaker !== "teacher") {
      const student = room.students.get(prevSpeaker);
      if (student) { student.approved = false; }
      io.to(prevSpeaker).emit("speak-revoked");
    }

    io.to(roomId).emit("speaker-changed", { speakerId: "teacher", speakerName: "Teacher", isTeacher: true });
    emitModeratorState(roomId);
    console.log(`[revoke] speaker revoked in ${roomId}`);
  });

  socket.on("teacher-broadcasting", () => {
    const room = getRoom(socket.roomId);
    if (!room || socket.role !== "teacher") return;
    room.teacherBroadcasting = true;
    const students = [];
    room.students.forEach((info, id) => students.push({ studentId: id, studentName: info.name }));
    socket.emit("current-students", students);
    room.moderators?.forEach((_, moderatorSocketId) => attachTeacherAudioMonitor(socket.roomId, moderatorSocketId));
    emitModeratorState(socket.roomId);
  });

  // ── Material sharing ───────────────────────────────────────────────────
  socket.on("share-material", ({ roomId, url, filename }) => {
    const room = getRoom(roomId);
    if (!room || socket.role !== "teacher") return;

    // Delete previous image for this room before storing the new one
    if (room.material?.filename) deleteUpload(room.material.filename);

    // Extract filename from URL if not provided explicitly
    const fname = filename || url.split('/').pop();
    room.material = { url, filename: fname, sharedAt: Date.now() };
    io.to(roomId).emit("material-shared", { url });
    emitModeratorState(roomId);
    console.log(`[material] shared in ${roomId}: ${url}`);
  });

  // ── DRAWING EVENT HANDLERS (FIXED WITH STROKE BOUNDARIES) ───────────────
  // These three events work together to prevent unwanted line connections
  // between separate drawing strokes on student canvases
  
  socket.on("draw-begin", ({ roomId, x, y, color, width }) => {
    if (socket.roomId) {
      socket.to(roomId).emit("draw-begin", { x, y, color, width });
    }
  });

  // ── Quran PDF sync ─────────────────────────────────────────────────────
  socket.on("quran-sync", ({ roomId, page, scrollPercent }) => {
    if (socket.roomId && socket.role === "teacher") {
      socket.to(roomId).emit("quran-sync", { page, scrollPercent });
    }
  });

  socket.on("quran-open", ({ roomId }) => {
    if (socket.roomId && socket.role === "teacher") {
      socket.to(roomId).emit("quran-open");
    }
  });

  socket.on("quran-close", ({ roomId }) => {
    if (socket.roomId && socket.role === "teacher") {
      socket.to(roomId).emit("quran-close");
    }
  });

  socket.on("draw", ({ roomId, x, y, color, width }) => {
    if (socket.roomId) {
      socket.to(roomId).emit("draw", { x, y, color, width });
    }
  });

  socket.on("draw-end", ({ roomId }) => {
    if (socket.roomId) {
      socket.to(roomId).emit("draw-end");
    }
  });

  socket.on("clear-canvas", (roomId) => {
    if (socket.roomId) {
      io.to(roomId).emit("clear-canvas");
    }
  });

  // ── Disconnect ─────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log(`[disconnect] ${socket.id}`);
    const { roomId, role } = socket;
    if (!roomId || !rooms.has(roomId)) return;
    const room = rooms.get(roomId);

    if (role === "teacher") {
      io.to(roomId).emit("teacher-left");
      // Delete the room's uploaded image on teacher disconnect
      if (room.material?.filename) deleteUpload(room.material.filename);
      rooms.delete(roomId);
      console.log(`[room] ${roomId} closed`);
    } else if (role === "student") {
      const student = room.students.get(socket.id);
      const name = student?.name || "Unknown";
      room.students.delete(socket.id);

      if (room.activeSpeaker === socket.id) {
        room.activeSpeaker = "teacher";
        io.to(roomId).emit("speaker-changed", { speakerId: "teacher", speakerName: "Teacher", isTeacher: true });
      }

      if (room.teacherSocketId) {
        io.to(room.teacherSocketId).emit("student-left", {
          studentId: socket.id,
          studentName: name,
          totalStudents: room.students.size
        });
      }
      emitModeratorState(roomId);
    } else if (role === "moderator") {
      room.moderators?.delete(socket.id);
      addModerationLog(roomId, "moderator_left_silently", socket.participantName || "Moderator");
      emitModeratorState(roomId);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("=".repeat(60));
  console.log("  AUDIO CLASSROOM — WebRTC Signaling Server");
  console.log("=".repeat(60));
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Teacher : http://localhost:${PORT}/teacher.html?room=test`);
  console.log(`  Student : http://localhost:${PORT}/student.html?room=test`);
  console.log("=".repeat(60));
});
