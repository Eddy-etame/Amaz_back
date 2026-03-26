import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { createRequire } from 'module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

require('dotenv').config({ path: resolve(__dirname, '../../.env') });

import express from 'express';
import AdminJS from 'adminjs';
import AdminJSExpress from '@adminjs/express';
import session from 'express-session';
import Connect from 'connect-pg-simple';
import { Adapter, Database, Resource } from '@adminjs/sql';

const { internalFetch } = require('../../shared/utils/internal-http.js');
const { randomId } = require('../../shared/utils/ids.js');

const PORT = Number(process.env.ADMIN_SERVICE_PORT || 3010);
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const INTERNAL_SHARED_SECRET = process.env.INTERNAL_SHARED_SECRET || '';
const PG_HOST = process.env.PG_HOST || 'localhost';
const PG_PORT = Number(process.env.PG_PORT || 5432);
const PG_USER = process.env.PG_USER || 'amaz';
const PG_PASSWORD = process.env.PG_PASSWORD || '';
const PG_DATABASE = process.env.PG_DATABASE || process.env.PG_DB || 'amaz_db';

const connectionString =
  process.env.DATABASE_URL ||
  `postgres://${PG_USER}:${PG_PASSWORD}@${PG_HOST}:${PG_PORT}/${PG_DATABASE}`;

async function authenticate(email, password) {
  if (!INTERNAL_SHARED_SECRET) {
    console.warn('INTERNAL_SHARED_SECRET not set, admin auth may fail');
    return null;
  }
  const result = await internalFetch({
    baseUrl: USER_SERVICE_URL,
    path: '/internal/admin/authenticate',
    method: 'POST',
    body: { email, password },
    callerService: 'admin-service',
    secret: INTERNAL_SHARED_SECRET,
    requestId: randomId('req'),
    timeoutMs: 5000
  });
  if (!result.ok || !result.payload?.success || !result.payload?.data?.user) {
    return null;
  }
  return result.payload.data.user;
}

const start = async () => {
  AdminJS.registerAdapter({ Database, Resource });

  const db = await new Adapter('postgresql', {
    connectionString,
    database: PG_DATABASE
  }).init();

  const admin = new AdminJS({
    rootPath: '/admin',
    resources: [
      { resource: db.table('users'), options: { navigation: { name: 'Users & Vendors' } } },
      { resource: db.table('vendors'), options: { navigation: { name: 'Users & Vendors' } } },
      { resource: db.table('orders'), options: { navigation: { name: 'Orders' } } },
      { resource: db.table('order_items'), options: { navigation: { name: 'Orders' } } },
      { resource: db.table('sessions'), options: { navigation: { name: 'Security' } } },
      { resource: db.table('security_events'), options: { navigation: { name: 'Security' } } },
      { resource: db.table('blocked_ips'), options: { navigation: { name: 'Security' } } }
    ]
  });

  if (process.env.NODE_ENV === 'development') {
    admin.watch();
  }

  const ConnectSession = Connect(session);
  const sessionStore = new ConnectSession({
    conObject: { connectionString },
    tableName: 'admin_session',
    createTableIfMissing: true
  });

  const app = express();
  app.disable('x-powered-by');

  const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate: async (email, password) => {
        const user = await authenticate(email, password);
        return user ? { email: user.email } : null;
      },
      cookieName: 'adminjs',
      cookiePassword: process.env.ADMIN_SESSION_SECRET || 'change-me-in-production-admin-session'
    },
    null,
    {
      store: sessionStore,
      resave: true,
      saveUninitialized: true,
      secret: process.env.ADMIN_SESSION_SECRET || 'change-me-in-production-admin-session',
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production'
      },
      name: 'adminjs'
    }
  );

  app.use(admin.options.rootPath, adminRouter);

  app.get('/health', (req, res) => {
    res.json({ success: true, data: { service: 'admin-service', status: 'ok' } });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Admin panel at http://localhost:${PORT}${admin.options.rootPath}`);
  });
};

start().catch((err) => {
  console.error('Admin service failed to start:', err);
  process.exit(1);
});
