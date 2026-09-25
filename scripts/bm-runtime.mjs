import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'node:http';
import {
  build as buildVite,
  createServer as createViteServer,
  loadEnv,
} from 'vite';
import standaloneConfig from '../server/standalone/vite.config.js';

const port = Number.parseInt(process.env.PORT || '4173', 10) || 4173;
const host = process.env.HOST || '0.0.0.0';
const moduleBase = normalizeModuleBase(
  process.env.BM_MODULE_BASE || '/modules/gods-eye/',
);
const distDir = path.resolve(process.cwd(), 'dist');

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

async function resolveStandaloneConfig(command) {
  return typeof standaloneConfig === 'function'
    ? standaloneConfig({ command, mode: 'production' })
    : standaloneConfig;
}

console.log(`[BM Runtime] building bundled frontend for ${moduleBase}`);
const buildConfig = await resolveStandaloneConfig('build');
await buildVite({
  ...buildConfig,
  mode: 'production',
});
console.log('[BM Runtime] bundled frontend ready');

// Keep the original provider plugins alive, but use Vite only as the API
// middleware host. Browser assets are served from the production bundle above.
const serveConfig = await resolveStandaloneConfig('serve');
const providerVite = await createViteServer({
  ...serveConfig,
  appType: 'custom',
  mode: 'production',
  server: {
    ...(serveConfig.server || {}),
    middlewareMode: true,
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
    runtime: 'bundled-static+provider-middleware',
    moduleBase,
    timestamp: new Date().toISOString(),
  });
}

function safeDistPath(relativePath) {
  const decoded = decodeURIComponent(relativePath || '');
  const resolved = path.resolve(distDir, decoded || 'index.html');
  if (resolved === distDir || resolved.startsWith(`${distDir}${path.sep}`)) {
    return resolved;
  }
  return null;
}

async function existingFile(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
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
  // Direct Render access may retain the BM module prefix. The BM Core gateway
  // normally strips it before forwarding provider requests.
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
  const candidate = safeDistPath(relativePath || 'index.html');
  if (candidate && (await existingFile(candidate))) {
    await sendFile(req, res, candidate);
    return;
  }

  // SPA fallback for module routes, while real missing assets still return 404.
  if (!path.extname(relativePath)) {
    await sendFile(req, res, path.join(distDir, 'index.html'));
    return;
  }

  securityHeaders(res);
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Asset not found');
});

server.listen(port, host, () => {
  console.log(`[BM Runtime] God's Eye listening on http://${host}:${port}`);
  console.log(`[BM Runtime] module base ${moduleBase}`);
  console.log('[BM Runtime] frontend mode bundled production assets');
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
