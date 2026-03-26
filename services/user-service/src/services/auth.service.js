const { config } = require('../config');
const { randomId } = require('../../../../shared/utils/ids');
const { hmacHex, randomToken, randomDigits, sha256Hex, timingSafeHexEqual } = require('../../../../shared/utils/crypto');
const { isAllowedChannel, isEmail, isPhone, requireFields } = require('../../../../shared/utils/validators');
const {
  findUserByEmail,
  findUserByPhone,
  findUserById,
  createUser,
  createVendor,
  updateUserProfile,
  updatePassword,
  updateVendorApproval,
  markVerification,
  insertSecurityEvent
} = require('../repositories/user.repository');
const {
  listUserAddresses,
  createUserAddress,
  updateUserAddress,
  setDefaultUserAddress,
  deleteUserAddress
} = require('../repositories/address.repository');
const {
  createSession,
  getSessionById,
  getActiveSessionByAccessHash,
  rotateSessionTokens,
  revokeSession,
  revokeAllUserSessions,
  insertTokenRevocation,
  isTokenRevoked
} = require('../repositories/session.repository');
const {
  createOtpRequest,
  countRecentOtpRequests,
  getOtpRequestById,
  insertOtpAttempt,
  incrementOtpAttempts,
  consumeOtpRequest,
  lockOtpRequest,
  createPasswordResetRequest,
  getActivePasswordResetRequest,
  consumePasswordResetRequest
} = require('../repositories/otp.repository');
const { addBlockedIp, removeBlockedIp, listBlockedIps } = require('../repositories/blocked-ips.repository');
const { issueTokenPair, verifyAccessToken, verifyRefreshToken, parseAccessToken, tokenHash } = require('./token.service');
const { buildPasswordHash, verifyPassword } = require('./password.service');
const { sendOtp, maskDestination } = require('./notification.service');

function getIpAddress(ctx) {
  const forwarded = (ctx.headers?.['x-forwarded-for'] || '').toString().split(',')[0].trim();
  return forwarded || ctx.ip || null;
}

function buildOtpCode() {
  return randomDigits(6);
}

function otpCodeHash({ otpRequestId, code }) {
  return hmacHex(config.accessHmacSecret, `${otpRequestId}:${code}`);
}

function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    username: user.username,
    role: user.role,
    emailVerified: Boolean(user.email_verified),
    smsVerified: Boolean(user.sms_verified)
  };
}

function genericOtpAcceptedBody(data = {}) {
  return {
    success: true,
    data: {
      accepted: true,
      ...data
    }
  };
}

function resolveUserDestination(user, channel) {
  if (channel === 'sms') {
    return user.phone || null;
  }
  return user.email || null;
}

function normalizeAddressPayload(payload = {}) {
  return {
    label: String(payload.label || 'Adresse').trim() || 'Adresse',
    street: String(payload.street || '').trim(),
    city: String(payload.city || '').trim(),
    postalCode: String(payload.postalCode || payload.postal_code || '').trim(),
    country: String(payload.country || '').trim(),
    phone: String(payload.phone || '').trim()
  };
}

async function createSessionForUser({ user, fingerprintHash, ctx }) {
  const sessionId = randomId('sess');
  const pair = issueTokenPair({
    sessionId,
    fingerprintHash
  });

  await createSession({
    sessionId,
    userId: user.id,
    accessTokenHash: pair.accessTokenHash,
    refreshTokenHash: pair.refreshTokenHash,
    fingerprintHash,
    ipAddress: getIpAddress(ctx),
    userAgent: ctx.headers?.['user-agent'] || null,
    accessExpiresAt: pair.accessExpiresAt,
    refreshExpiresAt: pair.refreshExpiresAt
  });

  return pair;
}

