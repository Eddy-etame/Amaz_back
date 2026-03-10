const { hashPassword, makeSalt, timingSafeHexEqual } = require('../../../../shared/utils/crypto');
const { derivePepper } = require('./pepper-client.service');

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
