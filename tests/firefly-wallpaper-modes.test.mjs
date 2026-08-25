import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const visual = read('src/lib/visual-settings.mjs');
const panel = read('src/components/VisualSettingsPanel.astro');
const layout = read('src/layouts/BaseLayout.astro');
const controller = read('src/components/FullscreenWallpaperController.astro');
const modeCssPath = new URL('src/styles/firefly-wallpaper-modes.css', root);

test('visual settings support banner, fullscreen, and overlay wallpaper modes', () => {
  assert.match(visual, /wallpaperMode:[\s\S]*overlay[\s\S]*fullscreen[\s\S]*banner|wallpaperMode:[\s\S]*fullscreen[\s\S]*overlay[\s\S]*banner/);
  assert.match(panel, /id="wallpaper-mode-overlay"[\s\S]*>覆盖透明</);
  assert.match(panel, /wallpaperMode:\s*'overlay'/);
  assert.match(layout, /raw\.wallpaperMode[\s\S]*overlay[\s\S]*fullscreen/);
});

test('fullscreen mode uses a fixed full-viewport Firefly hero with floating glass navigation', () => {
  assert.equal(existsSync(modeCssPath), true, 'wallpaper mode stylesheet should exist');
  const css = read('src/styles/firefly-wallpaper-modes.css');
  assert.match(css, /data-wallpaper-mode="fullscreen"[\s\S]*\.blog-banner-stage[\s\S]*position:\s*fixed[\s\S]*height:\s*100lvh/);
  assert.match(css, /data-wallpaper-mode="fullscreen"[\s\S]*\.standard-page-surface[\s\S]*margin-top:\s*100lvh/);
  assert.match(css, /data-wallpaper-mode="fullscreen"[\s\S]*\.site-header[\s\S]*border-radius:[^;]+;[\s\S]*backdrop-filter:\s*blur/);
});

test('fullscreen scroll cue matches Firefly shape, bounce, placement, and hide threshold', () => {
  const css = read('src/styles/firefly-wallpaper-modes.css');
  assert.match(layout, /id="fullscreen-scroll-indicator"/);
  assert.match(layout, /class="fullscreen-scroll-icon"/);
  assert.match(css, /\.fullscreen-scroll-indicator[\s\S]*bottom:\s*5rem[\s\S]*background:\s*transparent[\s\S]*border:\s*0/);
  assert.match(css, /\.fullscreen-scroll-icon[\s\S]*(?:width|font-size):\s*5rem[\s\S]*animation:\s*scroll-down-bounce\s+2s\s+ease-in-out\s+infinite/);
  assert.match(css, /@media\s*\(max-width:\s*1023px\)[\s\S]*\.fullscreen-scroll-indicator[\s\S]*bottom:\s*10rem/);
  assert.match(css, /@keyframes\s+scroll-down-bounce[\s\S]*50%\s*\{\s*transform:\s*translateY\(8px\)/);
  assert.match(controller, /scrollY\s*>\s*100[\s\S]*classList\.(?:add|toggle)\(['"]hide['"]/);
});

test('fullscreen scroll behavior mirrors Firefly title fade, blur ramp, and scroll target', () => {
  assert.match(controller, /fadeDistance\s*=\s*Math\.max\(1,\s*window\.innerHeight\s*\*\s*0\.5\)/);
  assert.match(controller, /--fullscreen-title-scroll['"],\s*`\$\{-scrollY\}px`/);
  assert.match(controller, /blurRatio\s*=\s*Math\.min\(scrollY\s*\/\s*300,\s*1\)/);
  assert.match(controller, /Math\.floor\(\(maxBlur\s*\*\s*blurRatio\)\s*\/\s*2\)\s*\*\s*2/);
  assert.match(controller, /scrollIntoView\(\{\s*behavior:[\s\S]*smooth/);
  assert.match(controller, /TARGET_CLEARANCE\s*=\s*104/);
  assert.match(controller, /EdgA\\\//);
});

test('overlay mode removes the banner and lets glass content float over the fixed wallpaper', () => {
  const css = read('src/styles/firefly-wallpaper-modes.css');
  assert.match(css, /data-wallpaper-mode="overlay"[\s\S]*\.blog-banner-stage[\s\S]*display:\s*none/);
  assert.match(css, /data-wallpaper-mode="overlay"[\s\S]*\.standard-page-surface[\s\S]*background:\s*transparent/);
  assert.match(css, /data-wallpaper-mode="overlay"[\s\S]*\.sidebar-widget[\s\S]*backdrop-filter:\s*blur/);
});

test('banner mode keeps a Firefly-like solid page surface below waves', () => {
  const css = read('src/styles/firefly-wallpaper-modes.css');
  assert.match(css, /data-wallpaper-mode="banner"[\s\S]*\.standard-page-surface[\s\S]*background:\s*var\(--standard-page-bg\)/);
});
