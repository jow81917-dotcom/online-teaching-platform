const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Student = sequelize.define('Student', {
  id: { type: DataTypes.STRING(36), primaryKey: true },
  user_id: { type: DataTypes.STRING(36), allowNull: false, unique: true },
  grade_level: DataTypes.INTEGER,
  parent_email: DataTypes.STRING,
  phone_number: DataTypes.STRING(20),
  address: DataTypes.TEXT,
  payment_status: { type: DataTypes.ENUM('paid', 'pending', 'expired'), defaultValue: 'pending' },
  payment_expiry: DataTypes.DATEONLY,
  enrollment_date: DataTypes.DATEONLY,
  attendance_score: { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
  homework_completion_rate: { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
  engagement_score: { type: DataTypes.DECIMAL(5,2), defaultValue: 0 }
}, { tableName: 'students', underscored: true });

module.exports = Student;
