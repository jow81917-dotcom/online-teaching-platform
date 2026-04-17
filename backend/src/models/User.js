const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.STRING(36), primaryKey: true },
  email: { type: DataTypes.STRING, unique: true, allowNull: false },
  password_hash: { type: DataTypes.STRING, allowNull: false },
  full_name: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.ENUM('admin', 'teacher', 'student'), allowNull: false },
  avatar_url: DataTypes.TEXT,
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  last_login: DataTypes.DATE
}, { tableName: 'users', underscored: true });

module.exports = User;
