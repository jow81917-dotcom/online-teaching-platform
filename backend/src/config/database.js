// backend/src/config/database.js
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

// Sequelize-compatible interface so all controllers work unchanged
const sequelize = {
  query: async (query, options = {}) => {
    const bind = options.bind || options.replacements || [];
    const rows = await sql(query, bind);
    return [rows, null];
  },
  authenticate: async () => {
    await sql`SELECT 1`;
  }
};

module.exports = sequelize;
