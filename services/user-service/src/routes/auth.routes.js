const express = require('express');
const { buildFingerprint } = require('../../../../shared/utils/fingerprint');

const {
  register,
  login,
  me,
  introspect,
  refresh,
  logout,
  revoke,
  startOtpFlow,
  confirmVerification,
  startForgotPassword,
  confirmForgotPassword,
  resetPassword
} = require('../services/auth.service');

function getRequestContext(req) {
  const forwardedFingerprint = (req.headers['x-auth-fingerprint'] || '').toString().trim();
  return {
    requestId: req.requestId,
    headers: req.headers,
    ip: req.ip,
    fingerprintHash: forwardedFingerprint || buildFingerprint(req)
  };
}

function requireGatewayAuth(req, res, next) {
  const userId = (req.headers['x-auth-user-id'] || '').toString().trim();
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_REQUIRED',
        message: 'Authentification requise'
      },
      requestId: req.requestId
    });
  }
  req.auth = {
    userId,
    role: (req.headers['x-auth-role'] || '').toString().trim() || 'user',
    email: (req.headers['x-auth-email'] || '').toString().trim()
  };
  return next();
}

function createAuthRouter() {
  const router = express.Router();

  const registerHandler = async (req, res, next) => {
    try {
      const ctx = getRequestContext(req);
      const result = await register({
        payload: req.body,
        fingerprintHash: ctx.fingerprintHash,
        ctx
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  };

  router.post('/register', async (req, res, next) => {
    await registerHandler(req, res, next);
  });
  router.post('/signup', registerHandler);

  router.post('/login', async (req, res, next) => {
    try {
      const ctx = getRequestContext(req);
      const result = await login({
        payload: req.body,
        fingerprintHash: ctx.fingerprintHash,
        ctx
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/refresh', async (req, res, next) => {
    try {
      const ctx = getRequestContext(req);
      const result = await refresh({
        payload: req.body,
        fingerprintHash: ctx.fingerprintHash,
        ctx
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', requireGatewayAuth, async (req, res, next) => {
    try {
      const result = await me({ userId: req.auth.userId });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/logout', requireGatewayAuth, async (req, res, next) => {
    try {
      const authorization = (req.headers.authorization || '').toString().trim();
      const accessToken = authorization.startsWith('Bearer ')
        ? authorization.slice('Bearer '.length).trim()
        : '';

      const result = await logout({
        accessToken,
        userId: req.auth.userId,
        ctx: getRequestContext(req)
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/revoke', requireGatewayAuth, async (req, res, next) => {
    try {
      const result = await revoke({
        payload: req.body,
        requesterUserId: req.auth.userId,
        ctx: getRequestContext(req)
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/verification/start', async (req, res, next) => {
    try {
      const result = await startOtpFlow({
        payload: {
          ...req.body,
          userId: req.body?.userId || (req.headers['x-auth-user-id'] || '').toString().trim() || undefined
        },
        purpose: 'verification',
        ctx: getRequestContext(req)
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/verification/confirm', async (req, res, next) => {
    try {
      const result = await confirmVerification({
        payload: req.body,
        ctx: getRequestContext(req)
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/password/forgot/start', async (req, res, next) => {
    try {
      const result = await startForgotPassword({
        payload: req.body,
        ctx: getRequestContext(req)
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/password/forgot/confirm', async (req, res, next) => {
    try {
      const result = await confirmForgotPassword({
        payload: req.body,
        ctx: getRequestContext(req)
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/password/reset', async (req, res, next) => {
    try {
      const result = await resetPassword({
        payload: req.body,
        ctx: getRequestContext(req)
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/internal/auth/introspect', async (req, res, next) => {
    try {
      const token = String(req.body?.token || '');
      const fingerprintHash = String(req.body?.fingerprint || '');
      const data = await introspect({
        token,
        fingerprintHash
      });
      return res.status(200).json({
        success: true,
        data,
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = {
  createAuthRouter
};
