function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route introuvable'
    },
    requestId: req.requestId
  });
}

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = status >= 500 ? 'Erreur interne' : err.publicMessage || err.message || 'Erreur requête';

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[${req.requestId}]`, err);
  }

  res.status(status).json({
    success: false,
    error: {
      code,
      message
    },
    requestId: req.requestId
  });
}

module.exports = {
  notFoundHandler,
  errorHandler
};
