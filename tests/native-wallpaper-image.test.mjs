import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
