import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('banner stage anchors the four-layer waves inside the banner instead of overlapping page UI', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  const waves = readSource('src/components/BannerWaves.astro');

  assert.match(layout, /class="blog-banner-stage"[\s\S]*<BlogBanner[\s\S]*<BannerWaves/);
  assert.match(waves, /viewBox="0 24 150 28"/);
  assert.match(waves, /M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v48h-352z/);
  assert.match(waves, /position:\s*absolute/);
  assert.match(waves, /bottom:\s*-?1px/);
  assert.doesNotMatch(waves, /margin-top:\s*calc\(-1\s*\*/);
});

test('wave geometry keeps the approved four-layer timing and opacity', () => {
  const model = readSource('src/lib/banner-waves.mjs');
  assert.match(model, /alpha:\s*0\.25[\s\S]*duration:\s*8/);
  assert.match(model, /alpha:\s*0\.5[\s\S]*duration:\s*9/);
  assert.match(model, /alpha:\s*0\.65[\s\S]*duration:\s*10/);
  assert.match(model, /alpha:\s*0\.75[\s\S]*duration:\s*11/);
  assert.match(model, /TRANSLATE_FROM\s*=\s*-90/);
  assert.match(model, /TRANSLATE_TO\s*=\s*85/);
});

test('homepage palette derives from theme hue through semantic tokens', () => {
  const tokens = readSource('src/styles/tokens.css');
  const home = readSource('src/styles/home.css');

  assert.match(tokens, /--standard-accent:\s*oklch\([^;]*var\(--theme-hue/);
  assert.match(tokens, /--standard-page-bg:\s*oklch\([^;]*var\(--theme-hue/);
  assert.match(tokens, /--paper:\s*hsl\(var\(--theme-hue/);
  assert.match(tokens, /--accent:\s*hsl\(var\(--theme-hue/);
  assert.match(home, /var\(--accent\)/);
  assert.match(home, /var\(--muted\)/);
  assert.match(home, /var\(--ink\)/);
  assert.doesNotMatch(tokens, /--firefly-/);
});

test('theme hue slider uses the shared OKLCH spectrum', () => {
  const tokens = readSource('src/styles/tokens.css');
  const css = readSource('src/styles/visual-settings.css');
  assert.match(tokens, /--color-selection-bar:\s*linear-gradient\([\s\S]*?oklch\(/);
  assert.match(css, /#theme-hue-range[\s\S]*background:\s*var\(--color-selection-bar\)/);
});
