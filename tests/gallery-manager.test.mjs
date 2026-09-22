import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('public Gallery no longer renders the iframe manager overlay', async () => {
  const page = await read('src/pages/gallery.astro');
  assert.doesNotMatch(page, /GalleryManager/);
  assert.doesNotMatch(page, /gallery-manager-overlay/);
  assert.match(page, /gallery-manage-entry/);
});

test('legacy manager controller is not wired into the public Gallery page', async () => {
  const page = await read('src/pages/gallery.astro');
  assert.doesNotMatch(page, /gallery-manager-controller/);
  assert.doesNotMatch(page, /airigallery\.lidure22\.xyz/);
});
