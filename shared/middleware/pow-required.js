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

    if (!Number.isFinite(timestamp) || !nonce || !proof) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'POW_REQUIRED',
          message: 'Preuve de travail invalide ou absente'
        },
        requestId: req.requestId
      });
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > windowMs) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'POW_EXPIRED',
          message: 'Preuve de travail expirée'
        },
        requestId: req.requestId
      });
    }

    const fingerprint = buildFingerprint(req);
    const replayKey = `${timestamp}:${nonce}:${fingerprint}:${req.method.toUpperCase()}:${req.originalUrl}`;
    if (nonceStore.has(replayKey)) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'POW_REPLAY',
          message: 'Nonce déjà utilisé'
        },
        requestId: req.requestId
      });
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
      return res.status(400).json({
        success: false,
        error: {
          code: 'POW_INVALID',
          message: 'Preuve de travail invalide'
        },
        requestId: req.requestId
      });
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
