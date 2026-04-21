// backend/src/app.js
const express = require('express');
const app = express();

const sequelize = require('./config/database');

sequelize.authenticate()
  .then(() => console.log('Database connected...'))
  .catch(err => console.log('Error: ' + err));

module.exports = app;
