import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('fullscreen homepage navbar is clear at the top and restores glass after scrolling', () => {
  const controller = readSource('src/components/FullscreenWallpaperController.astro');
  const topRule = controller.match(/html\[data-wallpaper-mode="fullscreen"\]\s+body\.layout-standard\s+\.site-header\s*\{([\s\S]*?)\}/);
  const scrolledRule = controller.match(/html\[data-wallpaper-mode="fullscreen"\]\s+body\.layout-standard\s+\.site-header\.is-scrolled\s*\{([\s\S]*?)\}/);

  assert.ok(topRule, 'fullscreen top navbar rule should exist');
  assert.match(topRule[1], /var\(--standard-card-bg\)\s+18%/);
  assert.match(topRule[1], /backdrop-filter:\s*none/);
  assert.match(topRule[1], /-webkit-backdrop-filter:\s*none/);

  assert.ok(scrolledRule, 'fullscreen scrolled navbar rule should exist');
  assert.match(scrolledRule[1], /var\(--standard-card-bg\)\s+68%/);
  assert.match(scrolledRule[1], /backdrop-filter:\s*blur\(18px\)\s+saturate\(1\.15\)/);
});
