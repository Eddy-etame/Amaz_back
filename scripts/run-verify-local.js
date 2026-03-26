#!/usr/bin/env node
/**
 * Chains local verification steps (see docs/VERIFY.md).
 * Run from Amaz_back: npm run verify:local
 *
 * Env skips (any non-empty = skip that step):
 *   VERIFY_SKIP_SMOKE       — skip static npm test
 *   VERIFY_SKIP_CONTRACT    — skip test:contract-smoke
 *   VERIFY_SKIP_HEALTH      — skip qa:campaign
 *   VERIFY_SKIP_GATEWAY     — skip test:gateway-suite
 *   VERIFY_SKIP_E2E_AUTH    — skip test:e2e-auth
 *   VERIFY_NETWORK_ONLY=1   — only network steps (skip smoke)
 */
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runStep(name, args, env = {}) {
  console.log(`\n=== verify: ${name} ===\n`);
  const r = spawnSync(npmCmd, args, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, ...env }
  });
  if (r.error) {
    console.error(r.error);
    return 1;
  }
  return r.status ?? 1;
}

function skip(key) {
  return String(process.env[key] || '').length > 0;
}

const onlyNetwork = String(process.env.VERIFY_NETWORK_ONLY || '') === '1';

let code = 0;

if (!onlyNetwork && !skip('VERIFY_SKIP_SMOKE')) {
  code = runStep('static smoke (npm test)', ['test']);
  if (code !== 0) process.exit(code);
}

if (!skip('VERIFY_SKIP_CONTRACT')) {
  code = runStep('contract + health smoke', ['run', 'test:contract-smoke']);
  if (code !== 0) process.exit(code);
}

if (!skip('VERIFY_SKIP_HEALTH')) {
  code = runStep('QA health campaign', ['run', 'qa:campaign']);
  if (code !== 0) process.exit(code);
}

if (!skip('VERIFY_SKIP_GATEWAY')) {
  code = runStep('gateway API suite (PoW + auth)', ['run', 'test:gateway-suite']);
  if (code !== 0) process.exit(code);
}

if (!skip('VERIFY_SKIP_E2E_AUTH')) {
  code = runStep('e2e auth', ['run', 'test:e2e-auth']);
  if (code !== 0) process.exit(code);
}

console.log('\n=== verify:local completed successfully ===\n');
process.exit(0);
