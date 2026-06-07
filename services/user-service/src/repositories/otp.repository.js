const { getMysqlPool } = require('../../../../shared/db/mysql');

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
  const pool = getMysqlPool();
  await pool.query(
    `
      INSERT INTO otp_requests (
        id, user_id, purpose, channel,
        destination, code_hash, expires_at, request_meta
      )
      VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(? / 1000), ?)
    `,
    [otpRequestId, userId, purpose, channel,
      destination, codeHash, expiresAt, JSON.stringify(requestMeta)]
  );
}

async function countRecentOtpRequests({ userId, purpose, channel, destination, windowSeconds }) {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `
      SELECT COUNT(*) AS count
      FROM otp_requests
      WHERE user_id = ?
        AND purpose = ?
        AND channel = ?
        AND destination = ?
        AND created_at >= NOW() - INTERVAL ? SECOND
    `,
    [userId, purpose, channel, destination, windowSeconds]
  );
  return Number(rows[0]?.count || 0);
}

async function getOtpRequestById(otpRequestId) {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT * FROM otp_requests WHERE id = ? LIMIT 1`,
    [otpRequestId]
  );
  return rows[0] || null;
}

async function insertOtpAttempt({ otpRequestId, success, ipAddress = null, fingerprintHash = null }) {
  const pool = getMysqlPool();
  await pool.query(
    `
      INSERT INTO otp_attempts (
        id, otp_request_id, success, ip_address, fingerprint_hash
      )
      VALUES (UUID(), ?, ?, ?, ?)
    `,
    [otpRequestId, Boolean(success), ipAddress, fingerprintHash]
  );
}

async function incrementOtpAttempts(otpRequestId) {
  const pool = getMysqlPool();
  await pool.query(
    `
      UPDATE otp_requests
      SET attempts = attempts + 1,
          updated_at = NOW()
      WHERE id = ?
    `,
    [otpRequestId]
  );
}

async function consumeOtpRequest(otpRequestId) {
  const pool = getMysqlPool();
  await pool.query(
    `
      UPDATE otp_requests
      SET consumed_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
    `,
    [otpRequestId]
  );
}

async function lockOtpRequest(otpRequestId, lockedUntilMs) {
  const pool = getMysqlPool();
  await pool.query(
    `
      UPDATE otp_requests
      SET locked_until = FROM_UNIXTIME(? / 1000),
          updated_at = NOW()
      WHERE id = ?
    `,
    [lockedUntilMs, otpRequestId]
  );
}

async function createPasswordResetRequest({ requestId, userId, otpRequestId, resetTokenHash, expiresAt }) {
  const pool = getMysqlPool();
  await pool.query(
    `
      INSERT INTO password_reset_requests (id, user_id, otp_request_id, reset_token_hash, expires_at)
      VALUES (?, ?, ?, ?, FROM_UNIXTIME(? / 1000))
    `,
    [requestId, userId, otpRequestId, resetTokenHash, expiresAt]
  );
}

async function getActivePasswordResetRequest(resetTokenHash) {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `
      SELECT *
      FROM password_reset_requests
      WHERE reset_token_hash = ?
        AND consumed_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `,
    [resetTokenHash]
  );
  return rows[0] || null;
}

async function consumePasswordResetRequest(requestId) {
  const pool = getMysqlPool();
  await pool.query(
    `
      UPDATE password_reset_requests
      SET consumed_at = NOW(),
          updated_at = NOW()
      WHERE id = ?
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