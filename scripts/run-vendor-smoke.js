#!/usr/bin/env node
/**
 * Vendor flows smoke test (PoW + vendor login).
 * Exerce les parcours propres au vendeur (CRUD produit, commandes reçues, retours,
 * messagerie) que la suite acheteur ne couvre pas.
 *
 * Pré-requis : Docker Compose up + bootstrap exécuté (compte vendeur de démo créé).
 *   node scripts/run-vendor-smoke.js
 */
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const GATEWAY = (process.env.GATEWAY_URL || 'http://127.0.0.1:3000').replace(/\/+$/, '');
const API = `${GATEWAY}/api/v1`;
const DIFFICULTY = Math.max(1, Number(process.env.POW_DIFFICULTY) || 3);
const CLIENT_FP = `vendor-smoke-${Date.now()}`;
const VENDOR_EMAIL = process.env.SMOKE_VENDOR_EMAIL || 'etame.eddy01@gmail.com';
const VENDOR_PASSWORD = process.env.SMOKE_VENDOR_PASSWORD || 'Amaz@2026!';

const sha256Hex = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
const FINGERPRINT_HASH = sha256Hex(`fp:${CLIENT_FP}`);

function minePow(method, pathQuery) {
  const timestamp = Date.now();
  const prefix = '0'.repeat(DIFFICULTY);
  const seed = crypto.randomBytes(8).toString('hex');
  for (let i = 0; i < 400000; i += 1) {
    const nonce = `${seed}-${i}`;
    const hash = sha256Hex(`${method.toUpperCase()}:${pathQuery}:${timestamp}:${nonce}:${FINGERPRINT_HASH}`);
    if (hash.startsWith(prefix)) return { proof: hash, nonce, timestamp };
  }
  throw new Error('PoW mining failed');
}

function powHeaders(method, urlString) {
  const u = new URL(urlString);
  const p = minePow(method, `${u.pathname}${u.search}`);
  return {
    'X-Client-Fingerprint': CLIENT_FP,
    'X-PoW-Proof': p.proof,
    'X-PoW-Nonce': p.nonce,
    'X-PoW-Timestamp': String(p.timestamp)
  };
}

async function api(method, relPath, { json, token } = {}) {
  const url = `${API}${relPath.startsWith('/') ? '' : '/'}${relPath}`;
  const headers = {
    Accept: 'application/json',
    'X-Request-Id': `vsmoke_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    ...powHeaders(method, url)
  };
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, { method, headers, body: json !== undefined ? JSON.stringify(json) : undefined });
  let data = null;
  const text = await res.text();
  if (text) { try { data = JSON.parse(text); } catch { data = { raw: text }; } }
  return { status: res.status, ok: res.ok, data };
}

const results = [];
function record(name, pass, detail) {
  results.push(pass);
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail != null ? ` — ${detail}` : ''}`);
}

async function main() {
  console.log('=== Vendor flows smoke ===');
  console.log('Gateway:', GATEWAY, '| vendor:', VENDOR_EMAIL, '\n');

  const login = await api('POST', '/auth/login', { json: { email: VENDOR_EMAIL, password: VENDOR_PASSWORD } });
  const token = login.data?.data?.accessToken || login.data?.data?.token || null;
  const role = login.data?.data?.user?.role || login.data?.data?.role;
  record('POST /auth/login (vendor)', login.status === 200 && Boolean(token), `${login.status} role=${role}`);
  if (!token) { console.log('\nNo token — aborting.'); process.exitCode = 1; return; }

  const me = await api('GET', '/auth/me', { token });
  record('GET /auth/me', me.status === 200, `${me.status} role=${me.data?.data?.role || me.data?.data?.user?.role}`);

  const prods = await api('GET', '/produits', { token });
  const items = prods.data?.data?.items || [];
  record('GET /produits', prods.status === 200, `${prods.status} count=${items.length}`);

  const create = await api('POST', '/produits', { token, json: {
    titre: 'Produit test vendeur', title: 'Produit test vendeur',
    description: 'Article cree par le smoke test vendeur (a supprimer).',
    prix: 19999, price: 19999, category: 'Electronique', categorie: 'Electronique',
    stock: 5, image: ''
  }});
  const newId = create.data?.data?.id || create.data?.data?.product?.id;
  record('POST /produits (create)', (create.status === 201 || create.status === 200) && Boolean(newId),
    `${create.status} id=${newId || 'none'}${newId ? '' : ' ' + JSON.stringify(create.data?.error || create.data).slice(0, 120)}`);

  if (newId) {
    const upd = await api('PUT', `/produits/${encodeURIComponent(newId)}`, { token, json: { stock: 9, prix: 18999, price: 18999 } });
    record('PUT /produits/:id (update)', upd.status === 200, upd.status);
    const del = await api('DELETE', `/produits/${encodeURIComponent(newId)}`, { token });
    record('DELETE /produits/:id', del.status === 200 || del.status === 204, del.status);
  } else {
    record('PUT /produits/:id (update)', false, 'skipped (no created id)');
    record('DELETE /produits/:id', false, 'skipped');
  }

  const orders = await api('GET', '/commandes', { token });
  record('GET /commandes (vendor)', orders.status === 200, `${orders.status} count=${(orders.data?.data?.items || []).length}`);

  const rets = await api('GET', '/retours', { token });
  record('GET /retours (vendor)', rets.status === 200, `${rets.status} count=${(rets.data?.data?.items || []).length}`);

  const convs = await api('GET', '/messages/conversations', { token });
  record('GET /messages/conversations', convs.status === 200, convs.status);

  const passed = results.filter(Boolean).length;
  console.log(`\nSummary: ${passed}/${results.length} passed`);
  if (passed < results.length) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
