const { buildFingerprint } = require('../utils/fingerprint');
const { verifyPow } = require('../utils/pow');

function createPowMiddleware(options = {}) {
  const difficulty = Number(options.difficulty ?? 0);
  const windowMs = Number(options.windowMs ?? 120000);
  const nonceStore = new Map();

  function cleanup() {
    const now = Date.now();
    for (const [key, expiresAt] of nonceStore.entries()) {
      if (expiresAt <= now) {
        nonceStore.delete(key);
      }
    }
  }

  return function powMiddleware(req, res, next) {
    cleanup();

    const timestampRaw = req.headers['x-pow-timestamp'];
    const nonce = (req.headers['x-pow-nonce'] || '').toString().trim();
    const proof = (req.headers['x-pow-proof'] || '').toString().trim();
    const timestamp = Number(timestampRaw);

    // Contrat API v1.2 : 403 « Preuve invalide » (messages génériques, pas de fuite d’info)
    const powForbidden = (code) =>
      res.status(403).json({
        success: false,
        error: {
          code,
          message: 'Preuve invalide'
        },
        requestId: req.requestId
      });

    if (!Number.isFinite(timestamp) || !nonce || !proof) {
      return powForbidden('POW_REQUIRED');
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > windowMs) {
      return powForbidden('POW_EXPIRED');
    }

    const fingerprint = buildFingerprint(req);
    const replayKey = `${timestamp}:${nonce}:${fingerprint}:${req.method.toUpperCase()}:${req.originalUrl}`;
    if (nonceStore.has(replayKey)) {
      return powForbidden('POW_REPLAY');
    }

    const valid = verifyPow({
      method: req.method,
      path: req.originalUrl,
      timestamp,
      nonce,
      fingerprint,
      proof,
      difficulty
    });

    if (!valid) {
      return powForbidden('POW_INVALID');
    }

    nonceStore.set(replayKey, now + windowMs);
    req.security = req.security || {};
    req.security.pow = {
      timestamp,
      nonce,
      difficulty
    };
    return next();
  };
}

module.exports = {
  createPowMiddleware
};
