import { fetchBmOntarioOps } from './bmOntarioOps.js';

const REFRESH_MS = 60_000;

function isBmMountedModule() {
  const base = String(import.meta.env?.BASE_URL || '/');
  return base.startsWith('/modules/gods-eye/');
}

function alertText(alert) {
  return String(alert?.Message || alert?.message || alert?.Notes || alert?.notes || '').trim();
}

function alertRegions(alert) {
  const value = alert?.Regions || alert?.regions;
  return Array.isArray(value) ? value.filter(Boolean).map(String) : [];
}

function isHighImportance(alert) {
  return Boolean(alert?.HighImportance ?? alert?.highImportance);
}

function buildBanner() {
  const root = document.createElement('aside');
  root.id = 'bm-ontario-alert-banner';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.style.cssText = [
    'position:fixed',
    'left:50%',
    'top:76px',
    'transform:translateX(-50%)',
    'z-index:12000',
    'width:min(860px,calc(100vw - 40px))',
    'border:1px solid rgba(255,184,76,.48)',
    'background:rgba(18,14,8,.94)',
    'box-shadow:0 12px 34px rgba(0,0,0,.36)',
    'border-radius:12px',
    'padding:10px 13px',
    'font-family:Inter,system-ui,sans-serif',
    'color:#fff1d6',
    'display:none',
    'pointer-events:none',
  ].join(';');

  const meta = document.createElement('div');
  meta.dataset.bmAlertMeta = 'true';
  meta.style.cssText = 'font-size:10px;letter-spacing:.13em;opacity:.7;margin-bottom:4px;font-weight:700';
  root.appendChild(meta);

  const message = document.createElement('div');
  message.dataset.bmAlertMessage = 'true';
  message.style.cssText = 'font-size:13px;line-height:1.45;font-weight:700';
  root.appendChild(message);

  document.body.appendChild(root);
  return root;
}

function render(root, payload) {
  const meta = root.querySelector('[data-bm-alert-meta]');
  const message = root.querySelector('[data-bm-alert-message]');
  const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];

  if (payload?.status?.alerts !== 'live') {
    root.style.display = 'none';
    return;
  }

  if (!alerts.length) {
    root.style.display = 'block';
    root.style.borderColor = 'rgba(93,210,146,.34)';
    root.style.background = 'rgba(7,22,16,.92)';
    meta.textContent = 'ONTARIO 511 · SOUTHWESTERN ONTARIO · LIVE';
    message.textContent = 'No regional alerts returned by Ontario 511.';
    return;
  }

  const alert = alerts[0];
  const high = isHighImportance(alert);
  const regions = alertRegions(alert);
  root.style.display = 'block';
  root.style.borderColor = high ? 'rgba(255,92,92,.58)' : 'rgba(255,184,76,.48)';
  root.style.background = high ? 'rgba(31,8,8,.95)' : 'rgba(18,14,8,.94)';
  meta.textContent = [
    'ONTARIO 511',
    high ? 'HIGH IMPORTANCE' : 'REGIONAL ALERT',
    regions.join(' · ') || 'SOUTHWESTERN ONTARIO',
  ].join(' · ');
  message.textContent = alertText(alert) || 'Ontario 511 returned a regional alert without a message.';
}

/** Mount a BM-only, non-geospatial Ontario 511 alert surface. */
export function mountBmOntarioAlertBanner({ fetchOntarioOps = fetchBmOntarioOps } = {}) {
  if (!isBmMountedModule() || typeof document === 'undefined') return () => {};

  const root = buildBanner();
  const controller = new AbortController();
  let timer = null;

  const refresh = async () => {
    if (controller.signal.aborted) return;
    try {
      const payload = await fetchOntarioOps(controller.signal);
      render(root, payload);
    } catch (error) {
      if (controller.signal.aborted) return;
      root.style.display = 'none';
      console.warn('[BM Ontario] alerts unavailable:', error?.message || error);
    }
  };

  void refresh();
  timer = setInterval(() => void refresh(), REFRESH_MS);

  return () => {
    controller.abort();
    if (timer) clearInterval(timer);
    root.remove();
  };
}
