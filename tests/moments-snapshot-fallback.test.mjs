import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/moments.astro');
const pins = read('src/components/MomentsPinControls.astro');
const baseLayout = read('src/layouts/BaseLayout.astro');

test('SNAPSHOTS uses one explicit event path into the page lightbox', () => {
  assert.match(pins, /button\.dataset\.snapshotIndex\s*=\s*String\(index\)/);
  assert.match(pins, /new CustomEvent\(['"]moments:open-snapshot['"]/);
  assert.match(pins, /detail:\s*\{\s*index\s*\}/);
  assert.match(page, /addEventListener\(['"]moments:open-snapshot['"]/);
  assert.match(page, /sourceImages\[index\]/);
  assert.match(page, /openLightbox\(sourceImage\)/);
  assert.doesNotMatch(baseLayout, /MomentsSnapshotPreviewBridge/);
});
