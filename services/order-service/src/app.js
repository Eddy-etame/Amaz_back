const express = require('express');

const { requestIdMiddleware } = require('../../../shared/middleware/request-id');
const { createInternalAuthMiddleware } = require('../../../shared/middleware/internal-auth');
const { errorHandler, notFoundHandler } = require('../../../shared/middleware/error-handler');
const { getPostgresPool } = require('../../../shared/db/postgres');
const { randomId } = require('../../../shared/utils/ids');
const { internalFetch } = require('../../../shared/utils/internal-http');
const { config } = require('./config');

const ORDER_STATUSES = ['confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];
const CANCELLABLE_STATUSES = new Set(['confirmed', 'preparing']);

function estimateDeliveryIso() {
  const days = 3 + Math.floor(Math.random() * 5);
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

function parseOrderItems(payload = {}) {
  const fromArray = Array.isArray(payload.items) ? payload.items : payload.articles;
  const sourceItems =
    Array.isArray(fromArray) && fromArray.length > 0
      ? fromArray
      : payload.produitId || payload.productId
        ? [payload]
        : [];

  return sourceItems
    .map((item) => ({
      productId: String(item.produitId || item.productId || '').trim(),
      quantity: Math.max(1, Number(item.quantite || item.quantity || 1))
    }))
    .filter((item) => item.productId);
}

function mapOrderRow(row) {
  const rawItems = Array.isArray(row.items) ? row.items : [];
  const shippingAddress = row.shipping_address || null;

  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || 'Client',
    userEmail: row.user_email || '',
    userPhone: row.user_phone || '',
    status: row.status,
    total: Number(row.total_amount),
    currency: row.currency || 'EUR',
    estimatedDeliveryAt: row.estimated_delivery_at,
    deliveredAt: row.delivered_at,
    shippingAddress,
    shippingCity: shippingAddress?.city || '',
    shippingAddressText: [
      shippingAddress?.street,
      [shippingAddress?.postalCode, shippingAddress?.city].filter(Boolean).join(' '),
      shippingAddress?.country
    ]
      .filter(Boolean)
      .join(', '),
    paymentStatus: row.payment_status,
    paymentMethod: row.payment_method || 'card',
    items: rawItems.map((item) => ({
      id: item.id,
      productId: item.productId,
      title: item.title,
      productName: item.title,
      price: Number(item.price),
      unitPrice: Number(item.price),
      quantity: Number(item.quantity),
      vendorId: item.vendorId,
      image: item.image || ''
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function fetchUserContact(userId) {
  const pool = getPostgresPool();
  const result = await pool.query(
    `
      SELECT id, username, email, phone
      FROM user_accounts
      WHERE id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function sendOrderNotification({
  type,
  orderId,
  userId,
  userEmail,
  userName,
  total,
  requestId
}) {
  if (!userEmail) {
    return;
  }

  await internalFetch({
    baseUrl: config.userServiceUrl,
    path: '/internal/notifications/email',
    method: 'POST',
    body: {
      type,
      to: userEmail,
      templateData: {
        userId,
        userName: userName || 'Client',
        orderId,
        total
      }
    },
    callerService: 'order-service',
    secret: config.internalSharedSecret,
    requestId,
    timeoutMs: config.internalFetchTimeoutMs
  }).catch(() => undefined);
}

function mapOrderForRole(row, role, authUserId) {
  const mapped = mapOrderRow(row);
  if (role !== 'vendor') {
    return mapped;
  }

  const vendorItems = mapped.items.filter((item) => item.vendorId === authUserId);
  return {
    ...mapped,
    items: vendorItems,
    total: vendorItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  };
}

async function insertOrderStatusHistory(queryable, { orderId, fromStatus, toStatus, actorType, actorId, metadata }) {
  await queryable.query(
    `
      INSERT INTO order_status_history (order_id, from_status, to_status, actor_type, actor_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `,
    [
      orderId,
      fromStatus ?? null,
      toStatus,
      actorType,
      actorId ?? null,
      metadata != null ? JSON.stringify(metadata) : null
    ]
  );
}

async function loadStatusHistoryForOrder(pool, orderId, limit = 20) {
  const r = await pool.query(
    `
      SELECT
        id::text AS id,
        from_status AS "fromStatus",
        to_status AS "toStatus",
        actor_type AS "actorType",
        actor_id AS "actorId",
        metadata,
        created_at AS "createdAt"
      FROM order_status_history
      WHERE order_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [orderId, limit]
  );
  return r.rows;
}

async function fetchProduct(productId, requestId) {
  const response = await internalFetch({
    baseUrl: config.productServiceUrl,
    path: `/produits/${encodeURIComponent(productId)}`,
    method: 'GET',
    callerService: 'order-service',
    secret: config.internalSharedSecret,
    requestId,
    timeoutMs: config.internalFetchTimeoutMs
  });

  if (!response.ok || !response.payload?.data) {
    throw {
      status: 422,
      code: 'PRODUCT_NOT_FOUND',
      publicMessage: `Produit introuvable: ${productId}`
    };
  }
  return response.payload.data;
}

async function reserveProductStock({ productId, quantity, requestId }) {
  const response = await internalFetch({
    baseUrl: config.productServiceUrl,
    path: `/internal/produits/${encodeURIComponent(productId)}/reserve`,
    method: 'POST',
    body: { quantity },
    callerService: 'order-service',
    secret: config.internalSharedSecret,
    requestId,
    timeoutMs: config.internalFetchTimeoutMs
  });

  if (!response.ok) {
    throw {
      status: response.status || 409,
      code: response.payload?.error?.code || 'STOCK_RESERVE_FAILED',
      publicMessage: response.payload?.error?.message || `Impossible de réserver le stock du produit ${productId}`
    };
  }
}

async function releaseProductStock({ productId, quantity, requestId }) {
  await internalFetch({
    baseUrl: config.productServiceUrl,
    path: `/internal/produits/${encodeURIComponent(productId)}/release`,
    method: 'POST',
    body: { quantity },
    callerService: 'order-service',
    secret: config.internalSharedSecret,
    requestId,
    timeoutMs: config.internalFetchTimeoutMs
  });
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));
  app.use(requestIdMiddleware);

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: { service: 'order-service', status: 'ok' },
      requestId: req.requestId
    });
  });

  app.get('/', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'order-service',
        port: config.port,
        message: 'Internal microservice. Do not call directly from clients.',
        usage: {
          apiCalls: 'Use http://localhost:3000/api/v1/... for client/API requests (via gateway)',
          healthCheck: `Use http://localhost:${config.port}/health for liveness`,
          businessRoutes: 'Direct business routes require x-internal-* signed headers (gateway only)'
        },
        requestId: req.requestId
      },
      requestId: req.requestId
    });
  });

  app.use(
    createInternalAuthMiddleware({
      secret: config.internalSharedSecret,
      allowedServices: ['gateway']
    })
  );

  const handlePostCommande = async (req, res, next) => {
    const userId = String(req.headers['x-auth-user-id'] || '').trim();
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentification requise'
        },
        requestId: req.requestId
      });
    }

    const rawItems = parseOrderItems(req.body || {});
    if (rawItems.length === 0) {
      const hasPayload =
        (Array.isArray(req.body?.articles) && req.body.articles.length > 0) ||
        (Array.isArray(req.body?.items) && req.body.items.length > 0);
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: hasPayload
            ? 'Chaque article doit avoir un productId valide et une quantité (articles[].productId / quantité).'
            : 'articles ou items non vides requis dans le corps JSON.'
        },
        requestId: req.requestId
      });
    }

    const reservedItems = [];
    try {
      const enrichedItems = [];
      for (const rawItem of rawItems) {
        const product = await fetchProduct(rawItem.productId, req.requestId);
        if (String(product.status || 'published') === 'archived') {
          throw {
            status: 409,
            code: 'PRODUCT_ARCHIVED',
            publicMessage: `Produit indisponible: ${rawItem.productId}`
          };
        }

        await reserveProductStock({
          productId: rawItem.productId,
          quantity: rawItem.quantity,
          requestId: req.requestId
        });
        reservedItems.push({
          productId: rawItem.productId,
          quantity: rawItem.quantity
        });

        enrichedItems.push({
          productId: rawItem.productId,
          title: String(product.title || 'Produit'),
          price: Number(product.price || 0),
          quantity: rawItem.quantity,
          vendorId: String(product.vendorId || ''),
          image: String(product.image || '')
        });
      }

      const orderId = randomId('ord');
      const estimatedDeliveryAt = estimateDeliveryIso();
      const total = enrichedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const shippingAddress = req.body?.adresseLivraison || req.body?.shippingAddress || {};
      const paymentMethod = String(req.body?.methodePaiement || req.body?.paymentMethod || 'card');

      const pool = getPostgresPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `
            INSERT INTO orders (
              id,
              user_id,
              status,
              total_amount,
              currency,
              estimated_delivery_at,
              shipping_address,
              payment_status,
              payment_method
            )
            VALUES ($1, $2, 'confirmed', $3, 'EUR', $4, $5::jsonb, 'authorized', $6)
          `,
          [orderId, userId, total, estimatedDeliveryAt, JSON.stringify(shippingAddress), paymentMethod]
        );

        for (const item of enrichedItems) {
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
                image_url
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `,
            [
              randomId('orditm'),
              orderId,
              item.productId,
              item.title,
              item.price,
              item.quantity,
              item.vendorId,
              item.image
            ]
          );
        }

        await client.query(
          `
            INSERT INTO payment_attempts (id, order_id, provider, amount, currency, status, provider_ref)
            VALUES ($1, $2, 'mock', $3, 'EUR', 'authorized', $4)
          `,
          [randomId('pay'), orderId, total, randomId('provider')]
        );
        await insertOrderStatusHistory(client, {
          orderId,
          fromStatus: null,
          toStatus: 'confirmed',
          actorType: 'user',
          actorId: userId,
          metadata: { source: 'checkout' }
        });
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }

      const userContact = await fetchUserContact(userId);
      await sendOrderNotification({
        type: 'order_confirmation',
        orderId,
        userId,
        userEmail: userContact?.email,
        userName: userContact?.username,
        total,
        requestId: req.requestId
      });

      return res.status(201).json({
        success: true,
        data: {
          id: orderId,
          userId,
          status: 'confirmed',
          estimatedDeliveryAt,
          total,
          shippingAddress,
          paymentMethod,
          items: enrichedItems.map((item) => ({
            productId: item.productId,
            title: item.title,
            productName: item.title,
            price: item.price,
            unitPrice: item.price,
            quantity: item.quantity,
            vendorId: item.vendorId,
            image: item.image
          }))
        },
        requestId: req.requestId
      });
    } catch (error) {
      await Promise.all(
        reservedItems.map((item) =>
          releaseProductStock({
            productId: item.productId,
            quantity: item.quantity,
            requestId: req.requestId
          }).catch(() => undefined)
        )
      );
      return next(error);
    }
  };

  app.post('/commandes', handlePostCommande);
  app.post('/api/v1/commandes', handlePostCommande);

  app.get('/commandes', async (req, res, next) => {
    try {
      const authUserId = String(req.headers['x-auth-user-id'] || '').trim();
      const role = String(req.headers['x-auth-role'] || '').trim();
      if (role !== 'admin' && !authUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentification requise' },
          requestId: req.requestId
        });
      }
      const statusFilter = String(req.query.status || '').trim();
      const page = Math.max(Number(req.query.page || 1), 1);
      const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
      const offset = (page - 1) * limit;

      const values = [];
      const conditions = [];

      if (statusFilter && ORDER_STATUSES.includes(statusFilter)) {
        values.push(statusFilter);
        conditions.push(`o.status = $${values.length}`);
      }

      if (role === 'vendor') {
        values.push(authUserId);
        conditions.push(`EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.vendor_id = $${values.length})`);
      } else if (role !== 'admin') {
        values.push(authUserId);
        conditions.push(`o.user_id = $${values.length}`);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const pool = getPostgresPool();

      values.push(limit);
      values.push(offset);
      const listResult = await pool.query(
        `
          SELECT
            o.*,
            u.username AS user_name,
            u.email AS user_email,
            u.phone AS user_phone,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', i.id,
                  'productId', i.product_id,
                  'title', i.product_title,
                  'price', i.unit_price,
                  'quantity', i.quantity,
                  'vendorId', i.vendor_id,
                  'image', i.image_url
                )
              ) FILTER (WHERE i.id IS NOT NULL),
              '[]'::json
            ) AS items
          FROM orders o
          LEFT JOIN user_accounts u ON u.id = o.user_id
          LEFT JOIN order_items i ON i.order_id = o.id
          ${whereClause}
          GROUP BY o.id, u.username, u.email, u.phone
          ORDER BY o.created_at DESC
          LIMIT $${values.length - 1}
          OFFSET $${values.length}
        `,
        values
      );

      const countValues = values.slice(0, values.length - 2);
      const countResult = await pool.query(
        `
          SELECT COUNT(*)::int AS count
          FROM orders o
          ${whereClause}
        `,
        countValues
      );
      const total = Number(countResult.rows[0]?.count || 0);

      return res.status(200).json({
        success: true,
        data: {
          items: listResult.rows.map((row) => mapOrderForRole(row, role, authUserId)),
          pagination: {
            page,
            limit,
            total
          }
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/commandes/:orderId', async (req, res, next) => {
    try {
      const orderId = String(req.params.orderId || '').trim();
      const authUserId = String(req.headers['x-auth-user-id'] || '').trim();
      const role = String(req.headers['x-auth-role'] || '').trim();
      if (role !== 'admin' && !authUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentification requise' },
          requestId: req.requestId
        });
      }
      const pool = getPostgresPool();

      const result = await pool.query(
        `
          SELECT
            o.*,
            u.username AS user_name,
            u.email AS user_email,
            u.phone AS user_phone,
            COALESCE(
              json_agg(
                json_build_object(
                  'id', i.id,
                  'productId', i.product_id,
                  'title', i.product_title,
                  'price', i.unit_price,
                  'quantity', i.quantity,
                  'vendorId', i.vendor_id,
                  'image', i.image_url
                )
              ) FILTER (WHERE i.id IS NOT NULL),
              '[]'::json
            ) AS items
          FROM orders o
          LEFT JOIN user_accounts u ON u.id = o.user_id
          LEFT JOIN order_items i ON i.order_id = o.id
          WHERE o.id = $1
          GROUP BY o.id, u.username, u.email, u.phone
          LIMIT 1
        `,
        [orderId]
      );
      const order = result.rows[0];
      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' },
          requestId: req.requestId
        });
      }

      if (role === 'vendor') {
        const vendorOwns = Array.isArray(order.items) && order.items.some((item) => item.vendorId === authUserId);
        if (!vendorOwns) {
          return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Commande non autorisée pour ce vendeur' },
            requestId: req.requestId
          });
        }
      } else if (role !== 'admin' && order.user_id !== authUserId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Commande non autorisée' },
          requestId: req.requestId
        });
      }

      let statusHistory = [];
      try {
        statusHistory = await loadStatusHistoryForOrder(pool, orderId, 20);
      } catch {
        statusHistory = [];
      }

      return res.status(200).json({
        success: true,
        data: {
          ...mapOrderForRole(order, role, authUserId),
          statusHistory
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.put('/commandes/:orderId/annuler', async (req, res, next) => {
    try {
      const orderId = String(req.params.orderId || '').trim();
      const authUserId = String(req.headers['x-auth-user-id'] || '').trim();
      const role = String(req.headers['x-auth-role'] || '').trim();
      if (role !== 'admin' && !authUserId) {
        return res.status(401).json({
          success: false,
          error: { code: 'AUTH_REQUIRED', message: 'Authentification requise' },
          requestId: req.requestId
        });
      }
      const pool = getPostgresPool();

      const details = await pool.query(
        `
          SELECT
            o.id,
            o.user_id,
            o.status,
            COALESCE(
              json_agg(
                json_build_object(
                  'productId', i.product_id,
                  'quantity', i.quantity
                )
              ) FILTER (WHERE i.id IS NOT NULL),
              '[]'::json
            ) AS items
          FROM orders o
          LEFT JOIN order_items i ON i.order_id = o.id
          WHERE o.id = $1
          GROUP BY o.id
          LIMIT 1
        `,
        [orderId]
      );
      const order = details.rows[0];
      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' },
          requestId: req.requestId
        });
      }

      if (role !== 'admin' && order.user_id !== authUserId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Annulation non autorisée' },
          requestId: req.requestId
        });
      }

      if (!CANCELLABLE_STATUSES.has(order.status)) {
        return res.status(409).json({
          success: false,
          error: { code: 'ORDER_CANNOT_BE_CANCELLED', message: 'La commande ne peut plus être annulée' },
          requestId: req.requestId
        });
      }

      const cancelClient = await pool.connect();
      try {
        await cancelClient.query('BEGIN');
        await cancelClient.query(
          `
            UPDATE orders
            SET status = 'cancelled',
                updated_at = NOW()
            WHERE id = $1
          `,
          [orderId]
        );
        await insertOrderStatusHistory(cancelClient, {
          orderId,
          fromStatus: order.status,
          toStatus: 'cancelled',
          actorType: role === 'admin' ? 'system' : 'user',
          actorId: authUserId,
          metadata: null
        });
        await cancelClient.query('COMMIT');
      } catch (e) {
        await cancelClient.query('ROLLBACK');
        throw e;
      } finally {
        cancelClient.release();
      }

      const releaseItems = (Array.isArray(order.items) ? order.items : []).filter(
        (item) => String(item.productId || '').trim() && Number(item.quantity || 0) > 0
      );
      await Promise.all(
        releaseItems.map((item) =>
          releaseProductStock({
            productId: String(item.productId || ''),
            quantity: Number(item.quantity || 0),
            requestId: req.requestId
          }).catch(() => undefined)
        )
      );

      return res.status(200).json({
        success: true,
        data: {
          id: orderId,
          status: 'cancelled'
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.put('/commandes/:orderId/statut', async (req, res, next) => {
    try {
      const orderId = String(req.params.orderId || '').trim();
      const nextStatus = String(req.body?.status || '').trim();
      const role = String(req.headers['x-auth-role'] || '').trim();
      const authUserId = String(req.headers['x-auth-user-id'] || '').trim();

      if (!ORDER_STATUSES.includes(nextStatus)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: 'Statut invalide'
          },
          requestId: req.requestId
        });
      }

      if (!['admin', 'vendor'].includes(role)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Mise à jour statut réservée aux vendeurs/admin'
          },
          requestId: req.requestId
        });
      }

      const pool = getPostgresPool();
      if (role === 'vendor') {
        const ownerCheck = await pool.query(
          `
            SELECT 1
            FROM order_items
            WHERE order_id = $1
              AND vendor_id = $2
            LIMIT 1
          `,
          [orderId, authUserId]
        );
        if (!ownerCheck.rowCount) {
          return res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Commande non autorisée pour ce vendeur'
            },
            requestId: req.requestId
          });
        }
      }

      const currentRow = await pool.query(`SELECT status FROM orders WHERE id = $1 LIMIT 1`, [orderId]);
      if (!currentRow.rowCount) {
        return res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' },
          requestId: req.requestId
        });
      }
      const previousStatus = String(currentRow.rows[0].status || '');
      if (previousStatus === nextStatus) {
        return res.status(200).json({
          success: true,
          data: {
            id: orderId,
            status: nextStatus
          },
          requestId: req.requestId
        });
      }

      const actorType = role === 'admin' ? 'system' : 'vendor';
      const stClient = await pool.connect();
      let updated;
      try {
        await stClient.query('BEGIN');
        updated = await stClient.query(
          `
            UPDATE orders
            SET status = $2,
                delivered_at = CASE WHEN $2 = 'delivered' THEN NOW() ELSE delivered_at END,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, status, user_id, total_amount
          `,
          [orderId, nextStatus]
        );
        if (!updated.rowCount) {
          await stClient.query('ROLLBACK');
          return res.status(404).json({
            success: false,
            error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' },
            requestId: req.requestId
          });
        }
        await insertOrderStatusHistory(stClient, {
          orderId,
          fromStatus: previousStatus,
          toStatus: nextStatus,
          actorType,
          actorId: authUserId || null,
          metadata: null
        });
        await stClient.query('COMMIT');
      } catch (e) {
        await stClient.query('ROLLBACK');
        throw e;
      } finally {
        stClient.release();
      }

      if (nextStatus === 'delivered') {
        const updatedOrder = updated.rows[0];
        const userContact = await fetchUserContact(updatedOrder.user_id);
        await sendOrderNotification({
          type: 'order_delivered',
          orderId,
          userId: updatedOrder.user_id,
          userEmail: userContact?.email,
          userName: userContact?.username,
          total: Number(updatedOrder.total_amount || 0),
          requestId: req.requestId
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          id: orderId,
          status: nextStatus
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = {
  createApp
};
