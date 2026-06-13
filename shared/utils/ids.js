// Génération d'identifiants aléatoires (nonces internes, request-id, etc.).
const crypto = require('crypto');

// Renvoie un identifiant aléatoire imprévisible. Le `prefix` optionnel sert juste à
// repérer l'origine d'un id dans les logs (ex. "req_ab12...", "nonce_ff03...").
function randomId(prefix = '') {
  const value = crypto.randomBytes(12).toString('hex');
  return prefix ? `${prefix}_${value}` : value;
}

module.exports = {
  randomId
};
