const express = require('express');

const { requestIdMiddleware } = require('../../../shared/middleware/request-id');
const { createInternalAuthMiddleware } = require('../../../shared/middleware/internal-auth');
const { errorHandler, notFoundHandler } = require('../../../shared/middleware/error-handler');
const { getMysqlPool } = require('../../../shared/db/mysql');
const { randomId } = require('../../../shared/utils/ids');
const { internalFetch } = require('../../../shared/utils/internal-http');
const { config } = require('./config');

const ORDER_STATUSES = ['confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];
const CANCELLABLE_STATUSES = new Set(['confirmed', 'preparing']);

// Date de livraison estimée : entre 3 et 7 jours (valeur de démo, pas de vrai transporteur).
function estimateDeliveryIso() {
  const days = 3 + Math.floor(Math.random() * 5);
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString();
}

// Normalise les articles de la commande : on accepte plusieurs formes de payload
// (items / articles, ou un produit unique) et on écarte ceux sans productId.
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

// Transforme une ligne SQL en objet commande pour le front. Les champs items et
// shipping_address sont stockés en JSON texte : on les parse en se protégeant des erreurs.
function mapOrderRow(row) {
  let rawItems = [];
  try {
    rawItems = typeof row.items === 'string' ? JSON.parse(row.items) : (Array.isArray(row.items) ? row.items : []);
  } catch {
    rawItems = [];
  }

  let shippingAddress = null;
  try {
    shippingAddress = typeof row.shipping_address === 'string'
      ? JSON.parse(row.shipping_address)
      : row.shipping_address || null;
  } catch {
    shippingAddress = null;
  }

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

// Récupère le contact de l'acheteur (pour la notification e-mail de la commande).
async function fetchUserContact(userId) {
  const pool = getMysqlPool();
  const [rows] = await pool.query(
    `SELECT id, username, email, phone FROM user_accounts WHERE id = ? LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

// Envoie l'e-mail de notification via le user-service (appel interne signé). Best-effort :
// le .catch() ignore l'échec pour ne pas bloquer la commande si l'e-mail ne part pas.
async function sendOrderNotification({
  type, orderId, userId, userEmail, userName, total, requestId
}) {
  if (!userEmail) return;

  await internalFetch({
    baseUrl: config.userServiceUrl,
    path: '/internal/notifications/email',
    method: 'POST',
    body: {
      type,
      to: userEmail,
      templateData: { userId, userName: userName || 'Client', orderId, total }
    },
    callerService: 'order-service',
    secret: config.internalSharedSecret,
    requestId,
    timeoutMs: config.internalFetchTimeoutMs
  }).catch(() => undefined);
}

// Vue de la commande selon le rôle : un vendeur ne voit QUE ses propres articles
// (filtrés par vendorId), avec un total recalculé sur ces articles — pas la commande entière.
function mapOrderForRole(row, role, authUserId) {
  const mapped = mapOrderRow(row);
  if (role !== 'vendor') return mapped;

  const vendorItems = mapped.items.filter((item) => item.vendorId === authUserId);
  return {
    ...mapped,
    items: vendorItems,
    total: vendorItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  };
}

async function insertOrderStatusHistory(connection, { orderId, fromStatus, toStatus, actorType, actorId, metadata }) {
  await connection.query(
    `
      INSERT INTO order_status_history (order_id, from_status, to_status, actor_type, actor_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
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
  const [rows] = await pool.query(
    `
      SELECT
        id AS id,
        from_status AS fromStatus,
        to_status AS toStatus,
        actor_type AS actorType,
        actor_id AS actorId,
        metadata,
        created_at AS createdAt
      FROM order_status_history
      WHERE order_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [orderId, limit]
  );
  return rows;
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
        error: { code: 'AUTH_REQUIRED', message: 'Authentification requise' },
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
            ? 'Chaque article doit avoir un productId valide et une quantité.'
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
        reservedItems.push({ productId: rawItem.productId, quantity: rawItem.quantity });

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

      const pool = getMysqlPool();
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute(
          `
            INSERT INTO orders (
              id, user_id, status, total_amount, currency,
              estimated_delivery_at, shipping_address, payment_status, payment_method
            )
            VALUES (?, ?, 'confirmed', ?, 'EUR', ?, ?, 'authorized', ?)
          `,
          [orderId, userId, total, estimatedDeliveryAt, JSON.stringify(shippingAddress), paymentMethod]
        );

        for (const item of enrichedItems) {
          await connection.execute(
            `
              INSERT INTO order_items (
                id, order_id, product_id, product_title,
                unit_price, quantity, vendor_id, image_url
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [randomId('orditm'), orderId, item.productId, item.title,
              item.price, item.quantity, item.vendorId, item.image]
          );
        }

        await connection.execute(
          `
            INSERT INTO payment_attempts (id, order_id, provider, amount, currency, status, provider_ref)
            VALUES (?, ?, 'mock', ?, 'EUR', 'authorized', ?)
          `,
          [randomId('pay'), orderId, total, randomId('provider')]
        );

        await insertOrderStatusHistory(connection, {
          orderId,
          fromStatus: null,
          toStatus: 'confirmed',
          actorType: 'user',
          actorId: userId,
          metadata: { source: 'checkout' }
        });

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
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
        conditions.push(`o.status = ?`);
      }

      if (role === 'vendor') {
        values.push(authUserId);
        conditions.push(`EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.vendor_id = ?)`);
      } else if (role !== 'admin') {
        values.push(authUserId);
        conditions.push(`o.user_id = ?`);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const pool = getMysqlPool();

      const [listRows] = await pool.query(
        `
          SELECT
            o.*,
            u.username AS user_name,
            u.email AS user_email,
            u.phone AS user_phone,
            COALESCE(
              JSON_ARRAYAGG(
                JSON_OBJECT(
                  'id', i.id,
                  'productId', i.product_id,
                  'title', i.product_title,
                  'price', i.unit_price,
                  'quantity', i.quantity,
                  'vendorId', i.vendor_id,
                  'image', i.image_url
                )
              ),
              JSON_ARRAY()
            ) AS items
          FROM orders o
          LEFT JOIN user_accounts u ON u.id = o.user_id
          LEFT JOIN order_items i ON i.order_id = o.id
          ${whereClause}
          GROUP BY o.id, u.username, u.email, u.phone
          ORDER BY o.created_at DESC
          LIMIT ? OFFSET ?
        `,
        [...values, limit, offset]
      );

      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS count FROM orders o ${whereClause}`,
        values
      );
      const total = Number(countRows[0]?.count || 0);

      return res.status(200).json({
        success: true,
        data: {
          items: listRows.map((row) => mapOrderForRole(row, role, authUserId)),
          pagination: { page, limit, total }
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

      const pool = getMysqlPool();
      const [rows] = await pool.query(
        `
          SELECT
            o.*,
            u.username AS user_name,
            u.email AS user_email,
            u.phone AS user_phone,
            COALESCE(
              JSON_ARRAYAGG(
                JSON_OBJECT(
                  'id', i.id,
                  'productId', i.product_id,
                  'title', i.product_title,
                  'price', i.unit_price,
                  'quantity', i.quantity,
                  'vendorId', i.vendor_id,
                  'image', i.image_url
                )
              ),
              JSON_ARRAY()
            ) AS items
          FROM orders o
          LEFT JOIN user_accounts u ON u.id = o.user_id
          LEFT JOIN order_items i ON i.order_id = o.id
          WHERE o.id = ?
          GROUP BY o.id, u.username, u.email, u.phone
          LIMIT 1
        `,
        [orderId]
      );

      const order = rows[0];
      if (!order) {
        return res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' },
          requestId: req.requestId
        });
      }

      if (role === 'vendor') {
        const parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
        const vendorOwns = Array.isArray(parsedItems) && parsedItems.some((item) => item.vendorId === authUserId);
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

      const pool = getMysqlPool();
      const [detailRows] = await pool.query(
        `
          SELECT
            o.id, o.user_id, o.status,
            COALESCE(
              JSON_ARRAYAGG(
                JSON_OBJECT('productId', i.product_id, 'quantity', i.quantity)
              ),
              JSON_ARRAY()
            ) AS items
          FROM orders o
          LEFT JOIN order_items i ON i.order_id = o.id
          WHERE o.id = ?
          GROUP BY o.id
          LIMIT 1
        `,
        [orderId]
      );

      const order = detailRows[0];
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

      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        await connection.execute(
          `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
          [orderId]
        );
        await insertOrderStatusHistory(connection, {
          orderId,
          fromStatus: order.status,
          toStatus: 'cancelled',
          actorType: role === 'admin' ? 'system' : 'user',
          actorId: authUserId,
          metadata: null
        });
        await connection.commit();
      } catch (e) {
        await connection.rollback();
        throw e;
      } finally {
        connection.release();
      }

      const parsedItems = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
      const releaseItems = (Array.isArray(parsedItems) ? parsedItems : []).filter(
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
        data: { id: orderId, status: 'cancelled' },
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
          error: { code: 'INVALID_STATUS', message: 'Statut invalide' },
          requestId: req.requestId
        });
      }

      if (!['admin', 'vendor'].includes(role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Mise à jour statut réservée aux vendeurs/admin' },
          requestId: req.requestId
        });
      }

      const pool = getMysqlPool();

      if (role === 'vendor') {
        const [ownerRows] = await pool.query(
          `SELECT 1 FROM order_items WHERE order_id = ? AND vendor_id = ? LIMIT 1`,
          [orderId, authUserId]
        );
        if (!ownerRows.length) {
          return res.status(403).json({
            success: false,
            error: { code: 'FORBIDDEN', message: 'Commande non autorisée pour ce vendeur' },
            requestId: req.requestId
          });
        }
      }

      const [currentRows] = await pool.query(
        `SELECT status FROM orders WHERE id = ? LIMIT 1`,
        [orderId]
      );
      if (!currentRows.length) {
        return res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' },
          requestId: req.requestId
        });
      }

      const previousStatus = String(currentRows[0].status || '');
      if (previousStatus === nextStatus) {
        return res.status(200).json({
          success: true,
          data: { id: orderId, status: nextStatus },
          requestId: req.requestId
        });
      }

      const actorType = role === 'admin' ? 'system' : 'vendor';
      const connection = await pool.getConnection();
      let updatedOrder = null;

      try {
        await connection.beginTransaction();
        await connection.execute(
          `
            UPDATE orders
            SET status = ?,
                delivered_at = CASE WHEN ? = 'delivered' THEN NOW() ELSE delivered_at END,
                updated_at = NOW()
            WHERE id = ?
          `,
          [nextStatus, nextStatus, orderId]
        );

        const [updatedRows] = await connection.execute(
          `SELECT id, status, user_id, total_amount FROM orders WHERE id = ? LIMIT 1`,
          [orderId]
        );

        if (!updatedRows.length) {
          await connection.rollback();
          return res.status(404).json({
            success: false,
            error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' },
            requestId: req.requestId
          });
        }

        updatedOrder = updatedRows[0];
        await insertOrderStatusHistory(connection, {
          orderId,
          fromStatus: previousStatus,
          toStatus: nextStatus,
          actorType,
          actorId: authUserId || null,
          metadata: null
        });

        await connection.commit();
      } catch (e) {
        await connection.rollback();
        throw e;
      } finally {
        connection.release();
      }

      if (nextStatus === 'delivered' && updatedOrder) {
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
        data: { id: orderId, status: nextStatus },
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

module.exports = { createApp };