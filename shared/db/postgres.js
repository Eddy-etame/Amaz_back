const { Pool } = require('pg');

let pool = null;

function getPostgresPool() {
  if (pool) return pool;

  pool = new Pool({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE || process.env.PG_DB,
    ssl: String(process.env.PG_SSL || 'false') === 'true' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000
  });

  return pool;
}

module.exports = {
  getPostgresPool
};
