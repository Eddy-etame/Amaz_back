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
  port: parseNumber(process.env.USER_SERVICE_PORT, 3001),
  host: process.env.USER_SERVICE_HOST || '0.0.0.0',
  internalSharedSecret: requiredSecret('INTERNAL_SHARED_SECRET'),
  accessHmacSecret: requiredSecret('ACCESS_HMAC_SECRET'),
  refreshHmacSecret: requiredSecret('REFRESH_HMAC_SECRET'),
  sessionTtlMinutes: parseNumber(process.env.SESSION_TTL_MINUTES, 60),
  refreshTtlDays: parseNumber(process.env.REFRESH_TTL_DAYS, 7),
  otpTtlMinutes: parseNumber(process.env.OTP_TTL_MINUTES, 5),
  otpMaxAttempts: parseNumber(process.env.OTP_MAX_ATTEMPTS, 5),
  otpCooldownSeconds: parseNumber(process.env.OTP_COOLDOWN_SECONDS, 60),
  otpMaxRequestsPerHour: parseNumber(process.env.OTP_MAX_REQUESTS_PER_HOUR, 8),
  passwordResetTtlMinutes: parseNumber(process.env.PASSWORD_RESET_TTL_MINUTES, 15),
  pepperServiceUrl: process.env.PEPPER_SERVICE_URL || 'http://localhost:3006'
};

module.exports = {
  config
};
