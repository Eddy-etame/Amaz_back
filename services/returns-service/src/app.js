const express = require('express');

const { requestIdMiddleware } = require('../../../shared/middleware/request-id');
const { createInternalAuthMiddleware } = require('../../../shared/middleware/internal-auth');
const { errorHandler, notFoundHandler } = require('../../../shared/middleware/error-handler');
const { getPostgresPool } = require('../../../shared/db/postgres');
const { randomId } = require('../../../shared/utils/ids');
const { config } = require('./config');

const RETURN_STATUSES = ['open', 'approved', 'rejected', 'received', 'refunded'];

function mapReturnRow(row, items) {
  return {
    id: row.id,
    orderId: row.order_id,
    userId: row.user_id,
    vendorId: row.vendor_id,
    userName: row.user_name || 'Client',
    reason: row.reason,
    qrReference: row.qr_reference,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (items || []).map((it) => ({
      productId: it.product_id,
      productName: it.product_name,
      quantity: Number(it.quantity)
    }))
  };
}

async function insertReturnStatusHistory(queryable, { returnId, fromStatus, toStatus, actorType, actorId }) {
  await queryable.query(
    `
      INSERT INTO return_status_history (return_id, from_status, to_status, actor_type, actor_id)
      VALUES ($1, $2, $3, $4, $5)
    `,
    [returnId, fromStatus ?? null, toStatus, actorType, actorId ?? null]
  );
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: { service: 'returns-service', status: 'ok' },
      requestId: req.requestId
    });
  });

  app.get('/', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'returns-service',
        port: config.port,
        message: 'Internal microservice. Do not call directly from clients.',
        usage: {
          apiCalls: 'Use http://localhost:3000/api/v1/retours for client requests (via gateway)',
          healthCheck: `Use http://localhost:${config.port}/health for liveness`
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

  app.get('/retours', async (req, res, next) => {
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

      if (statusFilter && RETURN_STATUSES.includes(statusFilter)) {
        values.push(statusFilter);
        conditions.push(`r.status = $${values.length}`);
      }

      if (role === 'vendor') {
        values.push(authUserId);
        conditions.push(`r.vendor_id = $${values.length}`);
      } else if (role === 'user') {
        values.push(authUserId);
        conditions.push(`r.user_id = $${values.length}`);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const pool = getPostgresPool();

      values.push(limit, offset);
      const listResult = await pool.query(
        `
          SELECT
            r.*,
            u.username AS user_name
          FROM return_requests r
          LEFT JOIN user_accounts u ON u.id = r.user_id
          ${whereClause}
          ORDER BY r.created_at DESC
          LIMIT $${values.length - 1}
          OFFSET $${values.length}
        `,
        values
      );

      const countValues = values.slice(0, values.length - 2);
      const countResult = await pool.query(
        `
          SELECT COUNT(*)::int AS count
          FROM return_requests r
          ${whereClause}
        `,
        countValues
      );
      const total = Number(countResult.rows[0]?.count || 0);

      const rows = listResult.rows;
      const returnIds = rows.map((r) => r.id);
      let itemsByReturn = new Map();
      if (returnIds.length > 0) {
        const itemsRes = await pool.query(
          `
            SELECT return_id, product_id, product_name, quantity
            FROM return_items
            WHERE return_id = ANY($1::varchar[])
          `,
          [returnIds]
        );
        itemsByReturn = itemsRes.rows.reduce((acc, it) => {
          const list = acc.get(it.return_id) || [];
          list.push(it);
          acc.set(it.return_id, list);
          return acc;
        }, new Map());
      }

      return res.status(200).json({
        success: true,
        data: {
          items: rows.map((row) => mapReturnRow(row, itemsByReturn.get(row.id) || [])),
          pagination: { page, limit, total }
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/retours/:returnId', async (req, res, next) => {
    try {
      const returnId = String(req.params.returnId || '').trim();
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
          SELECT r.*, u.username AS user_name
          FROM return_requests r
          LEFT JOIN user_accounts u ON u.id = r.user_id
          WHERE r.id = $1
          LIMIT 1
        `,
        [returnId]
      );
      const row = result.rows[0];
      if (!row) {
        return res.status(404).json({
          success: false,
          error: { code: 'RETURN_NOT_FOUND', message: 'Retour introuvable' },
          requestId: req.requestId
        });
      }

      if (role === 'vendor' && row.vendor_id !== authUserId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Retour non autorisé pour ce vendeur' },
          requestId: req.requestId
        });
      }
      if (role === 'user' && row.user_id !== authUserId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Retour non autorisé' },
          requestId: req.requestId
        });
      }

      const itemsRes = await pool.query(
        `SELECT product_id, product_name, quantity FROM return_items WHERE return_id = $1`,
        [returnId]
      );

      return res.status(200).json({
        success: true,
        data: mapReturnRow(row, itemsRes.rows),
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/retours', async (req, res, next) => {
    try {
      const userId = String(req.headers['x-auth-user-id'] || '').trim();
      const role = String(req.headers['x-auth-role'] || '').trim();
      if (role !== 'user' || !userId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Seuls les clients peuvent créer un retour' },
          requestId: req.requestId
        });
      }

      const orderId = String(req.body?.orderId || '').trim();
      const reason = String(req.body?.reason || '').trim();
      const rawItems = Array.isArray(req.body?.items) ? req.body.items : [];

      if (!orderId || !reason) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'orderId et reason sont requis' },
          requestId: req.requestId
        });
      }

      const wanted = rawItems
        .map((it) => ({
          productId: String(it.productId || it.produitId || '').trim(),
          quantity: Math.max(1, Number(it.quantity || it.quantite || 1))
        }))
        .filter((it) => it.productId);

      if (wanted.length === 0) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'items non vide requis' },
          requestId: req.requestId
        });
      }

      const pool = getPostgresPool();
      const orderCheck = await pool.query(`SELECT id, user_id FROM orders WHERE id = $1 LIMIT 1`, [orderId]);
      const order = orderCheck.rows[0];
      if (!order || order.user_id !== userId) {
        return res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' },
          requestId: req.requestId
        });
      }

      const linesRes = await pool.query(
        `
          SELECT product_id, product_title, quantity, vendor_id
          FROM order_items
          WHERE order_id = $1
        `,
        [orderId]
      );
      const lines = linesRes.rows;
      if (!lines.length) {
        return res.status(422).json({
          success: false,
          error: { code: 'ORDER_EMPTY', message: 'Commande sans articles' },
          requestId: req.requestId
        });
      }

      const lineByProduct = new Map(lines.map((l) => [l.product_id, l]));
      const vendorIds = new Set();
      for (const w of wanted) {
        const line = lineByProduct.get(w.productId);
        if (!line) {
          return res.status(422).json({
            success: false,
            error: { code: 'ITEM_NOT_IN_ORDER', message: `Produit absent de la commande: ${w.productId}` },
            requestId: req.requestId
          });
        }
        if (w.quantity > Number(line.quantity)) {
          return res.status(422).json({
            success: false,
            error: { code: 'INVALID_QUANTITY', message: `Quantité trop élevée pour ${w.productId}` },
            requestId: req.requestId
          });
        }
        vendorIds.add(line.vendor_id);
      }

      if (vendorIds.size !== 1) {
        return res.status(422).json({
          success: false,
          error: {
            code: 'MULTI_VENDOR_RETURN',
            message: 'Un retour ne peut porter que sur les articles d’un même vendeur'
          },
          requestId: req.requestId
        });
      }

      const vendorId = [...vendorIds][0];
      const returnId = randomId('ret');
      const qrReference = `QR-RET-${randomId('qr').slice(-8).toUpperCase()}`;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `
            INSERT INTO return_requests (id, order_id, user_id, vendor_id, reason, qr_reference, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'open')
          `,
          [returnId, orderId, userId, vendorId, reason, qrReference]
        );

        for (const w of wanted) {
          const line = lineByProduct.get(w.productId);
          await client.query(
            `
              INSERT INTO return_items (id, return_id, product_id, product_name, quantity)
              VALUES ($1, $2, $3, $4, $5)
            `,
            [randomId('ritm'), returnId, w.productId, line.product_title, w.quantity]
          );
        }

        await insertReturnStatusHistory(client, {
          returnId,
          fromStatus: null,
          toStatus: 'open',
          actorType: 'user',
          actorId: userId
        });

        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      const created = await pool.query(
        `
          SELECT r.*, u.username AS user_name
          FROM return_requests r
          LEFT JOIN user_accounts u ON u.id = r.user_id
          WHERE r.id = $1
        `,
        [returnId]
      );
      const itemsRes = await pool.query(
        `SELECT product_id, product_name, quantity FROM return_items WHERE return_id = $1`,
        [returnId]
      );

      return res.status(201).json({
        success: true,
        data: mapReturnRow(created.rows[0], itemsRes.rows),
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.put('/retours/:returnId/statut', async (req, res, next) => {
    try {
      const returnId = String(req.params.returnId || '').trim();
      const nextStatus = String(req.body?.status || '').trim();
      const role = String(req.headers['x-auth-role'] || '').trim();
      const authUserId = String(req.headers['x-auth-user-id'] || '').trim();

      if (!RETURN_STATUSES.includes(nextStatus)) {
        return res.status(400).json({
          success: false,
          error: { code: 'INVALID_STATUS', message: 'Statut invalide' },
          requestId: req.requestId
        });
      }

      if (!['admin', 'vendor'].includes(role)) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Mise à jour réservée aux vendeurs/admin' },
          requestId: req.requestId
        });
      }

      const pool = getPostgresPool();
      const cur = await pool.query(`SELECT status, vendor_id FROM return_requests WHERE id = $1 LIMIT 1`, [
        returnId
      ]);
      if (!cur.rowCount) {
        return res.status(404).json({
          success: false,
          error: { code: 'RETURN_NOT_FOUND', message: 'Retour introuvable' },
          requestId: req.requestId
        });
      }

      const prev = String(cur.rows[0].status || '');
      if (role === 'vendor' && cur.rows[0].vendor_id !== authUserId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Retour non autorisé pour ce vendeur' },
          requestId: req.requestId
        });
      }

      if (prev === nextStatus) {
        return res.status(200).json({
          success: true,
          data: { id: returnId, status: nextStatus },
          requestId: req.requestId
        });
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `
            UPDATE return_requests
            SET status = $1, updated_at = NOW()
            WHERE id = $2
          `,
          [nextStatus, returnId]
        );
        await insertReturnStatusHistory(client, {
          returnId,
          fromStatus: prev,
          toStatus: nextStatus,
          actorType: role === 'admin' ? 'admin' : 'vendor',
          actorId: authUserId
        });
        await client.query('COMMIT');
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }

      return res.status(200).json({
        success: true,
        data: { id: returnId, status: nextStatus },
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
