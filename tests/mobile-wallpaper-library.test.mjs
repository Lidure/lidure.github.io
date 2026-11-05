import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('mobile wallpapers have their own shared on-disk library', () => {
  const hero = read('src/components/HeroSlideshow.astro');
  const generator = read('scripts/generate-wallpaper-variants.mjs');

  assert.ok(existsSync(new URL('../public/assets/wallpapers/mobile/README.md', import.meta.url)));
  assert.match(hero, /const mobileWallpaperDir = join\(process\.cwd\(\), 'public', 'assets', 'wallpapers', 'mobile'\)/);
  assert.match(hero, /data-mobile-defaults=\{JSON\.stringify\(defaultMobileImages\)\}/);
  assert.match(hero, /defaultImages\.concat\(defaultMobileImages\)/);
  assert.match(hero, /assets\/wallpapers\/mobile\/generated\//);
  assert.match(generator, /MOBILE_WALLPAPER_DIR/);
  assert.match(generator, /generateVariants\(filename, MOBILE_WALLPAPER_DIR, MOBILE_OUTPUT_DIR\)/);
});

test('device mode selects a private mobile background set, with desktop fallback', () => {
  const hero = read('src/components/HeroSlideshow.astro');
  const settings = read('src/lib/visual-settings.mjs');

  assert.match(hero, /function libraryImages\(target\)/);
  assert.match(hero, /function activeLibrary\(\)/);
  assert.match(hero, /isMobileViewport\(\) && libraryImages\('mobile'\)\.length > 0 \? 'mobile' : 'desktop'/);
  assert.match(hero, /function allImages\(\) \{\s*return libraryImages\(activeLibrary\(\)\);/);
  assert.match(hero, /mobileSelectedIndex: state\.mobileSelectedIndex/);
  assert.match(hero, /mobileImages: state\.mobileImages/);
  assert.match(hero, /selectedIndexFor\(activeLibrary\(\)\)/);
  assert.match(settings, /\.\.\.merged/);
});

test('background manager can upload to and select from either device library', () => {
  const hero = read('src/components/HeroSlideshow.astro');
  const panel = read('src/components/VisualSettingsPanel.astro');

  assert.match(hero, /id="media-library-desktop"/);
  assert.match(hero, /id="media-library-mobile"/);
  assert.match(hero, /function targetForUpload\(\)/);
  assert.match(hero, /function addCustomSource\(src, target\)/);
  assert.match(hero, /var target = targetForUpload\(\)/);
  assert.match(hero, /setSelectedIndexFor\(target, i\)/);
  assert.match(hero, /mediaLibrary = isMobileViewport\(\) \? 'mobile' : 'desktop'/);
  assert.match(panel, /id="media-upload-target"/);
});
