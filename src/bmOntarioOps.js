const DEFAULT_BM_OPS_PATH = '/api/ops/ontario511';

function getBaseUrl() {
  const configured = String(import.meta.env?.VITE_BM_SHELL_ORIGIN || '').trim();
  return configured ? configured.replace(/\/$/, '') : '';
}

export function getBmOntarioOpsUrl() {
  return `${getBaseUrl()}${DEFAULT_BM_OPS_PATH}`;
}

export async function fetchBmOntarioOps(signal) {
  const response = await fetch(getBmOntarioOpsUrl(), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (response.status === 401) {
    throw new Error('BM session is required for Ontario Ops');
  }
  if (!response.ok) {
    throw new Error(`BM Ontario Ops returned HTTP ${response.status}`);
  }

  const payload = await response.json();
  return {
    source: payload.source || 'Ontario 511',
    corridor: payload.corridor || 'Windsor → London → GTA',
    generatedAt: payload.generatedAt || null,
    status: payload.status || {},
    counts: payload.counts || {},
    events: Array.isArray(payload.events) ? payload.events : [],
    cameras: Array.isArray(payload.cameras) ? payload.cameras : [],
    alerts: Array.isArray(payload.alerts) ? payload.alerts : [],
  };
}

export function bmOntarioCameraPoints(payload) {
  return (payload?.cameras || []).filter((camera) => Number.isFinite(camera.latitude) && Number.isFinite(camera.longitude));
}

export function bmOntarioEventPoints(payload) {
  return (payload?.events || []).filter((event) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude));
}
