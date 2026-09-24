const BM_ONTARIO_OPS_PATH = '/api/ops/ontario511';

export function normalizeBmModuleBase(value = import.meta.env?.BASE_URL || '/') {
  const base = String(value || '/');
  if (base === '/') return '/';
  return base.endsWith('/') ? base : `${base}/`;
}

export function rewriteBmApiPath(pathname, baseValue = import.meta.env?.BASE_URL || '/') {
  const base = normalizeBmModuleBase(baseValue);
  if (base === '/' || !pathname.startsWith('/api/') || pathname === BM_ONTARIO_OPS_PATH)
    return pathname;
  return `${base}api/${pathname.slice('/api/'.length)}`;
}

function rewriteInput(input, baseValue) {
  if (typeof input === 'string') {
    if (!input.startsWith('/api/')) return input;
    return rewriteBmApiPath(input, baseValue);
  }

  if (input instanceof URL) {
    if (input.origin !== globalThis.location?.origin) return input;
    const next = new URL(input.toString());
    next.pathname = rewriteBmApiPath(next.pathname, baseValue);
    return next;
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    const url = new URL(input.url);
    if (url.origin !== globalThis.location?.origin || !url.pathname.startsWith('/api/'))
      return input;
    url.pathname = rewriteBmApiPath(url.pathname, baseValue);
    return new Request(url, input);
  }

  return input;
}

/**
 * Keep God's Eye provider APIs behind the BM module namespace when the app is
 * mounted at /modules/gods-eye/. BM-owned APIs such as Ontario 511 stay on the
 * BM Core origin and are never forwarded to the specialist runtime.
 */
export function installBmFetchNamespace(baseValue = import.meta.env?.BASE_URL || '/') {
  const base = normalizeBmModuleBase(baseValue);
  if (base === '/' || typeof globalThis.fetch !== 'function') return;
  if (globalThis.__bmGodsEyeFetchNamespaced) return;

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => originalFetch(rewriteInput(input, base), init);
  Object.defineProperty(globalThis, '__bmGodsEyeFetchNamespaced', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}
