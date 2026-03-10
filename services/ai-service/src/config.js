function requiredSecret(name, fallback = '') {
  const value = String(process.env[name] || fallback || '').trim();
  if (!value) {
    throw new Error(`Missing required secret: ${name}`);
  }
  if (process.env.NODE_ENV === 'production' && value.startsWith('change-')) {
    throw new Error(`Secret ${name} still uses placeholder value`);
  }
  return value;
}

const config = {
  port: Number(process.env.AI_SERVICE_PORT || 3005),
  host: process.env.AI_SERVICE_HOST || '0.0.0.0',
  internalSharedSecret: requiredSecret('INTERNAL_SHARED_SECRET')
};

module.exports = {
  config
};
