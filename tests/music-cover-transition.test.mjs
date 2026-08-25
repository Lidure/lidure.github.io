import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('base layout installs the shared page transition enhancer', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');

  assert.match(layout, /import PageTransitionEnhancer from ['"]\.\.\/components\/PageTransitionEnhancer\.astro['"]/);
  assert.match(layout, /<PageTransitionEnhancer\s*\/>/);
});

test('music status gets a real default cover with runtime fallback', () => {
  const enhancer = readSource('src/components/PageTransitionEnhancer.astro');

  assert.match(enhancer, /DEFAULT_MUSIC_COVER\s*=\s*['"]\/assets\/music\/default-cover\.webp['"]/);
  assert.match(enhancer, /data-music-cover/);
  assert.match(enhancer, /addEventListener\(['"]error['"]/);
  assert.ok(existsSync(new URL('../public/assets/music/default-cover.webp', import.meta.url)));
});

test('page transition uses short Firefly-style compositor animations and a persistent theme progress bar', () => {
  const enhancer = readSource('src/components/PageTransitionEnhancer.astro');

  assert.match(enhancer, /id="page-transition-progress"[^>]*transition:persist/);
  assert.match(enhancer, /duration:\s*120/);
  assert.match(enhancer, /translateY\(-?2rem\)/);
  assert.match(enhancer, /will-change:\s*transform,\s*opacity/);
  assert.match(enhancer, /astro:before-preparation/);
  assert.match(enhancer, /astro:after-swap/);
  assert.match(enhancer, /data-reduce-motion="true"/);
  assert.match(enhancer, /prefers-reduced-motion:\s*reduce/);
});
