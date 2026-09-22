import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('gallery browser exposes native structure and bounded loading behavior', async () => {
  const [component, controller] = await Promise.all([
    read('src/components/GalleryBrowser.astro'),
    read('src/lib/gallery-browser-controller.mjs'),
  ]);

  assert.match(component, /id="gallery-browser-root"/);
  assert.match(component, /id="gallery-category-tabs"/);
  assert.match(component, /id="gallery-grid"/);
  assert.match(component, /id="gallery-refresh"/);
  assert.match(component, /id="gallery-pager"/);
  assert.match(controller, /loadGalleryManifest/);
  assert.match(controller, /nextPagePrefetchCandidates/);
  assert.match(controller, /requestIdleCallback/);
  assert.match(controller, /loading\s*=\s*index\s*===\s*0\s*\?\s*['"]eager['"]\s*:\s*['"]lazy['"]/);
  assert.match(controller, /decoding\s*=\s*['"]async['"]/);
  assert.match(controller, /gallery:image-open/);
  assert.match(controller, /nextPagePrefetchCandidates\([^)]*,\s*2\)/s);
  assert.match(controller, /clearGalleryManifestCache/);
  assert.match(controller, /AbortController/);
  assert.match(component, /astro:before-swap/);
});
