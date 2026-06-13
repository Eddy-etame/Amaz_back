// Connexion PostgreSQL partagée (pilote natif `pg`, pas d'ORM).
//
// On garde UN pool de connexions par process (singleton) : ouvrir une connexion par
// requête serait coûteux. Le pool réutilise et recycle les connexions tout seul.

const { Pool } = require('pg');

let pool = null;

// Renvoie le pool, en le créant à la première demande (lazy). Les paramètres viennent
// des variables d'environnement PG_*.
function getPostgresPool() {
  if (pool) return pool;

  pool = new Pool({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT || 5432),
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE || process.env.PG_DB,
    ssl: String(process.env.PG_SSL || 'false') === 'true' ? { rejectUnauthorized: false } : false,
    max: 20, // nombre max de connexions simultanées dans le pool
    idleTimeoutMillis: 30000 // ferme une connexion inactive au bout de 30 s
  });

  return pool;
}

// Ferme proprement le pool (utile dans les tests ou à l'arrêt du service).
async function resetPostgresPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getPostgresPool,
  resetPostgresPool
};
