/**
 * E2E auth test: register, login, /auth/me with PoW.
 * Prerequisite: gateway + user-service + pepper + Postgres running.
 *
 * Usage: node scripts/run-e2e-auth.js
 *   Or:  npm run test:e2e-auth
 *
 * Uses seeded user: eddy.etame@enkoschools.com / Amaz@2026!
 */
const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env')
});

const crypto = require('crypto');

const GATEWAY = process.env.GATEWAY_URL || 'http://localhost:3000';
const API_BASE = `${GATEWAY.replace(/\/+$/, '')}/api/v1`;
const DIFFICULTY = Math.max(0, Number(process.env.POW_DIFFICULTY) || 3);
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || 'eddy.etame@enkoschools.com';
const TEST_PASSWORDS = [
  process.env.E2E_TEST_PASSWORD,
  process.env.E2E_TEST_PASSWORD_ALT,
  'Amaz@2026!',
  'Daddiesammy1$',
  'Daddieammy1$'
].filter((p, i, arr) => p && arr.indexOf(p) === i);

function sha256Hex(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function generatePow(method, url, fingerprintHash) {
  if (DIFFICULTY <= 0) {
    return { proof: '0', nonce: '0', timestamp: Date.now() };
  }

  const parsed = new URL(url, 'http://localhost');
  const pathWithQuery = `${parsed.pathname}${parsed.search}`;
  const timestamp = Date.now();
  const targetPrefix = '0'.repeat(DIFFICULTY);
  const seed = crypto.randomBytes(8).toString('hex');

  for (let attempt = 0; attempt < 500_000; attempt++) {
    const nonce = `${seed}-${attempt}`;
    const candidate = `${method.toUpperCase()}:${pathWithQuery}:${timestamp}:${nonce}:${fingerprintHash}`;
    const hash = sha256Hex(candidate);
    if (hash.startsWith(targetPrefix)) {
      return { proof: hash, nonce, timestamp };
    }
  }
  return null;
}

async function fetchWithPow(method, path, body = null, clientFp = null) {
  const url = `${API_BASE}${path}`;
  const fp = clientFp || 'e2e-test-fingerprint-' + Date.now();
  const gatewayFp = sha256Hex(`fp:${fp}`);

  const pow = generatePow(method, url, gatewayFp);
  if (!pow && DIFFICULTY > 0) {
    throw new Error('Failed to generate PoW');
  }

  const headers = {
    'Content-Type': 'application/json',
    'X-Request-Id': `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    'X-Client-Fingerprint': fp
  };

  if (pow && DIFFICULTY > 0) {
    headers['X-PoW-Proof'] = pow.proof;
    headers['X-PoW-Nonce'] = pow.nonce;
    headers['X-PoW-Timestamp'] = String(pow.timestamp);
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = { raw: await res.text() };
  }

  return { status: res.status, ok: res.ok, data, clientFp: fp };
}

async function main() {
  console.log('=== E2E Auth Test ===\n');
  console.log(`Gateway: ${API_BASE}`);
  console.log(`PoW difficulty: ${DIFFICULTY}`);
  console.log(`Test user: ${TEST_EMAIL}\n`);

  const results = [];

  try {
    const clientFp = 'e2e-test-fingerprint-' + Date.now();
    let loginRes = null;
    let usedPassword = null;
    for (const pwd of TEST_PASSWORDS.length ? TEST_PASSWORDS : ['Amaz@2026!']) {
      loginRes = await fetchWithPow('POST', '/auth/login', {
        email: TEST_EMAIL,
        password: pwd
      }, clientFp);
      const ok = loginRes.ok && loginRes.status === 200 && loginRes.data?.success && loginRes.data?.data?.token;
      if (ok) {
        usedPassword = pwd;
        break;
      }
      if (loginRes.status === 401) continue;
      break;
    }

    const loginPass = loginRes.ok && loginRes.status === 200 && loginRes.data?.success && loginRes.data?.data?.token;
    results.push({ name: 'Login', pass: loginPass, status: loginRes.status });

    if (!loginPass) {
      console.log('Login FAIL:', loginRes.status, loginRes.data?.error?.message || loginRes.data?.error?.code || '');
      if (loginRes.status === 400 && loginRes.data?.error?.code === 'POW_REQUIRED') {
        console.log('  -> PoW rejected. Check POW_DIFFICULTY and fingerprint.');
      }
      process.exitCode = 1;
      return;
    }

    if (usedPassword) console.log('(used password:', usedPassword.replace(/./g, '*') + ')');
    const token = loginRes.data?.data?.accessToken || loginRes.data?.data?.token;
    console.log('Login OK, token received');

    const meUrl = `${API_BASE}/auth/me`;
    const mePow = generatePow('GET', meUrl, sha256Hex(`fp:${clientFp}`));
    const meRes = await fetch(meUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-Request-Id': `e2e_me_${Date.now()}`,
        'X-Client-Fingerprint': clientFp,
        'X-PoW-Proof': mePow?.proof || '0',
        'X-PoW-Nonce': mePow?.nonce || '0',
        'X-PoW-Timestamp': String(mePow?.timestamp || Date.now())
      }
    });

    const meData = await meRes.json().catch(() => ({}));
    const mePass = meRes.ok && meRes.status === 200 && meData?.success && meData?.data?.user;
    results.push({ name: 'GET /auth/me', pass: mePass, status: meRes.status });

    if (mePass) {
      console.log('GET /auth/me OK, user:', meData?.data?.user?.email);
    } else {
      console.log('GET /auth/me FAIL:', meRes.status);
    }

    const passed = results.filter((r) => r.pass).length;
    const total = results.length;
    console.log(`\nResult: ${passed}/${total} pass`);
    process.exitCode = passed === total ? 0 : 1;
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  }
}

main();
