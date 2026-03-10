const crypto = require('crypto');

function randomId(prefix = '') {
  const value = crypto.randomBytes(12).toString('hex');
  return prefix ? `${prefix}_${value}` : value;
}

module.exports = {
  randomId
};
