const { config } = require('../config');
const { hmacHex, sha256Hex, timingSafeHexEqual, randomToken } = require('../../../../shared/utils/crypto');

function issueAccessToken({ sessionId, fingerprintHash, expiresAt }) {
  const signature = hmacHex(
    config.accessHmacSecret,
    `${sessionId}.${expiresAt}.${fingerprintHash}`
  );
  return `atk.${sessionId}.${expiresAt}.${signature}`;
}

function issueRefreshToken({ sessionId, expiresAt }) {
  const rotationNonce = randomToken(16);
  const signature = hmacHex(config.refreshHmacSecret, `${sessionId}.${rotationNonce}.${expiresAt}`);
  return `rtk.${sessionId}.${rotationNonce}.${expiresAt}.${signature}`;
}

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

function tokenHash(token) {
  return sha256Hex(token);
}

function getNewExpiry() {
  const accessTtlMs = config.sessionTtlMinutes * 60 * 1000;
  const refreshTtlMs = config.refreshTtlDays * 24 * 60 * 60 * 1000;
  return {
    accessExpiresAt: Date.now() + accessTtlMs,
    refreshExpiresAt: Date.now() + refreshTtlMs
  };
}

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