async function register({ payload, fingerprintHash, ctx }) {
  const validation = requireFields(payload, ['email', 'password']);
  if (!validation.ok) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Champs manquants: ${validation.missing.join(', ')}`
        }
      }
    };
  }

  if (!isEmail(payload.email)) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Adresse email invalide'
        }
      }
    };
  }

  if (String(payload.password).length < 8) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Le mot de passe doit contenir au moins 8 caractères'
        }
      }
    };
  }

  const existing = await findUserByEmail(payload.email);
  if (existing) {
    return {
      status: 409,
      body: {
        success: false,
        error: {
          code: 'ACCOUNT_EXISTS',
          message: 'Compte déjà existant'
        }
      }
    };
  }

  const role = String(payload.role || 'user').toLowerCase();
  if (role === 'vendor') {
    const vendorValidation = requireFields(payload, ['businessName']);
    if (!vendorValidation.ok) {
      return {
        status: 400,
        body: {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Champs manquants pour vendeur: ${vendorValidation.missing.join(', ')}`
          }
        }
      };
    }
  }

  const { passwordHash, passwordSalt } = await buildPasswordHash({
    password: payload.password,
    requestId: ctx.requestId
  });

  const userId = randomId('usr');
  if (role === 'vendor') {
    await createVendor({
      userId,
      email: payload.email,
      phone: payload.phone || null,
      username: payload.username || null,
      passwordHash,
      passwordSalt,
      businessName: payload.businessName || null,
      siret: payload.siret || null,
      address: payload.address || null,
      taxId: payload.taxId || null,
      iban: payload.iban || null
    });
  } else {
    await createUser({
      userId,
      email: payload.email,
      phone: payload.phone || null,
      username: payload.username || null,
      role: role || 'user',
      passwordHash,
      passwordSalt
    });
  }

  const created = await findUserById(userId);
  const session = await createSessionForUser({
    user: created,
    fingerprintHash,
    ctx
  });

  await insertSecurityEvent({
    userId,
    eventType: 'auth.register.success',
    requestId: ctx.requestId,
    ipAddress: getIpAddress(ctx),
    fingerprintHash
  });

  return {
    status: 201,
    body: {
      success: true,
      data: {
        user: toPublicUser(created),
        token: session.accessToken,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        accessExpiresAt: session.accessExpiresAt,
        refreshExpiresAt: session.refreshExpiresAt
      }
    }
  };
}

