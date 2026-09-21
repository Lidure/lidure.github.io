import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('wallpaper images use responsive image candidates and prioritize only the active image', () => {
  const hero = readSource('src/components/HeroSlideshow.astro');

  assert.match(hero, /data-srcset=/);
  assert.match(hero, /data-sizes=/);
  assert.match(hero, /fetchpriority["']?,\s*["']high/);
  assert.match(hero, /requestIdleCallback|setTimeout\([^,]+,\s*1500\)/);
});

test('wallpaper preload does not eagerly fetch every configured image', () => {
  const hero = readSource('src/components/HeroSlideshow.astro');

  assert.doesNotMatch(hero, /defaults\.forEach\([\s\S]*?new Image\(/);
  assert.match(hero, /function\s+prefetchNextImage\b/);
});
