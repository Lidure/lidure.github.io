import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const bannerSource = readFileSync(new URL('../src/components/BlogBanner.astro', import.meta.url), 'utf8');

test('homepage groups category navigation and article feed inside one center column', () => {
  assert.match(
    indexSource,
    /<div class="home-center-column">[\s\S]*?<nav class="home-category-bar"[\s\S]*?<section class="home-main-column"/,
  );
  assert.doesNotMatch(indexSource, /<div class="home-layout">\s*<nav class="home-category-bar"/s);
});

test('center column owns the main grid area and keeps a compact vertical rhythm', () => {
  assert.match(
    bannerSource,
    /body\.layout-standard\.is-home\s+\.home-center-column\s*\{[^}]*grid-area:\s*main[^}]*display:\s*grid[^}]*gap:\s*18px/s,
  );
});

test('desktop homepage no longer uses a two-row nav/main grid that can be stretched by sidebars', () => {
  assert.doesNotMatch(bannerSource, /"left nav right"\s*"left main right"/s);
  assert.doesNotMatch(bannerSource, /grid-area:\s*nav/);
});

test('homepage still begins close to the Firefly overlap seam', () => {
  assert.match(bannerSource, /--home-banner-content-inset:\s*0\.75rem/);
  assert.match(bannerSource, /body\.layout-standard\.is-home\s+\.home-layout\s*\{[^}]*position:\s*relative[^}]*z-index:\s*6/s);
});
