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

export { existsSync };
