import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  DEFAULT_VISUAL_SETTINGS,
  applyVisualSettingsToDocument,
  normalizeVisualSettings,
} from '../src/lib/visual-settings.mjs';

test('old values and unknown keys survive v4 normalization', () => {
  const settings = normalizeVisualSettings({
    enabled: false,
    autoplay: false,
    interval: 9000,
    opacity: 0.25,
    quality: 'original',
    sakura: true,
    customLegacyValue: 'keep-me',
  });

  assert.equal(settings.enabled, false);
  assert.equal(settings.autoplay, false);
  assert.equal(settings.interval, 9000);
  assert.equal(settings.opacity, 0.25);
  assert.equal(settings.quality, 'original');
  assert.equal(settings.sakura, true);
  assert.equal(settings.wallpaperMode, 'fullscreen');
  assert.equal(settings.backgroundBlur, 5);
  assert.equal(settings.cardOpacity, 0.92);
  assert.equal(settings.themeHue, 255);
  assert.equal(settings.customLegacyValue, 'keep-me');
});

test('invalid values are clamped or replaced', () => {
  const settings = normalizeVisualSettings({
    wallpaperMode: 'broken',
    opacity: 4,
    backgroundBlur: -8,
    cardOpacity: 0,
    sakuraDensity: 9,
    sakuraSpeed: -2,
  });

  assert.equal(settings.wallpaperMode, 'fullscreen');
  assert.equal(settings.opacity, 1);
  assert.equal(settings.backgroundBlur, 0);
  assert.equal(settings.cardOpacity, 0.2);
  assert.equal(settings.sakuraDensity, 1);
  assert.equal(settings.sakuraSpeed, 0.25);
});

test('v4 wallpaper defaults migrate the previous banner default but preserve explicit v4 choices', () => {
  const upgraded = normalizeVisualSettings({ version: 3, wallpaperMode: 'banner' });
  assert.equal(upgraded.version, 5);
  assert.equal(upgraded.wallpaperMode, 'fullscreen');
  assert.equal(normalizeVisualSettings({ version: 4, wallpaperMode: 'banner' }).wallpaperMode, 'banner');
  assert.equal(normalizeVisualSettings({ version: 3, wallpaperMode: 'overlay' }).wallpaperMode, 'overlay');
});

test('v4 visual defaults add waves while preserving unknown legacy keys', () => {
  const value = normalizeVisualSettings({
    version: 2,
    images: ['legacy-image'],
    waveStrength: 'invalid',
    waveSpeed: 'invalid',
  });

  assert.equal(DEFAULT_VISUAL_SETTINGS.version, 5);
  assert.equal(DEFAULT_VISUAL_SETTINGS.wallpaperMode, 'fullscreen');
  assert.equal(DEFAULT_VISUAL_SETTINGS.backgroundBlur, 5);
  assert.equal(DEFAULT_VISUAL_SETTINGS.themeHue, 255);
  assert.equal(value.version, 5);
  assert.equal(value.waveEnabled, true);
  assert.equal(value.waveStrength, 'standard');
  assert.equal(value.waveSpeed, 'normal');
  assert.equal(value.waveMobile, true);
  assert.deepEqual(value.images, ['legacy-image']);
});

test('v3 applies wave datasets to the root element', () => {
  const dataset = {};
  const root = {
    dataset,
    classList: { toggle() {} },
    style: { setProperty() {} },
  };

  applyVisualSettingsToDocument({
    waveEnabled: false,
    waveStrength: 'strong',
    waveSpeed: 'fast',
    waveMobile: false,
  }, { documentElement: root });

  assert.equal(dataset.waveEnabled, 'false');
  assert.equal(dataset.waveStrength, 'strong');
  assert.equal(dataset.waveSpeed, 'fast');
  assert.equal(dataset.waveMobile, 'false');
});


