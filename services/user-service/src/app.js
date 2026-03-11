const express = require('express');

const { requestIdMiddleware } = require('../../../shared/middleware/request-id');
const { createRateLimitMiddleware } = require('../../../shared/middleware/rate-limit');
const { createInternalAuthMiddleware } = require('../../../shared/middleware/internal-auth');
const { errorHandler, notFoundHandler } = require('../../../shared/middleware/error-handler');
const { config } = require('./config');
const { createAuthRouter } = require('./routes/auth.routes');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'user-service',
        status: 'ok'
      },
      requestId: req.requestId
    });
  });

  app.use(
    createRateLimitMiddleware({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
      max: Number(process.env.RATE_LIMIT_MAX || 120)
    })
  );

  app.use(
    createInternalAuthMiddleware({
      secret: config.internalSharedSecret,
      allowedServices: ['gateway', 'order-service']
    })
  );

  app.use('/', createAuthRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = {
  createApp
};
