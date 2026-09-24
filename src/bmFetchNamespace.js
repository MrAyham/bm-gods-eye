const BM_ONTARIO_OPS_PATH = '/api/ops/ontario511';

function normalizedBase() {
  const base = String(import.meta.env.BASE_URL || '/');
  if (base === '/') return '/';
  return base.endsWith('/') ? base : `${base}/`;
}

function rewritePath(pathname) {
  const base = normalizedBase();
  if (base === '/' || !pathname.startsWith('/api/') || pathname === BM_ONTARIO_OPS_PATH)
    return pathname;
  return `${base}api/${pathname.slice('/api/'.length)}`;
}

function rewriteInput(input) {
  if (typeof input === 'string') {
    if (!input.startsWith('/api/')) return input;
    return rewritePath(input);
  }

  if (input instanceof URL) {
    if (input.origin !== globalThis.location?.origin) return input;
    const next = new URL(input.toString());
    next.pathname = rewritePath(next.pathname);
    return next;
  }

  if (typeof Request !== 'undefined' && input instanceof Request) {
    const url = new URL(input.url);
    if (url.origin !== globalThis.location?.origin || !url.pathname.startsWith('/api/'))
      return input;
    url.pathname = rewritePath(url.pathname);
    return new Request(url, input);
  }

  return input;
}

/**
 * Keep God's Eye provider APIs behind the BM module namespace when the app is
 * mounted at /modules/gods-eye/. BM-owned APIs such as Ontario 511 stay on the
 * BM Core origin and are never forwarded to the specialist runtime.
 */
export function installBmFetchNamespace() {
  const base = normalizedBase();
  if (base === '/' || typeof globalThis.fetch !== 'function') return;
  if (globalThis.__bmGodsEyeFetchNamespaced) return;

  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => originalFetch(rewriteInput(input), init);
  Object.defineProperty(globalThis, '__bmGodsEyeFetchNamespaced', {
    value: true,
    configurable: false,
    enumerable: false,
    writable: false,
  });
}
