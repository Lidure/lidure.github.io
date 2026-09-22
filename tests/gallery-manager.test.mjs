import assert from 'node:assert/strict';
import test from 'node:test';

import { initGalleryManageEntry } from '../src/lib/gallery-manage-entry.mjs';

function makeHarness(href = 'https://lidure22.xyz/gallery') {
  const listeners = new Map();
  const doc = {
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type, fn) {
      if (listeners.get(type) === fn) listeners.delete(type);
    },
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

test('manage=1 navigates to the standalone native manager', () => {
  const { doc, win } = makeHarness('https://lidure22.xyz/gallery?manage=1');
  const cleanup = initGalleryManageEntry(doc, win);
  assert.equal(win.__navigatedTo, '/gallery/manage');
  cleanup();
});

test('exact Ctrl+Alt+G navigates to standalone manager', () => {
  const { doc, win, listeners } = makeHarness();
  const cleanup = initGalleryManageEntry(doc, win);
  let prevented = false;
  listeners.get('keydown')({
    ctrlKey: true,
    altKey: true,
    metaKey: false,
    shiftKey: false,
    key: 'G',
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true);
  assert.equal(win.__navigatedTo, '/gallery/manage');
  cleanup();
  assert.equal(listeners.has('keydown'), false);
});

test('near-miss modifier combinations do not open management', () => {
  const { doc, win, listeners } = makeHarness();
  const cleanup = initGalleryManageEntry(doc, win);
  listeners.get('keydown')({
    ctrlKey: true, altKey: true, metaKey: false, shiftKey: true, key: 'g', preventDefault() {},
  });
  assert.equal(win.__navigatedTo, '');
  cleanup();
});
