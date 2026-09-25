import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import { createServer as createViteServer, loadEnv } from 'vite';
import { localProviderPlugins } from '../server/providers/local.js';

const port = Number.parseInt(process.env.PORT || '4173', 10) || 4173;
const host = process.env.HOST || '0.0.0.0';
const moduleBase = normalizeModuleBase(
  process.env.BM_MODULE_BASE || '/modules/gods-eye/',
);
const distDir = path.resolve(process.cwd(), 'dist');
const distIndex = path.join(distDir, 'index.html');
const moduleDistDir = path.join(
  distDir,
  moduleBase.replace(/^\/+|\/+$/g, ''),
);

process.env.HOST = host;
process.env.PORT = String(port);
process.env.BM_MODULE_BASE = moduleBase;

const loaded = loadEnv('production', process.cwd(), '');
for (const [key, value] of Object.entries(loaded)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

function normalizeModuleBase(value) {
  const raw = String(value || '/').trim();
  const withLeading = raw.startsWith('/') ? raw : `/${raw}`;
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`;
}

async function existingFile(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

if (!(await existingFile(distIndex))) {
  console.error(
    '[BM Runtime] dist/index.html is missing. Run `npm run build:bm` during the Render Build phase.',
  );
  process.exit(1);
}

const cesiumGlobalBundle = path.join(moduleDistDir, 'cesium', 'Cesium.js');
const hasCesiumGlobalBundle = await existingFile(cesiumGlobalBundle);
if (!hasCesiumGlobalBundle) {
  console.warn(
    `[BM Runtime] Cesium global bundle not found at ${cesiumGlobalBundle}. Production builds using vite-plugin-cesium require this file.`,
  );
}

// Provider runtime only. Do not load the standalone browser Vite config here:
// that config also installs Cesium/application plugins and retains a much larger
// module graph than a small Render instance needs after the frontend is prebuilt.
const providerVite = await createViteServer({
  configFile: false,
  envFile: false,
  publicDir: false,
  clearScreen: false,
  logLevel: 'warn',
  appType: 'custom',
  mode: 'production',
  plugins: localProviderPlugins(),
  optimizeDeps: {
    noDiscovery: true,
  },
  server: {
    middlewareMode: true,
    hmr: false,
    host,
    port,
  },
});

const CONTENT_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.mjs', 'application/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.ico', 'image/x-icon'],
  ['.wasm', 'application/wasm'],
  ['.glb', 'model/gltf-binary'],
  ['.gltf', 'model/gltf+json'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
]);

function securityHeaders(res) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex');
}

function healthPayload() {
  return JSON.stringify({
    ok: true,
    service: 'bm-gods-eye',
    runtime: 'prebuilt-static+provider-only-vite',
    moduleBase,
    cesiumGlobalBundle: hasCesiumGlobalBundle ? 'present' : 'missing',
    timestamp: new Date().toISOString(),
  });
}

function safePathWithin(rootDir, relativePath, fallback = '') {
  const decoded = decodeURIComponent(relativePath || fallback);
  const resolved = path.resolve(rootDir, decoded || fallback);
  if (resolved === rootDir || resolved.startsWith(`${rootDir}${path.sep}`)) {
    return resolved;
  }
  return null;
}

function safeDistPath(relativePath) {
  return safePathWithin(distDir, relativePath, 'index.html');
}

function safeModuleDistPath(relativePath) {
  return safePathWithin(moduleDistDir, relativePath, 'index.html');
}

async function sendFile(req, res, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES.get(extension) || 'application/octet-stream';
  const info = await stat(filePath);

  securityHeaders(res);
  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', String(info.size));
  res.setHeader(
    'Cache-Control',
    filePath.includes(`${path.sep}assets${path.sep}`)
      ? 'public, max-age=31536000, immutable'
      : extension === '.html'
        ? 'no-cache'
        : 'public, max-age=3600',
  );

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  createReadStream(filePath).pipe(res);
}

function providerRequest(req, res, originalUrl, pathname) {
  if (pathname.startsWith(`${moduleBase}api/`)) {
    req.url = originalUrl.replace(`${moduleBase}api/`, '/api/');
  }

  providerVite.middlewares(req, res, (error) => {
    req.url = originalUrl;
    if (error) {
      console.error('[BM Runtime] provider request error', error);
      if (!res.headersSent) {
        securityHeaders(res);
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      if (!res.writableEnded) res.end("God's Eye provider runtime error");
      return;
    }
    if (!res.writableEnded) {
      securityHeaders(res);
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Provider route not found' }));
    }
  });
}

const server = createServer(async (req, res) => {
  const originalUrl = req.url || '/';
  let parsed;
  try {
    parsed = new URL(originalUrl, 'http://bm-runtime.local');
  } catch {
    securityHeaders(res);
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad request');
    return;
  }

  const pathname = parsed.pathname;

  if (pathname === '/__bm_health' || pathname === `${moduleBase}__bm_health`) {
    securityHeaders(res);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(healthPayload());
    return;
  }

  if (pathname.startsWith('/api/') || pathname.startsWith(`${moduleBase}api/`)) {
    providerRequest(req, res, originalUrl, pathname);
    return;
  }

  if (pathname === '/') {
    res.writeHead(302, { Location: moduleBase });
    res.end();
    return;
  }

  const moduleBaseWithoutSlash = moduleBase.slice(0, -1);
  if (pathname === moduleBaseWithoutSlash) {
    res.writeHead(302, { Location: `${moduleBase}${parsed.search}` });
    res.end();
    return;
  }

  if (!pathname.startsWith(moduleBase)) {
    securityHeaders(res);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const relativePath = pathname.slice(moduleBase.length);

  // Normal Vite assets live directly under dist/ (for example dist/assets/*).
  const candidate = safeDistPath(relativePath || 'index.html');
  if (candidate && (await existingFile(candidate))) {
    await sendFile(req, res, candidate);
    return;
  }

  // vite-plugin-cesium includes the configured Vite base in its copy target.
  // With BM_MODULE_BASE=/modules/gods-eye/, Cesium.js, Widgets, Workers and
  // Assets are therefore written under dist/modules/gods-eye/cesium/* while
  // the browser requests them at /modules/gods-eye/cesium/*. Serve that nested
  // output as the second static lookup rather than incorrectly returning 404.
  const moduleCandidate = safeModuleDistPath(relativePath || 'index.html');
  if (moduleCandidate && (await existingFile(moduleCandidate))) {
    await sendFile(req, res, moduleCandidate);
    return;
  }

  if (!path.extname(relativePath)) {
    await sendFile(req, res, distIndex);
    return;
  }

  securityHeaders(res);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Asset not found');
});

server.listen(port, host, () => {
  console.log(`[BM Runtime] God's Eye listening on http://${host}:${port}`);
  console.log(`[BM Runtime] module base ${moduleBase}`);
  console.log('[BM Runtime] frontend mode prebuilt production assets');
  console.log('[BM Runtime] provider mode lightweight Vite middleware only');
  console.log(
    `[BM Runtime] Cesium global bundle ${hasCesiumGlobalBundle ? 'present' : 'missing'} at ${cesiumGlobalBundle}`,
  );
});

async function shutdown(signal) {
  console.log(`[BM Runtime] ${signal} received; shutting down`);
  server.close(async () => {
    await providerVite.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
