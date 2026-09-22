import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('gallery manager stays hidden until explicit entry and never ships eager iframe', async () => {
  const [component, controller] = await Promise.all([
    read('src/components/GalleryManager.astro'),
    read('src/lib/gallery-manager-controller.mjs'),
  ]);
  assert.match(component, /gallery-manager-overlay/);
  assert.match(component, /gallery-manager-frame-host/);
  assert.doesNotMatch(component, /<iframe/);
  assert.match(component, /gallery-manager-retry/);
  assert.match(component, /gallery-manager-close/);
  assert.match(component, /gallery-manager-direct/);
  assert.match(controller, /searchParams\.get\(['"]manage['"]\)\s*===\s*['"]1['"]/);
  assert.match(controller, /event\.ctrlKey\s*&&\s*event\.altKey/);
  assert.match(controller, /event\.key\.toLowerCase\(\)\s*===\s*['"]g['"]/);
  assert.match(controller, /document\.createElement\(['"]iframe['"]\)/);
  assert.match(controller, /https:\/\/airigallery\.lidure22\.xyz\//);
  assert.match(controller, /12_000|12000/);
  assert.match(controller, /frame\.remove\(\)|replaceChildren\(\)/);
  assert.match(controller, /history\.replaceState/);
  assert.doesNotMatch(controller, /postMessage\([^)]*token/i);
});
