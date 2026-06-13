const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env')
});

const { getPostgresPool } = require('../../shared/db/postgres');
const {
  buildPasswordHash
} = require('../../services/user-service/src/services/password.service');

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || 'Amaz@2026!';
/** Dedicated QA / Postman / qa-lab login (see README). */
const QA_TEST_PASSWORD = process.env.SEED_QA_TEST_PASSWORD || 'AmazQA2026!';
const SEEDED_VENDOR_ID = process.env.SEED_VENDOR_ID || 'vnd_seed_etame_e';

const seededUsers = [
  {
    id: 'usr_seed_qa_amaz',
    email: 'test@amaz.com',
    phone: '+33102030405',
    username: 'QA Amaz',
    role: 'user',
    password: QA_TEST_PASSWORD,
    address: {
      id: 'addr_seed_qa_amaz',
      label: 'Test',
      street: '1 rue QA',
      city: 'Paris',
      postalCode: '75001',
      country: 'France',
      phone: '+33102030405',
      isDefault: true
    }
  },
  {
    id: 'usr_seed_eddy_etame',
    email: 'eddy.eetame@gmail.com',
    phone: '+237670100101',
    username: 'Eddy Etame',
    role: 'user',
    address: {
      id: 'addr_seed_eddy_home',
      label: 'Domicile',
      street: '12 avenue des Fleurs',
      city: 'Douala',
      postalCode: '12000',
      country: 'Cameroon',
      phone: '+237670100101',
      isDefault: true
    }
  },
  {
    id: 'usr_seed_king_e',
    email: 'eddy.etame@enkoschools.com',
    phone: '+237670100202',
    username: 'King E',
    role: 'user',
    address: {
      id: 'addr_seed_king_home',
      label: 'Bureau',
      street: '5 rue du Commerce',
      city: 'Yaounde',
      postalCode: '21000',
      country: 'Cameroon',
      phone: '+237670100202',
      isDefault: true
    }
  },
  {
    id: 'usr_seed_david_green',
    email: 'drdavid10000@gmail.com',
    phone: '+237670100303',
    username: 'David Green',
    role: 'user',
    address: {
      id: 'addr_seed_david_home',
      label: 'Domicile',
      street: '88 boulevard Central',
      city: 'Bafoussam',
      postalCode: '31000',
      country: 'Cameroon',
      phone: '+237670100303',
      isDefault: true
    }
  }
];

const seededAdmin = {
  id: 'usr_seed_admin',
  email: 'admin@amaz.local',
  phone: '+237670100000',
  username: 'Admin Amaz',
  role: 'admin'
};

const seededVendor = {
  id: SEEDED_VENDOR_ID,
  email: 'etame.eddy01@gmail.com',
  phone: '+237670100404',
  username: 'Etame E',
  businessName: 'Etame Market SARL',
  siret: 'CM-DLA-2026-0001',
  address: '45 avenue du Commerce, Douala, Cameroon',
  taxId: 'TAX-CM-ETAME-2026',
  iban: 'CM21AMAZ0001000200030004'
};

function buildOrderTimestamp(daysAgo, hour = 10) {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date;
}

