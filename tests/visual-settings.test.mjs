import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_VISUAL_SETTINGS,
  normalizeVisualSettings,
} from '../src/lib/visual-settings.mjs';

test('old values and unknown keys survive v2 normalization', () => {
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
  assert.equal(settings.wallpaperMode, 'banner');
  assert.equal(settings.backgroundBlur, 6);
  assert.equal(settings.cardOpacity, 0.92);
  assert.equal(settings.themeHue, 340);
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

  assert.equal(settings.wallpaperMode, 'banner');
  assert.equal(settings.opacity, 1);
  assert.equal(settings.backgroundBlur, 0);
  assert.equal(settings.cardOpacity, 0.2);
  assert.equal(settings.sakuraDensity, 1);
  assert.equal(settings.sakuraSpeed, 0.25);
});

assert.equal(DEFAULT_VISUAL_SETTINGS.version, 2);