test('mobile fullscreen blur defaults to 0px and remains independent from desktop settings', () => {
  const defaults = normalizeVisualSettings({});
  assert.equal(defaults.backgroundBlur, 5);
  assert.equal(defaults.mobileFullscreenBlur, 0);

  const customized = normalizeVisualSettings({
    backgroundBlur: 9,
    mobileFullscreenBlur: 3,
  });
  assert.equal(customized.backgroundBlur, 9);
  assert.equal(customized.mobileFullscreenBlur, 3);
  assert.equal(normalizeVisualSettings({ mobileFullscreenBlur: -9 }).mobileFullscreenBlur, 0);
  assert.equal(normalizeVisualSettings({ mobileFullscreenBlur: 90 }).mobileFullscreenBlur, 20);

  const applied = {};
  applyVisualSettingsToDocument(customized, {
    documentElement: {
      dataset: {},
      classList: { toggle() {} },
      style: { setProperty(name, value) { applied[name] = value; } },
    },
  });
  assert.equal(applied['--wallpaper-blur'], '9px');
  assert.equal(applied['--mobile-fullscreen-blur'], '3px');
});

test('fullscreen phone blur stays at 0px by default while desktop behavior stays intact', () => {
  const controller = readFileSync(new URL('../src/components/FullscreenWallpaperController.astro', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../src/components/VisualSettingsPanel.astro', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../src/layouts/BaseLayout.astro', import.meta.url), 'utf8');

  assert.match(controller, /function isMobileFullscreen\(\)/);
  assert.match(controller, /isMobileFullscreen\(\) \? '--mobile-fullscreen-blur' : '--wallpaper-blur'/);
  assert.match(controller, /const scrollBlur = isMobileFullscreen\(\)\s*\? Math\.round\(maxBlur \* blurRatio \* 100\) \/ 100/);
  assert.match(controller, /Math\.floor\(\(maxBlur \* blurRatio\) \/ 2\) \* 2/);
  const mobileBlur = (max, scrollY) => Math.round(max * Math.min(scrollY / 300, 1) * 100) / 100;
  assert.equal(mobileBlur(0, 0), 0, 'unscrolled mobile hero must stay sharp');
  assert.equal(mobileBlur(0, 150), 0, 'default mobile hero stays sharp mid-scroll');
  assert.equal(mobileBlur(0, 300), 0, 'default mobile hero stays sharp after 300px');
  assert.equal(mobileBlur(0, 800), 0, 'default mobile hero stays sharp after long scroll');
  assert.equal(mobileBlur(1, 0), 0, 'a manually chosen 1px blur starts sharp');
  assert.equal(mobileBlur(1, 150), 0.5, 'mobile scroll blur should grow gradually');
  assert.equal(mobileBlur(1, 300), 1, 'mobile blur tops out at 1px by default');
  assert.equal(mobileBlur(1, 600), 1, 'mobile blur must not exceed configured maximum');
  assert.match(panel, /isMobileFullscreenMode\(readSettings\(\)\) \? 'mobileFullscreenBlur' : 'backgroundBlur'/);
  assert.match(panel, /mobileFullscreenBlur: 0/);
  assert.match(layout, /root\.style\.setProperty\('--mobile-fullscreen-blur', mobileFullscreenBlur \+ 'px'\)/);
});

test('v5 migration resets former 1px mobile default without altering PC blur', () => {
  const old = normalizeVisualSettings({ version: 4, backgroundBlur: 9, mobileFullscreenBlur: 1 });
  assert.equal(old.version, 5);
  assert.equal(old.backgroundBlur, 9);
  assert.equal(old.mobileFullscreenBlur, 0);
  assert.equal(normalizeVisualSettings({ version: 4, mobileFullscreenBlur: 3 }).mobileFullscreenBlur, 3);
  assert.equal(normalizeVisualSettings({ version: 5, mobileFullscreenBlur: 1 }).mobileFullscreenBlur, 1);
  assert.equal(normalizeVisualSettings({ version: 4 }).mobileFullscreenBlur, 0);
});
