import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('native Astro root view-transition snapshot is fully disabled so Firefly owns page motion', () => {
  const css = read('src/styles/global.css');
  const enhancer = read('src/components/PageTransitionEnhancer.astro');

  assert.match(css, /::view-transition-old\(root\),\s*\n::view-transition-new\(root\)\s*\{[\s\S]*animation:\s*none\s*!important/);
  assert.doesNotMatch(css, /::view-transition-new\(root\)\s*\{[\s\S]*animation-duration:\s*0\.25s/);
  assert.match(enhancer, /\.transition-main[\s\S]*120ms/);
  assert.match(enhancer, /\.transition-leaving[\s\S]*120ms/);
});
