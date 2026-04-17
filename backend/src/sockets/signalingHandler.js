// backend/src/sockets/signalingHandler.js
module.exports = (socket, io) => {
  socket.on('join-room', ({ sessionId, role, userId }) => {
    socket.join(sessionId);
    socket.to(sessionId).emit('user-joined', { userId, socketId: socket.id, role });
  });

  socket.on('send-offer', ({ to, socketId, offer }) => {
    io.to(socketId).emit('receive-offer', { from: socket.id, offer });
  });

  socket.on('send-answer', ({ socketId, answer }) => {
    io.to(socketId).emit('receive-answer', { from: socket.id, answer });
  });

  socket.on('send-ice-candidate', ({ socketId, candidate }) => {
    io.to(socketId).emit('receive-ice-candidate', { from: socket.id, candidate });
  });

  socket.on('leave-room', ({ sessionId, userId }) => {
    socket.to(sessionId).emit('user-left', userId);
    socket.leave(sessionId);
  });
};
