import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_VISUAL_SETTINGS,
  applyVisualSettingsToDocument,
  normalizeVisualSettings,
} from '../src/lib/visual-settings.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('banner height defaults to 65vh and clamps to 45-80vh', () => {
  assert.equal(DEFAULT_VISUAL_SETTINGS.bannerHeight, 65);
  assert.equal(normalizeVisualSettings({ bannerHeight: 20 }).bannerHeight, 45);
  assert.equal(normalizeVisualSettings({ bannerHeight: 72 }).bannerHeight, 72);
  assert.equal(normalizeVisualSettings({ bannerHeight: 100 }).bannerHeight, 80);
});

test('visual settings apply banner height as a root CSS variable', () => {
  const props = new Map();
  const root = {
    dataset: {},
    classList: { toggle() {} },
    style: { setProperty(name, value) { props.set(name, value); } },
  };

  applyVisualSettingsToDocument({ bannerHeight: 71 }, { documentElement: root });
  assert.equal(props.get('--user-banner-height'), '71vh');
});

test('banner height control is 45-80vh, live, and resettable', () => {
  const enhancer = read('src/components/BannerHeightSettingsEnhancer.astro');
  assert.match(enhancer, /id=["']banner-height-range["']/);
  assert.match(enhancer, /min=["']45["']/);
  assert.match(enhancer, /max=["']80["']/);
  assert.match(enhancer, /step=["']1["']/);
  assert.match(enhancer, /bannerHeight:\s*value/);
  assert.match(enhancer, /bannerHeight:\s*65/);
});

test('banner geometry reads the user height variable and initial paint restores saved height', () => {
  const waves = read('src/components/BannerWaves.astro');
  const layout = read('src/layouts/BaseLayout.astro');
  assert.match(waves, /--blog-banner-height:\s*var\(--user-banner-height,\s*65vh\)/);
  assert.match(layout, /raw\.bannerHeight/);
  assert.match(layout, /--user-banner-height/);
});
