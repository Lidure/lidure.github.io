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

test('v4 waves provide static SVG first paint and Canvas runtime', () => {
  const waves = readSource('src/components/BannerWaves.astro');
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(waves, /class="banner-waves-static"/);
  assert.match(waves, /<canvas[^>]*data-wave-canvas/);
  assert.match(waves, /getContext\(['"]2d['"]\)/);
  assert.match(waves, /prefers-reduced-motion/);
  assert.match(waves, /lidure:visual-settings-change/);
  assert.match(layout, /<BannerWaves/);
});

test('v4 settings center groups wave controls under Background and uses mobile bottom sheet', () => {
  const panel = readSource('src/components/VisualSettingsPanel.astro');
  assert.match(panel, /id="toggle-wave-enabled"/);
  assert.match(panel, /id="wave-strength-soft"/);
  assert.match(panel, /id="wave-strength-standard"/);
  assert.match(panel, /id="wave-strength-strong"/);
  assert.match(panel, /id="wave-speed-slow"/);
  assert.match(panel, /id="wave-speed-normal"/);
  assert.match(panel, /id="wave-speed-fast"/);
  assert.match(panel, /id="toggle-wave-mobile"/);
  assert.match(panel, /Customize your space/);
  assert.match(panel, /max-height:\s*86dvh/);
});

test('v4 moments expose authenticated pin controls and preserve server pin ordering', () => {
  const api = readSource('src/lib/moments-api.ts');
  const pins = readSource('src/components/MomentsPinControls.astro');
  const layout = readSource('src/layouts/BaseLayout.astro');

  assert.match(api, /pinned\?:\s*boolean/);
  assert.match(api, /pinnedAt\?:\s*number/);
  assert.match(api, /export async function setMomentPinned/);
  assert.match(api, /method:\s*['"]PATCH['"]/);
  assert.match(api, /\/pin/);

  assert.match(pins, /moment-pin-badge/);
  assert.match(pins, /pin-moment-btn/);
  assert.match(pins, /delete-moment-btn/);
  assert.match(pins, /setMomentPinned as setMomentPinnedViaApi/);
  assert.match(pins, /await setMomentPinnedViaApi/);
  assert.match(pins, /await fetchMoments/);
  assert.match(layout, /<MomentsPinControls\s*\/>/);
});
