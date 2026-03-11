/**
 * Periodic health checks for all downstream services.
 * Runs continuously so the gateway knows which services are up or down.
 * Used for fast-fail (503) when forwarding to an unhealthy service.
 */

const HEALTH_CHECK_INTERVAL_MS = Number(process.env.HEALTH_CHECK_INTERVAL_MS || 15000);
const HEALTH_CHECK_TIMEOUT_MS = Number(process.env.HEALTH_CHECK_TIMEOUT_MS || 2500);

const serviceStatus = new Map();

function getServiceNames(services) {
  return Object.keys(services).filter((k) => services[k]);
}

async function checkOne(serviceName, baseUrl) {
  if (!baseUrl) {
    serviceStatus.set(serviceName, { ok: false, code: 0, error: 'no_url', lastCheck: Date.now() });
    return;
  }
  const url = `${String(baseUrl).replace(/\/+$/, '')}/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    const ok = r.ok && r.status === 200;
    serviceStatus.set(serviceName, { ok, code: r.status, lastCheck: Date.now() });
  } catch (err) {
    clearTimeout(timer);
    const error = err?.name === 'AbortError' ? 'timeout' : (err?.code || err?.message || 'unreachable');
    serviceStatus.set(serviceName, { ok: false, code: 0, error, lastCheck: Date.now() });
  }
}

async function runHealthChecks(services) {
  const names = getServiceNames(services);
  await Promise.all(names.map((name) => checkOne(name, services[name])));
}

function startHealthMonitor(services) {
  const run = () => runHealthChecks(services).catch((err) => {
    // eslint-disable-next-line no-console
    console.error('[health-monitor] Error during health check:', err?.message || err);
  });

  run();
  const intervalId = setInterval(run, HEALTH_CHECK_INTERVAL_MS);

  return () => {
    clearInterval(intervalId);
  };
}

function isServiceHealthy(serviceName) {
  const status = serviceStatus.get(serviceName);
  if (!status) return true;
  return status.ok === true;
}

function getServiceStatus(serviceName) {
  return serviceStatus.get(serviceName) || null;
}

function getAllStatus() {
  const result = {};
  for (const [name, status] of serviceStatus) {
    result[name] = status;
  }
  return result;
}

module.exports = {
  startHealthMonitor,
  isServiceHealthy,
  getServiceStatus,
  getAllStatus,
  HEALTH_CHECK_INTERVAL_MS
};
