// backend/src/config/database.js
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

const sequelize = {
  query: async (queryStr, options = {}) => {
    const params = options.bind || options.replacements || [];
    try {
      // neon() supports sql.query(text, params) for parameterized queries
      const rows = await sql.query(queryStr, params);
      return [rows, null];
    } catch (e) {
      console.error('[DB] error:', e.message);
      throw e;
    }
  },

  authenticate: async () => {
    await sql.query('SELECT 1', []);
    console.log('[DB] Neon connected');
  }
};

module.exports = sequelize;
