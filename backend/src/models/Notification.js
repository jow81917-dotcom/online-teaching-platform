const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.STRING(36), primaryKey: true },
  user_id: { type: DataTypes.STRING(36), allowNull: false },
  type: { type: DataTypes.STRING(50), allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  data: DataTypes.TEXT,
  is_read: { type: DataTypes.BOOLEAN, defaultValue: false },
  read_at: DataTypes.DATE
}, { tableName: 'notifications', underscored: true });

module.exports = Notification;
