// Tokens de session "maison" (opaques, signés HMAC) — sans librairie JWT.
//
// Un token a la forme `atk.<sessionId>.<expiration>.<signature>` (access) ou
// `rtk.<sessionId>.<nonce>.<expiration>.<signature>` (refresh). La SIGNATURE est un
// HMAC calculé avec un secret serveur : un client ne peut donc pas forger un token,
// et le serveur le vérifie en recalculant la signature. On dit "opaque" parce que,
// contrairement à un JWT, le token ne transporte aucune donnée exploitable côté client.
//
// Deux détails de sécurité importants :
//   - l'access token est LIÉ à l'empreinte du client (fingerprintHash) : un token volé
//     et rejoué depuis un autre appareil ne passera pas la vérification ;
//   - le refresh token contient un nonce de rotation aléatoire : à chaque refresh on en
//     émet un nouveau, ce qui permet de détecter/empêcher la réutilisation d'un ancien.
// En base, on ne stocke que le HASH du token (cf. `tokenHash`), jamais le token en clair.

const { config } = require('../config');
const { hmacHex, sha256Hex, timingSafeHexEqual, randomToken } = require('../../../../shared/utils/crypto');

// Fabrique un access token signé, dont la signature inclut l'empreinte client.
function issueAccessToken({ sessionId, fingerprintHash, expiresAt }) {
  const signature = hmacHex(
    config.accessHmacSecret,
    `${sessionId}.${expiresAt}.${fingerprintHash}`
  );
  return `atk.${sessionId}.${expiresAt}.${signature}`;
}

// Fabrique un refresh token. Le nonce aléatoire rend chaque refresh unique (rotation).
function issueRefreshToken({ sessionId, expiresAt }) {
  const rotationNonce = randomToken(16);
  const signature = hmacHex(config.refreshHmacSecret, `${sessionId}.${rotationNonce}.${expiresAt}`);
  return `rtk.${sessionId}.${rotationNonce}.${expiresAt}.${signature}`;
}

// Découpe un access token en ses morceaux, ou renvoie null si la forme est invalide.
function parseAccessToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 4 || parts[0] !== 'atk') {
    return null;
  }
  const expiresAt = Number(parts[2]);
  if (!Number.isFinite(expiresAt)) {
    return null;
  }
  return {
    sessionId: parts[1],
    expiresAt,
    signature: parts[3]
  };
}

function parseRefreshToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 5 || parts[0] !== 'rtk') {
    return null;
  }
  const expiresAt = Number(parts[3]);
  if (!Number.isFinite(expiresAt)) {
    return null;
  }
  return {
    sessionId: parts[1],
    rotationNonce: parts[2],
    expiresAt,
    signature: parts[4]
  };
}

// Vérifie un access token : forme correcte -> non expiré -> signature recalculée
// identique (comparaison à temps constant) ET liée à la bonne empreinte client.
function verifyAccessToken(token, fingerprintHash) {
  const parsed = parseAccessToken(token);
  if (!parsed) return { valid: false, reason: 'format' };
  if (Date.now() > parsed.expiresAt) return { valid: false, reason: 'expired', parsed };

  const expected = hmacHex(
    config.accessHmacSecret,
    `${parsed.sessionId}.${parsed.expiresAt}.${fingerprintHash}`
  );

  if (!timingSafeHexEqual(expected, parsed.signature)) {
    return { valid: false, reason: 'signature', parsed };
  }

  return { valid: true, parsed };
}

// Idem pour le refresh token (sans empreinte : la rotation se gère côté session).
function verifyRefreshToken(token) {
  const parsed = parseRefreshToken(token);
  if (!parsed) return { valid: false, reason: 'format' };
  if (Date.now() > parsed.expiresAt) return { valid: false, reason: 'expired', parsed };

  const expected = hmacHex(
    config.refreshHmacSecret,
    `${parsed.sessionId}.${parsed.rotationNonce}.${parsed.expiresAt}`
  );
  if (!timingSafeHexEqual(expected, parsed.signature)) {
    return { valid: false, reason: 'signature', parsed };
  }
  return { valid: true, parsed };
}

// Empreinte du token stockée en base (on ne garde jamais le token en clair).
function tokenHash(token) {
  return sha256Hex(token);
}

// Calcule les dates d'expiration access (courte) et refresh (longue) à partir de la config.
function getNewExpiry() {
  const accessTtlMs = config.sessionTtlMinutes * 60 * 1000;
  const refreshTtlMs = config.refreshTtlDays * 24 * 60 * 60 * 1000;
  return {
    accessExpiresAt: Date.now() + accessTtlMs,
    refreshExpiresAt: Date.now() + refreshTtlMs
  };
}

// Émet un couple access+refresh + leurs hashes (ces hashes sont ce qu'on persiste en base).
function issueTokenPair({ sessionId, fingerprintHash }) {
  const { accessExpiresAt, refreshExpiresAt } = getNewExpiry();
  const accessToken = issueAccessToken({ sessionId, fingerprintHash, expiresAt: accessExpiresAt });
  const refreshToken = issueRefreshToken({ sessionId, expiresAt: refreshExpiresAt });

  return {
    accessToken,
    refreshToken,
    accessExpiresAt,
    refreshExpiresAt,
    accessTokenHash: tokenHash(accessToken),
    refreshTokenHash: tokenHash(refreshToken)
  };
}

module.exports = {
  issueTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  parseAccessToken,
  tokenHash
};
