// Limitation du débit de requêtes (rate limiting) : trop d'appels depuis la même
// source dans une fenêtre de temps -> on bloque temporairement. Sert à amortir le
// bruteforce et le spam, en complément de la PoW.

// Fabrique un middleware avec sa propre fenêtre `windowMs` et son plafond `max`.
// Chaque appel à la fabrique a son propre `store` (Map IP -> compteur), ce qui
// permet d'avoir des limites différentes selon la route (ex. 30/min sur la
// gateway, 120/min sur une route de partage de wishlist).
function createRateLimitMiddleware({ windowMs = 60000, max = 30 } = {}) {
  const store = new Map();
  return function rateLimitMiddleware(req, res, next) {
    // IP réelle (en tenant compte d'un éventuel proxy via x-forwarded-for).
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = store.get(ip);

    // Première requête dans la fenêtre.
    if (!entry) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(ip, entry);
      return next();
    }

    // Fenêtre écoulée : on réinitialise le compteur.
    if (now > entry.resetAt) {
      entry.count = 1;
      entry.resetAt = now + windowMs;
      return next();
    }

    // Sinon on incrémente, et au-delà du plafond on renvoie un 429 normalisé.
    // La limite se lève d'elle-même à la fin de la fenêtre (pas de bannissement permanent).
    entry.count++;
    if (entry.count > max) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Trop de requêtes, veuillez réessayer plus tard'
        },
        requestId: req.requestId
      });
    }
    return next();
  };
}

module.exports = { createRateLimitMiddleware };
