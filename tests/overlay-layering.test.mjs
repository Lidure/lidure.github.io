import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function layerValue(css, name) {
  const match = css.match(new RegExp(`--${name}:\\s*(\\d+)`));
  assert.ok(match, `missing --${name}`);
  return Number(match[1]);
}

test('global overlay layers have a strict semantic ordering', () => {
  const css = read('src/styles/overlay-layers.css');
  const decoration = layerValue(css, 'layer-decoration');
  const floating = layerValue(css, 'layer-floating');
  const navigation = layerValue(css, 'layer-navigation');
  const overlay = layerValue(css, 'layer-overlay');
  const modal = layerValue(css, 'layer-modal');
  const toast = layerValue(css, 'layer-toast');
  const progress = layerValue(css, 'layer-progress');

  assert.ok(decoration < floating);
  assert.ok(floating < navigation);
  assert.ok(navigation < overlay);
  assert.ok(overlay < modal);
  assert.ok(modal < toast);
  assert.ok(toast < progress);
});

test('expanded non-blocking panels outrank navigation without becoming modals', () => {
  const css = read('src/styles/overlay-layers.css');
  assert.match(css, /\.banner-waves[^{]*\{[^}]*z-index:\s*var\(--layer-decoration\)/s);
  assert.match(css, /\.site-header[^{]*\{[^}]*z-index:\s*var\(--layer-navigation\)/s);
  assert.match(css, /\.sekai-player-panel[^{]*\{[^}]*z-index:\s*var\(--layer-overlay\)/s);
  assert.match(css, /\.hero-settings-panel[^{]*\{[^}]*z-index:\s*var\(--layer-overlay\)/s);
  assert.match(css, /\.message-drawer[^{]*\{[^}]*z-index:\s*var\(--layer-overlay\)/s);
});

test('blocking dialogs, previews, toasts, and progress use their semantic layers', () => {
  const css = read('src/styles/overlay-layers.css');
  assert.match(css, /\.message-composer-backdrop[^{]*\{[^}]*z-index:\s*var\(--layer-modal\)/s);
  assert.match(css, /\.media-panel[^{]*\{[^}]*z-index:\s*var\(--layer-modal\)/s);
  assert.match(css, /\.media-preview[^{]*\{[^}]*z-index:\s*var\(--layer-modal\)/s);
  assert.match(css, /\.lightbox-overlay[^{]*\{[^}]*z-index:\s*var\(--layer-modal\)/s);
  assert.match(css, /\.moments-toast[^{]*\{[^}]*z-index:\s*var\(--layer-toast\)/s);
  assert.match(css, /\.moments-pin-status[^{]*\{[^}]*z-index:\s*var\(--layer-toast\)/s);
  assert.match(css, /#page-transition-progress[^{]*\{[^}]*z-index:\s*var\(--layer-progress\)/s);
});

test('message-board expanded surfaces escape the page stacking context without elevating all content', () => {
  const css = read('src/styles/overlay-layers.css');
  const component = read('src/components/MessageBoard.astro');
  assert.doesNotMatch(css, /:has\(#message-(?:composer|drawer)/);
  assert.match(component, /document\.body\.appendChild\(composer\)/);
  assert.match(component, /document\.body\.appendChild\(drawer\)/);
  assert.match(component, /composer\?\.remove\(\)/);
  assert.match(component, /drawer\?\.remove\(\)/);
});

test('legacy global magic z-index values are not reintroduced by covered surfaces', () => {
  const files = [
    read('src/styles/overlay-layers.css'),
    read('src/components/HeroSlideshow.astro'),
    read('src/styles/moments-life-wall.css'),
    read('src/components/MomentsPinControls.astro'),
  ].join('\n');

  for (const value of ['10001', '10002', '10010', '10020']) {
    assert.doesNotMatch(files, new RegExp(`z-index:\\s*${value}\\b`));
  }
});
