import { createServer } from 'node:http';
import { createServer as createViteServer, loadEnv } from 'vite';
import standaloneConfig from '../server/standalone/vite.config.js';

const port = Number.parseInt(process.env.PORT || '4173', 10) || 4173;
const host = process.env.HOST || '0.0.0.0';
process.env.HOST = host;
process.env.PORT = String(port);
process.env.BM_MODULE_BASE = process.env.BM_MODULE_BASE || '/modules/gods-eye/';

const loaded = loadEnv('production', process.cwd(), '');
for (const [key, value] of Object.entries(loaded)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const resolvedConfig = typeof standaloneConfig === 'function'
  ? await standaloneConfig({ command: 'serve', mode: 'production' })
  : standaloneConfig;

const vite = await createViteServer({
  ...resolvedConfig,
  appType: 'spa',
  mode: 'production',
  server: {
    ...(resolvedConfig.server || {}),
    middlewareMode: true,
    host,
    port,
  },
});

const server = createServer((req, res) => {
  if (req.url === '/__bm_health') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({
      ok: true,
      service: 'bm-gods-eye',
      moduleBase: process.env.BM_MODULE_BASE,
      timestamp: new Date().toISOString(),
    }));
    return;
  }
  vite.middlewares(req, res, (error) => {
    if (error) {
      console.error('[BM Runtime] request error', error);
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      if (!res.writableEnded) res.end('God\'s Eye runtime error');
    }
  });
});

server.listen(port, host, () => {
  console.log(`[BM Runtime] God's Eye listening on http://${host}:${port}`);
  console.log(`[BM Runtime] module base ${process.env.BM_MODULE_BASE}`);
});

async function shutdown(signal) {
  console.log(`[BM Runtime] ${signal} received; shutting down`);
  server.close(async () => {
    await vite.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
