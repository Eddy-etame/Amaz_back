const compteurRequetes = {};
const listeNoire = [];

function limiteurderequetes(req, res, next) {
  const limiteRequetes = 30;
  const duree = 60000;
  const adresseIP = req.ip;
  const tokenUtilisateur = req.headers.authorization;
  let identifiant;

  if (tokenUtilisateur) {
    identifiant = tokenUtilisateur.split(' ')[1] || adresseIP;
  } else {
    identifiant = adresseIP;
  }

  if (listeNoire.includes(identifiant)) {
    return res.status(403).send('Utilisateur banni');
  }
  const tempsActuel = Date.now();

  if (!compteurRequetes[identifiant]) {
    compteurRequetes[identifiant] = {
      nombre: 1,
      finTemps: tempsActuel + duree
    };
    return next();
  }
  const donneesUtilisateur = compteurRequetes[identifiant];

  if (tempsActuel > donneesUtilisateur.finTemps) {
    donneesUtilisateur.nombre = 1;
    donneesUtilisateur.finTemps = tempsActuel + duree;
    return next();
  }
  donneesUtilisateur.nombre++;

  if (donneesUtilisateur.nombre > limiteRequetes) {
    listeNoire.push(identifiant);
    return res.status(429).send('Trop de requêtes, veuillez réessayer plus tard');
  }
  return next();
}

function createRateLimitMiddleware({ windowMs = 60000, max = 30 } = {}) {
  const store = new Map();
  return function rateLimitMiddleware(req, res, next) {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = store.get(ip);

    if (!entry) {
      entry = { count: 1, resetAt: now + windowMs };
      store.set(ip, entry);
      return next();
    }

    if (now > entry.resetAt) {
      entry.count = 1;
      entry.resetAt = now + windowMs;
      return next();
    }

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

module.exports = { limiteurderequetes, createRateLimitMiddleware };

    


