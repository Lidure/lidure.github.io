import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('homepage no longer renders the clock strip', () => {
  const home = readSource('src/pages/index.astro');
  assert.doesNotMatch(home, /showTime=\{true\}/);
});

test('visual settings use semantic theme tokens and a spectrum hue slider', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  const tokens = readSource('src/styles/tokens.css');
  const css = readSource('src/styles/visual-settings.css');

  assert.match(layout, /visual-settings\.css/);
  assert.doesNotMatch(layout, /firefly-v5-polish\.css/);
  assert.match(tokens, /--visual-panel-bg:/);
  assert.match(tokens, /html\[data-theme='light'\][\s\S]*--visual-panel-bg:/);
  assert.match(tokens, /--color-selection-bar:\s*linear-gradient/);
  assert.match(css, /\.hero-settings-panel[\s\S]*--panel-bg:\s*var\(--visual-panel-bg\)/);
  assert.match(css, /#theme-hue-range[\s\S]*background:\s*var\(--color-selection-bar\)/);
});

test('visual panel bridges semantic variables into its scoped component styles', () => {
  const css = readSource('src/styles/visual-settings.css');
  const panelRule = css.match(/html body \.hero-settings-panel\s*\{([^}]*)\}/)?.[1] ?? '';
  const buttonRule = css.match(/html body \.hero-settings-btn\s*\{([^}]*)\}/)?.[1] ?? '';

  assert.match(panelRule, /--panel-bg:\s*var\(--visual-panel-bg\)/);
  assert.match(panelRule, /--text:\s*var\(--visual-panel-text\)/);
  assert.match(panelRule, /--muted:\s*var\(--visual-panel-muted\)/);
  assert.match(panelRule, /--border:\s*var\(--visual-panel-border\)/);
  assert.match(buttonRule, /--panel-bg:\s*var\(--visual-panel-bg\)/);
  assert.match(buttonRule, /--text-soft:\s*var\(--visual-panel-text\)/);
});

test('outer page surface stays flush with the viewport edge', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  const css = readSource('src/styles/site-shell.css');
  const surfaceRule = css.match(/body\.layout-standard \.standard-page-surface\s*\{([^}]*)\}/)?.[1] ?? '';
  const radius = surfaceRule.match(/border-radius:\s*([^;]+)/)?.[1]?.trim();

  assert.match(layout, /site-shell\.css/);
  assert.doesNotMatch(layout, /firefly-v5-polish\.css/);
  assert.ok(surfaceRule.length > 0, 'semantic shell should own the outer page surface');
  assert.ok(radius == null || radius === '0', 'outer page surface must not expose rounded viewport corners');
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
