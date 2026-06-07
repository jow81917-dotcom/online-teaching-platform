require('dotenv').config();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

(async () => {
  try {
    // Get admin user
    const [rows] = await sequelize.query(
      'SELECT id, username, role, password_hash FROM users WHERE LOWER(username) = LOWER($1)',
      { bind: ['admin'] }
    );

    if (!rows.length) {
      console.log('No admin found — creating one...');
      const id = uuidv4();
      const hash = await bcrypt.hash('Admin@123', 10);
      await sequelize.query(
        'INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, true, NOW(), NOW())',
        { bind: [id, 'admin', hash, 'admin'] }
      );
      console.log('Admin created: username=admin password=Admin@123');
    } else {
      const user = rows[0];
      console.log('Admin found:', user.username, '| role:', user.role);
      console.log('Existing hash:', user.password_hash.substring(0, 30) + '...');

      // Test if password matches
      const valid = await bcrypt.compare('Admin@123', user.password_hash);
      console.log('Password "Admin@123" valid?', valid);

      if (!valid) {
        console.log('Resetting password to Admin@123...');
        const newHash = await bcrypt.hash('Admin@123', 10);
        await sequelize.query(
          'UPDATE users SET password_hash = $1 WHERE LOWER(username) = LOWER($2)',
          { bind: [newHash, 'admin'] }
        );
        console.log('Password reset done!');
      } else {
        console.log('Password is correct — login should work.');
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
