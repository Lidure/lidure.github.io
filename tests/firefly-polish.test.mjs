import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage no longer renders the clock strip', () => {
  const home = readSource('src/pages/index.astro');
  assert.doesNotMatch(home, /showTime=\{true\}/);
});

test('visual settings polish is loaded and exposes theme-aware panel tokens plus a spectrum hue slider', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /firefly-v5-polish\.css/);

  const css = readSource('src/styles/firefly-v5-polish.css');
  assert.match(css, /--visual-panel-bg:/);
  assert.match(css, /\[data-theme="light"\][\s\S]*--visual-panel-bg:/);
  assert.match(css, /#theme-hue-range[\s\S]*linear-gradient\(90deg/);
  assert.match(css, /\.hero-settings-panel[\s\S]*var\(--visual-panel-text\)/);
});

test('outer page surface no longer rounds the full viewport edge', () => {
  const css = readSource('src/styles/firefly-refresh.css');
  assert.doesNotMatch(css, /\.standard-page-surface\s*\{[\s\S]*?border-radius:\s*22px\s+22px\s+0\s+0/);
});

test('banner waves use multi-harmonic asymmetric drift for a softer Firefly-like boundary', () => {
  const waves = readSource('src/components/BannerWaves.astro');
  const model = readSource('src/lib/banner-waves.mjs');
  assert.match(model, /drift:/);
  assert.match(model, /harmonic:/);
  assert.match(waves, /tertiaryPeriod/);
  assert.match(waves, /layer\.drift/);
  assert.match(waves, /layer\.harmonic/);
  assert.match(waves, /Math\.cos/);
});
