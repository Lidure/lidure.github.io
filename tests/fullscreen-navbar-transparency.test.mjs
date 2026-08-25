import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const css = readFileSync(new URL('../src/styles/firefly-wallpaper-modes.css', import.meta.url), 'utf8');

test('fullscreen navbar is light at the top and strengthens after scrolling', () => {
  assert.match(css, /html\[data-wallpaper-mode="fullscreen"\] body\.layout-standard \.site-header\s*\{[\s\S]*?var\(--standard-card-bg\) 38%, transparent\)[\s\S]*?blur\(10px\) saturate\(1\.08\)[\s\S]*?transition:/);
  assert.match(css, /html\[data-wallpaper-mode="fullscreen"\] body\.layout-standard \.site-header\.is-scrolled\s*\{[\s\S]*?var\(--standard-card-bg\) 68%, transparent\)[\s\S]*?blur\(18px\) saturate\(1\.15\)/);
});

test('fullscreen navbar uses a slimmer first-screen height while overlay keeps its stronger glass', () => {
  assert.match(css, /html\[data-wallpaper-mode="fullscreen"\] body\.layout-standard \.site-header-inner\s*\{[\s\S]*?min-height:\s*66px/);
  assert.match(css, /html\[data-wallpaper-mode="overlay"\] body\.layout-standard \.site-header[\s\S]*?var\(--standard-card-bg\) 70%, transparent\)[\s\S]*?blur\(18px\) saturate\(1\.15\)/);
});
