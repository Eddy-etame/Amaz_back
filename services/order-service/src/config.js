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
  port: Number(process.env.ORDER_SERVICE_PORT || 3003),
  host: process.env.ORDER_SERVICE_HOST || '0.0.0.0',
  internalSharedSecret: requiredSecret('INTERNAL_SHARED_SECRET'),
  productServiceUrl: process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3002',
  internalFetchTimeoutMs: Number(process.env.INTERNAL_FETCH_TIMEOUT_MS || 7000)
};

module.exports = {
  config
};
