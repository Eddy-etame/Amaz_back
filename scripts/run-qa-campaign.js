/**
 * Script de campagne QA backend.
 * Prérequis: gateway + tous les services démarrés, DB initialisées.
 */
const GATEWAY = 'http://localhost:3000';
const SERVICES = {
  gateway: 'http://localhost:3000',
  user: 'http://localhost:3001',
  product: 'http://localhost:3002',
  order: 'http://localhost:3003',
  messaging: 'http://localhost:3004',
  ai: 'http://localhost:3005',
  pepper: 'http://localhost:3006'
};

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

async function main() {
  const results = [];
  console.log('=== Campagne QA Backend ===\n');

  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const r = await fetchJson(`${url}/health`);
      const pass = r.ok && r.status === 200;
      results.push({ name: `${name} health`, pass, status: r.status });
      console.log(`${name} health: ${pass ? 'PASS' : 'FAIL'} (${r.status})`);
    } catch (e) {
      results.push({ name: `${name} health`, pass: false, status: 0 });
      console.log(`${name} health: FAIL (${e.message})`);
    }
  }

  console.log('\n--- API via Gateway (sans PoW pour ce script) ---');
  console.log('Note: Les appels /api/v1 nécessitent PoW. Utiliser la mini app qa-lab pour les tests complets.\n');

  const passed = results.filter((r) => r.pass).length;
  const total = results.length;
  console.log(`\nRésultat: ${passed}/${total} pass`);
  process.exitCode = passed === total ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