async function login({ payload, fingerprintHash, ctx }) {
  const validation = requireFields(payload, ['email', 'password']);
  if (!validation.ok) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Champs manquants: ${validation.missing.join(', ')}`
        }
      }
    };
  }

  const user = await findUserByEmail(payload.email);
  const genericError = {
    status: 401,
    body: {
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email ou mot de passe invalide'
      }
    }
  };

  if (!user) {
    await insertSecurityEvent({
      eventType: 'auth.login.failed',
      requestId: ctx.requestId,
      ipAddress: getIpAddress(ctx),
      fingerprintHash,
      metadata: { reason: 'unknown_user' }
    });
    return genericError;
  }

  const valid = await verifyPassword({
    password: payload.password,
    passwordHash: user.password_hash,
    passwordSalt: user.password_salt,
    requestId: ctx.requestId
  });
  if (!valid) {
    await insertSecurityEvent({
      userId: user.id,
      eventType: 'auth.login.failed',
      requestId: ctx.requestId,
      ipAddress: getIpAddress(ctx),
      fingerprintHash,
      metadata: { reason: 'bad_password' }
    });
    return genericError;
  }

  if (user.role === 'vendor' && user.approval_status !== 'approved') {
    await insertSecurityEvent({
      userId: user.id,
      eventType: 'auth.login.failed',
      requestId: ctx.requestId,
      ipAddress: getIpAddress(ctx),
      fingerprintHash,
      metadata: { reason: 'vendor_not_approved' }
    });
    return {
      status: 403,
      body: {
        success: false,
        error: {
          code: user.approval_status === 'rejected' ? 'VENDOR_REJECTED' : 'VENDOR_PENDING_APPROVAL',
          message:
            user.approval_status === 'rejected'
              ? 'Votre compte vendeur a été refusé.'
              : 'Votre compte vendeur est en attente d\'approbation par un administrateur.'
        }
      }
    };
  }

  const session = await createSessionForUser({
    user,
    fingerprintHash,
    ctx
  });

  await insertSecurityEvent({
    userId: user.id,
    eventType: 'auth.login.success',
    requestId: ctx.requestId,
    ipAddress: getIpAddress(ctx),
    fingerprintHash
  });

  return {
    status: 200,
    body: {
      success: true,
      data: {
        user: toPublicUser(user),
        token: session.accessToken,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        accessExpiresAt: session.accessExpiresAt,
        refreshExpiresAt: session.refreshExpiresAt
      }
    }
  };
}

async function me({ userId }) {
  const user = await findUserById(userId);
  if (!user) {
    return {
      status: 404,
      body: {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Utilisateur introuvable'
        }
      }
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      data: {
        user: toPublicUser(user)
      }
    }
  };
}

async function approveVendor({ vendorId, adminUserId, ctx }) {
  const vendor = await findUserById(vendorId);
  if (!vendor || vendor.role !== 'vendor') {
    return {
      status: 404,
      body: {
        success: false,
        error: {
          code: 'VENDOR_NOT_FOUND',
          message: 'Vendeur introuvable'
        }
      }
    };
  }

  await updateVendorApproval({
    vendorId,
    approvalStatus: 'approved',
    approvedBy: adminUserId
  });

  await insertSecurityEvent({
    userId: adminUserId,
    eventType: 'admin.vendor_approved',
    severity: 'info',
    requestId: ctx.requestId,
    ipAddress: getIpAddress(ctx),
    metadata: { vendorId }
  });

  return {
    status: 200,
    body: {
      success: true,
      data: { vendorId, approvalStatus: 'approved' }
    }
  };
}

async function rejectVendor({ vendorId, adminUserId, ctx }) {
  const vendor = await findUserById(vendorId);
  if (!vendor || vendor.role !== 'vendor') {
    return {
      status: 404,
      body: {
        success: false,
        error: {
          code: 'VENDOR_NOT_FOUND',
          message: 'Vendeur introuvable'
        }
      }
    };
  }

  await updateVendorApproval({
    vendorId,
    approvalStatus: 'rejected',
    approvedBy: null
  });

  await insertSecurityEvent({
    userId: adminUserId,
    eventType: 'admin.vendor_rejected',
    severity: 'info',
    requestId: ctx.requestId,
    ipAddress: getIpAddress(ctx),
    metadata: { vendorId }
  });

  return {
    status: 200,
    body: {
      success: true,
      data: { vendorId, approvalStatus: 'rejected' }
    }
  };
}

async function addBlockedIpAdmin({ ipAddress, reason, adminUserId, ctx }) {
  const ip = String(ipAddress || '').trim();
  if (!ip) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Adresse IP requise'
        }
      }
    };
  }

  try {
    await addBlockedIp({
      ipAddress: ip,
      reason: reason || null,
      blockedBy: adminUserId
    });
  } catch (err) {
    if (err.code === '23505') {
      return {
        status: 409,
        body: {
          success: false,
          error: {
            code: 'IP_ALREADY_BLOCKED',
            message: 'Cette adresse IP est déjà bloquée'
          }
        }
      };
    }
    throw err;
  }

  await insertSecurityEvent({
    userId: adminUserId,
    eventType: 'admin.ip_blocked',
    severity: 'info',
    requestId: ctx.requestId,
    ipAddress: getIpAddress(ctx),
    metadata: { blockedIp: ip, reason: reason || null }
  });

  return {
    status: 201,
    body: {
      success: true,
      data: { ipAddress: ip }
    }
  };
}

async function removeBlockedIpAdmin({ ipAddress, adminUserId, ctx }) {
  const ip = String(ipAddress || '').trim();
  if (!ip) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Adresse IP requise'
        }
      }
    };
  }

  const removed = await removeBlockedIp(ip);
  if (!removed) {
    return {
      status: 404,
      body: {
        success: false,
        error: {
          code: 'IP_NOT_BLOCKED',
          message: 'Cette adresse IP n\'est pas dans la liste des bloquées'
        }
      }
    };
  }

  await insertSecurityEvent({
    userId: adminUserId,
    eventType: 'admin.ip_unblocked',
    severity: 'info',
    requestId: ctx.requestId,
    ipAddress: getIpAddress(ctx),
    metadata: { unblockedIp: ip }
  });

  return {
    status: 200,
    body: {
      success: true,
      data: { ipAddress: ip, removed: true }
    }
  };
}

async function listBlockedIpsAdmin() {
  const items = await listBlockedIps();
  return {
    status: 200,
    body: {
      success: true,
      data: {
        items: items.map((r) => ({
          id: r.id,
          ip_address: r.ip_address,
          reason: r.reason,
          blocked_by: r.blocked_by,
          blocked_at: r.blocked_at
        }))
      }
    }
  };
}

async function updateMe({ userId, payload }) {
  const user = await findUserById(userId);
  if (!user) {
    return {
      status: 404,
      body: {
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'Utilisateur introuvable'
        }
      }
    };
  }

  const email = String(payload?.email ?? user.email ?? '').trim().toLowerCase();
  const username = String(payload?.username ?? payload?.nom ?? user.username ?? '').trim();
  const phone = String(payload?.phone ?? payload?.telephone ?? user.phone ?? '').trim();

  if (!isEmail(email)) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'INVALID_EMAIL',
          message: 'Adresse email invalide'
        }
      }
    };
  }

  await updateUserProfile({
    userId,
    email,
    phone: phone || null,
    username: username || null
  });

  const updated = await findUserById(userId);
  return {
    status: 200,
    body: {
      success: true,
      data: {
        user: toPublicUser(updated)
      }
    }
  };
}

async function getAddresses({ userId }) {
  const addresses = await listUserAddresses(userId);
  return {
    status: 200,
    body: {
      success: true,
      data: {
        items: addresses
      }
    }
  };
}

async function addAddress({ userId, payload }) {
  const address = normalizeAddressPayload(payload);
  const validation = requireFields(address, ['street', 'city', 'country']);
  if (!validation.ok) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Champs manquants: ${validation.missing.join(', ')}`
        }
      }
    };
  }

  const created = await createUserAddress({
    addressId: randomId('addr'),
    userId,
    ...address,
    isDefault: Boolean(payload?.isDefault)
  });

  return {
    status: 201,
    body: {
      success: true,
      data: created
    }
  };
}

