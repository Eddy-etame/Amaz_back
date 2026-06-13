// Boîte à outils cryptographique "maison".
//
// Tout est construit sur le module `crypto` natif de Node — pas de librairie
// externe (ni bcrypt, ni jsonwebtoken). C'est une contrainte du projet : on
// devait fabriquer nous-mêmes les briques de sécurité pour montrer qu'on en
// comprend le fonctionnement.

const crypto = require('crypto');

// Hash SHA-256 simple, renvoyé en hexadécimal.
// Sert aux empreintes NON secrètes (ex. hash du corps d'une requête, du payload PoW).
function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

// HMAC-SHA256 : un hash "signé" par un secret. Sans le secret on ne peut pas le
// reproduire. C'est la base de nos tokens et des signatures inter-services.
function hmacHex(secret, value) {
  return crypto.createHmac('sha256', String(secret)).update(String(value)).digest('hex');
}

// Comparaison à temps constant de deux valeurs hex.
// On NE compare jamais deux signatures avec `===` : la comparaison classique
// s'arrête au premier caractère différent, ce qui laisse fuiter (via le temps de
// réponse) à quel endroit ça diffère -> une "timing attack". `timingSafeEqual`
// prend toujours le même temps. On vérifie d'abord la longueur car la fonction
// l'exige (et deux longueurs différentes ne peuvent de toute façon pas être égales).
function timingSafeHexEqual(leftHex, rightHex) {
  if (!leftHex || !rightHex) return false;
  const left = Buffer.from(String(leftHex), 'hex');
  const right = Buffer.from(String(rightHex), 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// Jeton aléatoire imprévisible (par défaut 32 octets) — sessions, références, etc.
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

// Code numérique aléatoire (par défaut 6 chiffres) pour les OTP.
// `randomInt` est un tirage cryptographiquement sûr, contrairement à Math.random().
function randomDigits(length = 6) {
  const targetLength = Math.max(1, Number(length) || 6);
  let out = '';
  while (out.length < targetLength) {
    out += crypto.randomInt(0, 10).toString();
  }
  return out.slice(0, targetLength);
}

// Hachage d'un mot de passe avec PBKDF2.
// - `salt` : unique par utilisateur (empêche les rainbow tables et que deux
//   mots de passe identiques donnent le même hash).
// - `pepper` : secret global fourni par le pepper-service, PAS stocké à côté des
//   mots de passe -> même si la base fuit, sans le pepper le hash reste dur à casser.
// - 120 000 itérations : on ralentit volontairement le calcul pour rendre le
//   bruteforce coûteux. Sortie de 32 octets en hex.
function hashPassword({ password, salt, pepper }) {
  return crypto
    .pbkdf2Sync(String(password), `${salt}:${pepper}`, 120000, 32, 'sha256')
    .toString('hex');
}

// Génère un sel aléatoire (16 octets par défaut), à stocker avec l'utilisateur.
function makeSalt(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

module.exports = {
  sha256Hex,
  hmacHex,
  timingSafeHexEqual,
  randomToken,
  randomDigits,
  hashPassword,
  makeSalt
};
