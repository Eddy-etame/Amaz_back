// Empreinte (fingerprint) de la requête : hash dérivé d'éléments du client, lié au PoW et au
// jeton pour détecter un changement de contexte (anti-vol de session).
const { sha256Hex } = require('./crypto');

function buildFingerprint(req) {
  const explicit =
    (req.headers['x-device-fingerprint'] || req.headers['x-client-fingerprint'] || '')
      .toString()
      .trim();
  const userAgent = (req.headers['user-agent'] || '').toString().trim();
  const forwarded = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim();
  const ip = forwarded || req.ip || req.socket?.remoteAddress || 'unknown';

  if (explicit) {
    return sha256Hex(`fp:${explicit}`);
  }

  return sha256Hex(`ua:${userAgent}|ip:${ip}`);
}

module.exports = {
  buildFingerprint
};
