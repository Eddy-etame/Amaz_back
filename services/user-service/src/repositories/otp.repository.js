const { getPostgresPool } = require('../../../../shared/db/postgres');

async function createOtpRequest({
  otpRequestId,
  userId,
  purpose,
  channel,
  destination,
  codeHash,
  expiresAt,
  requestMeta = {}
}) {
  const pool = getPostgresPool();
  await pool.query(
    `
      INSERT INTO otp_requests (
        id,
        user_id,
        purpose,
        channel,
        destination,
        code_hash,
        expires_at,
        request_meta
      )
      VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7 / 1000.0), $8::jsonb)
    `,
    [otpRequestId, userId, purpose, channel, destination, codeHash, expiresAt, JSON.stringify(requestMeta)]
  );
}

async function countRecentOtpRequests({ userId, purpose, channel, destination, windowSeconds }) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT COUNT(*)::int AS count
      FROM otp_requests
      WHERE user_id = $1
        AND purpose = $2
        AND channel = $3
        AND destination = $4
        AND created_at >= NOW() - ($5::int * INTERVAL '1 second')
    `,
    [userId, purpose, channel, destination, windowSeconds]
  );
  return Number(result.rows[0]?.count || 0);
}

async function getOtpRequestById(otpRequestId) {
  const pool = getPostgresPool();
  const result = await pool.query(`SELECT * FROM otp_requests WHERE id = $1 LIMIT 1`, [otpRequestId]);
  return result.rows[0] || null;
}

async function insertOtpAttempt({ otpRequestId, success, ipAddress = null, fingerprintHash = null }) {
  const pool = getPostgresPool();
  await pool.query(
    `
      INSERT INTO otp_attempts (
        id,
        otp_request_id,
        success,
        ip_address,
        fingerprint_hash
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4)
    `,
    [otpRequestId, Boolean(success), ipAddress, fingerprintHash]
  );
}

async function incrementOtpAttempts(otpRequestId) {
  const pool = getPostgresPool();
  await pool.query(
    `
      UPDATE otp_requests
      SET attempts = attempts + 1,
          updated_at = NOW()
      WHERE id = $1
    `,
    [otpRequestId]
  );
}

async function consumeOtpRequest(otpRequestId) {
  const pool = getPostgresPool();
  await pool.query(
    `
      UPDATE otp_requests
      SET consumed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [otpRequestId]
  );
}

async function lockOtpRequest(otpRequestId, lockedUntilMs) {
  const pool = getPostgresPool();
  await pool.query(
    `
      UPDATE otp_requests
      SET locked_until = to_timestamp($2 / 1000.0),
          updated_at = NOW()
      WHERE id = $1
    `,
    [otpRequestId, lockedUntilMs]
  );
}

async function createPasswordResetRequest({ requestId, userId, otpRequestId, resetTokenHash, expiresAt }) {
  const pool = getPostgresPool();
  await pool.query(
    `
      INSERT INTO password_reset_requests (id, user_id, otp_request_id, reset_token_hash, expires_at)
      VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0))
    `,
    [requestId, userId, otpRequestId, resetTokenHash, expiresAt]
  );
}

async function getActivePasswordResetRequest(resetTokenHash) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT *
      FROM password_reset_requests
      WHERE reset_token_hash = $1
        AND consumed_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `,
    [resetTokenHash]
  );
  return result.rows[0] || null;
}

async function consumePasswordResetRequest(requestId) {
  const pool = getPostgresPool();
  await pool.query(
    `
      UPDATE password_reset_requests
      SET consumed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [requestId]
  );
}

module.exports = {
  createOtpRequest,
  countRecentOtpRequests,
  getOtpRequestById,
  insertOtpAttempt,
  incrementOtpAttempts,
  consumeOtpRequest,
  lockOtpRequest,
  createPasswordResetRequest,
  getActivePasswordResetRequest,
  consumePasswordResetRequest
};
