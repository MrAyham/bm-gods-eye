import * as Cesium from 'cesium';

/**
 * Camera presets for notable locations.
 * Phase 1 default: fly to Austin, TX on load.
 */
export const CAMERA_PRESETS = {
  austin: {
    destination: Cesium.Cartesian3.fromDegrees(-97.7431, 30.2672, 800),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0.0,
    },
  },
  sf: {
    destination: Cesium.Cartesian3.fromDegrees(-122.4194, 37.7749, 1000),
    orientation: {
      heading: Cesium.Math.toRadians(30),
      pitch: Cesium.Math.toRadians(-30),
      roll: 0.0,
    },
  },
  nyc: {
    destination: Cesium.Cartesian3.fromDegrees(-73.9857, 40.7484, 1200),
    orientation: {
      heading: Cesium.Math.toRadians(-20),
      pitch: Cesium.Math.toRadians(-30),
      roll: 0.0,
    },
  },
  bmWindsor: {
    destination: Cesium.Cartesian3.fromDegrees(-82.99, 42.30, 95000),
    orientation: {
      heading: Cesium.Math.toRadians(8),
      pitch: Cesium.Math.toRadians(-82),
      roll: 0.0,
    },
  },
  bmLondon: {
    destination: Cesium.Cartesian3.fromDegrees(-81.25, 42.98, 115000),
    orientation: {
      heading: Cesium.Math.toRadians(15),
      pitch: Cesium.Math.toRadians(-82),
      roll: 0.0,
    },
  },
  bmGta: {
    destination: Cesium.Cartesian3.fromDegrees(-79.63, 43.65, 155000),
    orientation: {
      heading: Cesium.Math.toRadians(18),
      pitch: Cesium.Math.toRadians(-82),
      roll: 0.0,
    },
  },
  bmOntarioCorridor: {
    destination: Cesium.Cartesian3.fromDegrees(-80.85, 42.93, 650000),
    orientation: {
      heading: Cesium.Math.toRadians(22),
      pitch: Cesium.Math.toRadians(-88),
      roll: 0.0,
    },
  },
};

const BM_REGION_PRESETS = {
  windsor: 'bmWindsor',
  london: 'bmLondon',
  gta: 'bmGta',
  corridor: 'bmOntarioCorridor',
};

/**
 * Fly the camera to a preset location with a smooth animation.
 */
export function flyToPreset(viewer, presetName, duration = 3.0) {
  const preset = CAMERA_PRESETS[presetName];
  if (!preset) return;

  viewer.camera.flyTo({
    destination: preset.destination,
    orientation: preset.orientation,
    duration,
    easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
  });
}

/**
 * Set camera to Austin on load with a cinematic fly-in.
 * @returns {Function} Cancels the pending or active startup flight.
 */
export function flyToAustin(viewer) {
  // Start from a high altitude, then fly down
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(-97.7431, 30.2672, 25000),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0.0,
    },
  });

  // Cinematic fly-in after a brief pause
  const timer = setTimeout(() => {
    if (viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(-97.7431, 30.2672, 600),
      orientation: {
        heading: Cesium.Math.toRadians(15),
        pitch: Cesium.Math.toRadians(-30),
        roll: 0.0,
      },
      duration: 4.0,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }, 500);
  return () => {
    clearTimeout(timer);
    if (!viewer.isDestroyed()) viewer.camera.cancelFlight();
  };
}

/**
 * BM shell startup view for a requested Ontario operating region.
 * Keeps the upstream Austin default intact when the engine runs standalone.
 * @returns {Function} Cancels the pending or active startup flight.
 */
export function flyToBmRegion(viewer, requestedRegion = 'corridor') {
  const region = BM_REGION_PRESETS[requestedRegion] ? requestedRegion : 'corridor';
  const preset = CAMERA_PRESETS[BM_REGION_PRESETS[region]];

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(-80.85, 42.93, 1800000),
    orientation: {
      heading: Cesium.Math.toRadians(22),
      pitch: Cesium.Math.toRadians(-90),
      roll: 0.0,
    },
  });

  const timer = setTimeout(() => {
    if (viewer.isDestroyed()) return;
    viewer.camera.flyTo({
      destination: preset.destination,
      orientation: preset.orientation,
      duration: region === 'corridor' ? 3.5 : 2.8,
      easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
    });
  }, 350);

  return () => {
    clearTimeout(timer);
    if (!viewer.isDestroyed()) viewer.camera.cancelFlight();
  };
}

export function flyToBmOntarioCorridor(viewer) {
  return flyToBmRegion(viewer, 'corridor');
}
