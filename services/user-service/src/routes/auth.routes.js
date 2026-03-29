const express = require('express');
const { buildFingerprint } = require('../../../../shared/utils/fingerprint');
const { sendEmail, sendTransactionalEmail } = require('../services/notification.service');

const {
  register,
  login,
  authenticateAdmin,
  resolveAdminUserIdFromEmail,
  me,
  updateMe,
  approveVendor,
  rejectVendor,
  addBlockedIpAdmin,
  removeBlockedIpAdmin,
  listBlockedIpsAdmin,
  getAddresses,
  addAddress,
  editAddress,
  setAddressAsDefault,
  removeAddress,
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

function requireAdmin(req, res, next) {
  if (req.auth?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'ADMIN_REQUIRED',
        message: 'Accès administrateur requis'
      },
      requestId: req.requestId
    });
  }
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

  router.put('/me', requireGatewayAuth, async (req, res, next) => {
    try {
      const result = await updateMe({
        userId: req.auth.userId,
        payload: req.body
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.get('/addresses', requireGatewayAuth, async (req, res, next) => {
    try {
      const result = await getAddresses({ userId: req.auth.userId });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/addresses', requireGatewayAuth, async (req, res, next) => {
    try {
      const result = await addAddress({
        userId: req.auth.userId,
        payload: req.body
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/addresses/:addressId', requireGatewayAuth, async (req, res, next) => {
    try {
      const result = await editAddress({
        userId: req.auth.userId,
        addressId: String(req.params.addressId || '').trim(),
        payload: req.body
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.put('/addresses/:addressId/default', requireGatewayAuth, async (req, res, next) => {
    try {
      const result = await setAddressAsDefault({
        userId: req.auth.userId,
        addressId: String(req.params.addressId || '').trim()
      });
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.delete('/addresses/:addressId', requireGatewayAuth, async (req, res, next) => {
    try {
      const result = await removeAddress({
        userId: req.auth.userId,
        addressId: String(req.params.addressId || '').trim()
      });
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

  router.post('/internal/notifications/email', async (req, res, next) => {
    try {
      const to = String(req.body?.to || '').trim();
      if (!to) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'to requis'
          },
          requestId: req.requestId
        });
      }

      if (req.body?.type) {
        await sendTransactionalEmail({
          to,
          type: String(req.body.type),
          templateData: req.body.templateData || {},
          requestId: req.requestId
        });
      } else {
        await sendEmail({
          to,
          subject: String(req.body?.subject || 'Notification Amaz'),
          text: String(req.body?.text || '').trim(),
          type: 'internal_email',
          requestId: req.requestId
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          accepted: true
        },
        requestId: req.requestId
      });
    } catch (error) {
      return next(error);
    }
  });

  router.patch(
    '/admin/vendors/:id/approve',
    requireGatewayAuth,
    requireAdmin,
    async (req, res, next) => {
      try {
        const ctx = getRequestContext(req);
        const result = await approveVendor({
          vendorId: String(req.params.id || '').trim(),
          adminUserId: req.auth.userId,
          ctx
        });
        res.status(result.status).json({
          ...result.body,
          requestId: req.requestId
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.patch(
    '/admin/vendors/:id/reject',
    requireGatewayAuth,
    requireAdmin,
    async (req, res, next) => {
      try {
        const ctx = getRequestContext(req);
        const result = await rejectVendor({
          vendorId: String(req.params.id || '').trim(),
          adminUserId: req.auth.userId,
          ctx
        });
        res.status(result.status).json({
          ...result.body,
          requestId: req.requestId
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get('/admin/ip-blocklist', requireGatewayAuth, requireAdmin, async (req, res, next) => {
    try {
      const result = await listBlockedIpsAdmin();
      res.status(result.status).json({
        ...result.body,
        requestId: req.requestId
      });
    } catch (error) {
      next(error);
    }
  });

  router.post('/admin/ip-blocklist', requireGatewayAuth, requireAdmin, async (req, res, next) => {
    try {
      const ctx = getRequestContext(req);
      const result = await addBlockedIpAdmin({
        ipAddress: req.body?.ip_address || req.body?.ipAddress,
        reason: req.body?.reason,
        adminUserId: req.auth.userId,
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

  router.delete('/admin/ip-blocklist/:ip', requireGatewayAuth, requireAdmin, async (req, res, next) => {
    try {
      const ctx = getRequestContext(req);
      const ip = decodeURIComponent(String(req.params.ip || '').trim());
      const result = await removeBlockedIpAdmin({
        ipAddress: ip,
        adminUserId: req.auth.userId,
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

  router.patch('/internal/admin/vendors/:vendorId/approve', async (req, res, next) => {
    try {
      if (req.internalCaller !== 'admin-service') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Réservé au service admin-service' },
          requestId: req.requestId
        });
      }
      const actorEmail = String(req.body?.actorEmail || '').trim();
      if (!actorEmail) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'actorEmail requis' },
          requestId: req.requestId
        });
      }
      const adminUserId = await resolveAdminUserIdFromEmail(actorEmail);
      if (!adminUserId) {
        return res.status(403).json({
          success: false,
          error: { code: 'ADMIN_ACTOR_INVALID', message: 'Email admin invalide ou rôle non autorisé' },
          requestId: req.requestId
        });
      }
      const ctx = getRequestContext(req);
      const result = await approveVendor({
        vendorId: String(req.params.vendorId || '').trim(),
        adminUserId,
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

  router.patch('/internal/admin/vendors/:vendorId/reject', async (req, res, next) => {
    try {
      if (req.internalCaller !== 'admin-service') {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Réservé au service admin-service' },
          requestId: req.requestId
        });
      }
      const actorEmail = String(req.body?.actorEmail || '').trim();
      if (!actorEmail) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'actorEmail requis' },
          requestId: req.requestId
        });
      }
      const adminUserId = await resolveAdminUserIdFromEmail(actorEmail);
      if (!adminUserId) {
        return res.status(403).json({
          success: false,
          error: { code: 'ADMIN_ACTOR_INVALID', message: 'Email admin invalide ou rôle non autorisé' },
          requestId: req.requestId
        });
      }
      const ctx = getRequestContext(req);
      const result = await rejectVendor({
        vendorId: String(req.params.vendorId || '').trim(),
        adminUserId,
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

  router.post('/internal/admin/authenticate', async (req, res, next) => {
    try {
      const { email, password } = req.body || {};
      const result = await authenticateAdmin({ email, password });
      if (!result.ok) {
        return res.status(401).json({
          success: false,
          error: { code: 'INVALID_CREDENTIALS', message: 'Identifiants invalides' },
          requestId: req.requestId
        });
      }
      return res.status(200).json({
        success: true,
        data: { user: result.user },
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
