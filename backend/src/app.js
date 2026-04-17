// backend/src/app.js
const express = require('express');
const app = express();

// Import database connection
const sequelize = require('./config/database');

// Test database connection
sequelize.authenticate()
  .then(() => console.log('Database connected...'))
  .catch(err => console.log('Error: ' + err));

// Sync database (development only)
if (process.env.NODE_ENV === 'development') {
  sequelize.sync({ alter: true })
    .then(() => console.log('Database synced'))
    .catch(err => console.log('Sync error: ' + err));
}

module.exports = app;