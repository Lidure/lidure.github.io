import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const article = read('src/pages/posts/[slug].astro');
const archive = read('src/pages/posts/index.astro');
const moments = read('src/pages/moments.astro');
const transition = read('src/components/PageTransitionEnhancer.astro');
const wallpaperCss = read('src/styles/firefly-wallpaper-modes.css');

test('article, archive, and Moments all use the shared banner shell', () => {
  for (const source of [article, archive, moments]) {
    assert.doesNotMatch(source, /showBanner=\{false\}/);
  }

  assert.match(article, /bannerTitle=\{post\.data\.title\}/);
  assert.match(article, /bannerSubtitle=\{post\.data\.description\}/);
  assert.match(archive, /bannerTitle="文章"/);
  assert.match(moments, /bannerTitle="碎碎念"/);
});

test('fullscreen and overlay keep Firefly inner-page behavior while banner mode owns the hero', () => {
  assert.match(wallpaperCss, /html\[data-wallpaper-mode="fullscreen"\] body\.layout-standard:not\(\.is-home\) \.blog-banner-stage,[\s\S]*html\[data-wallpaper-mode="overlay"\] body\.layout-standard \.blog-banner-stage\s*\{[\s\S]*display:\s*none/);
  assert.match(wallpaperCss, /html\[data-wallpaper-mode="banner"\] body\.layout-standard \.standard-page-surface/);
});

test('page transition timing follows Firefly compositor-friendly motion', () => {
  assert.match(transition, /scaleX\(0\.95\)/);
  assert.match(transition, /duration:\s*500/);
  assert.match(transition, /duration:\s*120/);
  assert.match(transition, /translateY\(-2rem\)/);
  assert.match(transition, /translateY\(2rem\)/);
  assert.match(transition, /cubic-bezier\(0\.55,\s*0\.055,\s*0\.675,\s*0\.19\)/);
  assert.match(transition, /cubic-bezier\(0\.25,\s*0\.46,\s*0\.45,\s*0\.94\)/);
});