async function editAddress({ userId, addressId, payload }) {
  const address = normalizeAddressPayload(payload);
  const validation = requireFields(address, ['street', 'city', 'country']);
  if (!validation.ok) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Champs manquants: ${validation.missing.join(', ')}`
        }
      }
    };
  }

  const updated = await updateUserAddress({
    userId,
    addressId,
    ...address,
    isDefault: Boolean(payload?.isDefault)
  });

  if (!updated) {
    return {
      status: 404,
      body: {
        success: false,
        error: {
          code: 'ADDRESS_NOT_FOUND',
          message: 'Adresse introuvable'
        }
      }
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      data: updated
    }
  };
}

async function setAddressAsDefault({ userId, addressId }) {
  const updated = await setDefaultUserAddress({ userId, addressId });
  if (!updated) {
    return {
      status: 404,
      body: {
        success: false,
        error: {
          code: 'ADDRESS_NOT_FOUND',
          message: 'Adresse introuvable'
        }
      }
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      data: updated
    }
  };
}

async function removeAddress({ userId, addressId }) {
  const deleted = await deleteUserAddress({ userId, addressId });
  if (!deleted) {
    return {
      status: 404,
      body: {
        success: false,
        error: {
          code: 'ADDRESS_NOT_FOUND',
          message: 'Adresse introuvable'
        }
      }
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      data: {
        deleted: true
      }
    }
  };
}

async function introspect({ token, fingerprintHash }) {
  const validity = verifyAccessToken(token, fingerprintHash);
  if (!validity.valid) {
    return {
      active: false,
      reason: validity.reason
    };
  }

  const accessHash = tokenHash(token);
  if (await isTokenRevoked(accessHash)) {
    return {
      active: false,
      reason: 'revoked'
    };
  }

  const session = await getActiveSessionByAccessHash(accessHash);
  if (!session) {
    return {
      active: false,
      reason: 'session_not_found'
    };
  }

  if (session.fingerprint_hash !== fingerprintHash) {
    await revokeSession({
      sessionId: session.id,
      reason: 'fingerprint_mismatch',
      revokedBy: 'system'
    });
    await insertTokenRevocation({
      tokenType: 'access',
      tokenHash: accessHash,
      sessionId: session.id,
      userId: session.user_id,
      reason: 'fingerprint_mismatch'
    });
    await insertSecurityEvent({
      userId: session.user_id,
      eventType: 'auth.session.revoked',
      severity: 'warning',
      fingerprintHash,
      metadata: {
        reason: 'fingerprint_mismatch'
      }
    });
    return {
      active: false,
      reason: 'fingerprint_mismatch'
    };
  }

  return {
    active: true,
    userId: session.user_id,
    role: session.role,
    email: session.email,
    fingerprintHash
  };
}

async function refresh({ payload, fingerprintHash, ctx }) {
  const validation = requireFields(payload, ['refreshToken']);
  if (!validation.ok) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Champs manquants: ${validation.missing.join(', ')}`
        }
      }
    };
  }

  const refreshToken = String(payload.refreshToken);
  const validity = verifyRefreshToken(refreshToken);
  if (!validity.valid || !validity.parsed) {
    return {
      status: 401,
      body: {
        success: false,
        error: {
          code: 'REFRESH_INVALID',
          message: 'Refresh token invalide'
        }
      }
    };
  }

  const session = await getSessionById(validity.parsed.sessionId);
  if (!session || session.revoked_at || new Date(session.refresh_expires_at).getTime() <= Date.now()) {
    return {
      status: 401,
      body: {
        success: false,
        error: {
          code: 'REFRESH_EXPIRED',
          message: 'Session expirée'
        }
      }
    };
  }

  if (session.fingerprint_hash !== fingerprintHash) {
    await revokeSession({
      sessionId: session.id,
      reason: 'fingerprint_mismatch',
      revokedBy: 'system'
    });
    await insertSecurityEvent({
      userId: session.user_id,
      eventType: 'auth.refresh.failed',
      severity: 'warning',
      requestId: ctx.requestId,
      ipAddress: getIpAddress(ctx),
      fingerprintHash,
      metadata: { reason: 'fingerprint_mismatch' }
    });
    return {
      status: 401,
      body: {
        success: false,
        error: {
          code: 'REFRESH_FINGERPRINT_MISMATCH',
          message: 'Session invalide'
        }
      }
    };
  }

  const refreshHash = tokenHash(refreshToken);
  if (refreshHash !== session.refresh_token_hash || (await isTokenRevoked(refreshHash))) {
    await revokeSession({
      sessionId: session.id,
      reason: 'refresh_replay',
      revokedBy: 'system'
    });
    await insertSecurityEvent({
      userId: session.user_id,
      eventType: 'auth.refresh.failed',
      severity: 'warning',
      requestId: ctx.requestId,
      ipAddress: getIpAddress(ctx),
      fingerprintHash,
      metadata: { reason: 'refresh_replay' }
    });
    return {
      status: 401,
      body: {
        success: false,
        error: {
          code: 'REFRESH_REVOKED',
          message: 'Refresh token révoqué'
        }
      }
    };
  }

  const pair = issueTokenPair({
    sessionId: session.id,
    fingerprintHash
  });

  await rotateSessionTokens({
    sessionId: session.id,
    accessTokenHash: pair.accessTokenHash,
    refreshTokenHash: pair.refreshTokenHash,
    accessExpiresAt: pair.accessExpiresAt,
    refreshExpiresAt: pair.refreshExpiresAt
  });
  await insertTokenRevocation({
    tokenType: 'refresh',
    tokenHash: refreshHash,
    sessionId: session.id,
    userId: session.user_id,
    reason: 'refresh_rotation'
  });

  return {
    status: 200,
    body: {
      success: true,
      data: {
        token: pair.accessToken,
        accessToken: pair.accessToken,
        refreshToken: pair.refreshToken,
        accessExpiresAt: pair.accessExpiresAt,
        refreshExpiresAt: pair.refreshExpiresAt
      }
    }
  };
}

