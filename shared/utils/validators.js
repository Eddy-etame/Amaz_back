function requireFields(payload, fields) {
  const missing = fields.filter((field) => {
    const value = payload?.[field];
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  });

  return {
    ok: missing.length === 0,
    missing
  };
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
}

function isPhone(value) {
  return /^\+?[1-9][0-9]{7,14}$/.test(String(value || '').trim());
}

function isAllowedChannel(value) {
  return value === 'email' || value === 'sms';
}

module.exports = {
  requireFields,
  isEmail,
  isPhone,
  isAllowedChannel
};
