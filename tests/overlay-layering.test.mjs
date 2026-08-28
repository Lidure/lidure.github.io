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
  const panel = layerValue(css, 'layer-panel');
  const modal = layerValue(css, 'layer-modal');
  const progress = layerValue(css, 'layer-progress');
  assert.ok(decoration < floating);
  assert.ok(floating < navigation);
  assert.ok(navigation < panel);
  assert.ok(panel < modal);
  assert.ok(modal < progress);
});

test('expanded panels always outrank navigation and decorative waves', () => {
  const css = read('src/styles/overlay-layers.css');
  assert.match(css, /\.banner-waves[^{]*\{[^}]*z-index:\s*var\(--layer-decoration\)/s);
  assert.match(css, /\.site-header[^{]*\{[^}]*z-index:\s*var\(--layer-navigation\)/s);
  assert.match(css, /\.sekai-player-panel[^{]*\{[^}]*z-index:\s*var\(--layer-panel\)/s);
  assert.match(css, /\.hero-settings-panel[^{]*\{[^}]*z-index:\s*var\(--layer-panel\)/s);
  assert.match(css, /\.message-composer-backdrop[^{]*\{[^}]*z-index:\s*var\(--layer-modal\)/s);
  assert.match(css, /\.message-drawer[^{]*\{[^}]*z-index:\s*var\(--layer-modal\)/s);
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
