// Micro-service IA : recommandations produits (recherche par mots-clés + complétion populaire, JAMAIS
// vide ; requête échappée anti-injection regex) et scoring anti-bot de /bot/auth. Base : MongoDB.
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

      // La requête vient de l'utilisateur : on échappe les caractères spéciaux des regex
      // pour éviter toute injection d'expression régulière côté MongoDB.
      const motCle = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matchFilter = query
        ? {
            $or: [
              { title: { $regex: motCle, $options: 'i' } },
              { description: { $regex: motCle, $options: 'i' } },
              { category: { $regex: motCle, $options: 'i' } }
            ]
          }
        : null;

      const LIMITE = 8;
      const matched = matchFilter
        ? await products.find(matchFilter).sort({ createdAt: -1 }).limit(LIMITE).toArray()
        : [];

      // Un moteur de recommandation ne doit jamais renvoyer une liste vide : si la recherche
      // par mot-clé ne suffit pas (terme inconnu ou requête vide), on complète avec les
      // produits les mieux notés puis les plus récents, sans doublon.
      let items = matched;
      if (items.length < LIMITE) {
        const dejaVus = items.map((p) => p.id).filter(Boolean);
        const complement = await products
          .find(dejaVus.length ? { id: { $nin: dejaVus } } : {})
          .sort({ rating: -1, createdAt: -1 })
          .limit(LIMITE - items.length)
          .toArray();
        items = items.concat(complement);
      }

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
