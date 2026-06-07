const { getMysqlPool } = require('../../../../shared/db/mysql');

function mapAddressRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    street: row.street,
    city: row.city,
    postalCode: row.postal_code || '',
    country: row.country,
    phone: row.phone || '',
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function listUserAddresses(userId) {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `
      SELECT *
      FROM user_addresses
      WHERE user_id = ?
      ORDER BY is_default DESC, created_at ASC
    `,
    [userId]
  );
  return rows.map(mapAddressRow);
}

async function createUserAddress({
  addressId, userId, label, street,
  city, postalCode, country, phone, isDefault
}) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [countRows] = await connection.execute(
      `SELECT COUNT(*) AS count FROM user_addresses WHERE user_id = ?`,
      [userId]
    );

    const shouldBeDefault = Boolean(isDefault) || Number(countRows[0]?.count || 0) === 0;

    if (shouldBeDefault) {
      await connection.execute(
        `UPDATE user_addresses SET is_default = false, updated_at = NOW() WHERE user_id = ?`,
        [userId]
      );
    }

    await connection.execute(
      `
        INSERT INTO user_addresses (
          id, user_id, label, street, city,
          postal_code, country, phone, is_default
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [addressId, userId, label, street, city,
        postalCode || null, country, phone || null, shouldBeDefault]
    );

    const [inserted] = await connection.execute(
      `SELECT * FROM user_addresses WHERE id = ? LIMIT 1`,
      [addressId]
    );

    await connection.commit();
    return mapAddressRow(inserted[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateUserAddress({
  userId, addressId, label, street,
  city, postalCode, country, phone, isDefault
}) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    if (Boolean(isDefault)) {
      await connection.execute(
        `UPDATE user_addresses SET is_default = false, updated_at = NOW() WHERE user_id = ?`,
        [userId]
      );
    }

    await connection.execute(
      `
        UPDATE user_addresses
        SET label = ?,
            street = ?,
            city = ?,
            postal_code = ?,
            country = ?,
            phone = ?,
            is_default = CASE WHEN ? THEN true ELSE is_default END,
            updated_at = NOW()
        WHERE id = ?
          AND user_id = ?
      `,
      [label, street, city, postalCode || null, country,
        phone || null, Boolean(isDefault), addressId, userId]
    );

    const [updated] = await connection.execute(
      `SELECT * FROM user_addresses WHERE id = ? AND user_id = ? LIMIT 1`,
      [addressId, userId]
    );

    await connection.commit();
    return updated[0] ? mapAddressRow(updated[0]) : null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function setDefaultUserAddress({ userId, addressId }) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute(
      `UPDATE user_addresses SET is_default = false, updated_at = NOW() WHERE user_id = ?`,
      [userId]
    );

    await connection.execute(
      `UPDATE user_addresses SET is_default = true, updated_at = NOW() WHERE id = ? AND user_id = ?`,
      [addressId, userId]
    );

    const [updated] = await connection.execute(
      `SELECT * FROM user_addresses WHERE id = ? AND user_id = ? LIMIT 1`,
      [addressId, userId]
    );

    await connection.commit();
    return updated[0] ? mapAddressRow(updated[0]) : null;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteUserAddress({ userId, addressId }) {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [toDelete] = await connection.execute(
      `SELECT * FROM user_addresses WHERE id = ? AND user_id = ? LIMIT 1`,
      [addressId, userId]
    );

    if (!toDelete[0]) {
      await connection.rollback();
      return false;
    }

    await connection.execute(
      `DELETE FROM user_addresses WHERE id = ? AND user_id = ?`,
      [addressId, userId]
    );

    if (toDelete[0].is_default) {
      const [nextAddress] = await connection.execute(
        `SELECT id FROM user_addresses WHERE user_id = ? ORDER BY created_at ASC LIMIT 1`,
        [userId]
      );

      if (nextAddress[0]?.id) {
        await connection.execute(
          `UPDATE user_addresses SET is_default = true, updated_at = NOW() WHERE id = ?`,
          [nextAddress[0].id]
        );
      }
    }

    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  listUserAddresses,
  createUserAddress,
  updateUserAddress,
  setDefaultUserAddress,
  deleteUserAddress
};