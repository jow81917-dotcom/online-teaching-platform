// backend/src/seeds/insertAdmin.js
const bcrypt = require('bcryptjs');
const sequelize = require('../config/database');

(async () => {
  try {
    const username = 'admin';
    const password = 'Admin@123';
    const role = 'admin';

    // check existence
    const [existing] = await sequelize.query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', { bind: [username] });
    if (existing.length) {
      console.log('Admin already exists');
      process.exit(0);
    }

    const password_hash = await bcrypt.hash(password, 10);
    const { v4: uuidv4 } = require('uuid');
    const id = uuidv4();
    await sequelize.query(
      'INSERT INTO users (id, username, password_hash, role, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, true, NOW(), NOW())',
      { bind: [id, username, password_hash, role] }
    );
    console.log('Admin user created');
  } catch (err) {
    console.error('Error inserting admin:', err);
    process.exit(1);
  }
})();
