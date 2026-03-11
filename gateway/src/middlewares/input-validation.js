function normalizeApiPath(rawPath) {
  const path = String(rawPath || '').split('?')[0] || '/';
  if (!path.startsWith('/api/v1')) {
    return path;
  }
  return path.slice('/api/v1'.length) || '/';
}

function hasNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function hasOtpChannel(value) {
  return value === 'email' || value === 'sms';
}

function createValidationResponse(res, requestId, message) {
  return res.status(400).json({
    success: false,
    error: {
      code: 'VALIDATION_ERROR',
      message
    },
    requestId
  });
}

function createGatewayValidationMiddleware() {
  return function gatewayInputValidation(req, res, next) {
    const method = String(req.method || 'GET').toUpperCase();
    const path = normalizeApiPath(req.path || req.originalUrl || '/');
    const body = req.body || {};

    if (method === 'POST' && (path === '/auth/register' || path === '/auth/signup')) {
      if (!hasValidEmail(body.email) || !hasNonEmptyString(body.password) || String(body.password).length < 8) {
        return createValidationResponse(res, req.requestId, 'email valide et password >= 8 requis');
      }
    }

    if (method === 'PUT' && path === '/auth/me') {
      if (!hasValidEmail(body.email)) {
        return createValidationResponse(res, req.requestId, 'email valide requis');
      }
    }

    if (method === 'POST' && path === '/auth/login') {
      if (!hasValidEmail(body.email) || !hasNonEmptyString(body.password)) {
        return createValidationResponse(res, req.requestId, 'email et password requis');
      }
    }

    if (method === 'POST' && path === '/auth/refresh') {
      if (!hasNonEmptyString(body.refreshToken)) {
        return createValidationResponse(res, req.requestId, 'refreshToken requis');
      }
    }

    if (method === 'POST' && path === '/auth/verification/start') {
      const hasIdentity = hasNonEmptyString(body.userId) || hasValidEmail(body.email) || hasNonEmptyString(body.phone);
      if (!hasOtpChannel(body.channel) || !hasIdentity) {
        return createValidationResponse(
          res,
          req.requestId,
          'channel valide et identifiant utilisateur requis (userId/email/phone)'
        );
      }
    }

    if (method === 'POST' && path === '/auth/password/forgot/start') {
      const hasIdentity = hasValidEmail(body.email) || hasNonEmptyString(body.phone);
      if (!hasOtpChannel(body.channel) || !hasIdentity) {
        return createValidationResponse(
          res,
          req.requestId,
          'channel valide et email/phone requis pour forgot password'
        );
      }
    }

    if (
      method === 'POST' &&
      (path === '/auth/verification/confirm' || path === '/auth/password/forgot/confirm')
    ) {
      if (!hasNonEmptyString(body.otpRequestId) || !hasNonEmptyString(body.code)) {
        return createValidationResponse(res, req.requestId, 'otpRequestId et code requis');
      }
    }

    if (method === 'POST' && path === '/auth/password/reset') {
      if (!hasNonEmptyString(body.resetToken) || !hasNonEmptyString(body.newPassword) || String(body.newPassword).length < 8) {
        return createValidationResponse(res, req.requestId, 'resetToken et newPassword >= 8 requis');
      }
    }

    if (method === 'POST' && path === '/commandes') {
      const items = Array.isArray(body.items) ? body.items : body.articles;
      if (!Array.isArray(items) || items.length === 0) {
        return createValidationResponse(res, req.requestId, 'items/articles requis');
      }
    }

    if (
      (method === 'POST' && path === '/addresses') ||
      (method === 'PUT' && path.startsWith('/addresses/'))
    ) {
      if (!hasNonEmptyString(body.street) || !hasNonEmptyString(body.city) || !hasNonEmptyString(body.country)) {
        return createValidationResponse(res, req.requestId, 'street, city et country requis');
      }
    }

    if (method === 'POST' && path === '/messages') {
      const content = body.content || body.contenu;
      if (!hasNonEmptyString(content)) {
        return createValidationResponse(res, req.requestId, 'content/contenu requis');
      }
    }

    return next();
  };
}

module.exports = {
  createGatewayValidationMiddleware
};
