import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const visual = read('src/lib/visual-settings.mjs');
const panel = read('src/components/VisualSettingsPanel.astro');
const layout = read('src/layouts/BaseLayout.astro');
const modeCssPath = new URL('src/styles/firefly-wallpaper-modes.css', root);

test('visual settings support banner, fullscreen, and overlay wallpaper modes', () => {
  assert.match(visual, /wallpaperMode:[\s\S]*overlay[\s\S]*fullscreen[\s\S]*banner|wallpaperMode:[\s\S]*fullscreen[\s\S]*overlay[\s\S]*banner/);
  assert.match(panel, /id="wallpaper-mode-overlay"[\s\S]*>覆盖透明</);
  assert.match(panel, /wallpaperMode:\s*'overlay'/);
  assert.match(layout, /raw\.wallpaperMode[\s\S]*overlay[\s\S]*fullscreen/);
});

test('fullscreen mode is a real 100dvh Firefly-style hero with floating glass navigation', () => {
  assert.equal(existsSync(modeCssPath), true, 'wallpaper mode stylesheet should exist');
  const css = read('src/styles/firefly-wallpaper-modes.css');
  assert.match(css, /data-wallpaper-mode="fullscreen"[\s\S]*\.blog-banner-stage[\s\S]*height:\s*100dvh/);
  assert.match(css, /data-wallpaper-mode="fullscreen"[\s\S]*\.site-header[\s\S]*border-radius:[^;]+;[\s\S]*backdrop-filter:\s*blur/);
  assert.match(layout, /class="fullscreen-scroll-indicator"/);
  assert.match(css, /\.fullscreen-scroll-indicator[\s\S]*display:\s*grid/);
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
