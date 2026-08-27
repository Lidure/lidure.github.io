import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bridge = readFileSync(new URL('../src/components/MomentsSnapshotPreviewBridge.astro', import.meta.url), 'utf8');

test('SNAPSHOTS falls back to opening the existing lightbox even if source binding is missing', () => {
  assert.match(bridge, /document\.getElementById\('moment-lightbox'\)/);
  assert.match(bridge, /document\.getElementById\('lightbox-image'\)/);
  assert.match(bridge, /lightbox\.hidden\s*=\s*false/);
  assert.match(bridge, /lightbox\.setAttribute\('aria-hidden',\s*'false'\)/);
  assert.match(bridge, /document\.body\.classList\.add\('lightbox-open'\)/);
  assert.match(bridge, /sourceImage\.dataset\.lightboxSrc\s*\|\|\s*sourceImage\.currentSrc\s*\|\|\s*sourceImage\.src/);
});
