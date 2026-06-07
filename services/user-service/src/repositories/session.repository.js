const { getMysqlPool } = require('../../../../shared/db/mysql');

async function createSession({
  sessionId,
  userId,
  accessTokenHash,
  refreshTokenHash,
  fingerprintHash,
  ipAddress,
  userAgent,
  accessExpiresAt,
  refreshExpiresAt
}) {
  const pool = getMysqlPool();
  await pool.query(
    `
      INSERT INTO sessions (
        id,
        user_id,
        access_token_hash,
        refresh_token_hash,
        fingerprint_hash,
        ip_address,
        user_agent,
        access_expires_at,
        refresh_expires_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, FROM_UNIXTIME(? / 1000), FROM_UNIXTIME(? / 1000))
    `,
    [sessionId, userId, accessTokenHash, refreshTokenHash,
      fingerprintHash, ipAddress, userAgent, accessExpiresAt, refreshExpiresAt]
  );
}

async function getSessionById(sessionId) {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `
      SELECT *
      FROM sessions
      WHERE id = ?
      LIMIT 1
    `,
    [sessionId]
  );
  return rows[0] || null;
}

async function getActiveSessionByAccessHash(accessTokenHash) {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `
      SELECT s.*, u.email, u.role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.access_token_hash = ?
        AND s.revoked_at IS NULL
        AND s.access_expires_at > NOW()
      LIMIT 1
    `,
    [accessTokenHash]
  );
  return rows[0] || null;
}

async function rotateSessionTokens({
  sessionId,
  accessTokenHash,
  refreshTokenHash,
  accessExpiresAt,
  refreshExpiresAt
}) {
  const pool = getMysqlPool();
  await pool.query(
    `
      UPDATE sessions
      SET access_token_hash = ?,
          refresh_token_hash = ?,
          access_expires_at = FROM_UNIXTIME(? / 1000),
          refresh_expires_at = FROM_UNIXTIME(? / 1000),
          updated_at = NOW()
      WHERE id = ?
    `,
    [accessTokenHash, refreshTokenHash, accessExpiresAt, refreshExpiresAt, sessionId]
  );
}

async function revokeSession({ sessionId, reason, revokedBy }) {
  const pool = getMysqlPool();
  await pool.query(
    `
      UPDATE sessions
      SET revoked_at = NOW(),
          revoked_reason = ?,
          revoked_by = ?,
          updated_at = NOW()
      WHERE id = ?
    `,
    [reason || null, revokedBy || null, sessionId]
  );
}

async function revokeAllUserSessions({ userId, reason, revokedBy }) {
  const pool = getMysqlPool();
  await pool.query(
    `
      UPDATE sessions
      SET revoked_at = NOW(),
          revoked_reason = ?,
          revoked_by = ?,
          updated_at = NOW()
      WHERE user_id = ?
        AND revoked_at IS NULL
    `,
    [reason || null, revokedBy || null, userId]
  );
}

async function insertTokenRevocation({ tokenType, tokenHash, sessionId, userId, reason }) {
  const pool = getMysqlPool();
  await pool.query(
    `
      INSERT IGNORE INTO token_revocations (id, token_type, token_hash, session_id, user_id, reason, revoked_at)
      VALUES (UUID(), ?, ?, ?, ?, ?, NOW())
    `,
    [tokenType, tokenHash, sessionId || null, userId || null, reason || null]
  );
}

async function isTokenRevoked(tokenHash) {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `
      SELECT 1
      FROM token_revocations
      WHERE token_hash = ?
      LIMIT 1
    `,
    [tokenHash]
  );
  return rows.length > 0;
}

module.exports = {
  createSession,
  getSessionById,
  getActiveSessionByAccessHash,
  rotateSessionTokens,
  revokeSession,
  revokeAllUserSessions,
  insertTokenRevocation,
  isTokenRevoked
};
