const { getPostgresPool } = require('../../../../shared/db/postgres');

async function isIpBlocked(ipAddress) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `SELECT 1 FROM blocked_ips WHERE ip_address = $1 LIMIT 1`,
    [String(ipAddress || '').trim()]
  );
  return result.rowCount > 0;
}

async function addBlockedIp({ ipAddress, reason, blockedBy }) {
  const pool = getPostgresPool();
  await pool.query(
    `
      INSERT INTO blocked_ips (ip_address, reason, blocked_by)
      VALUES ($1, $2, $3)
    `,
    [String(ipAddress || '').trim(), reason || null, blockedBy || null]
  );
}

async function removeBlockedIp(ipAddress) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `DELETE FROM blocked_ips WHERE ip_address = $1`,
    [String(ipAddress || '').trim()]
  );
  return result.rowCount > 0;
}

async function listBlockedIps() {
  const pool = getPostgresPool();
  const result = await pool.query(
    `SELECT id, ip_address, reason, blocked_by, blocked_at FROM blocked_ips ORDER BY blocked_at DESC`
  );
  return result.rows;
}

module.exports = {
  isIpBlocked,
  addBlockedIp,
  removeBlockedIp,
  listBlockedIps
};
