import { defineConfig, loadEnv } from 'vite';
import { createBrowserViteConfig } from './build/vite.js';

function bmLegacyCesiumImports() {
  return {
    name: 'bm-legacy-cesium-imports',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = String(id || '').split('?')[0].replace(/\\/g, '/');
      if (!/\.[mc]?js$/.test(cleanId)) return null;
      if (cleanId.includes('/node_modules/')) return null;
      if (!/\bCesium\b/.test(code)) return null;

      const hasCesiumBinding =
        /import\s+\*\s+as\s+Cesium\s+from\s+['"]cesium['"]/.test(code) ||
        /import\s*\{[^}]*\bCesium\b[^}]*\}\s*from\s*['"]cesium['"]/.test(code) ||
        /\b(?:const|let|var|class|function)\s+Cesium\b/.test(code);

      if (hasCesiumBinding) return null;

      console.warn(`[BM build] injecting missing Cesium import into ${cleanId}`);
      return {
        code: `import * as Cesium from 'cesium';\n${code}`,
        map: null,
      };
    },
  };
}

/**
 * BM production browser build.
 *
 * Keep server/provider middleware out of the Vite build process. Those
 * providers are attached only by scripts/bm-runtime.mjs at runtime. This keeps
 * Render build memory predictable while preserving the original browser app.
 *
 * The fork point predates cleanup of a few historic bare `Cesium` references.
 * The BM-only pre-transform above turns any local module that references the
 * namespace without binding it into an explicit ESM import. `node_modules` is
 * deliberately excluded so Cesium's own package graph is never rewritten.
 */
export default defineConfig(({ command, mode }) => {
  const loaded = loadEnv(mode, process.cwd(), '');
  const read = (name) => process.env[name] ?? loaded[name];

  return createBrowserViteConfig({
    base: read('BM_MODULE_BASE') || '/modules/gods-eye/',
    googleApiKey: read('GOOGLE_MAPS_API_KEY'),
    cesiumToken: read('CESIUM_ION_TOKEN'),
    command,
    plugins: [bmLegacyCesiumImports()],
  });
});
