// Preuve de travail (PoW) — calcul et vérification.
//
// Idée : avant d'accepter une requête, on oblige le client à résoudre un petit
// défi de hachage. Le client fait varier un "nonce" jusqu'à obtenir un SHA-256
// qui commence par un certain nombre de zéros. C'est quasi instantané pour une
// requête normale, mais coûteux à répéter des milliers de fois -> ça freine les
// bots et le spam d'API. Le serveur, lui, ne recalcule le hash qu'une seule fois :
// la vérification reste presque gratuite de notre côté. C'est tout l'intérêt.

const { sha256Hex } = require('./crypto');

// Vrai si `hex` commence par `difficulty` zéros.
// `difficulty` = nombre de "0" hexadécimaux exigés en tête : plus il est élevé,
// plus le client doit tester de nonces. À 0 (ou moins) le contrôle est désactivé.
function hasLeadingZeros(hex, difficulty) {
  if (difficulty <= 0) return true;
  return hex.startsWith('0'.repeat(difficulty));
}

// Construit la chaîne qui sera hachée. On y met la méthode, le chemin, l'horodatage,
// le nonce et l'empreinte client : ainsi une preuve est liée à UNE requête précise.
// Conséquence voulue : on ne peut pas rejouer la même preuve sur une autre route,
// un autre instant ou un autre client.
function buildPowPayload({ method, path, timestamp, nonce, fingerprint }) {
  return `${method.toUpperCase()}:${path}:${timestamp}:${nonce}:${fingerprint}`;
}

// Vérifie une preuve reçue. Deux conditions doivent être vraies en même temps :
//   1) le hash recalculé côté serveur correspond au `proof` envoyé par le client
//      (le client n'a pas menti sur son résultat) ;
//   2) ce hash respecte la difficulté demandée (assez de zéros en tête).
// Si l'une des deux échoue, la preuve est refusée.
function verifyPow({ method, path, timestamp, nonce, fingerprint, proof, difficulty }) {
  const payload = buildPowPayload({ method, path, timestamp, nonce, fingerprint });
  const expectedHash = sha256Hex(payload);
  return expectedHash === proof && hasLeadingZeros(proof, difficulty);
}

module.exports = {
  verifyPow,
  buildPowPayload,
  hasLeadingZeros
};
