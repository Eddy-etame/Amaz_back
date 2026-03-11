const { getPostgresPool } = require('../../../../shared/db/postgres');

async function findUserByEmail(email) {
  const pool = getPostgresPool();
  const result = await pool.query(
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
      FROM user_accounts u
      JOIN user_credentials c ON c.user_id = u.id
      WHERE lower(u.email) = lower($1)
      LIMIT 1
    `,
    [email]
  );

  return result.rows[0] || null;
}

async function findUserByPhone(phone) {
  const pool = getPostgresPool();
  const result = await pool.query(
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
      FROM user_accounts u
      JOIN user_credentials c ON c.user_id = u.id
      WHERE u.phone = $1
      LIMIT 1
    `,
    [phone]
  );

  return result.rows[0] || null;
}

async function findUserById(userId) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT
        id,
        email,
        phone,
        username,
        role,
        email_verified,
        sms_verified
      FROM user_accounts
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );
  return result.rows[0] || null;
}

async function createUser({ userId, email, phone, username, role, passwordHash, passwordSalt }) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `
        INSERT INTO users (id, email, phone, username, role, email_verified, sms_verified)
        VALUES ($1, lower($2), $3, $4, $5, false, false)
      `,
      [userId, email, phone || null, username || null, role || 'user']
    );
    await client.query(
      `
        INSERT INTO user_credentials (user_id, password_hash, password_salt, password_algo)
        VALUES ($1, $2, $3, 'pbkdf2-sha256+pepper')
      `,
      [userId, passwordHash, passwordSalt]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function createVendor({
  userId,
  email,
  phone,
  username,
  passwordHash,
  passwordSalt,
  businessName,
  siret,
  address,
  taxId,
  iban
}) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `
        INSERT INTO vendors (id, email, phone, username, role, email_verified, sms_verified, business_name, siret, address, tax_id, iban)
        VALUES ($1, lower($2), $3, $4, 'vendor', false, false, $5, $6, $7, $8, $9)
      `,
      [userId, email, phone || null, username || null, businessName || null, siret || null, address || null, taxId || null, iban || null]
    );
    await client.query(
      `
        INSERT INTO user_credentials (user_id, password_hash, password_salt, password_algo)
        VALUES ($1, $2, $3, 'pbkdf2-sha256+pepper')
      `,
      [userId, passwordHash, passwordSalt]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updatePassword({ userId, passwordHash, passwordSalt }) {
  const pool = getPostgresPool();
  await pool.query(
    `
      UPDATE user_credentials
      SET password_hash = $2,
          password_salt = $3,
          updated_at = NOW()
      WHERE user_id = $1
    `,
    [userId, passwordHash, passwordSalt]
  );
}

async function updateUserProfile({ userId, email, phone, username }) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      UPDATE users
      SET email = lower($2),
          phone = $3,
          username = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id
    `,
    [userId, email, phone || null, username || null]
  );

  return result.rowCount > 0;
}

async function markVerification({ userId, channel }) {
  const pool = getPostgresPool();
  if (channel === 'sms') {
    await pool.query(`UPDATE users SET sms_verified = true, updated_at = NOW() WHERE id = $1`, [userId]);
    await pool.query(`UPDATE vendors SET sms_verified = true, updated_at = NOW() WHERE id = $1`, [userId]);
    return;
  }
  await pool.query(`UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1`, [userId]);
  await pool.query(`UPDATE vendors SET email_verified = true, updated_at = NOW() WHERE id = $1`, [userId]);
}

async function insertSecurityEvent({
  userId = null,
  eventType,
  severity = 'info',
  requestId = null,
  ipAddress = null,
  fingerprintHash = null,
  metadata = {}
}) {
  const pool = getPostgresPool();
  await pool.query(
    `
      INSERT INTO security_events (
        id,
        user_id,
        event_type,
        severity,
        request_id,
        ip_address,
        fingerprint_hash,
        metadata
      )
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7::jsonb)
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
  markVerification,
  insertSecurityEvent
};
