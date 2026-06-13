// Vérification de l'authentification au niveau de la gateway.
//
// La gateway ne sait pas (volontairement) valider un token toute seule : elle
// demande au user-service de l'"introspecter" (route interne signée). Ça garde la
// logique d'auth dans un seul service. On lie aussi l'empreinte client au token
// (binding) pour limiter le vol de session.
//
// Deux variantes :
//   - createAuthMiddleware         : token OBLIGATOIRE (routes privées).
//   - createOptionalAuthMiddleware : token FACULTATIF (ex. GET catalogue : on
//     personnalise si connecté, mais on autorise l'anonyme).

const { buildFingerprint } = require('../../../shared/utils/fingerprint');
const { internalFetch } = require('../../../shared/utils/internal-http');

function createAuthMiddleware({ userServiceUrl, internalSecret, timeoutMs = 7000 }) {
  return async function authMiddleware(req, res, next) {
    // 1) En-tête `Authorization: Bearer <token>` présent et bien formé ?
    const authorization = (req.headers.authorization || '').toString().trim();
    if (!authorization.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Authentification requise'
        },
        requestId: req.requestId
      });
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_REQUIRED',
          message: 'Token invalide'
        },
        requestId: req.requestId
      });
    }

    const fingerprint = buildFingerprint(req);

    try {
      // 2) On demande au user-service si ce token est valide (et lié à cette empreinte).
      const introspect = await internalFetch({
        baseUrl: userServiceUrl,
        path: '/internal/auth/introspect',
        method: 'POST',
        body: { token, fingerprint },
        callerService: 'gateway',
        secret: internalSecret,
        requestId: req.requestId,
        timeoutMs
      });

      // 3a) Erreur côté user-service : on distingue panne (>=500 -> 502) et refus (401).
      if (!introspect.ok) {
        if ((introspect.status || 500) >= 500) {
          return next({
            status: 502,
            code: 'AUTH_INTROSPECTION_FAILED',
            publicMessage: 'Service auth indisponible'
          });
        }
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_INVALID',
            message: 'Session invalide ou expirée'
          },
          requestId: req.requestId
        });
      }

      // 3b) Le user-service répond mais le token n'est pas "actif" -> 401.
      if (!introspect.payload?.data?.active) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_INVALID',
            message: 'Session invalide ou expirée'
          },
          requestId: req.requestId
        });
      }

      // 4) OK : on attache l'identité (id, rôle…) à la requête pour la suite/le proxy.
      req.auth = introspect.payload.data;
      return next();
    } catch (error) {
      // Service injoignable / timeout : 502 propre via le gestionnaire d'erreurs.
      return next({
        status: 502,
        code: 'AUTH_INTROSPECTION_FAILED',
        publicMessage: 'Service auth indisponible',
        message: error.message
      });
    }
  };
}

// Variante "facultative" : pas de Bearer -> on laisse passer en anonyme (pas de
// `req.auth`). Si un Bearer est fourni, on l'introspecte exactement comme ci-dessus,
// et un token présent mais invalide est refusé (401) plutôt qu'ignoré.
function createOptionalAuthMiddleware({ userServiceUrl, internalSecret, timeoutMs = 7000 }) {
  return async function optionalAuthMiddleware(req, res, next) {
    const authorization = (req.headers.authorization || '').toString().trim();
    if (!authorization.startsWith('Bearer ')) {
      return next();
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) {
      return next();
    }

    const fingerprint = buildFingerprint(req);

    try {
      const introspect = await internalFetch({
        baseUrl: userServiceUrl,
        path: '/internal/auth/introspect',
        method: 'POST',
        body: { token, fingerprint },
        callerService: 'gateway',
        secret: internalSecret,
        requestId: req.requestId,
        timeoutMs
      });

      if (!introspect.ok) {
        if ((introspect.status || 500) >= 500) {
          return next({
            status: 502,
            code: 'AUTH_INTROSPECTION_FAILED',
            publicMessage: 'Service auth indisponible'
          });
        }
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_INVALID',
            message: 'Session invalide ou expirée'
          },
          requestId: req.requestId
        });
      }

      if (!introspect.payload?.data?.active) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'AUTH_INVALID',
            message: 'Session invalide ou expirée'
          },
          requestId: req.requestId
        });
      }

      req.auth = introspect.payload.data;
      return next();
    } catch (error) {
      return next({
        status: 502,
        code: 'AUTH_INTROSPECTION_FAILED',
        publicMessage: 'Service auth indisponible',
        message: error.message
      });
    }
  };
}

module.exports = {
  createAuthMiddleware,
  createOptionalAuthMiddleware
};
