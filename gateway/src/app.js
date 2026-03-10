const express = require('express');

const { requestIdMiddleware } = require('../../shared/middleware/request-id');
const { createPowMiddleware } = require('../../shared/middleware/pow-required');
const { createRateLimitMiddleware } = require('../../shared/middleware/rate-limit');
const { errorHandler, notFoundHandler } = require('../../shared/middleware/error-handler');
const { config } = require('./config');
const { createAuthMiddleware } = require('./middlewares/auth');
const { createGatewayValidationMiddleware } = require('./middlewares/input-validation');
const { forwardToService } = require('./proxy');

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

async function forwardProxy({ req, res, serviceBaseUrl, targetPath, internalSecret }) {
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
  const app = express();
  const inputValidationMiddleware = createGatewayValidationMiddleware();
  const authMiddleware = createAuthMiddleware({
    userServiceUrl: config.services.user,
    internalSecret: config.internalSharedSecret,
    timeoutMs: config.internalFetchTimeoutMs
  });

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);
  app.use(corsMiddleware);

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

  const HEALTH_AGGREGATE_TIMEOUT_MS = 2500;
  const SERVICE_NAMES = ['user', 'product', 'order', 'messaging', 'ai', 'pepper'];

  app.get('/health/aggregate', async (req, res) => {
    const requestId = req.requestId || 'aggregate';
    const data = {
      gateway: { status: 'ok', code: 200 },
      services: {}
    };

    const checkOne = async (name) => {
      const baseUrl = config.services[name];
      if (!baseUrl) {
        data.services[name] = { status: 'fail', code: 0, error: 'unreachable' };
        return;
      }
      const url = `${baseUrl.replace(/\/+$/, '')}/health`;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), HEALTH_AGGREGATE_TIMEOUT_MS);
      try {
        const r = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        const ok = r.ok && r.status === 200;
        data.services[name] = { status: ok ? 'ok' : 'fail', code: r.status };
      } catch (err) {
        clearTimeout(timer);
        const errorMsg = process.env.NODE_ENV === 'production' ? 'unreachable' : (err.code || err.name || 'unreachable');
        data.services[name] = { status: 'fail', code: 0, error: errorMsg };
      }
    };

    await Promise.all(SERVICE_NAMES.map((name) => checkOne(name)));

    res.json({
      success: true,
      data,
      requestId
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
        internalSecret: config.internalSharedSecret
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

  app.use('/api/v1/produits', async (req, res, next) => {
    try {
      if (req.method !== 'GET') {
        await authMiddleware(req, res, async () => {
          await forwardProxy({
            req,
            res,
            serviceBaseUrl: config.services.product,
            targetPath: normalizeDownstreamPath(req.originalUrl),
            internalSecret: config.internalSharedSecret
          });
        });
        return;
      }

      await forwardProxy({
        req,
        res,
        serviceBaseUrl: config.services.product,
        targetPath: normalizeDownstreamPath(req.originalUrl),
        internalSecret: config.internalSharedSecret
      });
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
            internalSecret: config.internalSharedSecret
          });
        });
        return;
      }

      await forwardProxy({
        req,
        res,
        serviceBaseUrl: config.services.product,
        targetPath,
        internalSecret: config.internalSharedSecret
      });
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
          internalSecret: config.internalSharedSecret
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
          internalSecret: config.internalSharedSecret
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
          internalSecret: config.internalSharedSecret
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
          internalSecret: config.internalSharedSecret
        });
      });
    } catch (error) {
      next(error);
    }
  });

  app.use('/api/v1/bot', async (req, res, next) => {
    try {
      await authMiddleware(req, res, async () => {
        await forwardProxy({
          req,
          res,
          serviceBaseUrl: config.services.ai,
          targetPath: normalizeDownstreamPath(req.originalUrl),
          internalSecret: config.internalSharedSecret
        });
      });
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
