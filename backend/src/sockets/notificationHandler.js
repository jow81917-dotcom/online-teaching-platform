// backend/src/sockets/notificationHandler.js
module.exports = (socket, io) => {
  socket.on('subscribe-notifications', ({ userId }) => {
    socket.join(`user:${userId}`);
  });
};
