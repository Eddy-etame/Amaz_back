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
  const superUser = process.env.MYSQL_SUPERUSER || 'root';
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
    const safePass = (amazPass || 'amaz').replace(/'/g, "''");
    if (userRows.length === 0) {
      await pool.query(`CREATE USER IF NOT EXISTS '${amazUser}'@'%' IDENTIFIED WITH mysql_native_password BY '${safePass}'`);
      console.log(`  Created user ${amazUser} with mysql_native_password`);
    } else {
      await pool.query(`ALTER USER '${amazUser}'@'%' IDENTIFIED WITH mysql_native_password BY '${safePass}'`);
      console.log(`  Ensured user ${amazUser} uses mysql_native_password`);
    }

    const [dbRows] = await pool.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [dbSafe]
    );
    if (dbRows.length === 0) {
      await pool.query(`CREATE DATABASE \`${dbSafe}\``);
      console.log(`  Created database ${dbSafe}`);
    }

    await pool.query(`GRANT ALL PRIVILEGES ON \`${dbSafe}\`.* TO '${amazUser}'@'%'`);
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
    // Le pool partagé n'active pas `multipleStatements` (par sécurité). On découpe donc
    // le fichier en instructions (séparateur `;`), on enlève les lignes de commentaire
    // `--`, et on exécute chaque instruction non vide une par une.
    // On retire d'ABORD les lignes de commentaire `--` (certaines contiennent un `;`),
    // PUIS on découpe sur `;`. L'inverse casserait la découpe.
    const withoutComments = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    const statements = withoutComments
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0);
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (stmtErr) {
        // Ignore "already exists" / duplicate errors to make migrations idempotent
        const ignoreCodes = [
          'ER_DUP_FIELDNAME',
          'ER_DUP_KEYNAME',
          'ER_MULTIPLE_PRI_KEY',
          'ER_TABLE_EXISTS_ERROR',
          'ER_CANT_DROP_FIELD_OR_KEY'
        ];
        const isIgnorable =
          ignoreCodes.includes(stmtErr.code) ||
          stmtErr.errno === 1060 ||
          stmtErr.errno === 1061 ||
          stmtErr.errno === 1068 ||
          stmtErr.errno === 1050 ||
          stmtErr.errno === 1091;
        if (isIgnorable) {
          console.log(`  [Idempotent Skip] ${stmtErr.message}`);
        } else {
          throw stmtErr;
        }
      }
    }
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

  // Unconditionally ensure database/user use mysql_native_password auth plugin
  // so older clients (like admin-service using older mysql package) can authenticate.
  console.log('Ensuring database and user authentication settings...');
  try {
    await ensureAmazDatabase();
  } catch (err) {
    console.log('  Non-critical: root user authentication setup skipped:', err.message);
  }

  let pool = getMysqlPool();

  try {
    // Attempt to alter our own auth mode using the regular pool, in case superuser wasn't accessible
    await pool.query(`ALTER USER CURRENT_USER IDENTIFIED WITH mysql_native_password BY '${process.env.MYSQL_PASSWORD || 'amaz'}'`);
    console.log('  Successfully configured active user session to mysql_native_password');
  } catch (selfAlterErr) {
    console.log('  Non-critical: self-alter of auth mode skipped:', selfAlterErr.message);
  }

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
        console.error("  CREATE USER IF NOT EXISTS 'amaz'@'%' IDENTIFIED BY 'amaz';");
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

