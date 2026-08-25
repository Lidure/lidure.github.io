import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('banner stage anchors Firefly-style waves inside the banner instead of overlapping page UI', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  const waves = readSource('src/components/BannerWaves.astro');

  assert.match(layout, /class="blog-banner-stage"[\s\S]*<BlogBanner[\s\S]*<BannerWaves/);
  assert.match(waves, /viewBox="0 24 150 28"/);
  assert.match(waves, /M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v48h-352z/);
  assert.match(waves, /position:\s*absolute/);
  assert.match(waves, /bottom:\s*-?1px/);
  assert.doesNotMatch(waves, /margin-top:\s*calc\(-1\s*\*/);
});

test('Firefly wave geometry keeps the reference four-layer timing and opacity', () => {
  const model = readSource('src/lib/banner-waves.mjs');
  assert.match(model, /alpha:\s*0\.25[\s\S]*duration:\s*8/);
  assert.match(model, /alpha:\s*0\.5[\s\S]*duration:\s*9/);
  assert.match(model, /alpha:\s*0\.65[\s\S]*duration:\s*10/);
  assert.match(model, /alpha:\s*0\.75[\s\S]*duration:\s*11/);
  assert.match(model, /TRANSLATE_FROM\s*=\s*-90/);
  assert.match(model, /TRANSLATE_TO\s*=\s*85/);
});

test('homepage palette is derived from theme hue with Firefly-like OKLCH semantic tokens', () => {
  const css = readSource('src/styles/firefly-v6-theme.css');
  assert.match(css, /--firefly-primary:\s*oklch\([^;]*var\(--theme-hue/);
  assert.match(css, /--firefly-page-bg:\s*oklch\([^;]*var\(--theme-hue/);
  assert.match(css, /--firefly-btn-bg:\s*oklch\([^;]*var\(--theme-hue/);
  assert.match(css, /--standard-accent:\s*var\(--firefly-primary\)/);
  assert.match(css, /\.sidebar-widget[\s\S]*var\(--firefly-card-bg\)/);
  assert.match(css, /\.home-featured-card[\s\S]*var\(--firefly-primary\)/);
  assert.match(css, /\.home-post-card[\s\S]*var\(--firefly-card-bg\)/);
});

test('theme hue slider uses Firefly-style OKLCH spectrum', () => {
  const css = readSource('src/styles/firefly-v6-theme.css');
  assert.match(css, /--color-selection-bar:\s*linear-gradient\([^;]*oklch\(/s);
  assert.match(css, /#theme-hue-range[\s\S]*background:\s*var\(--color-selection-bar\)/);
});
