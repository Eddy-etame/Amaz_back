const { sha256Hex } = require('./crypto');

function hasLeadingZeros(hex, difficulty) {
  if (difficulty <= 0) return true;
  return hex.startsWith('0'.repeat(difficulty));
}

function buildPowPayload({ method, path, timestamp, nonce, fingerprint }) {
  return `${method.toUpperCase()}:${path}:${timestamp}:${nonce}:${fingerprint}`;
}

function verifyPow({ method, path, timestamp, nonce, fingerprint, proof, difficulty }) {
  const payload = buildPowPayload({ method, path, timestamp, nonce, fingerprint });
  const expectedHash = sha256Hex(payload);
  return expectedHash === proof && hasLeadingZeros(proof, difficulty);
}

module.exports = {
  verifyPow,
  buildPowPayload,
  hasLeadingZeros
};
