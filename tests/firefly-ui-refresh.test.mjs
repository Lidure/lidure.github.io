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

test('player route defaults to immersive layout with trailing slash tolerance', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /pathname\.replace\(\/\\\/\+\$\/\s*,\s*['"]['"]\)/);
  assert.match(layout, /normalizedPath\s*===\s*['"]\/player['"]/);
  assert.match(layout, /['"]immersive['"]\s*:\s*['"]standard['"]/);
});

test('standard banner keeps B3 desktop and mobile heights', () => {
  const css = readSource('src/styles/firefly-refresh.css');
  assert.match(css, /--blog-banner-height:\s*50vh/);
  assert.match(css, /--blog-banner-height:\s*36vh/);
  assert.match(css, /body\.layout-standard/);
  assert.doesNotMatch(css, /body\.layout-immersive\s+\.post-card/);
});

test('standard banner stays readable when the background is disabled', () => {
  const css = readSource('src/styles/firefly-refresh.css');
  assert.match(css, /html\.no-hero-bg\s+body\.layout-standard\s+\.blog-banner/);
  assert.match(css, /color:\s*var\(--standard-text\)/);
});

test('site header replaces its global scroll listener after Astro navigation', () => {
  const header = readSource('src/components/SiteHeader.astro');
  assert.match(header, /window\.__siteHeaderScrollHandler/);
  assert.match(header, /removeEventListener\(['"]scroll['"]/);
  assert.match(header, /addEventListener\(['"]scroll['"]/);
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
