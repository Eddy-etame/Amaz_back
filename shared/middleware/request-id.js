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
