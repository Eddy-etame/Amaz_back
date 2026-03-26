const express = require('express');
const { requestIdMiddleware } = require('../../shared/middleware/request-id');
const { createPowMiddleware } = require('../../shared/middleware/pow-required');
const { createRateLimitMiddleware } = require('../../shared/middleware/rate-limit');
const { createBlockedIpMiddleware } = require('./middlewares/blocked-ip-check');
const verifierVPN = require('./middlewares/verifierVPN');
const { errorHandler, notFoundHandler } = require('../../shared/middleware/error-handler');
const { config } = require('./config');
const { createAuthMiddleware, createOptionalAuthMiddleware } = require('./middlewares/auth');
const { createGatewayValidationMiddleware } = require('./middlewares/input-validation');
const { forwardToService } = require('./proxy');
const { startHealthMonitor, isServiceHealthy, getAllStatus } = require('./health-monitor');

const AUTH_PUBLIC_PATHS = new Set([
  '/login',
  '/register',
  '/signup',
  '/verification/start',
  '/verification/confirm',
  '/password/forgot/start',
  '/password/forgot/confirm',
  '/password/reset',
  '/refresh'
]);

function splitPathAndQuery(rawUrl) {
  const [pathOnly, query = ''] = String(rawUrl || '/').split('?');
  return {
    pathOnly: pathOnly || '/',
    query
  };
}

function withQuery(pathOnly, query) {
  return query ? `${pathOnly}?${query}` : pathOnly;
}

function normalizeDownstreamPath(originalUrl) {
  const { pathOnly, query } = splitPathAndQuery(originalUrl);
  if (!pathOnly.startsWith('/api/v1')) {
    return withQuery(pathOnly, query);
  }
  const normalized = pathOnly.slice('/api/v1'.length) || '/';
  return withQuery(normalized, query);
}

function normalizeAuthDownstreamPath(originalUrl) {
  const normalized = normalizeDownstreamPath(originalUrl);
  const { pathOnly, query } = splitPathAndQuery(normalized);
  if (pathOnly === '/auth') {
    return withQuery('/', query);
  }
  if (pathOnly.startsWith('/auth/')) {
    return withQuery(pathOnly.slice('/auth'.length) || '/', query);
  }
  return withQuery(pathOnly, query);
}

function mapAlias(pathWithQuery, fromPath, toPath) {
  const { pathOnly, query } = splitPathAndQuery(pathWithQuery);
  const mapped =
    pathOnly === fromPath || pathOnly.startsWith(`${fromPath}/`)
      ? `${toPath}${pathOnly.slice(fromPath.length)}`
      : pathOnly;
  return withQuery(mapped, query);
}

/** Contrat v1.2 : POST /api/v1/bot/auth — PoW uniquement, pas de Bearer */
function isBotAuthPowOnly(req) {
  const p = req.path || '/';
  return req.method === 'POST' && (p === '/auth' || p.startsWith('/auth/'));
}

/**
 * Exécute un middleware Express (y compris async) et attend la fin.
 * Si le middleware répond seul (ex. 401) sans appeler next, on résout au `finish`.
 */
function runMiddleware(mw, req, res) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (err) => {
      if (settled) return;
      settled = true;
      res.removeListener('finish', onHttpFinish);
      res.removeListener('close', onHttpFinish);
      if (err) reject(err);
      else resolve();
    };
    const onHttpFinish = () => done();
    res.once('finish', onHttpFinish);
    res.once('close', onHttpFinish);
    mw(req, res, done);
  });
}

const SERVICE_NAME_BY_URL = {};
function buildServiceNameMap() {
  const s = config.services;
  if (s.user) SERVICE_NAME_BY_URL[s.user.replace(/\/+$/, '')] = 'user';
  if (s.product) SERVICE_NAME_BY_URL[s.product.replace(/\/+$/, '')] = 'product';
  if (s.order) SERVICE_NAME_BY_URL[s.order.replace(/\/+$/, '')] = 'order';
  if (s.messaging) SERVICE_NAME_BY_URL[s.messaging.replace(/\/+$/, '')] = 'messaging';
  if (s.ai) SERVICE_NAME_BY_URL[s.ai.replace(/\/+$/, '')] = 'ai';
  if (s.pepper) SERVICE_NAME_BY_URL[s.pepper.replace(/\/+$/, '')] = 'pepper';
  if (s.pepperPrimary) SERVICE_NAME_BY_URL[s.pepperPrimary.replace(/\/+$/, '')] = 'pepperPrimary';
}

