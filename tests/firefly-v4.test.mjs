import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('v4 early bootstrap exposes wave settings before hydration', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /dataset\.waveEnabled/);
  assert.match(layout, /dataset\.waveStrength/);
  assert.match(layout, /dataset\.waveSpeed/);
  assert.match(layout, /dataset\.waveMobile/);
});
