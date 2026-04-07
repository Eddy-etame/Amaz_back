/**
 * Database bootstrap: run all Postgres migrations in order, then seed.
 * Prerequisite: Postgres and Mongo running (e.g. docker compose up -d).
 *
 * Usage: node scripts/db-bootstrap.js
 *   Or:  npm run db:bootstrap
 *
 * Uses .env for PG_HOST, PG_PORT, PG_USER, PG_PASSWORD, PG_DATABASE, MONGO_URI.
 * Optional: PG_SUPERUSER, PG_SUPERUSER_PASSWORD for creating amaz role when missing.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { Pool } = require('pg');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

const { getPostgresPool, resetPostgresPool } = require('../shared/db/postgres');

const MIGRATIONS_DIR = path.resolve(__dirname, '../db/postgres/migrations');
const MIGRATION_ORDER = [
  '001_init.sql',
  '002_vendors.sql',
  '003_user_addresses.sql',
  '004_user_accounts_view_fix.sql',
  '005_vendor_approval.sql',
  '006_blocked_ips.sql',
  '007_order_status_history.sql',
  '008_vendors_primary_key.sql'
];

function createPool(overrides = {}) {
  return new Pool({
    host: process.env.PG_HOST,
    port: Number(process.env.PG_PORT || 5432),
    user: overrides.user ?? process.env.PG_USER,
    password: overrides.password ?? process.env.PG_PASSWORD,
    database: overrides.database ?? process.env.PG_DATABASE ?? process.env.PG_DB ?? 'postgres',
    ssl: String(process.env.PG_SSL || 'false') === 'true' ? { rejectUnauthorized: false } : false,
    max: 2,
    idleTimeoutMillis: 5000
  });
}

async function ensureAmazRole() {
  const superUser = process.env.PG_SUPERUSER || 'postgres';
  const db = (process.env.PG_DATABASE || process.env.PG_DB || 'amaz_db').replace(/[^a-zA-Z0-9_]/g, '') || 'amaz_db';
  const amazUser = (process.env.PG_USER || 'amaz').replace(/[^a-zA-Z0-9_]/g, '') || 'amaz';
  const amazPass = process.env.PG_PASSWORD || 'amaz';

  const passwordsToTry = [
    process.env.PG_SUPERUSER_PASSWORD,
    process.env.PG_SUPERUSER_PASSWORD_ALT,
    process.env.PG_PASSWORD,
    '',
    'postgres',
    'Daddiesammy1$',
    'Daddieammy1$'
  ].filter((p, i, arr) => p !== undefined && p !== null && arr.indexOf(p) === i);

  let pool;
  for (const superPass of passwordsToTry) {
    pool = createPool({
      user: superUser,
      password: superPass ?? '',
      database: 'postgres'
    });
    try {
      await pool.query('SELECT 1');
      break;
    } catch (e) {
      await pool.end();
      if (passwordsToTry.indexOf(superPass) === passwordsToTry.length - 1) throw e;
    }
  }

  try {
    const roleExists = await pool.query(
      'SELECT 1 FROM pg_roles WHERE rolname = $1',
      [amazUser]
    );
    if (roleExists.rows.length === 0) {
      const safePass = (amazPass || 'amaz').replace(/'/g, "''");
      await pool.query(`CREATE ROLE ${amazUser} WITH LOGIN PASSWORD '${safePass}'`);
      console.log(`  Created role ${amazUser}`);
    }

    const dbCheck = await pool.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [db]
    );
    if (dbCheck.rows.length === 0) {
      await pool.query(`CREATE DATABASE ${db} OWNER ${amazUser}`);
      console.log(`  Created database ${db}`);
    }
  } finally {
    await pool.end();
  }
}

async function runMigrations(pool) {
  for (const file of MIGRATION_ORDER) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`Migration not found: ${file}`);
      continue;
    }
    const sql = fs.readFileSync(filePath, 'utf8');
    await pool.query(sql);
    console.log(`  Ran ${file}`);
  }
}

function runScript(scriptPath, label) {
  const result = spawnSync('node', [scriptPath], {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
    env: process.env
  });
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
}

async function main() {
  console.log('=== Amaz DB Bootstrap ===\n');

  let pool = getPostgresPool();

  try {
    console.log('Running Postgres migrations...');
    await runMigrations(pool);
    console.log('Migrations done.\n');
  } catch (err) {
    const isRoleMissing = /role "amaz" does not exist|role .amaz. does not exist/i.test(err.message);
    if (isRoleMissing) {
      console.log('amaz role not found. Creating it via superuser...');
      try {
        await ensureAmazRole();
      } catch (superErr) {
        console.error('Could not create amaz role:', superErr.message);
        console.error('\nTo fix manually: connect as postgres superuser and run:');
        console.error('  CREATE ROLE amaz WITH LOGIN PASSWORD \'amaz\';');
        console.error('  CREATE DATABASE amaz_db OWNER amaz;');
        console.error('\nOr recreate the Postgres volume:');
        console.error('  docker compose -f docker-compose.full.yml down -v');
        console.error('  docker compose -f docker-compose.full.yml up -d');
        console.error('  npm run db:bootstrap');
        process.exitCode = 1;
        return;
      }
      await resetPostgresPool();
      pool = getPostgresPool();
      console.log('Retrying migrations...');
      await runMigrations(pool);
      console.log('Migrations done.\n');
    } else {
      console.error('Migration failed:', err.message);
      process.exitCode = 1;
      return;
    }
  } finally {
    await resetPostgresPool();
  }

  console.log('Running Postgres seed...');
  runScript(path.join(__dirname, '../db/postgres/seed.js'), 'Postgres seed');
  console.log('Postgres seed done.\n');

  console.log('Running Mongo init...');
  runScript(path.join(__dirname, '../db/mongo/init.js'), 'Mongo init');
  console.log('Mongo init done.\n');

  console.log('Bootstrap complete.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
