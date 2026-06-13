// Blocage des IP bannies (table `blocked_ips` en PostgreSQL).
//
// La gateway refuse les requêtes venant d'une IP listée en base. Pour ne pas
// interroger Postgres à CHAQUE requête, on garde la liste en cache mémoire 10 s.
// Un opérateur ajoute/retire une IP via l'API admin ou AdminJS ; le déblocage est
// donc effectif au pire 10 s plus tard (le temps que le cache se rafraîchisse).
//
// La table accepte des IP exactes OU des plages CIDR (colonne VARCHAR). On sépare
// les deux : les IP exactes vont dans un Set (recherche instantanée), les CIDR dans
// une liste qu'on parcourt. La comparaison passe par `shared/utils/client-ip`, qui
// normalise aussi les adresses IPv4 "mappées IPv6".

const { getPostgresPool } = require('../../../shared/db/postgres');
const { getClientIp, ipInList } = require('../../../shared/utils/client-ip');

let cache = null; // { exact: Set<string>, cidrs: string[] }
let cacheTime = 0;
const CACHE_TTL_MS = 10000;

// Renvoie les règles de blocage, depuis le cache si encore frais, sinon depuis la
// base. En cas d'erreur DB, on renvoie le dernier cache connu (ou des règles vides).
async function getBlockedRules() {
  const now = Date.now();
  if (cache && now - cacheTime < CACHE_TTL_MS) {
    return cache;
  }
  try {
    const pool = getPostgresPool();
    const result = await pool.query('SELECT ip_address FROM blocked_ips');
    const exact = new Set();
    const cidrs = [];
    for (const row of result.rows) {
      const value = String(row.ip_address || '').trim();
      if (!value) continue;
      if (value.includes('/')) {
        cidrs.push(value);
      } else {
        exact.add(value);
      }
    }
    cache = { exact, cidrs };
    cacheTime = now;
    return cache;
  } catch (err) {
    if (cache) return cache;
    return { exact: new Set(), cidrs: [] };
  }
}

function createBlockedIpMiddleware() {
  return async function blockedIpMiddleware(req, res, next) {
    const ip = getClientIp(req);
    if (!ip) return next();

    try {
      const { exact, cidrs } = await getBlockedRules();
      // Recherche exacte d'abord (rapide), puis les éventuelles plages CIDR.
      if (exact.has(ip) || ipInList(ip, cidrs)) {
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
      // Choix assumé : en cas d'erreur, on "fail open" (on laisse passer) pour ne
      // pas couper tout le trafic si la base de blocage est momentanément indisponible.
    }
    next();
  };
}

module.exports = { createBlockedIpMiddleware };
