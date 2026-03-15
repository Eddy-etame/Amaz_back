const express = require('express');

const { requestIdMiddleware } = require('../../../shared/middleware/request-id');
const { createInternalAuthMiddleware } = require('../../../shared/middleware/internal-auth');
const { errorHandler, notFoundHandler } = require('../../../shared/middleware/error-handler');
const { getMongoDb } = require('../../../shared/db/mongo');
const { randomId } = require('../../../shared/utils/ids');
const { config } = require('./config');

async function getCollections() {
  const db = await getMongoDb();
  return {
    products: db.collection('products'),
    aiLogs: db.collection('ai_logs')
  };
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'ai-service',
        status: 'ok'
      },
      requestId: req.requestId
    });
  });

  app.get('/', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'ai-service',
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

  app.post('/ai/recommendations', async (req, res, next) => {
    try {
      const query = String(req.body?.requete || req.body?.query || '').trim();
      const role = String(req.headers['x-auth-role'] || 'user');
      const userId = String(req.headers['x-auth-user-id'] || '');
      const { products, aiLogs } = await getCollections();

      const filter = query
        ? {
            $or: [
              { title: { $regex: query, $options: 'i' } },
              { description: { $regex: query, $options: 'i' } },
              { category: { $regex: query, $options: 'i' } }
            ]
          }
        : {};
      const items = await products
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(8)
        .toArray();

      const recommendations = items.map((item) => ({
        id: item.id || item._id?.toString(),
        title: item.title,
        price: item.price,
        category: item.category,
        image: item.image
      }));

      await aiLogs.insertOne({
        id: randomId('ailog'),
        userId,
        role,
        query,
        recommendationCount: recommendations.length,
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({
        success: true,
        data: {
          recommendations
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  app.post('/bot/auth', async (req, res, next) => {
    try {
      const state = String(req.body?.etat || '').trim();
      const action = String(req.body?.action || '').trim();
      const riskSignals = ['bruteforce', 'fraud', 'blocked', 'abuse'];
      const allow = !riskSignals.some((signal) => `${state} ${action}`.toLowerCase().includes(signal));
      const score = allow ? 0.2 : 0.9;

      const { aiLogs } = await getCollections();
      await aiLogs.insertOne({
        id: randomId('ailog'),
        userId: String(req.headers['x-auth-user-id'] || ''),
        role: String(req.headers['x-auth-role'] || 'user'),
        type: 'bot-auth',
        state,
        action,
        allow,
        score,
        createdAt: new Date().toISOString()
      });

      return res.status(200).json({
        success: true,
        data: {
          allow,
          score
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
