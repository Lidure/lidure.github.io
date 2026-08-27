import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bridge = readFileSync(new URL('../src/components/MomentsSnapshotPreviewBridge.astro', import.meta.url), 'utf8');

test('SNAPSHOTS uses native popover activation instead of fragile click remapping', () => {
  assert.match(bridge, /nativeButton\.setAttribute\('popovertarget',\s*previewId\)/);
  assert.match(bridge, /preview\.setAttribute\('popover',\s*'auto'\)/);
  assert.match(bridge, /className = 'moments-snapshot-popover'/);
  assert.match(bridge, /className = 'moments-snapshot-preview-image'/);
  assert.match(bridge, /cloneNode\(true\)/);
  assert.match(bridge, /\.moments-snapshot-popover::backdrop/);
  assert.doesNotMatch(bridge, /sourceImage\.click\(\)/);
  assert.doesNotMatch(bridge, /stopImmediatePropagation\(\)/);
});
