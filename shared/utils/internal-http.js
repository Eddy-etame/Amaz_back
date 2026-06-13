// Client HTTP pour les appels INTERNES (gateway -> service, service -> service).
//
// Chaque appel sortant est signé ici avec `signInternalRequest` puis envoyé avec
// les en-têtes `x-internal-*`. C'est le pendant "appelant" de middleware/internal-auth.js.

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
  const upperMethod = String(method || 'GET').toUpperCase();
  const hasJsonBody = body !== undefined && body !== null && !['GET', 'HEAD'].includes(upperMethod);

  // /!\ Point qui nous a coûté une longue séance de debug (bug checkout) :
  // pour une requête SANS corps (GET), on signe quand même un corps `{}` et non
  // `undefined`. Raison : côté service, Express transforme un corps vide en `{}`.
  // Si on signait `undefined` ici, le service recalculerait la signature sur `{}`
  // -> les deux empreintes ne correspondaient pas -> "INTERNAL_AUTH_INVALID", que
  // l'order-service traduisait à tort en "PRODUIT INTROUVABLE" au moment de payer.
  // Aligner les deux côtés sur `{}` règle le problème.
  const signatureBody = hasJsonBody ? body : {};
  const timestamp = Date.now();
  const nonce = randomId('nonce');
  const signature = signInternalRequest({
    secret,
    serviceName: callerService,
    method: upperMethod,
    path: finalPath,
    timestamp,
    nonce,
    body: signatureBody
  });

  const url = `${baseUrl}${finalPath}`;
  // Garde-fou anti-blocage : on coupe l'appel au bout de `timeoutMs` (un service
  // lent ou injoignable ne doit pas geler toute la chaîne).
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      method: upperMethod,
      headers: {
        'x-request-id': requestId || randomId('req'),
        'x-internal-service': callerService,
        'x-internal-timestamp': String(timestamp),
        'x-internal-nonce': nonce,
        'x-internal-signature': signature,
        ...(hasJsonBody ? { 'content-type': 'application/json' } : {}),
        ...headers
      },
      body: hasJsonBody ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
  } catch (error) {
    // On distingue le timeout (504) de l'injoignable (502) pour des logs clairs.
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

  // On lit la réponse en texte puis on tente de la parser en JSON. Si ce n'est pas
  // du JSON (erreur inattendue, page HTML…), on renvoie le texte brut sans planter.
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
