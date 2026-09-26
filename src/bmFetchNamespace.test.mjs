import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeBmModuleBase,
  rewriteBmApiPath,
} from './bmFetchNamespace.js';

test('normalizes BM module base paths', () => {
  assert.equal(normalizeBmModuleBase('/'), '/');
  assert.equal(normalizeBmModuleBase('/modules/gods-eye'), '/modules/gods-eye/');
  assert.equal(normalizeBmModuleBase('/modules/gods-eye/'), '/modules/gods-eye/');
});

test('namespaces Gods Eye provider APIs under the BM module path', () => {
  assert.equal(
    rewriteBmApiPath('/api/cctv/sources', '/modules/gods-eye/'),
    '/modules/gods-eye/api/cctv/sources',
  );
  assert.equal(
    rewriteBmApiPath('/api/opensky?lat=42', '/modules/gods-eye/'),
    '/modules/gods-eye/api/opensky?lat=42',
  );
});

test('keeps BM-owned Ontario operations API and subroutes on BM Core', () => {
  assert.equal(
    rewriteBmApiPath('/api/ops/ontario511', '/modules/gods-eye/'),
    '/api/ops/ontario511',
  );
  assert.equal(
    rewriteBmApiPath('/api/ops/ontario511/camera', '/modules/gods-eye/'),
    '/api/ops/ontario511/camera',
  );
});

test('does not rewrite provider APIs when Gods Eye is standalone', () => {
  assert.equal(rewriteBmApiPath('/api/cctv/sources', '/'), '/api/cctv/sources');
});
