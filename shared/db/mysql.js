// Pool de connexions MySQL partagé (driver mysql2). getMysqlPool() renvoie un pool unique
// (singleton) réutilisé par tous les services qui lisent/écrivent dans MySQL.
const mysql = require('mysql2/promise');

let pool = null;

function getMysqlPool() {
  if (pool) return pool;

  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'bd_final_projet_annuel',
    waitForConnections: true,
    connectionLimit: 20,
    queueLimit: 0
  });

  return pool;
}

async function resetMysqlPool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  getMysqlPool,
  resetMysqlPool
};