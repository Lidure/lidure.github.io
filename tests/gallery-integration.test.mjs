import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
  'src/lib/gallery-manage-entry.mjs',
];

test('public Blog gallery stays read-only while management is isolated to its route', async () => {
  const source = (await Promise.all(publicGalleryFiles.map(read))).join('\n');
  const [publicPage, managePage, workspace] = await Promise.all([
    read('src/pages/gallery.astro'),
    read('src/pages/gallery/manage.astro'),
    read('src/components/GalleryManageWorkspace.astro'),
  ]);

  assert.doesNotMatch(source, /ghp_[A-Za-z0-9]/);
  assert.doesNotMatch(source, /Authorization\s*:/i);
  assert.doesNotMatch(source, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(publicPage, /<iframe/i);
  assert.doesNotMatch(publicPage, /GalleryManager/);
  assert.match(managePage, /GalleryManageWorkspace/);
  assert.doesNotMatch(`${managePage}\n${workspace}`, /<iframe/i);
  assert.doesNotMatch(`${managePage}\n${workspace}`, /gallery-manager-overlay/);
});

test('public gallery keeps remote loading runtime-only and bounded', async () => {
  const [page, browserComponent, browser, manifest, lightbox, entry] = await Promise.all([
    read('src/pages/gallery.astro'),
    read('src/components/GalleryBrowser.astro'),
    read('src/lib/gallery-browser-controller.mjs'),
    read('src/lib/gallery-manifest-client.mjs'),
    read('src/lib/gallery-lightbox-controller.mjs'),
    read('src/lib/gallery-manage-entry.mjs'),
  ]);

  assert.doesNotMatch(page, /raw\.githubusercontent\.com/);
  assert.match(manifest, /GALLERY_MANIFEST_URL/);
  assert.match(browser, /index\s*===\s*0\s*\?\s*['"]eager['"]\s*:\s*['"]lazy['"]/);
  assert.equal((browser.match(/['"]eager['"]/g) || []).length, 1);
  assert.match(browserComponent, /astro:before-swap/);
  assert.match(browser, /abortController\.abort\(\)/);
  assert.match(browser, /nextPagePrefetchCandidates\([^)]*,\s*2\)/s);
  assert.match(lightbox, /new Set\(\[previousIndex, nextIndex\]\)/);
  assert.match(entry, /\/gallery\/manage/);
  assert.doesNotMatch(entry, /iframe|contentWindow|contentDocument/);
});
