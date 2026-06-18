/**
 * Database bootstrap: run all MySQL migrations in order, then seed.
 * Prerequisite: MySQL and Mongo running (e.g. docker compose up -d).
 *
 * Usage: node scripts/db-bootstrap.js
 *   Or:  npm run db:bootstrap
 *
 * Uses .env for MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE, MONGO_URI.
 * Optional: MYSQL_SUPERUSER, MYSQL_SUPERUSER_PASSWORD for creating amaz database/user when missing.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const mysql = require('mysql2/promise');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

const { getMysqlPool, resetMysqlPool } = require('../shared/db/mysql');

const MIGRATIONS_DIR = path.resolve(__dirname, '../db/mysql/migrations');
const MIGRATION_ORDER = [
  '001_init.sql',
  '002_vendors.sql',
  '003_user_addresses.sql',
  '004_user_accounts_view_fix.sql',
  '005_vendor_approval.sql',
  '006_blocked_ips.sql',
  '007_order_status_history.sql',
  '008_vendors_primary_key.sql',
  '009_returns.sql'
];

function createPool(overrides = {}) {
  return mysql.createPool({
    host: process.env.MYSQL_HOST || process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT || process.env.MYSQL_PORT || 3306),
    user: overrides.user ?? process.env.MYSQL_USER,
    password: overrides.password ?? process.env.MYSQL_PASSWORD,
    database: overrides.database ?? process.env.MYSQL_DATABASE ?? process.env.MYSQL_DB ?? 'amaz_db',
    waitForConnections: true,
    connectionLimit: 2,
    queueLimit: 0,
    multipleStatements: true
  });
}

async function ensureAmazDatabase() {
  const superUser = process.env.MYSQL_SUPERUSER || process.env.MYSQL_USER || 'root';
  const db = (process.env.MYSQL_DATABASE || process.env.MYSQL_DB || process.env.MYSQL_DATABASE || process.env.MYSQL_DB || 'amaz_db')
    .replace(/[^a-zA-Z0-9_]/g, '') || 'amaz_db';
  const amazUser = (process.env.MYSQL_USER || process.env.MYSQL_USER || 'amaz').replace(/[^a-zA-Z0-9_]/g, '') || 'amaz';
  const amazPass = process.env.MYSQL_PASSWORD || process.env.MYSQL_PASSWORD || 'amaz';
  const dbSafe = db.replace(/`/g, '');

  const passwordsToTry = [
    process.env.MYSQL_SUPERUSER_PASSWORD,
    process.env.MYSQL_SUPERUSER_PASSWORD_ALT,
    process.env.MYSQL_PASSWORD,
    process.env.MYSQL_PASSWORD,
    '',
    'root',
    'password'
  ].filter((p, i, arr) => p !== undefined && p !== null && arr.indexOf(p) === i);

  let pool;
  for (const superPass of passwordsToTry) {
    pool = createPool({
      user: superUser,
      password: superPass ?? '',
      database: 'mysql'
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
    const [userRows] = await pool.query(
      'SELECT 1 FROM mysql.user WHERE user = ?',
      [amazUser]
    );
    if (userRows.length === 0) {
      const safePass = (amazPass || 'amaz').replace(/'/g, "''");
      await pool.query('CREATE USER IF NOT EXISTS ?@\'%' IDENTIFIED BY ?', [amazUser, safePass]);
      console.log(`  Created user ${amazUser}`);
    }

    const [dbRows] = await pool.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [dbSafe]
    );
    if (dbRows.length === 0) {
      await pool.query(`CREATE DATABASE \`${dbSafe}\``);
      console.log(`  Created database ${dbSafe}`);
    }

    await pool.query(`GRANT ALL PRIVILEGES ON \`${dbSafe}\`.* TO ?@'%'`, [amazUser]);
    await pool.query('FLUSH PRIVILEGES');
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

  let pool = getMysqlPool();

  try {
    console.log('Running MySQL migrations...');
    await runMigrations(pool);
    console.log('Migrations done.\n');
  } catch (err) {
    const isSetupIssue = /access denied|unknown database|ER_ACCESS_DENIED_ERROR|ER_BAD_DB_ERROR/i.test(err.message);
    if (isSetupIssue) {
      console.log('Database setup issue detected. Creating database/user via superuser...');
      try {
        await ensureAmazDatabase();
      } catch (superErr) {
        console.error('Could not create MySQL database/user:', superErr.message);
        console.error('\nTo fix manually: connect as MySQL superuser and run:');
        console.error('  CREATE DATABASE amaz_db;');
        console.error('  CREATE USER IF NOT EXISTS \'amaz\'@\'%' IDENTIFIED BY \'amaz\';');
        console.error('  GRANT ALL PRIVILEGES ON amaz_db.* TO \'amaz\'@\'%\';');
        console.error('\nOr recreate the MySQL volume and retry:');
        console.error('  docker compose -f docker-compose.full.yml down -v');
        console.error('  docker compose -f docker-compose.full.yml up -d');
        console.error('  npm run db:bootstrap');
        process.exitCode = 1;
        return;
      }
      await resetMysqlPool();
      pool = getMysqlPool();
      console.log('Retrying migrations...');
      await runMigrations(pool);
      console.log('Migrations done.\n');
    } else {
      console.error('Migration failed:', err.message);
      process.exitCode = 1;
      return;
    }
  } finally {
    await resetMysqlPool();
  }

  console.log('Running MySQL seed...');
  runScript(path.join(__dirname, '../db/mysql/seed.js'), 'MySQL seed');
  console.log('MySQL seed done.\n');

  console.log('Running Mongo init...');
  runScript(path.join(__dirname, '../db/mongo/init.js'), 'Mongo init');
  console.log('Mongo init done.\n');

  console.log('Bootstrap complete.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

