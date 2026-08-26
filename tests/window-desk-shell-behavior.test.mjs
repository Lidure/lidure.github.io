import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('standard and immersive modes remain explicit', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  assert.match(layout, /layoutMode/);
  assert.match(layout, /layout-\$\{layoutMode\}/);
  assert.match(layout, /normalizedPath\s*===\s*['"]\/player['"]/);
  assert.match(layout, /['"]immersive['"]\s*:\s*['"]standard['"]/);
  assert.match(layout, /<SiteHeader\s+currentPath=/);
  assert.match(layout, /<FloatingControls\s*\/?>/);
  assert.match(layout, /!isStandard\s*&&\s*<ImmersiveUiController\s*\/>/);
});

test('header and floating controls preserve navigation-safe listeners and proxies', () => {
  const header = read('src/components/SiteHeader.astro');
  const controls = read('src/components/FloatingControls.astro');
  assert.match(header, /window\.__siteHeaderScrollHandler/);
  assert.match(header, /removeEventListener\(['"]scroll['"]/);
  assert.match(header, /addEventListener\(['"]scroll['"]/);
  assert.match(controls, /id="floating-background-btn"/);
  assert.match(controls, /getElementById\(['"]hero-settings-btn['"]\)/);
  assert.match(controls, /id="floating-back-to-top"/);
});

test('immersive controller still owns shell visibility only', () => {
  const controller = read('src/components/ImmersiveUiController.astro');
  assert.match(controller, /\.site-header/);
  assert.match(controller, /\.site-floating-controls/);
  assert.match(controller, /\.sekai-player-btn/);
  assert.match(controller, /#hero-settings-panel/);
  assert.match(controller, /astro:before-swap/);
  assert.doesNotMatch(controller, /\.topbar/);
});

test('visual settings dialog and merge-safe bridge remain intact', () => {
  const panel = read('src/components/VisualSettingsPanel.astro');
  const hero = read('src/components/HeroSlideshow.astro');
  assert.match(panel, /id="visual-tab-appearance"/);
  assert.match(panel, /id="visual-tab-background"/);
  assert.match(panel, /id="visual-tab-effects"/);
  assert.match(panel, /id="hero-settings-btn"/);
  assert.match(panel, /role="dialog"/);
  assert.match(panel, /event\.key\s*===\s*['"]Escape['"]/);
  assert.match(panel, /100dvh/);
  assert.match(panel, /safe-area-inset-bottom/);
  assert.match(hero, /__lidureVisualSettings/);
  assert.match(hero, /Object\.assign\(\{\},\s*current,\s*payload\)/);
});

test('sakura remains canvas-based and respects user motion/settings', () => {
  const particles = read('src/components/SekaiParticles.astro');
  const worker = read('src/workers/sakura.worker.js');
  assert.match(particles, /id="sakura-canvas"/);
  assert.match(particles, /prefers-reduced-motion/);
  assert.match(particles, /sakuraDensity/);
  assert.match(particles, /sakuraSpeed/);
  assert.match(worker, /MAX_PETALS\s*=\s*24/);
  assert.match(worker, /density/);
  assert.match(worker, /speedMultiplier/);
});

test('wallpaper defaults remain synchronized', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  const controller = read('src/components/FullscreenWallpaperController.astro');
  assert.match(layout, /raw\.backgroundBlur[\s\S]*?:\s*5;/);
  assert.match(layout, /raw\.themeHue[\s\S]*?:\s*255;/);
  assert.match(layout, /bridge\.write\(\{\s*themeHue:\s*255\s*\}\)/);
  assert.match(layout, /bridge\.write\(\{\s*backgroundBlur:\s*5\s*\}\)/);
  assert.match(controller, /const blurRatio = Math\.min\(scrollY \/ 300, 1\)/);
});
