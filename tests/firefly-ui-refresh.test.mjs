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

test('immersive UI controller owns current shell visibility without touching player business logic', () => {
  const path = 'src/components/ImmersiveUiController.astro';
  assert.ok(sourceExists(path), 'ImmersiveUiController.astro must exist');
  const controller = readSource(path);
  assert.match(controller, /\.site-header/);
  assert.match(controller, /\.site-floating-controls/);
  assert.match(controller, /\.sekai-player-btn/);
  assert.match(controller, /#hero-settings-panel/);
  assert.match(controller, /#media-panel/);
  assert.match(controller, /#media-preview/);
  assert.match(controller, /stopImmediatePropagation\(\)/);
  assert.match(controller, /astro:before-swap/);
  assert.doesNotMatch(controller, /\.topbar/);
});

test('immersive stage one hides only navigation and restores persistent controls before navigation', () => {
  const path = 'src/components/ImmersiveUiController.astro';
  assert.ok(sourceExists(path), 'ImmersiveUiController.astro must exist');
  const controller = readSource(path);
  assert.match(controller, /stage1:\s*\[\s*document\.querySelector\(['"]\.site-header['"]\)/);
  assert.match(controller, /stage2:\s*\[[\s\S]*?document\.querySelector\(['"]\.site-floating-controls['"]\)/);
  assert.match(controller, /stage === 1[\s\S]*?setVisibility\(targets\.stage1, false\)[\s\S]*?setVisibility\(targets\.stage2, true\)/);
  assert.match(controller, /function resetUi\([\s\S]*?setVisibility\(targets\.stage2, true\)/);
});

test('BaseLayout installs the immersive UI controller only for immersive mode', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /ImmersiveUiController/);
  assert.match(layout, /!isStandard\s*&&\s*<ImmersiveUiController\s*\/>/);
});

test('homepage exposes left, main, and right regions', () => {
  const home = readSource('src/pages/index.astro');
  assert.match(home, /HomeLeftSidebar/);
  assert.match(home, /home-main-column/);
  assert.match(home, /HomeRightSidebar/);
  assert.match(home, /HomePostCard/);
  assert.match(home, /home-category-bar/);
});

test('homepage widgets consume real tag, moments, player, and visitor sources', () => {
  const right = readSource('src/components/HomeRightSidebar.astro');
  const moments = readSource('src/components/RecentMomentsWidget.astro');
  const music = readSource('src/components/MusicStatusWidget.astro');
  assert.match(right, /topTags/);
  assert.match(right, /VisitorCounter/);
  assert.match(moments, /fetchMoments\(\{\s*limit:\s*3\s*\}\)/);
  assert.match(music, /__sekaiOpenPlayer/);
  assert.match(music, /getElementById\(['"]sekaiTrackTitle['"]\)/);
});

test('home music card uses the player public open API instead of simulating the draggable dock click', () => {
  const player = readSource('src/components/SekaiPlayer.astro');
  const music = readSource('src/components/MusicStatusWidget.astro');
  assert.match(player, /window\.__sekaiOpenPlayer\s*=\s*function/);
  assert.match(music, /window\.__sekaiOpenPlayer\s*\?\.\(\)/);
  assert.doesNotMatch(music, /getElementById\(['"]sekaiPlayerBtn['"]\)[\s\S]*?\.click\(\)/);
});

test('home music card proxies previous, play-pause, and next to the existing player controls', () => {
  const music = readSource('src/components/MusicStatusWidget.astro');
  assert.match(music, /id="home-music-prev"/);
  assert.match(music, /id="home-music-play-pause"/);
  assert.match(music, /id="home-music-next"/);
  assert.match(music, /getElementById\(['"]sekaiPrevBtn['"]\)/);
  assert.match(music, /getElementById\(['"]sekaiPlayPauseBtn['"]\)/);
  assert.match(music, /getElementById\(['"]sekaiNextBtn['"]\)/);
  assert.match(music, /audio\.paused\s*\?\s*['"]▶['"]\s*:\s*['"]❚❚['"]/);
});

test('v2 visual layer defines semantic colors and responsive Firefly grid', () => {
  const css = readSource('src/styles/firefly-v2.css');
  assert.match(css, /--standard-purple:/);
  assert.match(css, /--standard-cyan:/);
  assert.match(css, /--standard-warm:/);
  assert.match(css, /grid-template-columns:\s*232px\s+minmax\(0,\s*1fr\)\s+286px/);
  assert.match(css, /@media \(max-width:\s*1199px\) and \(min-width:\s*850px\)/);
  assert.match(css, /@media \(max-width:\s*849px\)/);
});

test('guestbook uses a wide two-column desktop shell', () => {
  const messages = readSource('src/pages/messages.astro');
  assert.match(messages, /messages-layout/);
  assert.match(messages, /messages-composer-column/);
  assert.match(messages, /messages-stream-column/);
  assert.match(messages, /width:\s*min\(100%,\s*1220px\)/);
  assert.match(messages, /grid-template-columns:\s*minmax\(340px,\s*370px\)\s+minmax\(0,\s*1fr\)/);
  assert.doesNotMatch(messages, /max-width:\s*760px/);
});

test('ordinary pages load the v2 cohesion layer', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  const css = readSource('src/styles/firefly-v2-pages.css');
  assert.match(layout, /firefly-v2-pages\.css/);
  assert.match(css, /\.timeline-item::before/);
  assert.match(css, /\.tag-pill:nth-child/);
  assert.match(css, /\.moments-shell/);
  assert.match(css, /\.post-shell/);
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
