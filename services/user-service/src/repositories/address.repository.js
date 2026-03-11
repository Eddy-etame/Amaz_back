const { getPostgresPool } = require('../../../../shared/db/postgres');

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
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT *
      FROM user_addresses
      WHERE user_id = $1
      ORDER BY is_default DESC, created_at ASC
    `,
    [userId]
  );

  return result.rows.map(mapAddressRow);
}

async function createUserAddress({
  addressId,
  userId,
  label,
  street,
  city,
  postalCode,
  country,
  phone,
  isDefault
}) {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const countResult = await client.query(
      `
        SELECT COUNT(*)::int AS count
        FROM user_addresses
        WHERE user_id = $1
      `,
      [userId]
    );

    const shouldBeDefault = Boolean(isDefault) || Number(countResult.rows[0]?.count || 0) === 0;
    if (shouldBeDefault) {
      await client.query(
        `
          UPDATE user_addresses
          SET is_default = false,
              updated_at = NOW()
          WHERE user_id = $1
        `,
        [userId]
      );
    }

    const inserted = await client.query(
      `
        INSERT INTO user_addresses (
          id,
          user_id,
          label,
          street,
          city,
          postal_code,
          country,
          phone,
          is_default
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        addressId,
        userId,
        label,
        street,
        city,
        postalCode || null,
        country,
        phone || null,
        shouldBeDefault
      ]
    );

    await client.query('COMMIT');
    return mapAddressRow(inserted.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateUserAddress({
  userId,
  addressId,
  label,
  street,
  city,
  postalCode,
  country,
  phone,
  isDefault
}) {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    if (Boolean(isDefault)) {
      await client.query(
        `
          UPDATE user_addresses
          SET is_default = false,
              updated_at = NOW()
          WHERE user_id = $1
        `,
        [userId]
      );
    }

    const updated = await client.query(
      `
        UPDATE user_addresses
        SET label = $3,
            street = $4,
            city = $5,
            postal_code = $6,
            country = $7,
            phone = $8,
            is_default = CASE
              WHEN $9::boolean THEN true
              ELSE is_default
            END,
            updated_at = NOW()
        WHERE id = $1
          AND user_id = $2
        RETURNING *
      `,
      [
        addressId,
        userId,
        label,
        street,
        city,
        postalCode || null,
        country,
        phone || null,
        Boolean(isDefault)
      ]
    );

    await client.query('COMMIT');
    return updated.rows[0] ? mapAddressRow(updated.rows[0]) : null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function setDefaultUserAddress({ userId, addressId }) {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      `
        UPDATE user_addresses
        SET is_default = false,
            updated_at = NOW()
        WHERE user_id = $1
      `,
      [userId]
    );

    const updated = await client.query(
      `
        UPDATE user_addresses
        SET is_default = true,
            updated_at = NOW()
        WHERE id = $1
          AND user_id = $2
        RETURNING *
      `,
      [addressId, userId]
    );

    await client.query('COMMIT');
    return updated.rows[0] ? mapAddressRow(updated.rows[0]) : null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function deleteUserAddress({ userId, addressId }) {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const deleted = await client.query(
      `
        DELETE FROM user_addresses
        WHERE id = $1
          AND user_id = $2
        RETURNING *
      `,
      [addressId, userId]
    );

    const deletedRow = deleted.rows[0];
    if (!deletedRow) {
      await client.query('ROLLBACK');
      return false;
    }

    if (deletedRow.is_default) {
      const nextAddress = await client.query(
        `
          SELECT id
          FROM user_addresses
          WHERE user_id = $1
          ORDER BY created_at ASC
          LIMIT 1
        `,
        [userId]
      );

      if (nextAddress.rows[0]?.id) {
        await client.query(
          `
            UPDATE user_addresses
            SET is_default = true,
                updated_at = NOW()
            WHERE id = $1
          `,
          [nextAddress.rows[0].id]
        );
      }
    }

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  listUserAddresses,
  createUserAddress,
  updateUserAddress,
  setDefaultUserAddress,
  deleteUserAddress
};
