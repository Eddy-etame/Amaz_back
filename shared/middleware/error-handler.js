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
  // Colonne inconnue côté MySQL (souvent un schéma périmé par rapport au code) :
  // le driver mysql2 renvoie le code 'ER_BAD_FIELD_ERROR' (errno 1054).
  const missingColumn = code === 'ER_BAD_FIELD_ERROR' || err.errno === 1054;
  const colHint = missingColumn && err.column ? ` (${String(err.column)})` : '';
  const message =
    status >= 500
      ? missingColumn
        ? `Schéma base de données incomplet (colonne manquante${colHint}). Avec Docker : npm run db:bootstrap:docker. Sinon : npm run db:bootstrap (même base MySQL que les conteneurs).`
        : 'Erreur interne'
      : err.publicMessage || err.message || 'Erreur requête';

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

