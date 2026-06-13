// Proxy de la gateway vers les microservices.
//
// Une fois la requête validée (PoW, rate-limit, IP/VPN, auth), c'est ici qu'on la
// relaie au bon service. Trois choses importantes se passent :
//   1) on retire les en-têtes "dangereux" envoyés par le client (dont les en-têtes
//      internes : un client ne doit jamais pouvoir se faire passer pour la gateway) ;
//   2) on SIGNE l'appel interne (HMAC) et on ajoute l'identité de l'utilisateur ;
//   3) on normalise la réponse (succès/erreur) pour que le front reçoive toujours
//      la même forme.

const { randomId } = require('../../shared/utils/ids');
const { signInternalRequest } = require('../../shared/utils/internal-signature');

// En-têtes à NE PAS recopier vers le service : en-têtes "hop-by-hop" (host,
// connection…) et surtout les en-têtes internes, qu'on régénère nous-mêmes signés.
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

// Met une erreur du service amont dans notre format standard. On garde le code/message
// du service s'il en fournit, sinon un message générique (selon 4xx vs 5xx).
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

// Idem côté succès : on renvoie le corps du service en y ajoutant le requestId.
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

// Les services montent leurs routes en `/commandes`, pas `/api/v1/commandes` :
// on retire un éventuel préfixe `/api/v1` en double, en gardant la query string.
function normalizeMicroserviceTargetPath(targetPath) {
  const raw = String(targetPath || '/');
  const q = raw.indexOf('?');
  const pathOnly = (q >= 0 ? raw.slice(0, q) : raw) || '/';
  const query = q >= 0 ? raw.slice(q + 1) : '';
  let p = pathOnly;
  if (p.startsWith('/api/v1')) {
    p = p.slice('/api/v1'.length) || '/';
  }
  return query ? `${p}?${query}` : p;
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
  // URL de base nettoyée (sans slash final ni `/api/v1` résiduel).
  const base = String(serviceBaseUrl || '')
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/i, '');
  const finalPath = normalizeMicroserviceTargetPath(targetPath);
  const timestamp = Date.now();
  const nonce = randomId('nonce');
  // Signature interne : prouve au service que l'appel vient bien de la gateway.
  const signature = signInternalRequest({
    secret: internalSecret,
    serviceName: callerService,
    method: req.method,
    path: finalPath,
    timestamp,
    nonce,
    body: req.body
  });

  const finalUrl = `${base}${finalPath}`;
  // Garde-fou anti-blocage : on abandonne l'appel au bout de `timeoutMs`.
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
        // Identité transmise au service (déjà vérifiée par l'auth de la gateway).
        'x-auth-user-id': req.auth?.userId || '',
        'x-auth-role': req.auth?.role || '',
        'x-auth-email': req.auth?.email || '',
        'x-auth-fingerprint': req.auth?.fingerprintHash || ''
      },
      // Pas de corps pour GET/HEAD ; sinon on transmet le JSON (corps vide -> `{}`).
      body: ['GET', 'HEAD'].includes(req.method.toUpperCase()) ? undefined : JSON.stringify(req.body || {}),
      signal: abortController.signal
    });
  } catch (error) {
    // Timeout (504) vs service injoignable (502).
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

  // On lit la réponse en texte puis on tente un parse JSON (sinon on renvoie le brut).
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
