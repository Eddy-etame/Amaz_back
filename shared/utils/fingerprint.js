// Empreinte ("fingerprint") d'un client.
//
// On en a besoin pour le rate-limit et le PoW : ça donne un identifiant stable
// d'un même appareil/navigateur, sans stocker de donnée personnelle (on ne garde
// qu'un hash). Si le front fournit sa propre empreinte, on l'utilise ; sinon on
// la reconstruit à partir du User-Agent et de l'IP.

const { sha256Hex } = require('./crypto');

function buildFingerprint(req) {
  // Empreinte explicite envoyée par le front (en-tête dédié), si présente.
  const explicit =
    (req.headers['x-device-fingerprint'] || req.headers['x-client-fingerprint'] || '')
      .toString()
      .trim();
  const userAgent = (req.headers['user-agent'] || '').toString().trim();
  // Derrière un proxy, l'IP réelle est dans `x-forwarded-for` (on prend la première).
  const forwarded = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';

  // On préfixe avant de hacher (`fp:` / `ua:`) pour éviter toute collision entre
  // les deux sources, et on ne renvoie qu'un hash (jamais l'IP/UA en clair).
  if (explicit) {
    return sha256Hex(`fp:${explicit}`);
  }

  return sha256Hex(`ua:${userAgent}|ip:${ip}`);
}

module.exports = {
  buildFingerprint
};
