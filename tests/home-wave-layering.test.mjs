import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bannerSource = readFileSync(new URL('../src/components/BlogBanner.astro', import.meta.url), 'utf8');
const wavesSource = readFileSync(new URL('../src/components/BannerWaves.astro', import.meta.url), 'utf8');

test('homepage surface does not trap content below the wave stacking layer', () => {
  assert.match(
    bannerSource,
    /html\[data-wallpaper-mode="banner"\]\s+body\.layout-standard\.is-home\s+\.standard-page-surface\s*\{[^}]*z-index:\s*auto[^}]*border-radius:\s*0/s,
  );
});

test('homepage content is explicitly layered above the waves', () => {
  assert.match(wavesSource, /body\.layout-standard\s+\.banner-waves\s*\{[^}]*z-index:\s*var\(--z-decoration\)/s);
  assert.match(
    bannerSource,
    /body\.layout-standard\.is-home\s+\.home-layout\s*\{[^}]*position:\s*relative[^}]*z-index:\s*20/s,
  );
});

test('homepage content starts below the banner wave overlap', () => {
  assert.match(
    bannerSource,
    /html\[data-wallpaper-mode="banner"\]\s+body\.layout-standard\.is-home\s+\.standard-content\s*\{[^}]*padding-top:\s*calc\(var\(--banner-surface-overlap\)\s*\+\s*14px\)/s,
  );
});
