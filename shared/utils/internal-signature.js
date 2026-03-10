const { hmacHex, sha256Hex, timingSafeHexEqual } = require('./crypto');

function buildCanonicalPayload({ serviceName, method, path, timestamp, nonce, body }) {
  const bodyHash = sha256Hex(body ? JSON.stringify(body) : '');
  return `${serviceName}:${method.toUpperCase()}:${path}:${timestamp}:${nonce}:${bodyHash}`;
}

function signInternalRequest({ secret, serviceName, method, path, timestamp, nonce, body }) {
  const canonical = buildCanonicalPayload({ serviceName, method, path, timestamp, nonce, body });
  return hmacHex(secret, canonical);
}

function verifyInternalRequest({
  secret,
  serviceName,
  method,
  path,
  timestamp,
  nonce,
  body,
  signature
}) {
  const expected = signInternalRequest({
    secret,
    serviceName,
    method,
    path,
    timestamp,
    nonce,
    body
  });
  return timingSafeHexEqual(expected, signature);
}

module.exports = {
  signInternalRequest,
  verifyInternalRequest
};