async function logout({ accessToken, userId, ctx }) {
  const parsed = parseAccessToken(accessToken);
  if (!parsed) {
    return {
      status: 200,
      body: {
        success: true,
        data: { loggedOut: true }
      }
    };
  }

  const tokenHashValue = tokenHash(accessToken);
  await revokeSession({
    sessionId: parsed.sessionId,
    reason: 'logout',
    revokedBy: userId || 'user'
  });
  await insertTokenRevocation({
    tokenType: 'access',
    tokenHash: tokenHashValue,
    sessionId: parsed.sessionId,
    userId: userId || null,
    reason: 'logout'
  });
  await insertSecurityEvent({
    userId: userId || null,
    eventType: 'auth.logout.success',
    requestId: ctx.requestId,
    ipAddress: getIpAddress(ctx),
    fingerprintHash: ctx.fingerprintHash
  });

  return {
    status: 200,
    body: {
      success: true,
      data: { loggedOut: true }
    }
  };
}

async function revoke({ payload, requesterUserId, ctx }) {
  if (payload?.allSessions) {
    await revokeAllUserSessions({
      userId: requesterUserId,
      reason: payload.reason || 'manual_revoke_all',
      revokedBy: requesterUserId
    });
    await insertSecurityEvent({
      userId: requesterUserId || null,
      eventType: 'auth.session.revoke_all',
      requestId: ctx.requestId,
      ipAddress: getIpAddress(ctx),
      fingerprintHash: ctx.fingerprintHash
    });
    return {
      status: 200,
      body: {
        success: true,
        data: { revokedAll: true }
      }
    };
  }

  const sessionId = payload?.sessionId || parseAccessToken(payload?.accessToken || '')?.sessionId;
  if (!sessionId) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'SESSION_ID_REQUIRED',
          message: 'sessionId requis'
        }
      }
    };
  }

  const targetSession = await getSessionById(sessionId);
  if (!targetSession) {
    return {
      status: 404,
      body: {
        success: false,
        error: {
          code: 'SESSION_NOT_FOUND',
          message: 'Session introuvable'
        }
      }
    };
  }

  if (targetSession.user_id !== requesterUserId) {
    await insertSecurityEvent({
      userId: requesterUserId || null,
      eventType: 'auth.revoke.forbidden',
      severity: 'warning',
      requestId: ctx.requestId,
      ipAddress: getIpAddress(ctx),
      fingerprintHash: ctx.fingerprintHash,
      metadata: { sessionId }
    });
    return {
      status: 403,
      body: {
        success: false,
        error: {
          code: 'SESSION_FORBIDDEN',
          message: 'Session non autorisée'
        }
      }
    };
  }

  await revokeSession({
    sessionId,
    reason: payload.reason || 'manual_revoke',
    revokedBy: requesterUserId
  });

  await insertSecurityEvent({
    userId: requesterUserId || null,
    eventType: 'auth.session.revoked',
    requestId: ctx.requestId,
    ipAddress: getIpAddress(ctx),
    fingerprintHash: ctx.fingerprintHash,
    metadata: { sessionId }
  });

  return {
    status: 200,
    body: {
      success: true,
      data: { sessionId, revoked: true }
    }
  };
}

