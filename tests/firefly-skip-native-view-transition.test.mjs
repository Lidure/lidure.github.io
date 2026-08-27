import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('Astro native ViewTransition is skipped before swap so Firefly is the only visible motion', () => {
  const enhancer = read('src/components/PageTransitionEnhancer.astro');
  const layout = read('src/layouts/BaseLayout.astro');

  assert.match(enhancer, /astro:before-swap/);
  assert.match(enhancer, /viewTransition\?*\.skipTransition\s*\(/);
  assert.match(layout, /<ClientRouter\s+fallback=["']swap["']\s*\/>/);

  // Firefly content motion remains the visible transition layer.
  assert.match(enhancer, /\.transition-main[\s\S]*120ms/);
  assert.match(enhancer, /\.transition-leaving[\s\S]*120ms/);
});
