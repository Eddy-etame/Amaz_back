const { buildFingerprint } = require('../../../shared/utils/fingerprint');
const { internalFetch } = require('../../../shared/utils/internal-http');

function createAuthMiddleware({ userServiceUrl, internalSecret, timeoutMs = 7000 }) {
  return async function authMiddleware(req, res, next) {
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

/**
 * For GET routes: no Bearer → next() without req.auth.
 * Bearer present → same introspection as createAuthMiddleware; invalid token → 401.
 */
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
