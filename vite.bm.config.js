import { defineConfig, loadEnv } from 'vite';
import { createBrowserViteConfig } from './build/vite.js';

/**
 * BM production browser build.
 *
 * Keep server/provider middleware out of the Vite build process. Those
 * providers are attached only by scripts/bm-runtime.mjs at runtime. This keeps
 * Render build memory predictable while preserving the original browser app.
 */
export default defineConfig(({ command, mode }) => {
  const loaded = loadEnv(mode, process.cwd(), '');
  const read = (name) => process.env[name] ?? loaded[name];

  return createBrowserViteConfig({
    base: read('BM_MODULE_BASE') || '/modules/gods-eye/',
    googleApiKey: read('GOOGLE_MAPS_API_KEY'),
    cesiumToken: read('CESIUM_ION_TOKEN'),
    command,
  });
});
