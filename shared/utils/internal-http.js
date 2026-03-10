const { randomId } = require('./ids');
const { signInternalRequest } = require('./internal-signature');

async function internalFetch({
  baseUrl,
  path,
  method = 'GET',
  body,
  callerService,
  secret,
  requestId,
  headers = {},
  timeoutMs = 7000
}) {
  const finalPath = String(path || '/');
  const timestamp = Date.now();
  const nonce = randomId('nonce');
  const signature = signInternalRequest({
    secret,
    serviceName: callerService,
    method,
    path: finalPath,
    timestamp,
    nonce,
    body
  });

  const url = `${baseUrl}${finalPath}`;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId || randomId('req'),
        'x-internal-service': callerService,
        'x-internal-timestamp': String(timestamp),
        'x-internal-nonce': nonce,
        'x-internal-signature': signature,
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch (error) {
    const timeout = error?.name === 'AbortError';
    return {
      ok: false,
      status: timeout ? 504 : 502,
      headers: null,
      payload: {
        success: false,
        error: {
          code: timeout ? 'INTERNAL_HTTP_TIMEOUT' : 'INTERNAL_HTTP_UNREACHABLE',
          message: timeout ? 'Timeout inter-service' : 'Service inter-service indisponible'
        }
      }
    };
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    payload
  };
}

module.exports = {
  internalFetch
};
