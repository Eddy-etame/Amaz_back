const { config } = require('../config');
const { internalFetch } = require('../../../../shared/utils/internal-http');
const { hmacHex } = require('../../../../shared/utils/crypto');

async function derivePepper({ value, context = 'password', requestId }) {
  const fallbackSecret = String(process.env.PEPPER_CLIENT_SECRET || '').trim();

  try {
    const response = await internalFetch({
      baseUrl: config.pepperServiceUrl,
      path: '/internal/pepper/hash',
      method: 'POST',
      body: {
        value,
        context
      },
      callerService: 'user-service',
      secret: config.internalSharedSecret,
      requestId,
      timeoutMs: Number(process.env.INTERNAL_FETCH_TIMEOUT_MS || 7000)
    });

    if (response.ok && response.payload?.data?.pepperedValue) {
      return response.payload.data.pepperedValue;
    }
  } catch {
    // fallback policy below
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('PEPPER_SERVICE_UNAVAILABLE');
  }
  if (!fallbackSecret) {
    throw new Error('PEPPER_CLIENT_SECRET_MISSING');
  }
  return hmacHex(fallbackSecret, `${context}:${value}`);
}

module.exports = {
  derivePepper
};
