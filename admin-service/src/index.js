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

const { buildSqlResources } = require('./admin-resources.cjs');

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

async function buildMongoAdminResources(AdminJS) {
  const uri = process.env.MONGO_URI || '';
  if (!uri) return [];
  try {
    const mongoose = (await import('mongoose')).default;
    const { Database, Resource } = await import('@adminjs/mongoose');
    AdminJS.registerAdapter({ Database, Resource });

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(uri, {
        dbName: process.env.MONGO_DB_NAME || undefined
      });
    }

    const productSchema = new mongoose.Schema(
      {},
      {
        strict: false,
        collection: 'products'
      }
    );
    const Product =
      mongoose.models.AmazAdminCatalogProduct ||
      mongoose.model('AmazAdminCatalogProduct', productSchema);

    return [
      {
        resource: Product,
        options: {
          id: 'mongo_products',
          navigation: { name: 'Catalog (Mongo, read-only)' },
          actions: {
            new: { isAccessible: () => false },
            edit: { isAccessible: () => false },
            delete: { isAccessible: () => false },
            bulkDelete: { isAccessible: () => false }
          }
        }
      }
    ];
  } catch (e) {
    console.warn('Admin Mongo catalog skipped:', e.message);
    return [];
  }
}

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

  const sqlResources = buildSqlResources(db, {
    USER_SERVICE_URL,
    INTERNAL_SHARED_SECRET
  });

  const mongoResources = await buildMongoAdminResources(AdminJS);

  const admin = new AdminJS({
    rootPath: '/admin',
    resources: [...sqlResources, ...mongoResources]
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

  // Allow the Angular admin app (another origin) to poll GET /health from the browser.
  app.use((req, res, next) => {
    if (req.path === '/health' || req.path.startsWith('/health')) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS' && req.path === '/health') {
      return res.status(204).end();
    }
    return next();
  });

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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Admin panel at http://localhost:${PORT}${admin.options.rootPath}`);
  });
  server.on('error', (err) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(
        `Port ${PORT} is already in use (another admin-service or app). ` +
          `Stop that process, or run with ADMIN_SERVICE_PORT=3011 npm run start:admin. ` +
          `Windows: netstat -ano | findstr :${PORT} then taskkill /PID <pid> /F`
      );
    } else {
      console.error(err);
    }
    process.exit(1);
  });
};

start().catch((err) => {
  console.error('Admin service failed to start:', err);
  process.exit(1);
});
