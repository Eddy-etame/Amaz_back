/**
 * QA backend health campaign: direct /health on each published port.
 * Run on the same host as Docker Compose (ports 3000–3006 on localhost).
 *
 * Retries help right after `docker compose up` while services warm up.
 */
const GATEWAY = (process.env.GATEWAY_URL || 'http://localhost:3000').replace(/\/+$/, '');
const SERVICES = {
  gateway: GATEWAY,
  user: (process.env.USERS_SERVICE_URL || 'http://localhost:3001').replace(/\/+$/, ''),
  product: (process.env.PRODUCTS_SERVICE_URL || 'http://localhost:3002').replace(/\/+$/, ''),
  order: (process.env.ORDERS_SERVICE_URL || 'http://localhost:3003').replace(/\/+$/, ''),
  messaging: (process.env.MESSAGING_SERVICE_URL || 'http://localhost:3004').replace(/\/+$/, ''),
  ai: (process.env.AI_SERVICE_URL || 'http://localhost:3005').replace(/\/+$/, ''),
  pepper: (process.env.PEPPER_SERVICE_URL || 'http://localhost:3006').replace(/\/+$/, '')
};

const RETRIES = Math.max(1, Number(process.env.QA_HEALTH_RETRIES) || 5);
const RETRY_DELAY_MS = Math.max(200, Number(process.env.QA_HEALTH_RETRY_MS) || 1500);

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...opts.headers } });
  let data;
  try {
    data = await res.json();
  } catch {
    data = { raw: await res.text() };
  }
  return { status: res.status, ok: res.ok, data };
}

async function checkHealthOnce(baseUrl) {
  const url = `${baseUrl}/health`;
  try {
    const r = await fetchJson(url);
    return { pass: r.ok && r.status === 200, status: r.status, error: null };
  } catch (e) {
    return { pass: false, status: 0, error: e.cause?.message || e.message || String(e) };
  }
}

async function checkHealthWithRetry(name, baseUrl) {
  let last = { pass: false, status: 0, error: 'no attempt' };
  for (let i = 0; i < RETRIES; i += 1) {
    last = await checkHealthOnce(baseUrl);
    if (last.pass) return last;
    if (i < RETRIES - 1) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  if (!last.pass && last.error) {
    last.hint =
      'If you use Docker: run `docker compose -f docker-compose.full.yml ps` and ensure ports are published. ' +
      'CLI tests must run on the host (not inside a container) unless you point *_SERVICE_URL at the right host.';
  }
  return last;
}

async function main() {
  const results = [];
  console.log('=== Backend QA health campaign ===\n');
  console.log(`Retries: ${RETRIES}, delay: ${RETRY_DELAY_MS}ms\n`);

  for (const [name, url] of Object.entries(SERVICES)) {
    const r = await checkHealthWithRetry(name, url);
    results.push({ name: `${name} health`, pass: r.pass, status: r.status });
    const line = `${name} health: ${r.pass ? 'PASS' : 'FAIL'} (${r.status})`;
    console.log(r.error ? `${line} — ${r.error}` : line);
    if (r.hint) console.log(`       ${r.hint}`);
  }

  console.log('\n--- Note ---');
  console.log('Gateway /api/v1/* requires PoW. Use: npm run test:gateway-suite');
  console.log('Or open qa-lab (ng serve, port 4202) → Run all.\n');

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`Result: ${passed}/${total} passed`);
  process.exitCode = passed === total ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
