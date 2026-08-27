import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pins = read('src/components/MomentsPinControls.astro');
const bridge = read('src/components/MomentsSnapshotPreviewBridge.astro');

test('SNAPSHOTS button owns a direct preview path without global click interception', () => {
  assert.match(pins, /button\.dataset\.snapshotIndex\s*=\s*String\(index\)/);
  assert.match(pins, /button\.addEventListener\(['"]click['"]/);
  assert.match(pins, /sourceImage\.click\(\)/);
  assert.match(pins, /document\.getElementById\('moment-lightbox'\)/);
  assert.match(pins, /document\.getElementById\('lightbox-image'\)/);
  assert.match(pins, /lightbox\.hidden\s*=\s*false/);
  assert.match(pins, /lightbox\.setAttribute\('aria-hidden',\s*'false'\)/);
  assert.match(pins, /document\.body\.classList\.add\('lightbox-open'\)/);
  assert.doesNotMatch(bridge, /addEventListener\(['"]click['"]/);
  assert.doesNotMatch(bridge, /stopImmediatePropagation\(\)/);
});
