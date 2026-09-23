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

test('gallery browser uses responsive page sizing instead of a fixed 24-image page', async () => {
  const controller = await read('src/lib/gallery-browser-controller.mjs');

  assert.match(controller, /galleryPageSizeForWidth/);
  assert.match(controller, /remapGalleryPage/);
  assert.match(controller, /addEventListener\(['"]resize['"]/);
  assert.doesNotMatch(controller, /const\s+PAGE_SIZE\s*=\s*24/);
});

test('failed gallery images render a designed fallback and retry without native broken-image chrome', async () => {
  const [controller, styles] = await Promise.all([
    read('src/lib/gallery-browser-controller.mjs'),
    read('src/styles/gallery.css'),
  ]);

  assert.match(controller, /gallery-tile-fallback/);
  assert.match(controller, /gallery-tile-fallback-icon/);
  assert.match(controller, /gallery-tile-fallback-title/);
  assert.match(controller, /gallery-tile-fallback-filename/);
  assert.match(controller, /暂时无法加载/);
  assert.match(controller, /is-retrying/);
  assert.match(controller, /setTimeout/);
  assert.match(styles, /\.gallery-tile-fallback\s*\{/);
  assert.match(styles, /\.gallery-tile\.is-error/);
  assert.doesNotMatch(styles, /\.gallery-tile\.is-error::before\s*\{/);
});