const seededOrders = [
  {
    id: 'ord_seed_eddy_001',
    userId: 'usr_seed_eddy_etame',
    status: 'delivered',
    paymentMethod: 'card',
    shippingAddress: seededUsers[0].address,
    createdAt: buildOrderTimestamp(8, 9),
    estimatedDeliveryAt: buildOrderTimestamp(4, 14),
    deliveredAt: buildOrderTimestamp(4, 15),
    items: [
      {
        id: 'orditm_seed_eddy_001_a',
        productId: 'prd_seed_001',
        title: 'Casque Bluetooth Pro',
        price: 59000,
        quantity: 1,
        vendorId: SEEDED_VENDOR_ID,
        image: ''
      },
      {
        id: 'orditm_seed_eddy_001_b',
        productId: 'prd_seed_006',
        title: 'Chaussures de sport légères',
        price: 28000,
        quantity: 1,
        vendorId: SEEDED_VENDOR_ID,
        image: ''
      }
    ]
  },
  {
    id: 'ord_seed_king_001',
    userId: 'usr_seed_king_e',
    status: 'confirmed',
    paymentMethod: 'livraison',
    shippingAddress: seededUsers[1].address,
    createdAt: buildOrderTimestamp(2, 11),
    estimatedDeliveryAt: buildOrderTimestamp(-2, 14),
    deliveredAt: null,
    items: [
      {
        id: 'orditm_seed_king_001_a',
        productId: 'prd_seed_004',
        title: 'Ordinateur portable 15"',
        price: 325000,
        quantity: 1,
        vendorId: SEEDED_VENDOR_ID,
        image: ''
      }
    ]
  },
  {
    id: 'ord_seed_david_001',
    userId: 'usr_seed_david_green',
    status: 'shipped',
    paymentMethod: 'card',
    shippingAddress: seededUsers[2].address,
    createdAt: buildOrderTimestamp(1, 13),
    estimatedDeliveryAt: buildOrderTimestamp(-3, 14),
    deliveredAt: null,
    items: [
      {
        id: 'orditm_seed_david_001_a',
        productId: 'prd_seed_010',
        title: 'Montre connectée fitness',
        price: 45000,
        quantity: 1,
        vendorId: SEEDED_VENDOR_ID,
        image: ''
      },
      {
        id: 'orditm_seed_david_001_b',
        productId: 'prd_seed_015',
        title: 'Powerbank 20000 mAh',
        price: 22000,
        quantity: 2,
        vendorId: SEEDED_VENDOR_ID,
        image: ''
      }
    ]
  }
];

function computeOrderTotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

async function seedUsersAndVendor(client) {
  const requestId = 'seed_demo_data';

  for (const user of seededUsers) {
    const pwd = user.password || DEFAULT_PASSWORD;
    const { passwordHash, passwordSalt } = await buildPasswordHash({
      password: pwd,
      requestId
    });

    await client.query(
      `
        INSERT INTO users (id, email, phone, username, role, email_verified, sms_verified)
        VALUES ($1, lower($2), $3, $4, $5, true, true)
      `,
      [user.id, user.email, user.phone, user.username, user.role]
    );

    await client.query(
      `
        INSERT INTO user_credentials (user_id, password_hash, password_salt, password_algo)
        VALUES ($1, $2, $3, 'pbkdf2-sha256+pepper')
      `,
      [user.id, passwordHash, passwordSalt]
    );

    await client.query(
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
      `,
      [
        user.address.id,
        user.id,
        user.address.label,
        user.address.street,
        user.address.city,
        user.address.postalCode,
        user.address.country,
        user.address.phone,
        user.address.isDefault
      ]
    );
  }

  const { passwordHash, passwordSalt } = await buildPasswordHash({
    password: DEFAULT_PASSWORD,
    requestId
  });

  // Insert admin user
  await client.query(
    `
      INSERT INTO users (id, email, phone, username, role, email_verified, sms_verified)
      VALUES ($1, lower($2), $3, $4, 'admin', true, true)
    `,
    [seededAdmin.id, seededAdmin.email, seededAdmin.phone, seededAdmin.username]
  );

  await client.query(
    `
      INSERT INTO user_credentials (user_id, password_hash, password_salt, password_algo)
      VALUES ($1, $2, $3, 'pbkdf2-sha256+pepper')
    `,
    [seededAdmin.id, passwordHash, passwordSalt]
  );

  // Insert vendor into users first (PostgreSQL inheritance: child rows are not in parent;
  // user_credentials FK references users(id), so we need the id in users)
  await client.query(
    `
      INSERT INTO users (id, email, phone, username, role, email_verified, sms_verified)
      VALUES ($1, lower($2), $3, $4, 'vendor', true, true)
    `,
    [seededVendor.id, seededVendor.email, seededVendor.phone, seededVendor.username]
  );

  await client.query(
    `
      INSERT INTO user_credentials (user_id, password_hash, password_salt, password_algo)
      VALUES ($1, $2, $3, 'pbkdf2-sha256+pepper')
    `,
    [seededVendor.id, passwordHash, passwordSalt]
  );

  // Insert vendor-specific data into vendors (inherited table)
  await client.query(
    `
      INSERT INTO vendors (
        id,
        email,
        phone,
        username,
        role,
        email_verified,
        sms_verified,
        business_name,
        siret,
        address,
        tax_id,
        iban,
        approval_status
      )
      VALUES ($1, lower($2), $3, $4, 'vendor', true, true, $5, $6, $7, $8, $9, 'approved')
    `,
    [
      seededVendor.id,
      seededVendor.email,
      seededVendor.phone,
      seededVendor.username,
      seededVendor.businessName,
      seededVendor.siret,
      seededVendor.address,
      seededVendor.taxId,
      seededVendor.iban
    ]
  );
}

async function seedOrders(client) {
  for (const order of seededOrders) {
    const total = computeOrderTotal(order.items);

    await client.query(
      `
        INSERT INTO orders (
          id,
          user_id,
          status,
          total_amount,
          currency,
          estimated_delivery_at,
          delivered_at,
          shipping_address,
          payment_status,
          payment_method,
          created_at,
          updated_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          'EUR',
          $5,
          $6,
          $7::jsonb,
          'authorized',
          $8,
          $9,
          $10
        )
      `,
      [
        order.id,
        order.userId,
        order.status,
        total,
        order.estimatedDeliveryAt.toISOString(),
        order.deliveredAt ? order.deliveredAt.toISOString() : null,
        JSON.stringify(order.shippingAddress),
        order.paymentMethod,
        order.createdAt.toISOString(),
        new Date().toISOString()
      ]
    );

    for (const item of order.items) {
      await client.query(
        `
          INSERT INTO order_items (
            id,
            order_id,
            product_id,
            product_title,
            unit_price,
            quantity,
            vendor_id,
            image_url,
            created_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          item.id,
          order.id,
          item.productId,
          item.title,
          item.price,
          item.quantity,
          item.vendorId,
          item.image,
          order.createdAt.toISOString()
        ]
      );
    }

    await client.query(
      `
        INSERT INTO payment_attempts (
          id,
          order_id,
          provider,
          amount,
          currency,
          status,
          provider_ref,
          created_at
        )
        VALUES ($1, $2, 'mock', $3, 'EUR', 'authorized', $4, $5)
      `,
      [
        `pay_seed_${order.id}`,
        order.id,
        total,
        `provider_seed_${order.id}`,
        order.createdAt.toISOString()
      ]
    );
  }
}

