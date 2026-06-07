const { getMysqlPool } = require('../../../../shared/db/mysql');

async function attachVendorApprovalStatus(row) {
  if (!row || row.role !== 'vendor') return row;
  const pool = getMysqlPool();
  try {
    const [rows] = await pool.query(
      `SELECT approval_status FROM vendors WHERE id = ? LIMIT 1`,
      [row.id]
    );
    row.approval_status = rows[0]?.approval_status ?? null;
  } catch (err) {
    if (err.code === 'ER_BAD_FIELD_ERROR') {
      row.approval_status = 'pending';
    } else {
      throw err;
    }
  }
  return row;
}

async function findUserByEmail(email) {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `
      SELECT
        u.id,
        u.email,
        u.phone,
        u.username,
        u.role,
        u.email_verified,
        u.sms_verified,
        c.password_hash,
        c.password_salt
      FROM users u
      JOIN user_credentials c ON c.user_id = u.id
      WHERE LOWER(u.email) = LOWER(?)
      LIMIT 1
    `,
    [email]
  );
  return attachVendorApprovalStatus(rows[0] || null);
}

async function findUserByPhone(phone) {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `
      SELECT
        u.id,
        u.email,
        u.phone,
        u.username,
        u.role,
        u.email_verified,
        u.sms_verified,
        c.password_hash,
        c.password_salt
      FROM users u
      JOIN user_credentials c ON c.user_id = u.id
      WHERE u.phone = ?
      LIMIT 1
    `,
    [phone]
  );
  return attachVendorApprovalStatus(rows[0] || null);
}

async function findUserById(userId) {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `
      SELECT
        u.id,
        u.email,
        u.phone,
        u.username,
        u.role,
        u.email_verified,
        u.sms_verified
      FROM users u
      WHERE u.id = ?
      LIMIT 1
    `,
    [userId]
  );
  return attachVendorApprovalStatus(rows[0] || null);
}

async function createUser({ userId, email, phone, username, role, passwordHash, passwordSalt }) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `
        INSERT INTO users (id, email, phone, username, role, email_verified, sms_verified)
        VALUES (?, LOWER(?), ?, ?, ?, false, false)
      `,
      [userId, email, phone || null, username || null, role || 'user']
    );
    await connection.execute(
      `
        INSERT INTO user_credentials (user_id, password_hash, password_salt, password_algo)
        VALUES (?, ?, ?, 'pbkdf2-sha256+pepper')
      `,
      [userId, passwordHash, passwordSalt]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createVendor({
  userId, email, phone, username, passwordHash, passwordSalt,
  businessName, siret, address, taxId, iban
}) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `
        INSERT INTO vendors (id, email, phone, username, role, email_verified, sms_verified,
          business_name, siret, address, tax_id, iban, approval_status)
        VALUES (?, LOWER(?), ?, ?, 'vendor', false, false, ?, ?, ?, ?, ?, 'pending')
      `,
      [userId, email, phone || null, username || null,
        businessName || null, siret || null, address || null, taxId || null, iban || null]
    );
    await connection.execute(
      `
        INSERT INTO user_credentials (user_id, password_hash, password_salt, password_algo)
        VALUES (?, ?, ?, 'pbkdf2-sha256+pepper')
      `,
      [userId, passwordHash, passwordSalt]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updatePassword({ userId, passwordHash, passwordSalt }) {
  const pool = getMysqlPool();
  await pool.query(
    `
      UPDATE user_credentials
      SET password_hash = ?,
          password_salt = ?,
          updated_at = NOW()
      WHERE user_id = ?
    `,
    [passwordHash, passwordSalt, userId]
  );
}

async function updateUserProfile({ userId, email, phone, username }) {
  const pool = getMysqlPool();
  const [result] = await pool.query(
    `
      UPDATE users
      SET email = LOWER(?),
          phone = ?,
          username = ?,
          updated_at = NOW()
      WHERE id = ?
    `,
    [email, phone || null, username || null, userId]
  );
  return result.affectedRows > 0;
}

async function markVerification({ userId, channel }) {
  const pool = getMysqlPool();
  if (channel === 'sms') {
    await pool.query(`UPDATE users SET sms_verified = true, updated_at = NOW() WHERE id = ?`, [userId]);
    await pool.query(`UPDATE vendors SET sms_verified = true, updated_at = NOW() WHERE id = ?`, [userId]);
    return;
  }
  await pool.query(`UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = ?`, [userId]);
  await pool.query(`UPDATE vendors SET email_verified = true, updated_at = NOW() WHERE id = ?`, [userId]);
}

async function updateVendorApproval({ vendorId, approvalStatus, approvedBy }) {
  const pool = getMysqlPool();
  await pool.query(
    `
      UPDATE vendors
      SET approval_status = ?,
          approved_at = CASE WHEN ? = 'approved' THEN NOW() ELSE approved_at END,
          approved_by = CASE WHEN ? = 'approved' THEN ? ELSE NULL END,
          updated_at = NOW()
      WHERE id = ?
    `,
    [approvalStatus, approvalStatus, approvalStatus, approvedBy || null, vendorId]
  );
}

async function insertSecurityEvent({
  userId = null, eventType, severity = 'info',
  requestId = null, ipAddress = null,
  fingerprintHash = null, metadata = {}
}) {
  const pool = getMysqlPool();
  await pool.query(
    `
      INSERT INTO security_events (
        id, user_id, event_type, severity,
        request_id, ip_address, fingerprint_hash, metadata
      )
      VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?)
    `,
    [userId, eventType, severity, requestId, ipAddress, fingerprintHash, JSON.stringify(metadata)]
  );
}

module.exports = {
  findUserByEmail,
  findUserByPhone,
  findUserById,
  createUser,
  createVendor,
  updateUserProfile,
  updatePassword,
  updateVendorApproval,
  markVerification,
  insertSecurityEvent
};