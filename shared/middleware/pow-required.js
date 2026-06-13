// Middleware Express qui EXIGE une preuve de travail valide sur les routes externes.
//
// C'est la première barrière de la gateway. Avant de toucher à la moindre logique
// métier, on vérifie que la requête porte une PoW correcte (cf. utils/pow.js).
// But : freiner le spam automatisé et bloquer les rejeux. Tous les messages
// d'erreur sont volontairement génériques (« Preuve invalide ») pour ne rien
// révéler à un attaquant sur la raison exacte du refus.

const { buildFingerprint } = require('../utils/fingerprint');
const { verifyPow } = require('../utils/pow');

function createPowMiddleware(options = {}) {
  const difficulty = Number(options.difficulty ?? 0);
  const windowMs = Number(options.windowMs ?? 120000);
  // Mémoire anti-rejeu : on retient les preuves déjà vues jusqu'à leur expiration.
  // (En production multi-instances il faudrait un store partagé type Redis ; ici
  // une Map en mémoire suffit pour le périmètre du projet.)
  const nonceStore = new Map();

  // Purge les entrées expirées pour éviter que la Map grossisse indéfiniment.
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

    // Réponse 403 standardisée. Le `code` change pour nos logs, mais le message
    // reste le même pour le client (pas de fuite d'info).
    const powForbidden = (code) =>
      res.status(403).json({
        success: false,
        error: {
          code,
          message: 'Preuve invalide'
        },
        requestId: req.requestId
      });

    // 1) En-têtes PoW présents et bien formés ?
    if (!Number.isFinite(timestamp) || !nonce || !proof) {
      return powForbidden('POW_REQUIRED');
    }

    // 2) La preuve n'est-elle pas trop vieille ? (fenêtre de validité)
    const now = Date.now();
    if (Math.abs(now - timestamp) > windowMs) {
      return powForbidden('POW_EXPIRED');
    }

    // 3) Anti-rejeu : la clé lie la preuve à un instant, un nonce, un client et
    // une route précis. Si on l'a déjà vue, c'est un rejeu -> on refuse.
    const fingerprint = buildFingerprint(req);
    const replayKey = `${timestamp}:${nonce}:${fingerprint}:${req.method.toUpperCase()}:${req.originalUrl}`;
    if (nonceStore.has(replayKey)) {
      return powForbidden('POW_REPLAY');
    }

    // 4) La preuve est-elle mathématiquement correcte (hash + difficulté) ?
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

    // Tout est bon : on mémorise la preuve (anti-rejeu) et on note le contexte
    // PoW sur la requête, puis on laisse passer vers la suite.
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
