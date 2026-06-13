// Orchestration du hachage et de la vérification des mots de passe.
//
// C'est le point qui assemble les trois ingrédients de notre stockage de mot de passe :
//   sel (unique par utilisateur) + pepper (secret externe) + PBKDF2 (hachage lent).
// On ne compare jamais les mots de passe en clair : on recalcule le hash et on compare
// à temps constant.

const { hashPassword, makeSalt, timingSafeHexEqual } = require('../../../../shared/utils/crypto');
const { derivePepper } = require('./pepper-client.service');

// À l'inscription / au changement de mot de passe : génère un sel neuf, récupère le
// pepper, et renvoie le hash + le sel (à stocker ; le pepper, lui, n'est pas stocké).
async function buildPasswordHash({ password, requestId }) {
  const salt = makeSalt(16);
  const pepper = await derivePepper({ value: password, context: 'password', requestId });
  const passwordHash = hashPassword({
    password,
    salt,
    pepper
  });
  return {
    passwordHash,
    passwordSalt: salt
  };
}

// À la connexion : on refait le même calcul avec le sel stocké, et on compare le
// résultat au hash en base, à temps constant (anti timing-attack).
async function verifyPassword({ password, passwordHash, passwordSalt, requestId }) {
  const pepper = await derivePepper({ value: password, context: 'password', requestId });
  const candidate = hashPassword({
    password,
    salt: passwordSalt,
    pepper
  });
  return timingSafeHexEqual(candidate, passwordHash);
}

module.exports = {
  buildPasswordHash,
  verifyPassword
};
