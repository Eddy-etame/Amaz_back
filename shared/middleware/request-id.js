// Identifiant de requête (traçabilité).
//
// On attache un `requestId` à chaque requête et on le renvoie dans l'en-tête de
// réponse. Il se retrouve dans tous nos messages d'erreur et nos logs : on peut donc
// suivre une même requête de bout en bout (front -> gateway -> service). Si l'appelant
// fournit déjà un `x-request-id`, on le reprend ; sinon on en génère un.

const { randomId } = require('../utils/ids');

function requestIdMiddleware(req, res, next) {
  const incoming = (req.headers['x-request-id'] || '').toString().trim();
  const requestId = incoming || randomId('req');
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
}

module.exports = {
  requestIdMiddleware
};
