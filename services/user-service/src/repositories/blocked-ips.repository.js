const { getMysqlPool } = require('../../../../shared/db/mysql');

async function isIpBlocked(ipAddress) {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT 1 FROM blocked_ips WHERE ip_address = ? LIMIT 1`,
    [String(ipAddress || '').trim()]
  );
  return rows.length > 0;
}

async function addBlockedIp({ ipAddress, reason, blockedBy }) {
  const pool = getMysqlPool();
  await pool.query(
    `
      INSERT INTO blocked_ips (ip_address, reason, blocked_by)
      VALUES (?, ?, ?)
    `,
    [String(ipAddress || '').trim(), reason || null, blockedBy || null]
  );
}

async function removeBlockedIp(ipAddress) {
  const pool = getMysqlPool();
  const [result] = await pool.query(
    `DELETE FROM blocked_ips WHERE ip_address = ?`,
    [String(ipAddress || '').trim()]
  );
  return result.affectedRows > 0;
}

async function listBlockedIps() {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT id, ip_address, reason, blocked_by, blocked_at FROM blocked_ips ORDER BY blocked_at DESC`
  );
  return rows;
}

module.exports = {
  isIpBlocked,
  addBlockedIp,
  removeBlockedIp,
  listBlockedIps
};