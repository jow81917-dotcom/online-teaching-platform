// backend/server.js
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import routes
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const sessionRoutes = require('./src/routes/sessions');
const homeworkRoutes = require('./src/routes/homework');
const leaveRoutes = require('./src/routes/leave');
const notificationRoutes = require('./src/routes/notifications');
const analyticsRoutes = require('./src/routes/analytics');
const reportRoutes = require('./src/routes/reports');
const videoRoutes = require('./src/routes/videos');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/videos', videoRoutes);

// Socket.IO handlers
const signalingHandler = require('./src/sockets/signalingHandler');
const notificationHandler = require('./src/sockets/notificationHandler');

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  
  signalingHandler(socket, io);
  notificationHandler(socket, io);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Automation cron jobs
const cron = require('node-cron');
const automationEngine = require('./src/services/automationEngine');

// Run every minute to check session statuses
cron.schedule('* * * * *', () => {
  automationEngine.checkSessionStatuses();
  automationEngine.autoEndExpiredSessions();
});

// Run every hour for homework cleanup
cron.schedule('0 * * * *', () => {
  automationEngine.checkHomeworkCleanup();
});

// Run every 5 minutes for notifications
cron.schedule('*/5 * * * *', () => {
  automationEngine.sendPendingNotifications();
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});