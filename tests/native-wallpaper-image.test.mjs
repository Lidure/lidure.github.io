import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('fullscreen image wallpaper uses a native sharp image surface instead of the legacy background layer', () => {
  const controller = readSource('src/components/FullscreenWallpaperController.astro');
  const css = readSource('src/styles/site-shell.css');

  assert.match(controller, /document\.createElement\(['"]img['"]\)/);
  assert.match(controller, /className\s*=\s*['"]slideshow-image['"]/);
  assert.match(controller, /MutationObserver/);
  assert.match(controller, /backgroundImage/);

  const imageBlocks = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, selector]) => selector.includes('data-wallpaper-mode=') && selector.includes('.slideshow-image'));
  assert.ok(imageBlocks.length > 0);
  assert.ok(imageBlocks.some(([, , body]) => /object-fit:\s*cover/.test(body)));
  for (const [, , body] of imageBlocks) {
    assert.doesNotMatch(body, /filter:\s*blur/);
    assert.doesNotMatch(body, /transform:\s*scale/);
  }
  assert.match(css, /data-wallpaper-mode=['"]fullscreen['"][\s\S]*?\.slideshow-layer[\s\S]*?display:\s*none\s*!important/);
});

test('fullscreen wallpaper parent stays neutral while the overlay owns the scroll blur ramp', () => {
  const css = readSource('src/styles/site-shell.css');
  const controller = readSource('src/components/FullscreenWallpaperController.astro');
  const heroRule = css.match(/html\[data-wallpaper-mode=['"]fullscreen['"]\]\s+body\.layout-standard\s+\.hero-slideshow,\s*html\[data-wallpaper-mode=['"]overlay['"]\]\s+body\.layout-standard\s+\.hero-slideshow\s*\{([\s\S]*?)\}/);

  assert.ok(heroRule, 'fullscreen/overlay hero-slideshow rule should exist');
  assert.doesNotMatch(heroRule[1], /filter:/);
  assert.doesNotMatch(heroRule[1], /transform:/);
  assert.match(css, /\.slideshow-overlay[\s\S]*?backdrop-filter:\s*blur\(var\(--wallpaper-scroll-blur,\s*0px\)\)/);
  assert.match(controller, /setProperty\(['"]--wallpaper-scroll-blur['"]/);
  assert.doesNotMatch(controller, /--fullscreen-scroll-blur/);
});
