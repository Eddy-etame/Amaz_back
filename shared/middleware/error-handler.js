// Gestion centralisée des erreurs (à monter EN DERNIER dans la chaîne Express).
//
// `notFoundHandler` répond pour toute route non reconnue ; `errorHandler` attrape les
// erreurs remontées par `next(err)`. On masque les détails internes au client (pour
// les 5xx on dit juste "Erreur interne") mais on les journalise côté serveur.

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
  // Cas particulier : code Postgres 42703 = "colonne inexistante". Quasi toujours une
  // base pas à jour par rapport au code -> on renvoie un message actionnable qui dit
  // de relancer les migrations (db:bootstrap). Ça nous a fait gagner du temps en dev.
  const pgMissingColumn = code === '42703';
  const colHint =
    pgMissingColumn && err.column ? ` (${String(err.column)})` : '';
  const message =
    status >= 500
      ? pgMissingColumn
        ? `Schéma base de données incomplet (colonne manquante${colHint}). Si vous utilisez Docker: npm run db:bootstrap:docker. Sinon: npm run db:bootstrap (même Postgres que les conteneurs, ex. localhost:5432 → amaz-postgres).`
        : 'Erreur interne'
      : err.publicMessage || err.message || 'Erreur requête';

  // On ne logge en détail que les vraies erreurs serveur (5xx), avec le requestId.
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
