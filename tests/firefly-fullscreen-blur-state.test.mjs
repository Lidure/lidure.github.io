import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const controller = readFileSync(new URL('../src/components/FullscreenWallpaperController.astro', import.meta.url), 'utf8');

test('fullscreen blur follows Firefly home and inner-page rules', () => {
  assert.match(controller, /function isFullscreen\(\)\s*\{[\s\S]*?root\.dataset\.wallpaperMode === 'fullscreen'/);
  assert.match(controller, /function isFullscreenHome\(\)\s*\{[\s\S]*?isFullscreen\(\)[\s\S]*?body\.classList\.contains\('is-home'\)/);
  assert.match(controller, /if \(!isFullscreen\(\)\)\s*\{[\s\S]*?--fullscreen-scroll-blur[\s\S]*?0px/);
  assert.match(controller, /if \(!body\.classList\.contains\('is-home'\)\)\s*\{[\s\S]*?--fullscreen-scroll-blur[\s\S]*?maxBlur/);
  assert.match(controller, /const blurRatio = Math\.min\(scrollY \/ 300, 1\)/);
  assert.match(controller, /Math\.floor\(\(maxBlur \* blurRatio\) \/ 2\) \* 2/);
});

test('fullscreen blur is synchronized immediately on settings and page lifecycle changes', () => {
  assert.match(controller, /document\.addEventListener\('lidure:visual-settings-change'[\s\S]*?sync\(\)/);
  assert.match(controller, /document\.addEventListener\('astro:page-load', initFullscreenWallpaperController\)/);
});
