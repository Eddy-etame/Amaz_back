const { verifyInternalRequest } = require('../utils/internal-signature');

function createInternalAuthMiddleware(options = {}) {
  const secret = options.secret;
  const maxDriftMs = Number(options.maxDriftMs ?? 60000);
  const allowedServices = Array.isArray(options.allowedServices) ? options.allowedServices : null;
  const nonceStore = new Map();

  function cleanup(now) {
    for (const [key, expiresAt] of nonceStore.entries()) {
      if (expiresAt <= now) {
        nonceStore.delete(key);
      }
    }
  }

  return function internalAuth(req, res, next) {
    const caller = (req.headers['x-internal-service'] || '').toString().trim();
    const timestamp = Number(req.headers['x-internal-timestamp']);
    const nonce = (req.headers['x-internal-nonce'] || '').toString().trim();
    const signature = (req.headers['x-internal-signature'] || '').toString().trim();

    if (!secret || !caller || !Number.isFinite(timestamp) || !nonce || !signature) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INTERNAL_AUTH_REQUIRED',
          message: 'Authentification interne requise'
        },
        requestId: req.requestId
      });
    }

    if (allowedServices && allowedServices.length > 0 && !allowedServices.includes(caller)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'INTERNAL_AUTH_FORBIDDEN',
          message: 'Appelant interne non autorisé'
        },
        requestId: req.requestId
      });
    }

    const now = Date.now();
    cleanup(now);

    if (Math.abs(now - timestamp) > maxDriftMs) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INTERNAL_AUTH_EXPIRED',
          message: 'Signature interne expirée'
        },
        requestId: req.requestId
      });
    }

    const replayKey = `${caller}:${timestamp}:${nonce}`;
    if (nonceStore.has(replayKey)) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'INTERNAL_AUTH_REPLAY',
          message: 'Rejeu détecté'
        },
        requestId: req.requestId
      });
    }

    const valid = verifyInternalRequest({
      secret,
      serviceName: caller,
      method: req.method,
      path: req.originalUrl,
      timestamp,
      nonce,
      body: req.body,
      signature
    });

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'INTERNAL_AUTH_INVALID',
          message: 'Signature interne invalide'
        },
        requestId: req.requestId
      });
    }

    nonceStore.set(replayKey, now + maxDriftMs);
    req.internalCaller = caller;
    return next();
  };
}

module.exports = {
  createInternalAuthMiddleware
};
