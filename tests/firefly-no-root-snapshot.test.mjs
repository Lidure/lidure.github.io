import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('native Astro root view-transition snapshot animation is neutralized so Firefly owns page motion', () => {
  const enhancer = read('src/components/PageTransitionEnhancer.astro');

  assert.match(enhancer, /::view-transition-group\(root\),[\s\S]*::view-transition-new\(root\)\s*\{[\s\S]*animation:\s*none\s*!important/);
  assert.match(enhancer, /::view-transition-group\(root\),[\s\S]*transition:\s*none\s*!important/);
  assert.match(enhancer, /::view-transition-old\(root\)\s*\{[\s\S]*opacity:\s*0\s*!important/);
  assert.match(enhancer, /::view-transition-new\(root\)\s*\{[\s\S]*opacity:\s*1\s*!important/);
  assert.match(enhancer, /\.transition-main[\s\S]*120ms/);
  assert.match(enhancer, /\.transition-leaving[\s\S]*120ms/);
});