async function startOtpFlow({ payload, purpose, ctx }) {
  const channel = payload?.channel;
  const genericResponseData = {
    otpRequestId: randomId('otp'),
    channel,
    destination: channel === 'sms' ? '****' : '**@***',
    expiresAt: Date.now() + config.otpTtlMinutes * 60 * 1000
  };

  if (!isAllowedChannel(channel)) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'INVALID_CHANNEL',
          message: 'Canal invalide. Utiliser email ou sms'
        }
      }
    };
  }

  let user = null;
  if (payload.userId) {
    user = await findUserById(payload.userId);
  } else if (payload.email && isEmail(payload.email)) {
    user = await findUserByEmail(payload.email);
  } else if (payload.phone && isPhone(payload.phone)) {
    user = await findUserByPhone(payload.phone);
  }

  if (!user) {
    return {
      status: 200,
      body: genericOtpAcceptedBody(genericResponseData)
    };
  }

  const destination = resolveUserDestination(user, channel);
  if (!destination) {
    await insertSecurityEvent({
      userId: user.id,
      eventType: 'otp.destination.missing',
      severity: 'warning',
      requestId: ctx.requestId,
      ipAddress: getIpAddress(ctx),
      fingerprintHash: ctx.fingerprintHash,
      metadata: { purpose, channel }
    });
    return {
      status: 200,
      body: genericOtpAcceptedBody(genericResponseData)
    };
  }

  const recentCount = await countRecentOtpRequests({
    userId: user.id,
    purpose,
    channel,
    destination,
    windowSeconds: config.otpCooldownSeconds
  });
  if (recentCount > 0) {
    return {
      status: 200,
      body: genericOtpAcceptedBody(genericResponseData)
    };
  }

  const hourlyCount = await countRecentOtpRequests({
    userId: user.id,
    purpose,
    channel,
    destination,
    windowSeconds: 3600
  });
  if (hourlyCount >= config.otpMaxRequestsPerHour) {
    await insertSecurityEvent({
      userId: user.id,
      eventType: 'otp.rate_limited',
      severity: 'warning',
      requestId: ctx.requestId,
      ipAddress: getIpAddress(ctx),
      fingerprintHash: ctx.fingerprintHash,
      metadata: { purpose, channel, destination }
    });
    return {
      status: 429,
      body: {
        success: false,
        error: {
          code: 'OTP_RATE_LIMITED',
          message: 'Trop de demandes OTP, réessayez plus tard'
        }
      }
    };
  }

  const otpRequestId = randomId('otp');
  const code = buildOtpCode();
  const codeHash = otpCodeHash({
    otpRequestId,
    code
  });
  const expiresAt = Date.now() + config.otpTtlMinutes * 60 * 1000;

  await createOtpRequest({
    otpRequestId,
    userId: user.id,
    purpose,
    channel,
    destination,
    codeHash,
    expiresAt,
    requestMeta: {
      requestId: ctx.requestId,
      ipAddress: getIpAddress(ctx)
    }
  });

  await sendOtp({
    channel,
    destination,
    code,
    purpose,
    requestId: ctx.requestId
  });

  await insertSecurityEvent({
    userId: user.id,
    eventType: 'otp.sent',
    requestId: ctx.requestId,
    ipAddress: getIpAddress(ctx),
    fingerprintHash: ctx.fingerprintHash,
    metadata: {
      purpose,
      channel,
      otpRequestId
    }
  });

  return {
    status: 200,
    body: {
      success: true,
      data: {
        accepted: true,
        otpRequestId,
        channel,
        destination: maskDestination(destination, channel),
        expiresAt,
        debugCode: process.env.NODE_ENV === 'production' ? undefined : code
      }
    }
  };
}

