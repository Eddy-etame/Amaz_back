const { config } = require('../config');
const { internalFetch } = require('../../../../shared/utils/internal-http');
const { hmacHex } = require('../../../../shared/utils/crypto');

async function callPepperService({ baseUrl, value, context, requestId }) {
  const response = await internalFetch({
    baseUrl,
    path: '/internal/pepper/hash',
    method: 'POST',
    body: { value, context },
    callerService: 'user-service',
    secret: config.internalSharedSecret,
    requestId,
    timeoutMs: Number(process.env.INTERNAL_FETCH_TIMEOUT_MS || 7000)
  });

  if (response.ok && response.payload?.data?.pepperedValue) {
    return response.payload.data.pepperedValue;
  }
  return null;
}

/**
 * Derives dual pepper: pepper-primary + pepper-service.
 * Used in hash(password, salt, pepperPrimary + pepperService) for defense in depth.
 */
async function derivePepper({ value, context = 'password', requestId }) {
  const fallbackSecret = String(process.env.PEPPER_CLIENT_SECRET || '').trim();

  try {
    const [pepperPrimary, pepperService] = await Promise.all([
      callPepperService({
        baseUrl: config.pepperPrimaryUrl,
        value,
        context,
        requestId
      }),
      callPepperService({
        baseUrl: config.pepperServiceUrl,
        value,
        context,
        requestId
      })
    ]);

    if (pepperPrimary && pepperService) {
      return `${pepperPrimary}:${pepperService}`;
    }
  } catch {
    // fallback policy below
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('PEPPER_SERVICE_UNAVAILABLE');
  }
  const fallbackPrimary = String(process.env.PEPPER_PRIMARY_CLIENT_SECRET || '').trim();
  if (!fallbackSecret || !fallbackPrimary) {
    throw new Error('PEPPER_CLIENT_SECRET_MISSING');
  }
  const p1 = hmacHex(fallbackPrimary, `${context}:${value}`);
  const p2 = hmacHex(fallbackSecret, `${context}:${value}`);
  return `${p1}:${p2}`;
}

module.exports = {
  derivePepper
};
