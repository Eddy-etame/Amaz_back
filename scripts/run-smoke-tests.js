const fs = require('fs');
const path = require('path');

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function assert(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

function hasAllSnippets(content, snippets) {
  return snippets.every((snippet) => content.includes(snippet));
}

function hasAllRegex(content, regexes) {
  return regexes.every((regex) => regex.test(content));
}

function main() {
  const root = path.resolve(__dirname, '..');
  const failures = [];

  const requiredFiles = [
    'gateway/src/app.js',
    'services/user-service/src/routes/auth.routes.js',
    'services/order-service/src/app.js',
    'services/messaging-service/src/app.js',
    'services/pepper-service/src/app.js',
    'db/postgres/migrations/001_init.sql',
    'db/postgres/migrations/007_order_status_history.sql',
    'docs/openapi/gateway-v1.yaml',
    'db/mongo/init.js',
    'scripts/health-and-contract-smoke.js',
    'scripts/run-gateway-api-suite.js',
    'docs/CDC_ENTITES_DB.md',
    'docs/CDC_DB_CROSSCHECK.md'
  ];

  for (const relativePath of requiredFiles) {
    const fullPath = path.join(root, relativePath);
    assert(fs.existsSync(fullPath), `Missing required file: ${relativePath}`, failures);
  }

  const gatewayApp = readFileSafe(path.join(root, 'gateway/src/app.js')) || '';
  assert(
    hasAllRegex(gatewayApp, [
      /createPowMiddleware\(/,
      /createRateLimitMiddleware\(/,
      /app\.use\('\/api\/v1\/auth'/,
      /app\.use\('\/api\/v1\/messages'/,
      /isBotAuthPowOnly/,
      /runMiddleware\(optionalAuthMiddleware/
    ]),
    'Gateway routes/security middleware not fully wired',
    failures
  );

  const authRoutes = readFileSafe(path.join(root, 'services/user-service/src/routes/auth.routes.js')) || '';
  assert(
    hasAllSnippets(authRoutes, [
      "router.post('/register'",
      "router.post('/signup'",
      "router.post('/verification/start'",
      "router.post('/password/forgot/start'",
      "router.post('/password/reset'",
      "router.post('/internal/auth/introspect'"
    ]),
    'User-service auth routes missing required endpoints',
    failures
  );

  const orderApp = readFileSafe(path.join(root, 'services/order-service/src/app.js')) || '';
  assert(
    hasAllSnippets(orderApp, [
      "app.post('/commandes'",
      "app.get('/commandes'",
      "app.put('/commandes/:orderId/annuler'",
      "app.put('/commandes/:orderId/statut'",
      'order_status_history'
    ]),
    'Order-service critical endpoints missing',
    failures
  );

  const productApp = readFileSafe(path.join(root, 'services/product-service/src/app.js')) || '';
  assert(
    hasAllSnippets(productApp, [
      "app.get('/wishlists/shared/:token'",
      'wishlistSharedRateLimit',
      'shareDisabledAt'
    ]),
    'Product-service wishlist hardening snippets missing',
    failures
  );

  const messagingApp = readFileSafe(path.join(root, 'services/messaging-service/src/app.js')) || '';
  assert(
    hasAllSnippets(messagingApp, [
      "app.get('/messages/conversations'",
      "app.get('/messages/:produitId'",
      "app.post('/messages'",
      "namespace.on('connection'"
    ]),
    'Messaging service REST/socket endpoints missing',
    failures
  );

  const sqlSchema = readFileSafe(path.join(root, 'db/postgres/migrations/001_init.sql')) || '';
  assert(
    hasAllSnippets(sqlSchema, [
      'CREATE TABLE IF NOT EXISTS users',
      'CREATE TABLE IF NOT EXISTS sessions',
      'CREATE TABLE IF NOT EXISTS token_revocations',
      'CREATE TABLE IF NOT EXISTS otp_requests',
      'CREATE TABLE IF NOT EXISTS orders',
      'CREATE TABLE IF NOT EXISTS security_events'
    ]),
    'PostgreSQL migration does not include required core tables',
    failures
  );

  const histMigration = readFileSafe(path.join(root, 'db/postgres/migrations/007_order_status_history.sql')) || '';
  assert(
    hasAllSnippets(histMigration, ['order_status_history', 'CREATE TABLE IF NOT EXISTS order_status_history']),
    '007_order_status_history migration missing or incomplete',
    failures
  );

  if (failures.length > 0) {
    // eslint-disable-next-line no-console
    console.error('Smoke tests failed:\n- ' + failures.join('\n- '));
    process.exitCode = 1;
    return;
  }

  // eslint-disable-next-line no-console
  console.log('Smoke tests passed.');
}

main();