async function verifyOtpCode({ otpRequestId, code, purpose, ctx }) {
  const otp = await getOtpRequestById(otpRequestId);
  if (!otp || otp.purpose !== purpose) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error: {
          code: 'OTP_INVALID',
          message: 'Code OTP invalide'
        }
      }
    };
  }

  if (otp.consumed_at) {
    return {
      ok: false,
      status: 409,
      body: {
        success: false,
        error: {
          code: 'OTP_ALREADY_USED',
          message: 'Code OTP déjà utilisé'
        }
      }
    };
  }

  if (otp.locked_until && new Date(otp.locked_until).getTime() > Date.now()) {
    return {
      ok: false,
      status: 429,
      body: {
        success: false,
        error: {
          code: 'OTP_LOCKED',
          message: 'Trop de tentatives OTP'
        }
      }
    };
  }

  if (new Date(otp.expires_at).getTime() <= Date.now()) {
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error: {
          code: 'OTP_EXPIRED',
          message: 'Code OTP expiré'
        }
      }
    };
  }

  const expected = otpCodeHash({
    otpRequestId,
    code
  });
  if (!timingSafeHexEqual(expected, otp.code_hash)) {
    const nextAttempts = Number(otp.attempts || 0) + 1;
    await incrementOtpAttempts(otpRequestId);
    await insertOtpAttempt({
      otpRequestId,
      success: false,
      ipAddress: getIpAddress(ctx),
      fingerprintHash: ctx.fingerprintHash
    });
    if (nextAttempts >= config.otpMaxAttempts) {
      await lockOtpRequest(otpRequestId, Date.now() + 5 * 60 * 1000);
    }
    await insertSecurityEvent({
      userId: otp.user_id,
      eventType: 'otp.failed',
      severity: 'warning',
      requestId: ctx.requestId,
      ipAddress: getIpAddress(ctx),
      fingerprintHash: ctx.fingerprintHash,
      metadata: {
        purpose,
        otpRequestId,
        attempts: nextAttempts
      }
    });
    return {
      ok: false,
      status: 400,
      body: {
        success: false,
        error: {
          code: 'OTP_INVALID',
          message: 'Code OTP invalide'
        }
      }
    };
  }

  await consumeOtpRequest(otpRequestId);
  await insertOtpAttempt({
    otpRequestId,
    success: true,
    ipAddress: getIpAddress(ctx),
    fingerprintHash: ctx.fingerprintHash
  });
  return {
    ok: true,
    otp
  };
}