async function forwardProxy({ req, res, serviceBaseUrl, targetPath, internalSecret, serviceName }) {
  const base = String(serviceBaseUrl || '').replace(/\/+$/, '');
  const name = serviceName || SERVICE_NAME_BY_URL[base];
  if (name && !isServiceHealthy(name)) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: `Le service ${name} est temporairement indisponible. Veuillez réessayer plus tard.`
      },
      requestId: req.requestId
    });
  }
  await forwardToService({
    req,
    res,
    serviceBaseUrl,
    targetPath,
    internalSecret,
    timeoutMs: config.upstreamTimeoutMs
  });
}

function corsMiddleware(req, res, next) {
  const origin = (req.headers.origin || '').toString();
  if (!origin) {
    return next();
  }

  if (config.allowedOrigins.length === 0 || config.allowedOrigins.includes(origin)) {
    res.setHeader('access-control-allow-origin', origin);
    res.setHeader('vary', 'Origin');
    res.setHeader(
      'access-control-allow-headers',
      'content-type,authorization,x-request-id,x-client-fingerprint,x-device-fingerprint,x-pow-proof,x-pow-nonce,x-pow-timestamp'
    );
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('access-control-allow-credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  return next();
}

function createApp() {
  buildServiceNameMap();
  const app = express();
  app.use(verifierVPN);
  app.use(createBlockedIpMiddleware());
  const inputValidationMiddleware = createGatewayValidationMiddleware();
  const authMiddleware = createAuthMiddleware({
    userServiceUrl: config.services.user,
    internalSecret: config.internalSharedSecret,
    timeoutMs: config.internalFetchTimeoutMs
  });
  const optionalAuthMiddleware = createOptionalAuthMiddleware({
    userServiceUrl: config.services.user,
    internalSecret: config.internalSharedSecret,
    timeoutMs: config.internalFetchTimeoutMs
  });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);
  app.use(corsMiddleware);

  app.get('/', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'gateway',
        port: config.port,
        message: 'Amaz API Gateway',
        usage: {
          api: 'Use http://localhost:3000/api/v1/... for API calls (requires PoW headers)',
          health: 'GET /health or /health/aggregate for status'
        },
        requestId: req.requestId
      },
      requestId: req.requestId
    });
  });

  app.get('/health', (req, res) => {
    res.json({
      success: true,
      data: {
        service: 'gateway',
        status: 'ok'
      },
      requestId: req.requestId
    });
  });

  app.get('/health/aggregate', (req, res) => {
    const raw = getAllStatus();
    const services = {};
    for (const name of Object.keys(config.services)) {
      const s = raw[name];
      services[name] = s
        ? {
            status: s.ok ? 'ok' : 'fail',
            code: s.code || 0,
            ...(s.error && { error: s.error }),
            lastCheck: s.lastCheck
          }
        : { status: 'pending', code: 0, error: 'not yet checked' };
    }
    res.json({
      success: true,
      data: {
        gateway: { status: 'ok', code: 200 },
        services
      },
      requestId: req.requestId
    });
  });

  app.use(
    '/api/v1',
    createPowMiddleware({
      difficulty: config.powDifficulty,
      windowMs: config.powWindowMs
    })
  );
  app.use(
    '/api/v1',
    createRateLimitMiddleware({
      windowMs: config.rateLimitWindowMs,
      max: config.rateLimitMax
    })
  );
  app.use('/api/v1', inputValidationMiddleware);

  app.use('/api/v1/auth', async (req, res, next) => {
    const path = req.path || '/';
    const needsAuth = !AUTH_PUBLIC_PATHS.has(path);

    const proxyCall = async () =>
      forwardProxy({
        req,
        res,
        serviceBaseUrl: config.services.user,
        targetPath: normalizeAuthDownstreamPath(req.originalUrl),
        internalSecret: config.internalSharedSecret,
        serviceName: 'user'
      });

    try {
      if (needsAuth) {
        await authMiddleware(req, res, proxyCall);
        return;
      }
      await proxyCall();
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/addresses', async (req, res, next) => {
    try {
      await authMiddleware(req, res, async () => {
        await forwardProxy({
          req,
          res,
          serviceBaseUrl: config.services.user,
          targetPath: normalizeDownstreamPath(req.originalUrl),
          internalSecret: config.internalSharedSecret,
          serviceName: 'user'
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/wishlists/shared', async (req, res, next) => {
    try {
      if (req.method !== 'GET') {
        return res.status(405).json({
          success: false,
          error: { code: 'METHOD_NOT_ALLOWED', message: 'Méthode non autorisée' },
          requestId: req.requestId
        });
      }
      await forwardProxy({
        req,
        res,
        serviceBaseUrl: config.services.product,
        targetPath: normalizeDownstreamPath(req.originalUrl),
        internalSecret: config.internalSharedSecret,
        serviceName: 'product'
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/wishlists/me', async (req, res, next) => {
    try {
      await authMiddleware(req, res, async () => {
        await forwardProxy({
          req,
          res,
          serviceBaseUrl: config.services.product,
          targetPath: normalizeDownstreamPath(req.originalUrl),
          internalSecret: config.internalSharedSecret,
          serviceName: 'product'
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/produits', async (req, res, next) => {
    try {
      if (req.method !== 'GET') {
        await authMiddleware(req, res, async () => {
          await forwardProxy({
            req,
            res,
            serviceBaseUrl: config.services.product,
            targetPath: normalizeDownstreamPath(req.originalUrl),
            internalSecret: config.internalSharedSecret,
            serviceName: 'product'
          });
        });
        return;
      }

      await runMiddleware(optionalAuthMiddleware, req, res);
      if (!res.headersSent) {
        await forwardProxy({
          req,
          res,
          serviceBaseUrl: config.services.product,
          targetPath: normalizeDownstreamPath(req.originalUrl),
          internalSecret: config.internalSharedSecret,
          serviceName: 'product'
        });
      }
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/products', async (req, res, next) => {
    try {
      const targetPath = mapAlias(normalizeDownstreamPath(req.originalUrl), '/products', '/produits');
      if (req.method !== 'GET') {
        await authMiddleware(req, res, async () => {
          await forwardProxy({
            req,
            res,
            serviceBaseUrl: config.services.product,
            targetPath,
            internalSecret: config.internalSharedSecret,
            serviceName: 'product'
          });
        });
        return;
      }

      await runMiddleware(optionalAuthMiddleware, req, res);
      if (!res.headersSent) {
        await forwardProxy({
          req,
          res,
          serviceBaseUrl: config.services.product,
          targetPath,
          internalSecret: config.internalSharedSecret,
          serviceName: 'product'
        });
      }
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/commandes', async (req, res, next) => {
    try {
      await authMiddleware(req, res, async () => {
        await forwardProxy({
          req,
          res,
          serviceBaseUrl: config.services.order,
          targetPath: normalizeDownstreamPath(req.originalUrl),
          internalSecret: config.internalSharedSecret,
          serviceName: 'order'
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/orders', async (req, res, next) => {
    try {
      const targetPath = mapAlias(normalizeDownstreamPath(req.originalUrl), '/orders', '/commandes');
      await authMiddleware(req, res, async () => {
        await forwardProxy({
          req,
          res,
          serviceBaseUrl: config.services.order,
          targetPath,
          internalSecret: config.internalSharedSecret,
          serviceName: 'order'
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/messages', async (req, res, next) => {
    try {
      await authMiddleware(req, res, async () => {
        await forwardProxy({
          req,
          res,
          serviceBaseUrl: config.services.messaging,
          targetPath: normalizeDownstreamPath(req.originalUrl),
          internalSecret: config.internalSharedSecret,
          serviceName: 'messaging'
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/ai', async (req, res, next) => {
    try {
      await authMiddleware(req, res, async () => {
        await forwardProxy({
          req,
          res,
          serviceBaseUrl: config.services.ai,
          targetPath: normalizeDownstreamPath(req.originalUrl),
          internalSecret: config.internalSharedSecret,
          serviceName: 'ai'
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/bot', async (req, res, next) => {
    const proxyCall = async () =>
      forwardProxy({
        req,
        res,
        serviceBaseUrl: config.services.ai,
        targetPath: normalizeDownstreamPath(req.originalUrl),
        internalSecret: config.internalSharedSecret,
        serviceName: 'ai'
      });

    try {
      if (isBotAuthPowOnly(req)) {
        await proxyCall();
        return;
      }
      await authMiddleware(req, res, proxyCall);
    } catch (error) {
      next(error);
    }
  });

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = {
  createApp
};
