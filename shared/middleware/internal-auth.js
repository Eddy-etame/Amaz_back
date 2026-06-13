// Middleware Express posé DEVANT les routes internes d'un microservice.
//
// C'est le pendant de `utils/internal-signature.js` côté service appelé : il
// refuse tout appel qui n'est pas signé par un appelant interne légitime (la
// gateway, ou un autre service autorisé). C'est ce qui fait qu'un client qui
// taperait directement http://localhost:3002/produits reçoit
// « INTERNAL_AUTH_REQUIRED » au lieu d'accéder aux données.

const { verifyInternalRequest } = require('../utils/internal-signature');

function createInternalAuthMiddleware(options = {}) {
  const secret = options.secret;
  const maxDriftMs = Number(options.maxDriftMs ?? 60000);
  // Liste blanche optionnelle : restreint quels services ont le droit d'appeler.
  const allowedServices = Array.isArray(options.allowedServices) ? options.allowedServices : null;
  // Anti-rejeu (voir pow-required.js pour la même logique).
  const nonceStore = new Map();

  function cleanup(now) {
    for (const [key, expiresAt] of nonceStore.entries()) {
      if (expiresAt <= now) {
        nonceStore.delete(key);
      }
    }
  }

  return function internalAuth(req, res, next) {
    // En-têtes de signature interne posés par l'appelant.
    const caller = (req.headers['x-internal-service'] || '').toString().trim();
    const timestamp = Number(req.headers['x-internal-timestamp']);
    const nonce = (req.headers['x-internal-nonce'] || '').toString().trim();
    const signature = (req.headers['x-internal-signature'] || '').toString().trim();

    // 1) Secret configuré + en-têtes complets ? Sinon, appel non interne -> 401.
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

    // 2) L'appelant fait-il partie des services autorisés (si une liste est définie) ?
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

    // 3) Signature pas trop ancienne ? (tolérance d'horloge `maxDriftMs`)
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

    // 4) Déjà vue ? Alors c'est un rejeu -> 409.
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

    // 5) La signature recalculée correspond-elle ? (inclut le hash du corps)
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

    // OK : on mémorise (anti-rejeu), on note l'appelant et on laisse passer.
    nonceStore.set(replayKey, now + maxDriftMs);
    req.internalCaller = caller;
    return next();
  };
}

module.exports = {
  createInternalAuthMiddleware
};
