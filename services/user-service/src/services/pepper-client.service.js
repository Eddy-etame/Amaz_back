// Client du/des pepper-service(s).
//
// Rappel : le "pepper" est un secret ajouté au mot de passe avant le hachage. Sa
// particularité (vs le sel) : il n'est PAS stocké à côté des mots de passe. Ici on va
// plus loin — le pepper est calculé par un service dédié (le secret maître ne vit donc
// pas dans le user-service). Si la base user fuit, l'attaquant n'a ni le sel+hash
// suffisants ni le secret de pepper : il lui manque une pièce.
//
// On utilise même DEUX peppers (primary + secondary) combinés : "defense in depth".

const { config } = require('../config');
const { internalFetch } = require('../../../../shared/utils/internal-http');
const { hmacHex } = require('../../../../shared/utils/crypto');

// Appel interne signé vers un pepper-service : il renvoie la valeur "pepperée".
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

// Dérive le pepper combiné (primary + service). Les deux appels se font en parallèle.
// Politique de repli :
//   - en PRODUCTION, si les pepper-services sont indisponibles, on échoue (fail-closed) :
//     mieux vaut refuser que hacher avec un pepper faible ;
//   - en DEV uniquement, on accepte un repli basé sur des secrets d'environnement, pour
//     pouvoir travailler sans lancer les pepper-services.
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
    // On retombe sur la politique de repli ci-dessous.
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('PEPPER_SERVICE_UNAVAILABLE');
  }
  const fallbackPrimary = String(process.env.PEPPER_PRIMARY_CLIENT_SECRET || '').trim();
  if (!fallbackSecret || !fallbackPrimary) {
    throw new Error('PEPPER_CLIENT_SECRET_MISSING');
  }
  // Repli dev : on reproduit localement un double pepper avec les secrets d'env.
  const p1 = hmacHex(fallbackPrimary, `${context}:${value}`);
  const p2 = hmacHex(fallbackSecret, `${context}:${value}`);
  return `${p1}:${p2}`;
}

module.exports = {
  derivePepper
};
