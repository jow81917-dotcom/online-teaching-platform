// backend/src/config/database.js
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

const sequelize = {
  query: async (query, options = {}) => {
    const bind = options.bind || options.replacements || [];
    const rows = await sql.query(query, bind);
    return [rows, null];
  },
  authenticate: async () => {
    await sql`SELECT 1`;
  }
};

module.exports = sequelize;
