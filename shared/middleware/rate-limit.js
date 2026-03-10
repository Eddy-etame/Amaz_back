const { buildFingerprint } = require('../utils/fingerprint');

function createRateLimitMiddleware(options = {}) {
  const windowMs = Number(options.windowMs ?? 60000);
  const max = Number(options.max ?? 120);
  const maxByAxis = {
    ip: Number(options.maxByAxis?.ip ?? max),
    fingerprint: Number(options.maxByAxis?.fingerprint ?? Math.max(40, Math.floor(max * 0.8))),
    account: Number(options.maxByAxis?.account ?? Math.max(30, Math.floor(max * 0.7))),
    endpoint: Number(options.maxByAxis?.endpoint ?? Math.max(50, Math.floor(max * 0.9)))
  };
  const store = new Map();

  function getIp(req) {
    const forwarded = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim();
    return forwarded || req.ip || req.socket?.remoteAddress || 'unknown';
  }

  function getAccountKey(req) {
    const direct = (req.headers['x-account-id'] || req.auth?.userId || req.headers['x-auth-user-id'] || '')
      .toString()
      .trim();
    if (direct) return direct;

    const body = req.body || {};
    const candidate = body.userId || body.email || body.phone || req.query?.userId || '';
    const normalized = String(candidate || '').trim().toLowerCase();
    return normalized || 'anon';
  }

  function buildAxisKeys(req) {
    const ip = getIp(req);
    const fingerprint = buildFingerprint(req);
    const account = getAccountKey(req);
    const endpoint = `${req.method.toUpperCase()}:${req.baseUrl || ''}${req.path || ''}`;
    return [
      { axis: 'ip', key: `ip:${ip}` },
      { axis: 'fingerprint', key: `fp:${fingerprint}` },
      { axis: 'account', key: `acct:${account}` },
      { axis: 'endpoint', key: `ep:${endpoint}` }
    ];
  }

  function cleanup(now) {
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }

  return function rateLimitMiddleware(req, res, next) {
    const now = Date.now();
    cleanup(now);
    const axisKeys = buildAxisKeys(req);

    for (const axisEntry of axisKeys) {
      const current = store.get(axisEntry.key) || { count: 0, resetAt: now + windowMs };
      current.count += 1;
      store.set(axisEntry.key, current);

      const axisMax = maxByAxis[axisEntry.axis] ?? max;
      if (current.count > axisMax) {
        const retryAfter = Math.ceil((current.resetAt - now) / 1000);
        res.setHeader('retry-after', String(Math.max(retryAfter, 1)));
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Trop de requêtes, réessaie plus tard'
          },
          requestId: req.requestId
        });
      }
    }

    return next();
  };
}

module.exports = {
  createRateLimitMiddleware
};
