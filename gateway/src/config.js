function parseOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(rawValue, fallback) {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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
  port: parseNumber(process.env.GATEWAY_PORT, 3000),
  host: process.env.GATEWAY_HOST || '0.0.0.0',
  internalSharedSecret: requiredSecret('INTERNAL_SHARED_SECRET'),
  powDifficulty: Math.max(1, parseNumber(process.env.POW_DIFFICULTY, 3)),
  powWindowMs: parseNumber(process.env.POW_WINDOW_MS, 120000),
  rateLimitWindowMs: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 60000),
  rateLimitMax: parseNumber(process.env.RATE_LIMIT_MAX, 120),
  upstreamTimeoutMs: parseNumber(process.env.UPSTREAM_TIMEOUT_MS, 10000),
  internalFetchTimeoutMs: parseNumber(process.env.INTERNAL_FETCH_TIMEOUT_MS, 7000),
  allowedOrigins: parseOrigins(process.env.CORS_ALLOWED_ORIGINS),
  services: {
    user: process.env.USERS_SERVICE_URL || 'http://localhost:3001',
    product: process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3002',
    order: process.env.ORDERS_SERVICE_URL || 'http://localhost:3003',
    messaging: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3004',
    ai: process.env.AI_SERVICE_URL || 'http://localhost:3005',
    pepper: process.env.PEPPER_SERVICE_URL || 'http://localhost:3006'
  }
};

module.exports = {
  config
};
