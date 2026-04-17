const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Teacher = sequelize.define('Teacher', {
  id: { type: DataTypes.STRING(36), primaryKey: true },
  user_id: { type: DataTypes.STRING(36), allowNull: false, unique: true },
  subject_specialization: DataTypes.STRING,
  qualification: DataTypes.TEXT,
  experience_years: { type: DataTypes.INTEGER, defaultValue: 0 },
  phone_number: DataTypes.STRING(20),
  address: DataTypes.TEXT,
  reliability_score: { type: DataTypes.DECIMAL(5,2), defaultValue: 100 },
  session_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  performance_rating: { type: DataTypes.DECIMAL(3,2), defaultValue: 0 },
  is_available: { type: DataTypes.BOOLEAN, defaultValue: true },
  hire_date: DataTypes.DATEONLY
}, { tableName: 'teachers', underscored: true });

module.exports = Teacher;
