import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const publicGalleryFiles = [
  'src/pages/gallery.astro',
  'src/components/GalleryBrowser.astro',
  'src/components/GalleryLightbox.astro',
  'src/lib/gallery-data.mjs',
  'src/lib/gallery-manifest-client.mjs',
  'src/lib/gallery-browser-controller.mjs',
  'src/lib/gallery-lightbox-controller.mjs',
];

test('public Gallery stays read-only and does not render the legacy iframe manager', async () => {
  const parts = await Promise.all(publicGalleryFiles.map(read));
  const source = parts.join('\n');
  const pageSource = parts[0];

  assert.doesNotMatch(source, /ghp_[A-Za-z0-9]/);
  assert.doesNotMatch(source, /Authorization\s*:/i);
  assert.doesNotMatch(source, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(pageSource, /GalleryManager/);
  assert.doesNotMatch(pageSource, /gallery-manager-overlay/);
  assert.doesNotMatch(pageSource, /<iframe/i);
});

test('standalone management route exists instead of an embedded manager', async () => {
  await access(new URL('../src/pages/gallery/manage.astro', import.meta.url));
  const page = await read('src/pages/gallery/manage.astro');
  assert.doesNotMatch(page, /<iframe/i);
  assert.doesNotMatch(page, /airigallery\.lidure22\.xyz[^\n]*iframe/i);
});

test('public Gallery keeps bounded runtime loading and native management entry', async () => {
  const [page, browserComponent, browser, manifest, lightbox] = await Promise.all([
    read('src/pages/gallery.astro'),
    read('src/components/GalleryBrowser.astro'),
    read('src/lib/gallery-browser-controller.mjs'),
    read('src/lib/gallery-manifest-client.mjs'),
    read('src/lib/gallery-lightbox-controller.mjs'),
  ]);

  assert.doesNotMatch(page, /raw\.githubusercontent\.com/);
  assert.match(page, /gallery-manage-entry/);
  assert.match(manifest, /GALLERY_MANIFEST_URL/);
  assert.match(browser, /index\s*===\s*0\s*\?\s*['"]eager['"]\s*:\s*['"]lazy['"]/);
  assert.equal((browser.match(/['"]eager['"]/g) || []).length, 1);
  assert.match(browserComponent, /astro:before-swap/);
  assert.match(browser, /abortController\.abort\(\)/);
  assert.match(browser, /nextPagePrefetchCandidates\([^)]*,\s*2\)/s);
  assert.match(lightbox, /new Set\(\[previousIndex, nextIndex\]\)/);
});
