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

test('build prepares responsive WebP variants from the existing local wallpapers', () => {
  const pkg = JSON.parse(readSource('package.json'));
  const generator = readSource('scripts/generate-wallpaper-variants.mjs');

  assert.equal(pkg.scripts.prebuild, 'node scripts/generate-wallpaper-variants.mjs');
  assert.equal(pkg.scripts.predev, 'node scripts/generate-wallpaper-variants.mjs');
  assert.match(pkg.scripts['test:site'], /firefly-wallpaper-loading\.test\.mjs/);
  assert.match(generator, /from ['"]sharp['"]/);
  assert.match(generator, /\[640,\s*960,\s*1280,\s*1920\]/);
  assert.match(generator, /assets[\\/]wallpapers[\\/]generated/);
  assert.match(generator, /\.webp\(/);
});
