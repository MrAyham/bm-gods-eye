import test from 'node:test';
import assert from 'node:assert/strict';
import { createBmCompositeCctvSource } from './bmCompositeCctvSource.js';

function assertOntarioProxyUrl(value, { cameraId, viewId }) {
  const url = new URL(value, 'https://bm.test');
  assert.equal(url.pathname, '/api/ops/ontario511/camera');
  assert.equal(url.searchParams.get('cameraId'), cameraId);
  assert.equal(url.searchParams.get('viewId'), viewId);
  assert.match(url.searchParams.get('frameTick') || '', /^\d+$/);
}

test('BM composite CCTV merges Ontario 511 cameras into the native catalog', async () => {
  const baseSource = {
    async getCatalog() {
      return { sources: [{ id: 'native:1', name: 'Native Camera', lat: 1, lon: 2, url: '/native.jpg' }] };
    },
    async getHealth() {
      return { cameras: [{ id: 'native:1', status: 'live' }] };
    },
    getFrameUrl() {
      return '/native-frame.jpg';
    },
    getMediaUrl() {
      return '/native-media.jpg';
    },
  };

  const fetchOntarioOps = async () => ({
    generatedAt: '2026-09-24T17:00:00.000Z',
    status: { cameras: 'live' },
    cameras: [
      {
        id: '42',
        roadway: 'Highway 401',
        direction: 'Eastbound',
        location: 'Windsor',
        latitude: 42.3,
        longitude: -82.9,
        views: [
          { id: '1', url: 'https://511on.ca/camera-42.jpg', status: 'Active', description: 'East view' },
        ],
      },
    ],
  });

  const source = createBmCompositeCctvSource({ baseSource, fetchOntarioOps });
  const catalog = await source.getCatalog();

  assert.equal(catalog.sources.length, 2);
  assert.equal(
    catalog.sources[0].id,
    'ontario511:42',
    'authenticated Ontario cameras should lead the BM catalog instead of the native Austin source',
  );
  const ontario = catalog.sources.find((camera) => camera.id === 'ontario511:42');
  assert.ok(ontario);
  assert.equal(ontario.provider, 'Ontario 511');
  assert.equal(ontario.sourceKind, 'public-road-camera');
  assert.equal(ontario.lat, 42.3);
  assert.equal(ontario.lon, -82.9);
  assert.equal(ontario.feedType, 'image');
  assertOntarioProxyUrl(source.getFrameUrl({ id: 'ontario511:42' }, 10_000), {
    cameraId: '42',
    viewId: '1',
  });
  assertOntarioProxyUrl(source.getMediaUrl({ id: 'ontario511:42' }), {
    cameraId: '42',
    viewId: '1',
  });
  assert.equal(source.getFrameUrl({ id: 'native:1' }), '/native-frame.jpg');
});

test('BM composite CCTV reports Ontario health without credentials or secrets', async () => {
  const baseSource = {
    async getCatalog() { return { sources: [] }; },
    async getHealth() { return { cameras: [] }; },
    getFrameUrl() { return ''; },
    getMediaUrl() { return ''; },
  };
  const fetchOntarioOps = async () => ({
    status: { cameras: 'live' },
    cameras: [
      {
        id: '7',
        location: 'London',
        latitude: 42.98,
        longitude: -81.25,
        views: [{ id: 'v1', url: 'https://511on.ca/london.jpg', status: 'Active' }],
      },
    ],
  });

  const source = createBmCompositeCctvSource({ baseSource, fetchOntarioOps });
  const health = await source.getHealth();
  assert.equal(health.cameras.length, 1);
  assert.deepEqual(
    { id: health.cameras[0].id, status: health.cameras[0].status, label: health.cameras[0].label },
    { id: 'ontario511:7', status: 'live', label: 'Ontario 511' },
  );
  assert.equal(JSON.stringify(health).includes('ONTARIO_511_API_KEY'), false);
});

test('BM composite CCTV preserves truthful unavailable state when no public image exists', async () => {
  const baseSource = {
    async getCatalog() { return { sources: [] }; },
    async getHealth() { return { cameras: [] }; },
    getFrameUrl() { return ''; },
    getMediaUrl() { return ''; },
  };
  const fetchOntarioOps = async () => ({
    status: { cameras: 'live' },
    cameras: [{ id: '9', latitude: 43, longitude: -80, location: 'Corridor Camera', views: [] }],
  });

  const source = createBmCompositeCctvSource({ baseSource, fetchOntarioOps });
  await source.getCatalog();
  const health = await source.getHealth();
  assert.equal(health.cameras[0].status, 'unavailable');
  assert.match(health.cameras[0].message, /no public image URL/i);
});
