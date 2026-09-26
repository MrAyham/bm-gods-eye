import { catalogControlServices } from './catalog.js';
import { StyleManager } from '../ui/composition.js';
import { flyToAustin, flyToBmRegion } from '../camera.js';
import { initCockpitCloudEffects } from '../cockpitCloudEffects.js';

function isBmMountedModule() {
  const base = String(import.meta.env?.BASE_URL || '/');
  return base.startsWith('/modules/gods-eye/');
}

function bmRequestedRegion() {
  if (typeof window === 'undefined') return 'corridor';
  const value = new URL(window.location.href).searchParams.get('bmRegion');
  return ['windsor', 'london', 'gta', 'corridor'].includes(value)
    ? value
    : 'corridor';
}

function bmRegionLabel(region) {
  if (region === 'windsor') return 'Windsor / Essex';
  if (region === 'london') return 'London corridor';
  if (region === 'gta') return 'Mississauga / GTA';
  return 'Windsor → London → GTA corridor';
}

/** Construct the existing controls and camera presentation. */
export function createApplicationControls({
  scene: { viewer, mapStackController, operations },
  loaderStatus,
  Controls = StyleManager,
  services,
  catalog,
  placeSearch,
  defer,
}) {
  // Initialize the style manager (post-processing, HUD, locations, share links)
  const styleManager = new Controls(viewer, {
    services: {
      ...services,
      ...operations.surface.controlServices,
      searchAndFlyTo: operations.searchAndFlyTo,
      fetchRegionalBrief: (...args) =>
        operations.requests.regional.getBrief(...args),
      ...catalogControlServices(catalog),
    },
    requestServices: operations.requests,
    mapStackController,
    placeSearch,
  });
  defer(() => styleManager.orbitController.stop());
  defer(() => styleManager.hud.destroy());
  defer(() => styleManager.dispose());
  // The previous multi-canvas weather compositor remains disabled. Cockpit
  // clouds use a separate, capped low-resolution GPU pass that never attaches
  // Cesium fog or post-process stages and is fully stopped in map mode.
  const weatherEffects = null;
  const cockpitCloudEffects = initCockpitCloudEffects(viewer, {
    weatherService: operations.requests.weather,
  });
  defer(() => cockpitCloudEffects?.destroy());

  if (!styleManager.hasShareState) {
    if (isBmMountedModule()) {
      const region = bmRequestedRegion();
      loaderStatus.textContent = `Opening ${bmRegionLabel(region)}...`;
      defer(flyToBmRegion(viewer, region));
    } else {
      loaderStatus.textContent = 'Flying to Austin, TX...';
      defer(flyToAustin(viewer));
    }
  } else {
    loaderStatus.textContent = 'Restoring shared view...';
  }

  return { styleManager, weatherEffects, cockpitCloudEffects };
}
