// Extraction et comparaison d'adresses IP client.
//
// Deux middlewares en ont besoin (blocage d'IP et blocage VPN) : autant centraliser
// ici la façon de récupérer la "vraie" IP et de la comparer à une liste (IP exacte
// ou plage CIDR). Ça évite que les deux middlewares fassent les choses différemment.

// Récupère l'IP réelle de l'appelant.
// - Derrière un proxy, l'IP d'origine est dans `x-forwarded-for` (on prend le 1er hop).
// - On normalise les adresses IPv4 "mappées IPv6" (`::ffff:1.2.3.4` -> `1.2.3.4`) pour
//   qu'une IP stockée en IPv4 corresponde même si la requête arrive sous forme mappée.
function getClientIp(req) {
  const forwarded = (req.headers?.['x-forwarded-for'] || '').toString().split(',')[0].trim();
  let ip = forwarded || req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  ip = String(ip).trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice('::ffff:'.length);
  }
  return ip;
}

// Convertit une IPv4 ("a.b.c.d") en entier 32 bits, ou null si ce n'est pas une IPv4.
function ipv4ToInt(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = value * 256 + n;
  }
  return value >>> 0;
}

// Vrai si `ip` est dans la plage CIDR IPv4 `cidr` (ex. "203.0.113.0/24").
// (Le CIDR IPv6 n'est pas géré ici ; pour l'IPv6 on s'appuie sur l'égalité exacte.)
function ipv4InCidr(ip, cidr) {
  const [base, bitsRaw] = String(cidr).split('/');
  const bits = Number(bitsRaw);
  if (!Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null) return false;
  // Masque des `bits` premiers bits. (bits = 0 -> masque 0 -> tout correspond.)
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

// Vrai si `ip` correspond à une entrée de `list` : soit une IP identique, soit une
// plage CIDR IPv4 qui la contient. Les entrées vides sont ignorées.
function ipInList(ip, list) {
  if (!ip || !Array.isArray(list)) return false;
  for (const ruleRaw of list) {
    const rule = String(ruleRaw || '').trim();
    if (!rule) continue;
    if (rule.includes('/')) {
      if (ipv4InCidr(ip, rule)) return true;
    } else if (rule === ip) {
      return true;
    }
  }
  return false;
}

// Découpe une chaîne "a, b ,c" (ex. variable d'environnement) en liste propre.
function parseIpList(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

module.exports = {
  getClientIp,
  ipInList,
  ipv4InCidr,
  parseIpList
};
