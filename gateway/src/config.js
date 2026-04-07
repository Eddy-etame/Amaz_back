function parseOrigins(raw) {
  return String(raw || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Browsers treat localhost vs 127.0.0.1 as different origins; Angular dev server may use either. */
const DEV_CORS_DEFAULTS = [
  'http://localhost:4200',
  'http://localhost:4201',
  'http://localhost:4202',
  'http://localhost:4203',
  'http://127.0.0.1:4200',
  'http://127.0.0.1:4201',
  'http://127.0.0.1:4202',
  'http://127.0.0.1:4203'
];

function mergeAllowedOrigins() {
  const fromEnv = parseOrigins(process.env.CORS_ALLOWED_ORIGINS);
  if (process.env.NODE_ENV === 'production') {
    return fromEnv;
  }
  const set = new Set([...fromEnv, ...DEV_CORS_DEFAULTS]);
  return Array.from(set);
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

/** Microservices expose /commandes, /produits, … — not /api/v1/… (that prefix is gateway-only). */
function normalizeMicroserviceBaseUrl(raw) {
  return String(raw || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/v1$/i, '');
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
  allowedOrigins: mergeAllowedOrigins(),
  services: {
    user: normalizeMicroserviceBaseUrl(process.env.USERS_SERVICE_URL || 'http://localhost:3001'),
    product: normalizeMicroserviceBaseUrl(process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3002'),
    order: normalizeMicroserviceBaseUrl(process.env.ORDERS_SERVICE_URL || 'http://localhost:3003'),
    messaging: normalizeMicroserviceBaseUrl(process.env.MESSAGING_SERVICE_URL || 'http://localhost:3004'),
    ai: normalizeMicroserviceBaseUrl(process.env.AI_SERVICE_URL || 'http://localhost:3005'),
    pepper: normalizeMicroserviceBaseUrl(process.env.PEPPER_SERVICE_URL || 'http://localhost:3006'),
    pepperPrimary: normalizeMicroserviceBaseUrl(process.env.PEPPER_PRIMARY_URL || 'http://localhost:3007')
  }
};

module.exports = {
  config
};
