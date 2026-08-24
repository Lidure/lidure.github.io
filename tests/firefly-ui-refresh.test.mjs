import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const sourceUrl = (path) => new URL(`../${path}`, import.meta.url);
const sourceExists = (path) => existsSync(sourceUrl(path));
const readSource = (path) => readFileSync(sourceUrl(path), 'utf8');
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
  const styles = [
    readSource('src/styles/firefly-refresh.css'),
    readSource('src/components/BlogBanner.astro'),
  ].join('\n');
  assert.match(styles, /html\.no-hero-bg\s+body\.layout-standard/);
  assert.match(styles, /color:\s*var\(--standard-text\)/);
});

test('site header replaces its global scroll listener after Astro navigation', () => {
  const header = readSource('src/components/SiteHeader.astro');
  assert.match(header, /window\.__siteHeaderScrollHandler/);
  assert.match(header, /removeEventListener\(['"]scroll['"]/);
  assert.match(header, /addEventListener\(['"]scroll['"]/);
});

test('shared shell mounts navigation and floating controls for both modes', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /<SiteHeader\s+currentPath=/);
  assert.match(layout, /<FloatingControls\s*\/?>/);
  assert.doesNotMatch(layout, /isStandard\s*\?\s*\([\s\S]*?<SiteHeader/);
});

test('floating controls proxy existing background settings instead of duplicating them', () => {
  const path = 'src/components/FloatingControls.astro';
  assert.ok(sourceExists(path), 'FloatingControls.astro must exist');
  const controls = readSource(path);
  assert.match(controls, /id="floating-background-btn"/);
  assert.match(controls, /getElementById\(['"]hero-settings-btn['"]\)/);
  assert.match(controls, /\.click\(\)/);
  assert.match(controls, /<ThemeToggle\s*\/?>/);
  assert.match(controls, /id="floating-back-to-top"/);
  assert.match(controls, /window\.__floatingControlsScrollHandler/);
  assert.doesNotMatch(controls, /sekaiPlayerPanel|sekaiAudio|fetchMoments/);
});

test('immersive hide state uses current shell selectors', () => {
  const player = readSource('src/pages/player.astro');
  assert.doesNotMatch(player, /querySelector\(['"]\.topbar['"]\)/);
  assert.match(player, /querySelector\(['"]\.site-header['"]\)/);
  assert.match(player, /querySelector\(['"]\.site-floating-controls['"]\)/);
});

test('immersive stage one keeps player and background controls visible', () => {
  const player = readSource('src/pages/player.astro');
  assert.match(player, /stage1:\s*\[\s*document\.querySelector\(['"]\.site-header['"]\)/);
  assert.match(player, /stage2:\s*\[[\s\S]*?document\.querySelector\(['"]\.site-floating-controls['"]\)/);
  assert.match(player, /document\.querySelector\(['"]\.sekai-player-btn['"]\)/);
  assert.match(player, /hideStage === 1[\s\S]*?setOpacity\(t\.stage1, '0'\)[\s\S]*?setOpacity\(t\.stage2, ''\)/);
});

test('homepage exposes left, main, and right regions', () => {
  const home = readSource('src/pages/index.astro');
  assert.match(home, /HomeLeftSidebar/);
  assert.match(home, /home-main-column/);
  assert.match(home, /HomeRightSidebar/);
  assert.match(home, /HomePostCard/);
});

test('guestbook uses a wide two-column desktop shell', () => {
  const messages = readSource('src/pages/messages.astro');
  assert.match(messages, /messages-layout/);
  assert.match(messages, /messages-composer-column/);
  assert.match(messages, /messages-stream-column/);
  assert.doesNotMatch(messages, /max-width:\s*760px/);
});

test('built immersive page keeps core controls without standard chrome', () => {
  const html = readBuilt('player/index.html');
  assert.match(html, /layout-immersive/);
  assert.match(html, /class="site-header"/);
  assert.match(html, /id="sekaiPlayerBtn"/);
  assert.match(html, /id="hero-settings-btn"/);
  assert.match(html, /class="site-floating-controls"/);
  assert.doesNotMatch(html, /class="blog-banner"/);
  assert.doesNotMatch(html, /class="footer"/);
});

export { sourceExists };