async function confirmVerification({ payload, ctx }) {
  const validation = requireFields(payload, ['otpRequestId', 'code']);
  if (!validation.ok) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Champs manquants: ${validation.missing.join(', ')}`
        }
      }
    };
  }

  const verification = await verifyOtpCode({
    otpRequestId: payload.otpRequestId,
    code: payload.code,
    purpose: 'verification',
    ctx
  });
  if (!verification.ok) {
    return {
      status: verification.status,
      body: verification.body
    };
  }

  await markVerification({
    userId: verification.otp.user_id,
    channel: verification.otp.channel
  });

  await insertSecurityEvent({
    userId: verification.otp.user_id,
    eventType: 'otp.verified',
    requestId: ctx.requestId,
    ipAddress: getIpAddress(ctx),
    fingerprintHash: ctx.fingerprintHash,
    metadata: {
      purpose: 'verification',
      channel: verification.otp.channel
    }
  });

  return {
    status: 200,
    body: {
      success: true,
      data: {
        verified: true
      }
    }
  };
}

async function startForgotPassword({ payload, ctx }) {
  return startOtpFlow({
    payload,
    purpose: 'password_reset',
    ctx
  });
}

async function confirmForgotPassword({ payload, ctx }) {
  const validation = requireFields(payload, ['otpRequestId', 'code']);
  if (!validation.ok) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Champs manquants: ${validation.missing.join(', ')}`
        }
      }
    };
  }

  const verification = await verifyOtpCode({
    otpRequestId: payload.otpRequestId,
    code: payload.code,
    purpose: 'password_reset',
    ctx
  });
  if (!verification.ok) {
    return {
      status: verification.status,
      body: verification.body
    };
  }

  const resetToken = `rst_${randomToken(24)}`;
  const resetTokenHash = sha256Hex(resetToken);
  const requestId = randomId('pwdrst');
  const expiresAt = Date.now() + config.passwordResetTtlMinutes * 60 * 1000;

  await createPasswordResetRequest({
    requestId,
    userId: verification.otp.user_id,
    otpRequestId: payload.otpRequestId,
    resetTokenHash,
    expiresAt
  });

  await insertSecurityEvent({
    userId: verification.otp.user_id,
    eventType: 'password.reset.challenge.confirmed',
    requestId: ctx.requestId,
    ipAddress: getIpAddress(ctx),
    fingerprintHash: ctx.fingerprintHash,
    metadata: {
      otpRequestId: payload.otpRequestId,
      resetRequestId: requestId
    }
  });

  return {
    status: 200,
    body: {
      success: true,
      data: {
        resetToken,
        expiresAt
      }
    }
  };
}

async function resetPassword({ payload, ctx }) {
  const validation = requireFields(payload, ['resetToken', 'newPassword']);
  if (!validation.ok) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Champs manquants: ${validation.missing.join(', ')}`
        }
      }
    };
  }

  if (String(payload.newPassword).length < 8) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'WEAK_PASSWORD',
          message: 'Le mot de passe doit contenir au moins 8 caractères'
        }
      }
    };
  }

  const resetTokenHash = sha256Hex(String(payload.resetToken));
  const request = await getActivePasswordResetRequest(resetTokenHash);
  if (!request) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'RESET_TOKEN_INVALID',
          message: 'Jeton de réinitialisation invalide'
        }
      }
    };
  }

  const { passwordHash, passwordSalt } = await buildPasswordHash({
    password: payload.newPassword,
    requestId: ctx.requestId
  });

  await updatePassword({
    userId: request.user_id,
    passwordHash,
    passwordSalt
  });
  await consumePasswordResetRequest(request.id);
  await revokeAllUserSessions({
    userId: request.user_id,
    reason: 'password_reset',
    revokedBy: 'system'
  });
  await insertSecurityEvent({
    userId: request.user_id,
    eventType: 'password.reset.success',
    requestId: ctx.requestId,
    ipAddress: getIpAddress(ctx),
    fingerprintHash: ctx.fingerprintHash
  });

  return {
    status: 200,
    body: {
      success: true,
      data: {
        reset: true
      }
    }
  };
}

/**
 * Internal-only admin check for AdminJS (POST /internal/admin/authenticate).
 * Caller must use signed internal requests from admin-service; still verify role + password here.
 */
async function authenticateAdmin({ email, password }) {
  const e = String(email || '').trim();
  const p = String(password || '');
  if (!e || !p) {
    return { ok: false };
  }

  const requestId = 'internal-admin-authenticate';
  const user = await findUserByEmail(e);
  if (!user) {
    await insertSecurityEvent({
      eventType: 'admin.authenticate.failed',
      requestId,
      metadata: { reason: 'unknown_user' }
    });
    return { ok: false };
  }

  if (user.role !== 'admin') {
    await insertSecurityEvent({
      userId: user.id,
      eventType: 'admin.authenticate.failed',
      requestId,
      metadata: { reason: 'not_admin' }
    });
    return { ok: false };
  }

  const valid = await verifyPassword({
    password: p,
    passwordHash: user.password_hash,
    passwordSalt: user.password_salt,
    requestId
  });
  if (!valid) {
    await insertSecurityEvent({
      userId: user.id,
      eventType: 'admin.authenticate.failed',
      requestId,
      metadata: { reason: 'bad_password' }
    });
    return { ok: false };
  }

  await insertSecurityEvent({
    userId: user.id,
    eventType: 'admin.authenticate.success',
    requestId
  });

  return {
    ok: true,
    user: toPublicUser(user)
  };
}

module.exports = {
  register,
  login,
  authenticateAdmin,
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
};
