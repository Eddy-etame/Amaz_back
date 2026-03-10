const { getPostgresPool } = require('../../../../shared/db/postgres');

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
  const pool = getPostgresPool();
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8 / 1000.0), to_timestamp($9 / 1000.0))
    `,
    [sessionId, userId, accessTokenHash, refreshTokenHash, fingerprintHash, ipAddress, userAgent, accessExpiresAt, refreshExpiresAt]
  );
}

async function getSessionById(sessionId) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT *
      FROM sessions
      WHERE id = $1
      LIMIT 1
    `,
    [sessionId]
  );
  return result.rows[0] || null;
}

async function getActiveSessionByAccessHash(accessTokenHash) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT s.*, u.email, u.role
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.access_token_hash = $1
        AND s.revoked_at IS NULL
        AND s.access_expires_at > NOW()
      LIMIT 1
    `,
    [accessTokenHash]
  );
  return result.rows[0] || null;
}

async function rotateSessionTokens({
  sessionId,
  accessTokenHash,
  refreshTokenHash,
  accessExpiresAt,
  refreshExpiresAt
}) {
  const pool = getPostgresPool();
  await pool.query(
    `
      UPDATE sessions
      SET access_token_hash = $2,
          refresh_token_hash = $3,
          access_expires_at = to_timestamp($4 / 1000.0),
          refresh_expires_at = to_timestamp($5 / 1000.0),
          updated_at = NOW()
      WHERE id = $1
    `,
    [sessionId, accessTokenHash, refreshTokenHash, accessExpiresAt, refreshExpiresAt]
  );
}

async function revokeSession({ sessionId, reason, revokedBy }) {
  const pool = getPostgresPool();
  await pool.query(
    `
      UPDATE sessions
      SET revoked_at = NOW(),
          revoked_reason = $2,
          revoked_by = $3,
          updated_at = NOW()
      WHERE id = $1
    `,
    [sessionId, reason || null, revokedBy || null]
  );
}

async function revokeAllUserSessions({ userId, reason, revokedBy }) {
  const pool = getPostgresPool();
  await pool.query(
    `
      UPDATE sessions
      SET revoked_at = NOW(),
          revoked_reason = $2,
          revoked_by = $3,
          updated_at = NOW()
      WHERE user_id = $1
        AND revoked_at IS NULL
    `,
    [userId, reason || null, revokedBy || null]
  );
}

async function insertTokenRevocation({ tokenType, tokenHash, sessionId, userId, reason }) {
  const pool = getPostgresPool();
  await pool.query(
    `
      INSERT INTO token_revocations (id, token_type, token_hash, session_id, user_id, reason, revoked_at)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())
      ON CONFLICT DO NOTHING
    `,
    [tokenType, tokenHash, sessionId || null, userId || null, reason || null]
  );
}

async function isTokenRevoked(tokenHash) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT 1
      FROM token_revocations
      WHERE token_hash = $1
      LIMIT 1
    `,
    [tokenHash]
  );
  return result.rowCount > 0;
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
