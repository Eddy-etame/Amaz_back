const { randomId } = require('../../shared/utils/ids');
const { signInternalRequest } = require('../../shared/utils/internal-signature');

const HOP_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'accept-encoding',
  'x-internal-service',
  'x-internal-signature',
  'x-internal-timestamp',
  'x-internal-nonce'
]);

function sanitizeHeaders(headers) {
  const result = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (HOP_HEADERS.has(key.toLowerCase())) continue;
    result[key] = value;
  }
  return result;
}

function normalizeErrorPayload({ status, payload, requestId }) {
  const fallbackCode = status >= 500 ? 'UPSTREAM_INTERNAL_ERROR' : 'UPSTREAM_REQUEST_FAILED';
  const fallbackMessage = status >= 500 ? 'Erreur interne du service distant' : 'Erreur lors de l’appel service';

  return {
    success: false,
    error: {
      code: payload?.error?.code || fallbackCode,
      message: payload?.error?.message || fallbackMessage,
      details: payload?.error?.details || payload?.details || undefined
    },
    requestId
  };
}

function buildSuccessPayload({ payload, requestId }) {
  if (payload && typeof payload === 'object') {
    return {
      ...payload,
      requestId
    };
  }
  return {
    success: true,
    data: payload,
    requestId
  };
}

async function forwardToService({
  req,
  res,
  serviceBaseUrl,
  targetPath,
  internalSecret,
  callerService = 'gateway',
  timeoutMs = 10000
}) {
  const finalPath = String(targetPath || '/');
  const timestamp = Date.now();
  const nonce = randomId('nonce');
  const signature = signInternalRequest({
    secret: internalSecret,
    serviceName: callerService,
    method: req.method,
    path: finalPath,
    timestamp,
    nonce,
    body: req.body
  });

  const finalUrl = `${serviceBaseUrl}${finalPath}`;
  const abortController = new AbortController();
  const timer = setTimeout(() => {
    abortController.abort();
  }, timeoutMs);

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(finalUrl, {
      method: req.method,
      headers: {
        ...sanitizeHeaders(req.headers),
        'x-request-id': req.requestId || randomId('req'),
        'x-internal-service': callerService,
        'x-internal-timestamp': String(timestamp),
        'x-internal-nonce': nonce,
        'x-internal-signature': signature,
        'x-auth-user-id': req.auth?.userId || '',
        'x-auth-role': req.auth?.role || '',
        'x-auth-email': req.auth?.email || '',
        'x-auth-fingerprint': req.auth?.fingerprintHash || ''
      },
      body: ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : JSON.stringify(req.body || {}),
      signal: abortController.signal
    });
  } catch (error) {
    const isAbort = error?.name === 'AbortError';
    return res.status(isAbort ? 504 : 502).json({
      success: false,
      error: {
        code: isAbort ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE',
        message: isAbort ? 'Le service distant a expiré' : 'Le service distant est indisponible'
      },
      requestId: req.requestId
    });
  } finally {
    clearTimeout(timer);
  }

  const responseText = await upstreamResponse.text();
  let payload = null;
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = {
        success: upstreamResponse.ok,
        data: responseText
      };
    }
  }

  if (upstreamResponse.ok) {
    return res.status(upstreamResponse.status).json(
      buildSuccessPayload({
        payload: payload || { success: true },
        requestId: req.requestId
      })
    );
  }

  return res.status(upstreamResponse.status).json(
    normalizeErrorPayload({
      status: upstreamResponse.status,
      payload,
      requestId: req.requestId
    })
  );
}

module.exports = {
  forwardToService
};
