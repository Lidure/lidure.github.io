import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const galleryFiles = [
  'src/pages/gallery.astro',
  'src/components/GalleryBrowser.astro',
  'src/components/GalleryLightbox.astro',
  'src/components/GalleryManager.astro',
  'src/lib/gallery-data.mjs',
  'src/lib/gallery-manifest-client.mjs',
  'src/lib/gallery-browser-controller.mjs',
  'src/lib/gallery-lightbox-controller.mjs',
  'src/lib/gallery-manager-controller.mjs',
];

test('Blog gallery never owns write credentials or mutation APIs', async () => {
  const parts = await Promise.all(galleryFiles.map(read));
  const source = parts.join('\n');
  const pageSource = parts[0];
  const managerSource = parts[3];

  assert.doesNotMatch(source, /ghp_[A-Za-z0-9]/);
  assert.doesNotMatch(source, /access[_-]?token/i);
  assert.doesNotMatch(source, /Authorization\s*:/i);
  assert.doesNotMatch(source, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(pageSource, /<iframe/i);
  assert.doesNotMatch(managerSource, /<iframe/i);
});

test('gallery keeps remote loading runtime-only and bounded', async () => {
  const [page, browserComponent, browser, manifest, lightbox, manager] = await Promise.all([
    read('src/pages/gallery.astro'),
    read('src/components/GalleryBrowser.astro'),
    read('src/lib/gallery-browser-controller.mjs'),
    read('src/lib/gallery-manifest-client.mjs'),
    read('src/lib/gallery-lightbox-controller.mjs'),
    read('src/lib/gallery-manager-controller.mjs'),
  ]);

  assert.doesNotMatch(page, /raw\.githubusercontent\.com/);
  assert.match(manifest, /GALLERY_MANIFEST_URL/);
  assert.match(browser, /index\s*===\s*0\s*\?\s*['"]eager['"]\s*:\s*['"]lazy['"]/);
  assert.equal((browser.match(/['"]eager['"]/g) || []).length, 1);
  assert.match(browserComponent, /astro:before-swap/);
  assert.match(browser, /abortController\.abort\(\)/);
  assert.match(browser, /nextPagePrefetchCandidates\([^)]*,\s*2\)/s);
  assert.match(lightbox, /new Set\(\[previousIndex, nextIndex\]\)/);
  assert.match(manager, /frame\.remove\(\)/);
  assert.match(manager, /12_000|12000/);
  assert.doesNotMatch(manager, /contentWindow|contentDocument/);
});
