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
  // PostgreSQL undefined_column — often stale DB vs code (run npm run db:bootstrap from Amaz_back)
  const pgMissingColumn = code === '42703';
  const colHint =
    pgMissingColumn && err.column ? ` (${String(err.column)})` : '';
  const message =
    status >= 500
      ? pgMissingColumn
        ? `Schéma base de données incomplet (colonne manquante${colHint}). Si vous utilisez Docker: npm run db:bootstrap:docker. Sinon: npm run db:bootstrap (même Postgres que les conteneurs, ex. localhost:5432 → amaz-postgres).`
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
