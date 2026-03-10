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
  port: Number(process.env.PEPPER_SERVICE_PORT || 3006),
  host: process.env.PEPPER_SERVICE_HOST || '0.0.0.0',
  internalSharedSecret: requiredSecret('INTERNAL_SHARED_SECRET'),
  pepperMasterSecret: requiredSecret('PEPPER_MASTER_SECRET')
};

module.exports = {
  config
};
