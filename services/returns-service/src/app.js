// returns-service — flux de retours (acheteur crée, vendeur/admin traite).
//
// Converti de PostgreSQL vers MySQL (mysql2) pour rester cohérent avec le reste du
// backend : placeholders `?`, `IN (?)` (mysql2 développe un tableau), résultats sous la
// forme `const [rows] = await pool.query(...)`, transactions via getConnection()/
// beginTransaction()/commit()/rollback().

const express = require('express');

const { requestIdMiddleware } = require('../../../shared/middleware/request-id');
const { createInternalAuthMiddleware } = require('../../../shared/middleware/internal-auth');
const { errorHandler, notFoundHandler } = require('../../../shared/middleware/error-handler');
const { getMysqlPool } = require('../../../shared/db/mysql');
const { randomId } = require('../../../shared/utils/ids');
const { config } = require('./config');

const RETURN_STATUSES = ['open', 'approved', 'rejected', 'received', 'refunded'];

// Met une ligne SQL (snake_case) + ses articles au format renvoyé au front.
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

// Ajoute une ligne d'historique de statut. `queryable` peut être le pool ou une
// connexion de transaction (les deux exposent .query en mysql2).
async function insertReturnStatusHistory(queryable, { returnId, fromStatus, toStatus, actorType, actorId }) {
  await queryable.query(
    `INSERT INTO return_status_history (return_id, from_status, to_status, actor_type, actor_id)
     VALUES (?, ?, ?, ?, ?)`,
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

  // Toutes les routes métier exigent une signature interne de la gateway.
  app.use(
    createInternalAuthMiddleware({
      secret: config.internalSharedSecret,
      allowedServices: ['gateway']
    })
  );

  // Liste des retours, filtrée par rôle (vendeur voit les siens, acheteur les siens, admin tout).
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

      // On construit dynamiquement les conditions WHERE + leurs paramètres `?`.
      const values = [];
      const conditions = [];

      if (statusFilter && RETURN_STATUSES.includes(statusFilter)) {
        values.push(statusFilter);
        conditions.push(`r.status = ?`);
      }
      if (role === 'vendor') {
        values.push(authUserId);
        conditions.push(`r.vendor_id = ?`);
      } else if (role === 'user') {
        values.push(authUserId);
        conditions.push(`r.user_id = ?`);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const pool = getMysqlPool();

      // Total (mêmes conditions, sans limit/offset).
      const [countRows] = await pool.query(
        `SELECT COUNT(*) AS count FROM return_requests r ${whereClause}`,
        values
      );
      const total = Number(countRows[0]?.count || 0);

      // Page de résultats.
      const [rows] = await pool.query(
        `SELECT r.*, u.username AS user_name
         FROM return_requests r
         LEFT JOIN user_accounts u ON u.id = r.user_id
         ${whereClause}
         ORDER BY r.created_at DESC
         LIMIT ? OFFSET ?`,
        [...values, limit, offset]
      );

      // Articles des retours de la page (un seul appel via IN (?)).
      const returnIds = rows.map((r) => r.id);
      let itemsByReturn = new Map();
      if (returnIds.length > 0) {
        const [itemRows] = await pool.query(
          `SELECT return_id, product_id, product_name, quantity
           FROM return_items
           WHERE return_id IN (?)`,
          [returnIds]
        );
        itemsByReturn = itemRows.reduce((acc, it) => {
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

  // Détail d'un retour (avec contrôle d'accès par rôle).
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

      const pool = getMysqlPool();
      const [rows] = await pool.query(
        `SELECT r.*, u.username AS user_name
         FROM return_requests r
         LEFT JOIN user_accounts u ON u.id = r.user_id
         WHERE r.id = ?
         LIMIT 1`,
        [returnId]
      );
      const row = rows[0];
      if (!row) {
        return res.status(404).json({
          success: false,
          error: { code: 'RETURN_NOT_FOUND', message: 'Retour introuvable' },
          requestId: req.requestId
        });
      }

      // Un vendeur ne voit que ses retours ; un acheteur que les siens.
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

      const [itemRows] = await pool.query(
        `SELECT product_id, product_name, quantity FROM return_items WHERE return_id = ?`,
        [returnId]
      );

      return res.status(200).json({
        success: true,
        data: mapReturnRow(row, itemRows),
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  // Création d'un retour par un acheteur.
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

      // On accepte les clés FR (produitId/quantite) ou EN (productId/quantity).
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

      const pool = getMysqlPool();
      // La commande doit exister ET appartenir à l'acheteur.
      const [orderRows] = await pool.query(`SELECT id, user_id FROM orders WHERE id = ? LIMIT 1`, [orderId]);
      const order = orderRows[0];
      if (!order || order.user_id !== userId) {
        return res.status(404).json({
          success: false,
          error: { code: 'ORDER_NOT_FOUND', message: 'Commande introuvable' },
          requestId: req.requestId
        });
      }

      const [lines] = await pool.query(
        `SELECT product_id, product_title, quantity, vendor_id FROM order_items WHERE order_id = ?`,
        [orderId]
      );
      if (!lines.length) {
        return res.status(422).json({
          success: false,
          error: { code: 'ORDER_EMPTY', message: 'Commande sans articles' },
          requestId: req.requestId
        });
      }

      // Chaque article demandé doit être dans la commande, en quantité suffisante,
      // et tous doivent venir du MÊME vendeur (un retour = un vendeur).
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

      // Écriture transactionnelle : la demande + ses articles + l'historique, tout ou rien.
      const client = await pool.getConnection();
      try {
        await client.beginTransaction();
        await client.query(
          `INSERT INTO return_requests (id, order_id, user_id, vendor_id, reason, qr_reference, status)
           VALUES (?, ?, ?, ?, ?, ?, 'open')`,
          [returnId, orderId, userId, vendorId, reason, qrReference]
        );

        for (const w of wanted) {
          const line = lineByProduct.get(w.productId);
          await client.query(
            `INSERT INTO return_items (id, return_id, product_id, product_name, quantity)
             VALUES (?, ?, ?, ?, ?)`,
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

        await client.commit();
      } catch (e) {
        await client.rollback();
        throw e;
      } finally {
        client.release();
      }

      const [createdRows] = await pool.query(
        `SELECT r.*, u.username AS user_name
         FROM return_requests r
         LEFT JOIN user_accounts u ON u.id = r.user_id
         WHERE r.id = ?`,
        [returnId]
      );
      const [createdItems] = await pool.query(
        `SELECT product_id, product_name, quantity FROM return_items WHERE return_id = ?`,
        [returnId]
      );

      return res.status(201).json({
        success: true,
        data: mapReturnRow(createdRows[0], createdItems),
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  // Mise à jour du statut d'un retour (vendeur/admin uniquement).
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

      const pool = getMysqlPool();
      const [curRows] = await pool.query(
        `SELECT status, vendor_id FROM return_requests WHERE id = ? LIMIT 1`,
        [returnId]
      );
      if (!curRows.length) {
        return res.status(404).json({
          success: false,
          error: { code: 'RETURN_NOT_FOUND', message: 'Retour introuvable' },
          requestId: req.requestId
        });
      }

      const prev = String(curRows[0].status || '');
      if (role === 'vendor' && curRows[0].vendor_id !== authUserId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Retour non autorisé pour ce vendeur' },
          requestId: req.requestId
        });
      }

      // Pas de changement réel : on répond OK sans rien écrire.
      if (prev === nextStatus) {
        return res.status(200).json({
          success: true,
          data: { id: returnId, status: nextStatus },
          requestId: req.requestId
        });
      }

      const client = await pool.getConnection();
      try {
        await client.beginTransaction();
        await client.query(
          `UPDATE return_requests SET status = ?, updated_at = NOW() WHERE id = ?`,
          [nextStatus, returnId]
        );
        await insertReturnStatusHistory(client, {
          returnId,
          fromStatus: prev,
          toStatus: nextStatus,
          actorType: role === 'admin' ? 'admin' : 'vendor',
          actorId: authUserId
        });
        await client.commit();
      } catch (e) {
        await client.rollback();
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
