import { LayerLifecycle } from '../data/lifecycle.js';
import { LayerPresentation } from './layerPresentation.js';
import { createCyberSonarScene } from '../cyberSonarScene.js';

function isBmMountedModule() {
  const base = String(import.meta.env?.BASE_URL || '/');
  return base.startsWith('/modules/gods-eye/');
}

async function enableBmOntarioDefaults(dataManager) {
  const layerIds = ['cctv', 'ontario-events'];
  const results = await Promise.allSettled(
    layerIds.map((layerId) =>
      dataManager.setEnabled(layerId, true, { origin: 'programmatic' }),
    ),
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected' || result.value === false) {
      const detail =
        result.status === 'rejected'
          ? result.reason?.message || String(result.reason)
          : 'lifecycle rejected activation';
      console.warn(`[BM Ontario] ${layerIds[index]} default activation failed: ${detail}`);
    }
  });
}

/** Register the application layer catalog before allowing state restoration. */
export function createApplicationData({
  scene: { viewer, mapStackController },
  controls: { styleManager },
  catalog,
  allowQaRegistration,
  onData,
  defer,
}) {
  // Initialize data layer manager
  const dataManager = new LayerLifecycle(viewer, {
    allowQaRegistration,
  });
  defer(async () => {
    await dataManager.destroyAll();
    if (dataManager.layers.size)
      throw new Error(
        `Data layers could not be destroyed: ${[...dataManager.layers.keys()].join(', ')}`,
      );
  });
  const presentation = new LayerPresentation(dataManager, {
    weatherClock: catalog?.weatherClock,
  });
  defer(() => presentation.destroy());
  onData?.(dataManager);
  if (!catalog?.layers || !catalog?.metadata)
    throw new TypeError('An application layer catalog is required');
  for (const layer of catalog.layers) dataManager.register(layer);
  for (const layer of catalog.layers) layer.attachDataManager?.(dataManager);
  for (const layer of catalog.layers)
    layer.attachMapStackController?.(mapStackController);
  // Restoration starts only after the caller's complete registry is sealed.
  dataManager.finalizeRegistrations(catalog.metadata);
  if (allowQaRegistration) {
    window.__gevQaRegisterLayer = (targetManager, layerModule) => {
      if (targetManager !== dataManager)
        throw new Error('QA layer manager mismatch');
      return dataManager.registerForQa(layerModule);
    };
    window.__gevQaUnregisterLayer = (targetManager, layerId) => {
      if (targetManager !== dataManager)
        throw new Error('QA layer manager mismatch');
      return dataManager.unregisterForQa(layerId);
    };
    const register = window.__gevQaRegisterLayer;
    const unregister = window.__gevQaUnregisterLayer;
    defer(() => {
      if (window.__gevQaRegisterLayer === register)
        delete window.__gevQaRegisterLayer;
      if (window.__gevQaUnregisterLayer === unregister)
        delete window.__gevQaUnregisterLayer;
    });
  }
  presentation.mount(document.getElementById('data-toggles'));
  styleManager.attachDataManager(dataManager);
  defer(createCyberSonarScene(viewer, dataManager));

  // BM owns a regional operations posture: when mounted through the BM shell,
  // start verified public roadway cameras and Ontario road events immediately.
  // Shared views remain authoritative and standalone upstream behavior is unchanged.
  if (isBmMountedModule() && !styleManager.hasShareState) {
    queueMicrotask(() => {
      void enableBmOntarioDefaults(dataManager);
    });
  }

  return { dataManager, catalog, presentation };
}
