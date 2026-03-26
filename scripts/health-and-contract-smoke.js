#!/usr/bin/env node
/**
 * Health checks par microservice + smoke minimal contrat v1.2 (PoW).
 * Prérequis : stack démarrée (voir README).
 *
 *   node ./scripts/health-and-contract-smoke.js
 *   SKIP_CONTRACT=1 node ./scripts/health-and-contract-smoke.js   # health uniquement
 */

const crypto = require('crypto');
const path = require('path');

try {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} catch {
  /* optional */
}

const GATEWAY_BASE = (process.env.GATEWAY_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const POW_DIFFICULTY = Math.max(1, Number(process.env.POW_DIFFICULTY) || 3);
const SKIP_CONTRACT = String(process.env.SKIP_CONTRACT || '').toLowerCase() === '1';

const DIRECT_SERVICES = [
  { name: 'user', port: Number(process.env.USERS_SERVICE_PORT) || 3001 },
  { name: 'product', port: Number(process.env.PRODUCTS_SERVICE_PORT) || 3002 },
  { name: 'order', port: Number(process.env.ORDERS_SERVICE_PORT) || 3003 },
  { name: 'messaging', port: Number(process.env.MESSAGING_SERVICE_PORT) || 3004 },
  { name: 'ai', port: Number(process.env.AI_SERVICE_PORT) || 3005 },
  { name: 'pepper', port: Number(process.env.PEPPER_SERVICE_PORT) || 3006 }
];

function sha256Hex(str) {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/** Même algorithme que le front (PowService) et shared/utils/pow.js */
function minePow({ method, urlPath, fingerprintHash, difficulty }) {
  const timestamp = Date.now();
  const targetPrefix = '0'.repeat(difficulty);
  const seed = crypto.randomBytes(8).toString('hex');
  const maxAttempts = 300000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const nonce = `${seed}-${attempt}`;
    const candidate = `${method.toUpperCase()}:${urlPath}:${timestamp}:${nonce}:${fingerprintHash}`;
    const hash = sha256Hex(candidate);
    if (hash.startsWith(targetPrefix)) {
      return { proof: hash, nonce, timestamp };
    }
  }
  throw new Error('Échec minage PoW (augmenter POW_DIFFICULTY ?)');
}

async function fetchJson(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: {
        accept: 'application/json',
        ...(options.headers || {})
      }
    });
  } catch (e) {
    const msg = e?.cause?.message || e.message || String(e);
    return { ok: false, status: 0, data: null, networkError: msg };
  }
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  return { ok: res.ok, status: res.status, data };
}

function assert(cond, msg, failures) {
  if (!cond) failures.push(msg);
}

async function main() {
  const failures = [];

  const gHealth = await fetchJson(`${GATEWAY_BASE}/health`);
  if (gHealth.networkError) {
    console.error('health-and-contract-smoke: Gateway injoignable (%s): %s', GATEWAY_BASE, gHealth.networkError);
    console.error('Démarrez la stack (voir README), puis relancez ce script.');
    process.exitCode = 1;
    return;
  }
  assert(gHealth.ok && gHealth.data?.data?.status === 'ok', `Gateway /health (${gHealth.status})`, failures);

  const agg = await fetchJson(`${GATEWAY_BASE}/health/aggregate`);
  assert(agg.ok && agg.data?.data?.gateway, `Gateway /health/aggregate (${agg.status})`, failures);

  for (const { name, port } of DIRECT_SERVICES) {
    const url = `http://127.0.0.1:${port}/health`;
    const r = await fetchJson(url);
    assert(!r.networkError, `Service ${name} : ${r.networkError}`, failures);
    assert(r.ok, `Service ${name} GET /health port ${port} → ${r.status}`, failures);
  }

  if (!SKIP_CONTRACT) {
    const clientFp = 'smoke-contract-script';
    const fingerprintHash = sha256Hex(`fp:${clientFp}`);

    const produitsPath = '/api/v1/produits';
    const produitsUrl = `${GATEWAY_BASE}${produitsPath}`;
    const powProd = minePow({
      method: 'GET',
      urlPath: produitsPath,
      fingerprintHash,
      difficulty: POW_DIFFICULTY
    });

    const prodRes = await fetchJson(produitsUrl, {
      method: 'GET',
      headers: {
        'X-Client-Fingerprint': clientFp,
        'X-PoW-Proof': powProd.proof,
        'X-PoW-Nonce': powProd.nonce,
        'X-PoW-Timestamp': String(powProd.timestamp)
      }
    });
    assert(
      [200, 401, 403, 502, 503].includes(prodRes.status),
      `GET ${produitsPath} statut inattendu ${prodRes.status}`,
      failures
    );
    const powErr = prodRes.data?.error?.code;
    if (powErr && String(powErr).startsWith('POW_')) {
      failures.push(`GET ${produitsPath} : PoW rejeté (${powErr})`);
    }

    const botPath = '/api/v1/bot/auth';
    const botUrl = `${GATEWAY_BASE}${botPath}`;
    const powBot = minePow({
      method: 'POST',
      urlPath: botPath,
      fingerprintHash,
      difficulty: POW_DIFFICULTY
    });

    const botRes = await fetchJson(botUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Client-Fingerprint': clientFp,
        'X-PoW-Proof': powBot.proof,
        'X-PoW-Nonce': powBot.nonce,
        'X-PoW-Timestamp': String(powBot.timestamp)
      },
      body: JSON.stringify({ etat: 'ok', action: 'smoke' })
    });
    assert(
      botRes.ok && botRes.status === 200 && botRes.data?.success,
      `POST ${botPath} sans Bearer (PoW only) → ${botRes.status} ${JSON.stringify(botRes.data?.error || '')}`,
      failures
    );
  }

  if (failures.length) {
    console.error('health-and-contract-smoke: ÉCHEC');
    for (const f of failures) console.error(' -', f);
    process.exitCode = 1;
    return;
  }
  console.log('health-and-contract-smoke: OK', SKIP_CONTRACT ? '(health seulement)' : '(health + contrat)');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
