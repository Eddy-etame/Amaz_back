const { getPostgresPool } = require('../../../shared/db/postgres');

let cache = null;
let cacheTime = 0;
const CACHE_TTL_MS = 10000;

async function getBlockedIpsSet() {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) {
    return cache;
  }
  try {
    const pool = getPostgresPool();
    const result = await pool.query('SELECT ip_address FROM blocked_ips');
    cache = new Set(result.rows.map((r) => String(r.ip_address || '').trim()));
    cacheTime = now;
    return cache;
  } catch (err) {
    if (cache) return cache;
    return new Set();
  }
}

function createBlockedIpMiddleware() {
  return async function blockedIpMiddleware(req, res, next) {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || req.connection?.remoteAddress || '';
    if (!ip) return next();

    try {
      const blocked = await getBlockedIpsSet();
      if (blocked.has(ip)) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'ACCESS_DENIED',
            message: 'Accès refusé'
          },
          requestId: req.requestId
        });
      }
    } catch (_) {
      // fail open on error
    }
    next();
  };
}

module.exports = { createBlockedIpMiddleware };
