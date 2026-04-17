const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Session = sequelize.define('Session', {
  id: { type: DataTypes.STRING(36), primaryKey: true },
  title: { type: DataTypes.STRING, allowNull: false },
  description: DataTypes.TEXT,
  subject: DataTypes.STRING(100),
  teacher_id: { type: DataTypes.STRING(36), allowNull: false },
  student_id: { type: DataTypes.STRING(36), allowNull: false },
  scheduled_start: { type: DataTypes.DATE, allowNull: false },
  scheduled_end: { type: DataTypes.DATE, allowNull: false },
  min_duration_minutes: { type: DataTypes.INTEGER, defaultValue: 30 },
  max_duration_minutes: { type: DataTypes.INTEGER, defaultValue: 60 },
  grace_period_minutes: { type: DataTypes.INTEGER, defaultValue: 5 },
  status: { type: DataTypes.ENUM('scheduled','active','completed','cancelled','replaced'), defaultValue: 'scheduled' },
  actual_start_time: DataTypes.DATE,
  actual_end_time: DataTypes.DATE,
  auto_ended: { type: DataTypes.BOOLEAN, defaultValue: false },
  meeting_link: DataTypes.TEXT,
  room_name: { type: DataTypes.STRING, unique: true },
  is_replacement: { type: DataTypes.BOOLEAN, defaultValue: false },
  original_teacher_id: DataTypes.STRING(36),
  created_by: { type: DataTypes.STRING(36), allowNull: false }
}, { tableName: 'sessions', underscored: true });

module.exports = Session;
