const crypto = require('crypto');

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function hmacHex(secret, value) {
  return crypto.createHmac('sha256', String(secret)).update(String(value)).digest('hex');
}

function timingSafeHexEqual(leftHex, rightHex) {
  if (!leftHex || !rightHex) return false;
  const left = Buffer.from(String(leftHex), 'hex');
  const right = Buffer.from(String(rightHex), 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

function randomDigits(length = 6) {
  const targetLength = Math.max(1, Number(length) || 6);
  let out = '';
  while (out.length < targetLength) {
    out += crypto.randomInt(0, 10).toString();
  }
  return out.slice(0, targetLength);
}

function hashPassword({ password, salt, pepper }) {
  return crypto
    .pbkdf2Sync(String(password), `${salt}:${pepper}`, 120000, 32, 'sha256')
    .toString('hex');
}

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
