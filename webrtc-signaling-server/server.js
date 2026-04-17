// webrtc-signaling-server/server.js
require('dotenv').config();
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_jwt_key_change_this';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// ICE config — STUN + TURN from audio-relay-classroom
const ICE_SERVERS = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:global.relay.metered.ca:80',                 username: 'c42ac28730f2eccb2531db32', credential: 'Os9aeQUDwLn1A7Qw' },
  { urls: 'turn:global.relay.metered.ca:80?transport=tcp',   username: 'c42ac28730f2eccb2531db32', credential: 'Os9aeQUDwLn1A7Qw' },
  { urls: 'turn:global.relay.metered.ca:443',                username: 'c42ac28730f2eccb2531db32', credential: 'Os9aeQUDwLn1A7Qw' },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'c42ac28730f2eccb2531db32', credential: 'Os9aeQUDwLn1A7Qw' }
];

const app = express();
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', FRONTEND_URL);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  next();
});

// Serve ICE config to frontend
app.get('/ice-config', (req, res) => {
  res.json({ iceServers: ICE_SERVERS, iceTransportPolicy: 'all', iceCandidatePoolSize: 10 });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    credentials: true
  }
});

// rooms[sessionId] = { users: { userId: socketId }, startTime, timerId }
const rooms = {};

io.use((socket, next) => {
  const token = socket.handshake.query.token;
  if (!token) return next(new Error('No token'));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const { sessionId, userId } = socket.handshake.query;
  console.log(`[+] ${userId} connected (socket: ${socket.id})`);

  socket.on('join-room', ({ sessionId, role, userId }) => {
    socket.join(sessionId);

    if (!rooms[sessionId]) {
      rooms[sessionId] = { users: {}, startTime: Date.now() };
    }
    rooms[sessionId].users[userId] = socket.id;

    // Notify others in the room
    socket.to(sessionId).emit('user-joined', { userId, socketId: socket.id, role });

    // Start session timer
    startSessionTimer(sessionId, io);

    console.log(`[room:${sessionId}] ${userId} joined (${role})`);
  });

  socket.on('send-offer', ({ to, socketId, offer }) => {
    io.to(socketId).emit('receive-offer', { from: userId, socketId: socket.id, offer });
  });

  socket.on('send-answer', ({ to, socketId, answer }) => {
    io.to(socketId).emit('receive-answer', { from: userId, answer });
  });

  socket.on('send-ice-candidate', ({ to, socketId, candidate }) => {
    io.to(socketId).emit('receive-ice-candidate', { from: userId, candidate });
  });

  // ── Image & canvas relay ──────────────────────────────────────────
  socket.on('share-image', ({ sessionId, dataUrl, width, height }) => {
    socket.to(sessionId).emit('image-shared', { dataUrl, width, height });
  });

  socket.on('clear-image', ({ sessionId }) => {
    socket.to(sessionId).emit('image-cleared');
  });

  socket.on('draw-stroke', ({ sessionId, x0, y0, x1, y1, color, size, erase }) => {
    socket.to(sessionId).emit('draw-stroke', { x0, y0, x1, y1, color, size, erase });
  });

  socket.on('clear-canvas', ({ sessionId }) => {
    socket.to(sessionId).emit('canvas-cleared');
  });

  socket.on('leave-room', ({ sessionId, userId }) => {
    leaveRoom(socket, sessionId, userId);
  });

  socket.on('disconnect', () => {
    // Find and clean up any rooms this socket was in
    for (const [sid, room] of Object.entries(rooms)) {
      const uid = Object.keys(room.users).find(u => room.users[u] === socket.id);
      if (uid) leaveRoom(socket, sid, uid);
    }
    console.log(`[-] ${socket.id} disconnected`);
  });
});

function leaveRoom(socket, sessionId, userId) {
  if (!rooms[sessionId]) return;
  delete rooms[sessionId].users[userId];
  socket.to(sessionId).emit('user-left', userId);
  socket.leave(sessionId);

  if (Object.keys(rooms[sessionId].users).length === 0) {
    clearInterval(rooms[sessionId].timerId);
    delete rooms[sessionId];
    console.log(`[room:${sessionId}] closed`);
  }
}

function startSessionTimer(sessionId, io) {
  if (rooms[sessionId].timerId) return; // already running

  const MAX_DURATION = 60 * 60; // 1 hour default max in seconds

  rooms[sessionId].timerId = setInterval(() => {
    if (!rooms[sessionId]) return;
    const elapsed = Math.floor((Date.now() - rooms[sessionId].startTime) / 1000);
    const remaining = MAX_DURATION - elapsed;

    io.to(sessionId).emit('time-update', { elapsed, remaining });

    if (remaining <= 0) {
      io.to(sessionId).emit('session-ended', { reason: 'max_duration_reached' });
      clearInterval(rooms[sessionId].timerId);
      delete rooms[sessionId];
    }
  }, 30000); // emit every 30 seconds
}

server.listen(PORT, () => {
  console.log(`WebRTC Signaling Server running on port ${PORT}`);
});
