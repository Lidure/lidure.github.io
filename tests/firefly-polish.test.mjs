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

test('visual panel provides the theme variables consumed by its scoped component styles', () => {
  const css = readSource('src/styles/firefly-v5-polish.css');
  const panelRule = css.match(/html body \.hero-settings-panel\s*\{([^}]*)\}/)?.[1] ?? '';
  const buttonRule = css.match(/html body \.hero-settings-btn\s*\{([^}]*)\}/)?.[1] ?? '';

  assert.match(panelRule, /--panel-bg:\s*var\(--visual-panel-bg\)/);
  assert.match(panelRule, /--text:\s*var\(--visual-panel-text\)/);
  assert.match(panelRule, /--muted:\s*var\(--visual-panel-muted\)/);
  assert.match(panelRule, /--border:\s*var\(--visual-panel-border\)/);
  assert.match(buttonRule, /--panel-bg:\s*var\(--visual-panel-bg\)/);
  assert.match(buttonRule, /--text-soft:\s*var\(--visual-panel-text\)/);
});

test('outer page surface no longer rounds the full viewport edge', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /firefly-v5-polish\.css/);

  const css = readSource('src/styles/firefly-v5-polish.css');
  assert.match(css, /body\.layout-standard\s+\.standard-page-surface\s*\{[\s\S]*border-radius:\s*0/);
});

test('banner waves use the current Firefly-compatible layered translation model', () => {
  const waves = readSource('src/components/BannerWaves.astro');
  const model = readSource('src/lib/banner-waves.mjs');

  assert.match(model, /WAVE_LAYERS\s*=\s*Object\.freeze/);
  assert.match(model, /duration:\s*8/);
  assert.match(model, /duration:\s*11/);
  assert.match(model, /const EASE\s*=\s*Object\.freeze/);
  assert.match(model, /cubicBezier\(\.\.\.EASE, phase\)/);
  assert.match(model, /TRANSLATE_FROM/);
  assert.match(model, /TRANSLATE_TO/);
  assert.match(waves, /WAVE_LAYERS\.forEach/);
  assert.match(waves, /waveUseX\(layer, elapsed, preset\.speed\)/);
  assert.match(waves, /layer\.alpha \* preset\.alpha/);
});
