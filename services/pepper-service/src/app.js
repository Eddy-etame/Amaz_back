const express = require('express');

const { requestIdMiddleware } = require('../../../shared/middleware/request-id');
const { createInternalAuthMiddleware } = require('../../../shared/middleware/internal-auth');
const { errorHandler, notFoundHandler } = require('../../../shared/middleware/error-handler');
const { hmacHex } = require('../../../shared/utils/crypto');
const { config } = require('./config');

const ALLOWED_CONTEXTS = new Set(['password', 'token', 'otp']);

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);

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

  app.use(
    createInternalAuthMiddleware({
      secret: config.internalSharedSecret,
      allowedServices: ['user-service']
    })
  );

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
