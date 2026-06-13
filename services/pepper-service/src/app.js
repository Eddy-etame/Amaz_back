// Pepper-service : un microservice minuscule dont le SEUL rôle est d'appliquer le
// secret maître de "pepper".
//
// Tout l'intérêt : ce secret maître (`PEPPER_MASTER_SECRET`) ne vit QUE dans ce
// process. Le user-service lui envoie une valeur à pepperer et reçoit le résultat,
// mais ne connaît jamais le secret. Donc si la base ou le user-service fuit, le secret
// de pepper, lui, n'a pas fuité — il manque une pièce pour casser les mots de passe.
// C'est de la réduction de surface d'attaque (defense in depth).
//
// Le service est INTERNE : seul le user-service peut l'appeler, via une signature
// interne (cf. `createInternalAuthMiddleware`). Un client direct est rejeté.

const express = require('express');

const { requestIdMiddleware } = require('../../../shared/middleware/request-id');
const { createInternalAuthMiddleware } = require('../../../shared/middleware/internal-auth');
const { errorHandler, notFoundHandler } = require('../../../shared/middleware/error-handler');
const { hmacHex } = require('../../../shared/utils/crypto');
const { config } = require('./config');

// On limite les "contextes" autorisés : on ne peppere que ce qui est prévu.
const ALLOWED_CONTEXTS = new Set(['password', 'token', 'otp']);

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);

  // /health et / sont publics (sondes de vivacité, message d'usage) : montés AVANT
  // l'auth interne pour que Docker/QA puissent vérifier que le service tourne.
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'pepper-service',
        status: 'ok'
      },
      requestId: req.requestId
    });
  });

  app.get('/', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'pepper-service',
        port: config.port,
        message: 'Internal microservice. Do not call directly from clients.',
        usage: {
          apiCalls: 'Use http://localhost:3000/api/v1/... for client/API requests (via gateway)',
          healthCheck: `Use http://localhost:${config.port}/health for liveness`,
          businessRoutes: 'Direct business routes require x-internal-* signed headers (user-service only)'
        },
        requestId: req.requestId
      },
      requestId: req.requestId
    });
  });

  // À partir d'ici, tout exige une signature interne valide ET un appelant = user-service.
  app.use(
    createInternalAuthMiddleware({
      secret: config.internalSharedSecret,
      allowedServices: ['user-service']
    })
  );

  // Le cœur du service : renvoie HMAC(secret_maître, "contexte:valeur").
  app.post('/internal/pepper/hash', (req, res) => {
    const value = String(req.body?.value || '');
    const context = String(req.body?.context || 'default');
    if (!value) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALUE_REQUIRED',
          message: 'value requis'
        },
        requestId: req.requestId
      });
    }

    if (!ALLOWED_CONTEXTS.has(context)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTEXT',
          message: 'Contexte pepper invalide'
        },
        requestId: req.requestId
      });
    }

    // Le contexte est inclus dans le calcul : un même mot peppered pour "password"
    // donne un résultat différent que pour "otp" (cloisonnement des usages).
    const pepperedValue = hmacHex(config.pepperMasterSecret, `${context}:${value}`);
    return res.status(200).json({
      success: true,
      data: {
        pepperedValue
      },
      requestId: req.requestId
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = {
  createApp
};
