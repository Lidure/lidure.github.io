import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function makeHarness(href = 'https://lidure22.xyz/gallery') {
  const listeners = new Map();
  const doc = {
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) { if (listeners.get(type) === fn) listeners.delete(type); },
  };
  const win = {
    location: {
      href,
      assign(url) { win.__navigatedTo = url; },
    },
    __navigatedTo: '',
  };
  return { doc, win, listeners };
}

test('manage=1 navigates to the standalone native manager', async () => {
  const { initGalleryManageEntry } = await import('../src/lib/gallery-manage-entry.mjs');
  const { doc, win } = makeHarness('https://lidure22.xyz/gallery?manage=1');
  const cleanup = initGalleryManageEntry(doc, win);
  assert.equal(win.__navigatedTo, '/gallery/manage');
  cleanup();
});

test('Ctrl+Alt+G navigates to the standalone native manager', async () => {
  const { initGalleryManageEntry } = await import('../src/lib/gallery-manage-entry.mjs');
  const { doc, win, listeners } = makeHarness();
  const cleanup = initGalleryManageEntry(doc, win);
  let prevented = false;
  listeners.get('keydown')({
    ctrlKey: true, altKey: true, metaKey: false, shiftKey: false, key: 'g',
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.equal(win.__navigatedTo, '/gallery/manage');
  cleanup();
});

test('public gallery no longer ships the old iframe manager', async () => {
  const page = await read('src/pages/gallery.astro');
  assert.doesNotMatch(page, /GalleryManager/);
  assert.doesNotMatch(page, /gallery-manager-overlay/);
  assert.doesNotMatch(page, /<iframe/i);
  assert.match(page, /gallery-manage-entry\.mjs/);
});
