import { createCctvSource } from './layers/cctv/source.js';
import { fetchBmOntarioOps } from './bmOntarioOps.js';

const ONTARIO_PREFIX = 'ontario511:';

function finite(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function chooseView(camera) {
  const views = Array.isArray(camera?.views) ? camera.views : [];
  return (
    views.find(
      (view) =>
        view?.url &&
        !/unavailable|offline|disabled/i.test(String(view.status || '')),
    ) ||
    views.find((view) => view?.url) ||
    null
  );
}

function labelFor(camera) {
  const location = String(camera?.location || '').trim();
  const roadway = String(camera?.roadway || '').trim();
  const direction = String(camera?.direction || '').trim();
  return (
    location ||
    [roadway, direction].filter(Boolean).join(' · ') ||
    `Ontario 511 Camera ${camera?.id || ''}`.trim()
  );
}

function cityFor(camera) {
  const text = `${camera?.location || ''} ${camera?.roadway || ''}`.toLowerCase();
  if (/windsor|essex|tecumseh|la salle|lasalle/.test(text))
    return 'Windsor / Essex';
  if (/london|strathroy|woodstock/.test(text)) return 'London Corridor';
  if (/toronto|mississauga|brampton|oakville|burlington|hamilton|milton/.test(text))
    return 'GTA Corridor';
  return 'Ontario Corridor';
}

function headingFromDirection(value) {
  const direction = String(value || '').toLowerCase();
  if (/north/.test(direction)) return 0;
  if (/east/.test(direction)) return 90;
  if (/south/.test(direction)) return 180;
  if (/west/.test(direction)) return 270;
  return 0;
}

/**
 * Extend the native CCTV source with authenticated BM Ontario 511 cameras.
 * The Ontario developer key never enters this runtime; BM Core owns it.
 */
export function createBmCompositeCctvSource({
  baseSource = createCctvSource(),
  fetchOntarioOps = fetchBmOntarioOps,
} = {}) {
  const ontarioById = new Map();
  let lastOps = null;

  function ingestOntario(payload) {
    lastOps = payload;
    ontarioById.clear();
    const sources = [];

    for (const camera of payload?.cameras || []) {
      const lat = finite(camera?.latitude, NaN);
      const lon = finite(camera?.longitude, NaN);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

      const id = `${ONTARIO_PREFIX}${camera.id}`;
      const view = chooseView(camera);
      ontarioById.set(id, { camera, view });

      sources.push({
        id,
        name: labelFor(camera),
        city: cityFor(camera),
        provider: 'Ontario 511',
        sourceKind: 'public-road-camera',
        feedType: 'image',
        url: view?.url || '',
        lat,
        lon,
        headingDeg: headingFromDirection(camera?.direction),
        headingConfidence: camera?.direction ? 'medium' : 'low',
        fovDeg: 70,
        rangeM: 350,
        mountHeightM: 10,
        pitchDeg: -12,
        licenseNote:
          'Public roadway camera metadata and imagery via Ontario 511.',
        credit: 'Ontario 511',
        code: String(camera.id || ''),
      });
    }

    return sources;
  }

  async function readOntario(options) {
    try {
      return await fetchOntarioOps(options?.signal);
    } catch (error) {
      if (error?.name === 'AbortError') throw error;
      return null;
    }
  }

  return {
    async getCatalog(options) {
      const [baseResult, ops] = await Promise.all([
        baseSource.getCatalog(options).catch((error) => {
          if (error?.name === 'AbortError') throw error;
          return { sources: [] };
        }),
        readOntario(options),
      ]);

      const ontarioSources = ops ? ingestOntario(ops) : [];
      return {
        ...baseResult,
        sources: [
          ...(Array.isArray(baseResult?.sources) ? baseResult.sources : []),
          ...ontarioSources,
        ],
      };
    },

    async getHealth(options) {
      const [baseResult, ops] = await Promise.all([
        baseSource.getHealth(options).catch((error) => {
          if (error?.name === 'AbortError') throw error;
          return { cameras: [] };
        }),
        readOntario(options),
      ]);

      if (ops) ingestOntario(ops);
      const now = Date.now();
      const ontarioStatus =
        ops?.status?.cameras === 'live' ? 'live' : 'unavailable';
      const ontarioHealth = [...ontarioById.entries()].map(([id, entry]) => ({
        id,
        status: entry.view?.url ? ontarioStatus : 'unavailable',
        sourceKind: 'public-road-camera',
        label: 'Ontario 511',
        message: entry.view?.url
          ? `Public Ontario 511 roadway camera · ${entry.view.status || 'status unknown'}`
          : 'Ontario 511 camera has no public image URL available',
        updatedAt: now,
      }));

      return {
        ...baseResult,
        cameras: [
          ...(Array.isArray(baseResult?.cameras) ? baseResult.cameras : []),
          ...ontarioHealth,
        ],
      };
    },

    getFrameUrl(camera) {
      const entry = ontarioById.get(String(camera?.id || ''));
      if (entry) return entry.view?.url || '';
      return baseSource.getFrameUrl(camera);
    },

    getMediaUrl(camera) {
      const entry = ontarioById.get(String(camera?.id || ''));
      if (entry) return entry.view?.url || '';
      return baseSource.getMediaUrl(camera);
    },

    getOntarioStatus() {
      return lastOps
        ? {
            status: lastOps.status?.cameras || 'unknown',
            count: ontarioById.size,
            generatedAt: lastOps.generatedAt || null,
          }
        : { status: 'not-loaded', count: 0, generatedAt: null };
    },
  };
}
