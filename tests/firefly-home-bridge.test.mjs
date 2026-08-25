import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const layoutCss = readFileSync(new URL('../src/styles/firefly-v2.css', import.meta.url), 'utf8');
const bannerSource = readFileSync(new URL('../src/components/BlogBanner.astro', import.meta.url), 'utf8');

test('homepage category navigation lives inside the three-column home grid', () => {
  assert.match(indexSource, /<div class="home-layout">\s*<nav class="home-category-bar"/s);
  assert.doesNotMatch(indexSource, /<BaseLayout[\s\S]*?>\s*<nav class="home-category-bar"[\s\S]*?<div class="home-layout">/s);
});

test('desktop home grid gives the category card its own center row while sidebars span the bridge', () => {
  assert.match(layoutCss, /\.home-category-bar\s*\{[^}]*grid-area:\s*nav/s);
  assert.match(layoutCss, /\.home-layout\s*\{[^}]*grid-template-areas:\s*"left nav right"\s*"left main right"/s);
  assert.match(layoutCss, /\.home-category-bar\s*\{[^}]*width:\s*100%/s);
});

test('homepage starts its three-column bridge close to the Firefly overlap seam', () => {
  assert.match(bannerSource, /--home-banner-content-inset:\s*0\.75rem/);
  assert.match(bannerSource, /body\.layout-standard\.is-home\s+\.home-layout\s*\{[^}]*position:\s*relative[^}]*z-index:\s*6/s);
});

test('small screens keep navigation first without forcing sidebars above it', () => {
  assert.match(layoutCss, /@media\s*\(max-width:\s*849px\)[\s\S]*grid-template-areas:\s*"nav"\s*"left"\s*"main"\s*"right"/s);
});
