#!/usr/bin/env node
/**
 * Full gateway API regression suite (PoW + Bearer where required).
 * Run from the host with Docker Compose publishing 3000–3006 (see docker-compose.full.yml).
 *
 *   npm run test:gateway-suite
 *   GATEWAY_URL=http://localhost:3000 npm run test:gateway-suite
 */

const path = require('path');
const crypto = require('crypto');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const GATEWAY = (process.env.GATEWAY_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const API = `${GATEWAY}/api/v1`;
const DIFFICULTY = Math.max(1, Number(process.env.POW_DIFFICULTY) || 3);
const CLIENT_FP = process.env.QA_CLIENT_FP || `gateway-suite-${Date.now()}`;
const TEST_EMAIL = process.env.E2E_TEST_EMAIL || `suite_${Date.now()}@qa.local`;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD || 'SuiteTest1!';

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

const FINGERPRINT_HASH = sha256Hex(`fp:${CLIENT_FP}`);

function minePow(method, fullPathWithQuery) {
  const timestamp = Date.now();
  const prefix = '0'.repeat(DIFFICULTY);
  const seed = crypto.randomBytes(8).toString('hex');
  for (let i = 0; i < 400000; i += 1) {
    const nonce = `${seed}-${i}`;
    const candidate = `${method.toUpperCase()}:${fullPathWithQuery}:${timestamp}:${nonce}:${FINGERPRINT_HASH}`;
    const hash = sha256Hex(candidate);
    if (hash.startsWith(prefix)) {
      return { proof: hash, nonce, timestamp };
    }
  }
  throw new Error('PoW mining failed');
}

function powHeaders(method, urlString) {
  const u = new URL(urlString);
  const pathQuery = `${u.pathname}${u.search}`;
  const p = minePow(method, pathQuery);
  return {
    'X-Client-Fingerprint': CLIENT_FP,
    'X-PoW-Proof': p.proof,
    'X-PoW-Nonce': p.nonce,
    'X-PoW-Timestamp': String(p.timestamp)
  };
}

async function fetchApi(method, relPath, { json, token } = {}) {
  const url = relPath.startsWith('http') ? relPath : `${API}${relPath.startsWith('/') ? '' : '/'}${relPath}`;
  const headers = {
    Accept: 'application/json',
    'X-Request-Id': `suite_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...powHeaders(method, url)
  };
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : undefined
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  return { status: res.status, ok: res.ok, data };
}

function record(results, name, pass, detail) {
  results.push({ name, pass, detail: detail != null ? String(detail) : '' });
  const icon = pass ? 'PASS' : 'FAIL';
  console.log(`[${icon}] ${name}${detail != null && detail !== '' ? ` — ${detail}` : ''}`);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Gateway health monitor may need time after `docker compose up` before user-service is "ok". */
async function waitForHealthyUser(maxMs) {
  const step = 3000;
  for (let elapsed = 0; elapsed < maxMs; elapsed += step) {
    try {
      const agg = await fetch(`${GATEWAY}/health/aggregate`);
      if (!agg.ok) {
        await sleep(step);
        continue;
      }
      const j = await agg.json().catch(() => ({}));
      const u = j?.data?.services?.user;
      if (u?.status === 'ok' && u?.code === 200) {
        if (elapsed > 0) console.log(`(user-service became healthy after ${elapsed}ms)\n`);
        return true;
      }
    } catch {
      /* ignore */
    }
    await sleep(step);
  }
  return false;
}

async function main() {
  const results = [];
  console.log('=== Gateway API suite ===');
  console.log('Gateway:', GATEWAY);
  console.log('PoW difficulty:', DIFFICULTY);
  console.log('');

  const waitMs = Math.max(0, Number(process.env.GATEWAY_SUITE_WAIT_USER_MS) || 60000);
  if (waitMs > 0 && process.env.GATEWAY_SUITE_SKIP_WAIT !== '1') {
    console.log(`Waiting up to ${waitMs}ms for user-service to be healthy in /health/aggregate...`);
    await waitForHealthyUser(waitMs);
    console.log('');
  }

  let token = null;

  try {
    const h = await fetch(`${GATEWAY}/health`);
    record(results, 'GET /health', h.ok && h.status === 200, h.status);

    const agg = await fetch(`${GATEWAY}/health/aggregate`);
    let aggOk = agg.ok && agg.status === 200;
    if (aggOk) {
      const j = await agg.json().catch(() => ({}));
      const svcs = j?.data?.services || {};
      for (const k of ['user', 'product', 'order', 'messaging', 'ai', 'pepper']) {
        const s = svcs[k];
        const up = s?.status === 'ok' && s?.code === 200;
        record(results, `aggregate service:${k}`, up, s ? `${s.status} ${s.code}` : 'missing');
        if (!up) aggOk = false;
      }
    }
    record(results, 'GET /health/aggregate', aggOk, agg.status);

    const prodList = await fetchApi('GET', '/produits');
    const items = prodList.data?.data?.items || [];
    const firstId = items[0]?.id;
    record(
      results,
      'GET /api/v1/produits',
      prodList.status === 200 && Array.isArray(items),
      `${prodList.status} count=${items.length}`
    );

    if (firstId) {
      const one = await fetchApi('GET', `/produits/${encodeURIComponent(firstId)}`);
      record(results, 'GET /api/v1/produits/:id', one.status === 200, one.status);
    } else {
      record(results, 'GET /api/v1/produits/:id', false, 'skipped (no products — run db:bootstrap)');
    }

    const reg = await fetchApi('POST', '/auth/register', {
      json: { email: TEST_EMAIL, password: TEST_PASSWORD, username: 'qa_suite' }
    });
    record(
      results,
      'POST /api/v1/auth/register',
      reg.status === 201 || reg.status === 200,
      reg.status
    );

    const login = await fetchApi('POST', '/auth/login', {
      json: { email: TEST_EMAIL, password: TEST_PASSWORD }
    });
    if (login.status === 200 && login.data?.data) {
      token = login.data.data.accessToken || login.data.data.token || null;
    }
    record(results, 'POST /api/v1/auth/login', Boolean(token), login.status);

    if (token) {
      const me = await fetchApi('GET', '/auth/me', { token });
      record(results, 'GET /api/v1/auth/me', me.status === 200, me.status);

      const orders = await fetchApi('GET', '/commandes', { token });
      record(
        results,
        'GET /api/v1/commandes',
        orders.status === 200,
        orders.status
      );

      const orderItems = orders.data?.data?.items || [];
      const firstOrderId = orderItems[0]?.id;
      if (firstOrderId) {
        const oneOrd = await fetchApi('GET', `/commandes/${encodeURIComponent(firstOrderId)}`, { token });
        record(
          results,
          'GET /api/v1/commandes/:id',
          oneOrd.status === 200,
          oneOrd.status
        );
      } else {
        record(results, 'GET /api/v1/commandes/:id', false, 'skipped (no orders)');
      }

      const wlMine = await fetchApi('GET', '/wishlists/me', { token });
      record(results, 'GET /api/v1/wishlists/me', wlMine.status === 200, wlMine.status);

      if (firstId && wlMine.status === 200) {
        const wlAdd = await fetchApi('PATCH', '/wishlists/me', {
          token,
          json: { addProductId: firstId }
        });
        record(results, 'PATCH /api/v1/wishlists/me (add)', wlAdd.status === 200, wlAdd.status);

        const wlShare = await fetchApi('POST', '/wishlists/me/share', { token, json: {} });
        const shareTok = wlShare.data?.data?.shareToken;
        record(results, 'POST /api/v1/wishlists/me/share', wlShare.status === 200, wlShare.status);

        if (shareTok) {
          const wlPub = await fetchApi('GET', `/wishlists/shared/${encodeURIComponent(shareTok)}`);
          record(results, 'GET /api/v1/wishlists/shared/:token', wlPub.status === 200, wlPub.status);

          const wlRevoke = await fetchApi('PATCH', '/wishlists/me', {
            token,
            json: { shareDisabled: true }
          });
          record(
            results,
            'PATCH /api/v1/wishlists/me (shareDisabled)',
            wlRevoke.status === 200,
            wlRevoke.status
          );

          const wlPub404 = await fetchApi('GET', `/wishlists/shared/${encodeURIComponent(shareTok)}`);
          record(
            results,
            'GET /wishlists/shared after revoke (404)',
            wlPub404.status === 404,
            wlPub404.status
          );

          await fetchApi('PATCH', '/wishlists/me', { token, json: { shareDisabled: false } });
        } else {
          record(results, 'GET /api/v1/wishlists/shared/:token', false, 'no shareToken');
          record(results, 'PATCH /api/v1/wishlists/me (shareDisabled)', false, 'no shareToken');
          record(results, 'GET /wishlists/shared after revoke (404)', false, 'no shareToken');
        }
      } else {
        record(results, 'PATCH /api/v1/wishlists/me (add)', false, 'skipped (no product or wishlist)');
        record(results, 'POST /api/v1/wishlists/me/share', false, 'skipped');
        record(results, 'GET /api/v1/wishlists/shared/:token', false, 'skipped');
        record(results, 'PATCH /api/v1/wishlists/me (shareDisabled)', false, 'skipped');
        record(results, 'GET /wishlists/shared after revoke (404)', false, 'skipped');
      }

      const ai = await fetchApi('POST', '/ai/recommendations', {
        token,
        json: { query: 'test', limit: 3 }
      });
      record(results, 'POST /api/v1/ai/recommendations', ai.status === 200, ai.status);

      if (firstId && items[0]?.vendorId) {
        const msg = await fetchApi('POST', '/messages', {
          token,
          json: {
            content: 'Gateway suite ping',
            vendorId: items[0].vendorId,
            productId: firstId,
            subject: 'QA'
          }
        });
        record(results, 'POST /api/v1/messages', msg.status === 201 || msg.status === 200, msg.status);
      } else {
        record(results, 'POST /api/v1/messages', false, 'skipped (no product/vendor)');
      }
    } else {
      record(results, 'GET /api/v1/auth/me', false, 'no token');
      record(results, 'GET /api/v1/commandes', false, 'no token');
      record(results, 'GET /api/v1/commandes/:id', false, 'no token');
      record(results, 'GET /api/v1/wishlists/me', false, 'no token');
      record(results, 'PATCH /api/v1/wishlists/me (add)', false, 'no token');
      record(results, 'POST /api/v1/wishlists/me/share', false, 'no token');
      record(results, 'GET /api/v1/wishlists/shared/:token', false, 'no token');
      record(results, 'PATCH /api/v1/wishlists/me (shareDisabled)', false, 'no token');
      record(results, 'GET /wishlists/shared after revoke (404)', false, 'no token');
      record(results, 'POST /api/v1/ai/recommendations', false, 'no token');
      record(results, 'POST /api/v1/messages', false, 'no token');
    }

    const botUrl = `${API}/bot/auth`;
    const bot = await fetch(botUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...powHeaders('POST', botUrl)
      },
      body: JSON.stringify({ etat: 'ok', action: 'suite' })
    });
    let botData = null;
    try {
      botData = await bot.json();
    } catch {
      /* ignore */
    }
    record(
      results,
      'POST /api/v1/bot/auth (PoW only)',
      bot.ok && bot.status === 200 && botData?.success,
      bot.status
    );
  } catch (e) {
    record(results, 'suite fatal', false, e.message || String(e));
  }

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log('');
  console.log(`Summary: ${passed}/${total} passed`);

  if (passed < total) {
    console.log('\nTip: If many failures mention connection errors, ensure Docker Compose is up:');
    console.log('  docker compose -f docker-compose.full.yml up -d');
    console.log('Tests must run on the same machine where ports 3000–3006 are published.');
    process.exitCode = 1;
  }
}

main();