async function cleanupSeedData(client) {
  const seededUserIds = seededUsers.map((user) => user.id);
  const seededAddressIds = seededUsers.map((user) => user.address.id);
  const seededOrderIds = seededOrders.map((order) => order.id);
  const seededOrderItemIds = seededOrders.flatMap((order) =>
    order.items.map((item) => item.id)
  );
  const seededPaymentIds = seededOrders.map((order) => `pay_seed_${order.id}`);

  await client.query(`DELETE FROM payment_attempts WHERE id = ANY($1::varchar[])`, [seededPaymentIds]);
  await client.query(`DELETE FROM order_items WHERE id = ANY($1::varchar[])`, [seededOrderItemIds]);
  await client.query(`DELETE FROM orders WHERE id = ANY($1::varchar[])`, [seededOrderIds]);
  await client.query(`DELETE FROM user_addresses WHERE id = ANY($1::varchar[])`, [seededAddressIds]);
  await client.query(`DELETE FROM user_credentials WHERE user_id = ANY($1::varchar[])`, [
    [...seededUserIds, seededVendor.id, seededAdmin.id]
  ]);
  await client.query(`DELETE FROM vendors WHERE id = $1`, [seededVendor.id]);
  await client.query(`DELETE FROM users WHERE id = ANY($1::varchar[])`, [
    [...seededUserIds, seededVendor.id, seededAdmin.id]
  ]);
}

async function main() {
  const pool = getPostgresPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await cleanupSeedData(client);
    await seedUsersAndVendor(client);
    await seedOrders(client);
    await client.query('COMMIT');

    // eslint-disable-next-line no-console
    console.log(
      JSON.stringify({
        ok: true,
        users: seededUsers.length,
        admin: seededAdmin.email,
        vendor: seededVendor.email,
        orders: seededOrders.length,
        defaultPassword: DEFAULT_PASSWORD,
        qaTestUser: 'test@amaz.com',
        qaTestPassword: QA_TEST_PASSWORD
      })
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      ok: false,
      error: error.message
    })
  );
  process.exitCode = 1;
});
