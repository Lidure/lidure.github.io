import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('semantic shell owns wallpaper and bannerless compatibility', () => {
  const shell = read('src/styles/site-shell.css');
  assert.match(shell, /data-wallpaper-mode=["']fullscreen["']/);
  assert.match(shell, /data-wallpaper-mode=["']overlay["']/);
  assert.match(shell, /data-wallpaper-mode=["']banner["']/);
  assert.match(shell, /\.no-hero-bg/);
  assert.match(shell, /\.is-bannerless/);
  assert.match(shell, /--wallpaper-overlay/);
  assert.match(shell, /--wallpaper-blur/);
  assert.match(shell, /data-card-border/);
  assert.match(shell, /data-card-follow-theme/);
});

test('fullscreen native media remains sharp in the semantic shell', () => {
  const shell = read('src/styles/site-shell.css');
  const blocks = [...shell.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const mediaBlocks = blocks.filter(([, selector]) =>
    selector.includes('data-wallpaper-mode') &&
    selector.includes('fullscreen') &&
    (selector.includes('.slideshow-video') || selector.includes('.slideshow-image'))
  );
  assert.ok(mediaBlocks.length > 0);
  for (const [, , body] of mediaBlocks) {
    assert.doesNotMatch(body, /filter:\s*blur/);
    assert.doesNotMatch(body, /transform:\s*scale/);
  }
});

test('semantic compatibility variables exist independently of Firefly layers', () => {
  const tokens = read('src/styles/tokens.css');
  for (const variable of [
    '--standard-page-bg', '--standard-card-bg', '--standard-card-elevated',
    '--standard-text', '--standard-muted', '--standard-line',
    '--standard-accent', '--standard-accent-soft',
    '--visual-panel-bg', '--visual-panel-text', '--visual-panel-muted',
  ]) assert.match(tokens, new RegExp(variable.replaceAll('-', '\\-')));
});

test('base layout owns shared semantic styles while route styles stay route-owned', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  for (const shared of ['global.css', 'tokens.css', 'site-shell.css', 'pages.css']) {
    assert.match(layout, new RegExp(shared.replace('.', '\\.')));
  }
  for (const routeOwned of ['home.css', 'article.css', 'moments.css']) {
    assert.doesNotMatch(layout, new RegExp(routeOwned.replace('.', '\\.')));
  }
  assert.match(read('src/pages/posts/[slug].astro'), /styles\/article\.css/);
  assert.match(read('src/pages/moments.astro'), /styles\/moments\.css/);
});

test('page-level migration styles are gone', () => {
  assert.equal(existsSync(new URL('../src/styles/article-reading.css', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/styles/moments-life-wall.css', import.meta.url)), false);
  assert.doesNotMatch(read('src/pages/posts/[slug].astro'), /article-reading\.css/);
  const moments = read('src/pages/moments.astro');
  assert.doesNotMatch(moments, /moments-life-wall\.css/);
  assert.match(moments, /styles\/moments\.css/);
});

test('retired portal homepage components are removed', () => {
  for (const path of [
    'src/components/HomeLeftSidebar.astro',
    'src/components/HomeRightSidebar.astro',
    'src/components/HomePostCard.astro',
    'src/components/HomeProfileSidebar.astro',
    'src/components/RecentMomentsWidget.astro',
    'src/components/MusicStatusWidget.astro',
  ]) assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, path);
});

test('global css no longer owns retired ordinary-page components', () => {
  const global = read('src/styles/global.css');
  for (const selector of [
    '.home-layout', '.home-featured-card', '.timeline-item', '.tag-pill',
    '.moment-card', '.article-bookmark', '.messages-layout',
  ]) assert.doesNotMatch(global, new RegExp(selector.replace('.', '\\.')));
});

export { existsSync };
