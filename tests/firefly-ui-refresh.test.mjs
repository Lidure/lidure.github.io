import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const readBuilt = (path) =>
  readFileSync(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('BaseLayout exposes standard and immersive page modes', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /layoutMode/);
  assert.match(layout, /layout-\$\{layoutMode\}/);
  assert.match(layout, /<BlogBanner/);
  assert.match(layout, /<SiteHeader/);
});

test('player route defaults to immersive layout', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /Astro\.url\.pathname\s*===\s*['"]\/player['"]/);
  assert.match(layout, /['"]immersive['"]\s*:\s*['"]standard['"]/);
});

test('standard banner keeps B3 desktop and mobile heights', () => {
  const css = readSource('src/styles/firefly-refresh.css');
  assert.match(css, /--blog-banner-height:\s*50vh/);
  assert.match(css, /--blog-banner-height:\s*36vh/);
  assert.match(css, /body\.layout-standard/);
  assert.doesNotMatch(css, /body\.layout-immersive\s+\.post-card/);
});

test('home uses dedicated profile and post-card components', () => {
  const home = readSource('src/pages/index.astro');
  assert.match(home, /HomeProfileSidebar/);
  assert.match(home, /HomePostCard/);
  assert.doesNotMatch(home, /Sweet Blog Corner|floating-shape-a|class="link-grid"/);
});

test('built immersive page has no standard banner shell', () => {
  const html = readBuilt('player/index.html');
  assert.match(html, /layout-immersive/);
  assert.doesNotMatch(html, /class="blog-banner"/);
});
