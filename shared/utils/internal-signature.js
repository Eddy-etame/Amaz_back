// Signature des appels INTERNES (gateway -> microservice, ou service -> service).
//
// Problème à résoudre : un microservice (ex. product-service sur :3002) ne doit
// PAS faire confiance à n'importe quel appel HTTP qui arrive sur son port. Il ne
// doit accepter que les appels qui viennent réellement de la gateway. Comme on
// n'a pas de mTLS, on signe chaque requête interne avec un secret partagé
// (`INTERNAL_SHARED_SECRET`) que seuls les services connaissent.

const { hmacHex, sha256Hex, timingSafeHexEqual } = require('./crypto');

// Construit la chaîne "canonique" qui sera signée. On y met tout ce qui doit être
// figé : le service appelant, la méthode, le chemin, l'horodatage, le nonce et un
// hash du corps. Inclure le hash du corps lie la signature au contenu EXACT :
// si on modifie ne serait-ce qu'un octet du body, la signature ne correspond plus.
function buildCanonicalPayload({ serviceName, method, path, timestamp, nonce, body }) {
  const bodyHash = sha256Hex(body ? JSON.stringify(body) : '');
  return `${serviceName}:${method.toUpperCase()}:${path}:${timestamp}:${nonce}:${bodyHash}`;
}

// Côté appelant : calcule la signature HMAC de la requête.
function signInternalRequest({ secret, serviceName, method, path, timestamp, nonce, body }) {
  const canonical = buildCanonicalPayload({ serviceName, method, path, timestamp, nonce, body });
  return hmacHex(secret, canonical);
}

// Côté service appelé : recalcule la signature attendue et la compare à celle reçue,
// en temps constant (cf. `timingSafeHexEqual`). Renvoie vrai seulement si tout colle.
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
