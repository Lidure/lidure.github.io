import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pins = readFileSync(new URL('../src/components/MomentsPinControls.astro', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/styles/moments-notebook-refresh.css', import.meta.url), 'utf8');

test('SNAPSHOTS uses native popover targets instead of fragile click remapping', () => {
  assert.match(pins, /button\.setAttribute\('popovertarget',\s*previewId\)/);
  assert.match(pins, /preview\.setAttribute\('popover',\s*'auto'\)/);
  assert.match(pins, /className = 'moments-snapshot-popover'/);
  assert.match(pins, /className = 'moments-snapshot-preview-image'/);
  assert.doesNotMatch(pins, /openSnapshotPreview\(/);
  assert.doesNotMatch(pins, /sourceImage\.click\(\)/);
  assert.match(css, /\.moments-snapshot-popover::backdrop/);
  assert.match(css, /\.moments-snapshot-preview-image/);
});
