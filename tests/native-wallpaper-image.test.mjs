import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('fullscreen image wallpaper uses a native image surface instead of the legacy background layer', () => {
  const controller = readSource('src/components/FullscreenWallpaperController.astro');
  const css = readSource('src/styles/firefly-wallpaper-modes.css');

  assert.match(controller, /document\.createElement\(['"]img['"]\)/);
  assert.match(controller, /className\s*=\s*['"]slideshow-image['"]/);
  assert.match(controller, /MutationObserver/);
  assert.match(controller, /backgroundImage/);

  assert.match(css, /data-wallpaper-mode="fullscreen"[\s\S]*?\.slideshow-image[\s\S]*?object-fit:\s*cover/);
  assert.match(css, /data-wallpaper-mode="fullscreen"[\s\S]*?\.slideshow-image[\s\S]*?filter:\s*blur\(var\(--fullscreen-scroll-blur,\s*0px\)\)/);
  assert.match(css, /data-wallpaper-mode="fullscreen"[\s\S]*?\.slideshow-layer[\s\S]*?display:\s*none\s*!important/);
});

test('fullscreen wallpaper parent is neutral so only the image blur ramp controls homepage blur', () => {
  const css = readSource('src/styles/firefly-wallpaper-modes.css');
  const match = css.match(/html\[data-wallpaper-mode="fullscreen"\]\s+body\.layout-standard\s+\.hero-slideshow,\s*html\[data-wallpaper-mode="overlay"\]\s+body\.layout-standard\s+\.hero-slideshow\s*\{([\s\S]*?)\}/);

  assert.ok(match, 'fullscreen/overlay hero-slideshow rule should exist');
  assert.match(match[1], /filter:\s*none/);
  assert.match(match[1], /transform:\s*none/);
});

test('all built-in wallpaper media is served from same-origin local assets', () => {
  const hero = readSource('src/components/HeroSlideshow.astro');
  const defaultBlock = hero.match(/const defaultImages: string\[\] = \[([\s\S]*?)\n\];/);
  assert.ok(defaultBlock, 'HeroSlideshow should expose a defaultImages list');

  const urls = [...defaultBlock[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
  assert.equal(urls.length, 12, 'expected all 12 built-in wallpapers/videos to remain available');
  assert.doesNotMatch(defaultBlock[1], /https?:\/\//, 'built-in wallpaper defaults must not depend on remote hosts');

  for (const url of urls) {
    assert.match(url, /^\/assets\/wallpapers\/[A-Za-z0-9._()-]+$/);
    assert.ok(existsSync(new URL(`../public${url}`, import.meta.url)), `missing local wallpaper asset: ${url}`);
  }
});

test('background library defers thumbnail media work until the panel is opened', () => {
  const hero = readSource('src/components/HeroSlideshow.astro');

  assert.match(
    hero,
    /function syncUI\(\)\s*\{[\s\S]*?if \(mediaPanel && mediaPanel\.classList\.contains\('open'\)\) renderList\(\);/,
    'syncUI should not build the media library while its panel is closed',
  );
  assert.match(
    hero,
    /mediaManageBtn\.addEventListener\('click',[\s\S]*?mediaPanel\.classList\.add\('open'\);[\s\S]*?renderList\(\);/,
    'opening the background library should build the thumbnails on demand',
  );

  const thumbnailBlock = hero.match(/function drawVideoThumbnail\([\s\S]*?\n    \}/);
  assert.ok(thumbnailBlock, 'drawVideoThumbnail should exist');
  assert.match(thumbnailBlock[0], /vid\.preload = 'metadata'/);
  assert.doesNotMatch(thumbnailBlock[0], /vid\.preload = 'auto'/);
});
