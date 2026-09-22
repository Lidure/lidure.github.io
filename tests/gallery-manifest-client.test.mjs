import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GALLERY_MANIFEST_URL,
  clearGalleryManifestCache,
  loadGalleryManifest,
} from '../src/lib/gallery-manifest-client.mjs';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

const payload = { files: { 'gallery/airi/1.png': {} } };

test('fresh cache renders without network', async () => {
  const storage = memoryStorage({
    lidure_gallery_manifest_v1: JSON.stringify({ savedAt: 1_000_000, payload }),
  });
  let calls = 0;
  const result = await loadGalleryManifest({
    storage,
    now: () => 1_000_000 + 60_000,
    fetchImpl: async () => { calls += 1; throw new Error('should not fetch'); },
  });
  assert.equal(calls, 0);
  assert.equal(result.source, 'cache');
  assert.equal(result.stale, false);
});

test('force refresh bypasses fresh cache and uses no-store network fetch', async () => {
  const storage = memoryStorage();
  let options;
  const result = await loadGalleryManifest({
    storage,
    forceRefresh: true,
    now: () => 2_000_000,
    fetchImpl: async (url, init) => {
      assert.equal(url, GALLERY_MANIFEST_URL);
      options = init;
      return { ok: true, json: async () => payload };
    },
  });
  assert.equal(options.cache, 'no-store');
  assert.equal(result.source, 'network');
});

test('network failure may use validated stale cache up to 24 hours', async () => {
  const savedAt = 3_000_000;
  const storage = memoryStorage({
    lidure_gallery_manifest_v1: JSON.stringify({ savedAt, payload }),
  });
  const result = await loadGalleryManifest({
    storage,
    now: () => savedAt + 6 * 60 * 60 * 1000,
    fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.equal(result.source, 'stale-cache');
  assert.equal(result.stale, true);
});

test('stale cache older than 24 hours does not mask network failure', async () => {
  const savedAt = 4_000_000;
  const storage = memoryStorage({
    lidure_gallery_manifest_v1: JSON.stringify({ savedAt, payload }),
  });
  await assert.rejects(
    loadGalleryManifest({
      storage,
      now: () => savedAt + 25 * 60 * 60 * 1000,
      fetchImpl: async () => { throw new Error('offline'); },
    }),
    /offline/,
  );
});

test('cache clearing removes only the gallery manifest entry', () => {
  const storage = memoryStorage({ lidure_gallery_manifest_v1: 'x', other: 'keep' });
  clearGalleryManifestCache(storage);
  assert.equal(storage.getItem('lidure_gallery_manifest_v1'), null);
  assert.equal(storage.getItem('other'), 'keep');
});
