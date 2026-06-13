// Blocage d'accès via VPN/proxy (denylist d'IP et de plages CIDR).
//
// Principe : on refuse au bord du système les requêtes venant d'adresses qu'on a
// décidé d'interdire (sortie VPN, datacenter, proxy abusif…). La liste est
// configurable par la variable d'environnement `VPN_BLOCKLIST` (IP ou CIDR séparés
// par des virgules) ; sans configuration, on garde quelques exemples par défaut.
//
// Limite honnête : une "vraie" détection de VPN s'appuierait sur une base d'IP
// commerciale tenue à jour. Ici on fournit le mécanisme de denylist (exact + CIDR),
// qui se branche directement sur une telle source si besoin.

const { getClientIp, ipInList, parseIpList } = require('../../../shared/utils/client-ip');

// Exemples par défaut (utilisés seulement si VPN_BLOCKLIST n'est pas défini).
const DEFAULT_BLOCKLIST = ['10.0.0.1', '172.16.0.1'];

function getBlocklist() {
  const fromEnv = parseIpList(process.env.VPN_BLOCKLIST);
  return fromEnv.length > 0 ? fromEnv : DEFAULT_BLOCKLIST;
}

function verifierVPN(req, res, next) {
  const ip = getClientIp(req);
  const blocklist = getBlocklist();

  if (ip && ipInList(ip, blocklist)) {
    // Réponse JSON cohérente avec le reste de l'API (et pas un simple texte).
    return res.status(403).json({
      success: false,
      error: {
        code: 'VPN_BLOCKED',
        message: 'Accès refusé'
      },
      requestId: req.requestId
    });
  }

  return next();
}

module.exports = verifierVPN;
