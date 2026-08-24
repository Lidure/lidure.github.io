import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWavePreset } from '../src/lib/banner-waves.mjs';

test('wave presets map strength and speed to bounded multipliers', () => {
  assert.deepEqual(resolveWavePreset({ waveStrength: 'soft', waveSpeed: 'slow' }), {
    amplitude: 0.72,
    alpha: 0.72,
    speed: 0.72,
  });
  assert.deepEqual(resolveWavePreset({ waveStrength: 'strong', waveSpeed: 'fast' }), {
    amplitude: 1.22,
    alpha: 1.12,
    speed: 1.32,
  });
});

test('invalid wave options fall back to standard normal', () => {
  assert.deepEqual(resolveWavePreset({ waveStrength: 'x', waveSpeed: 'y' }), {
    amplitude: 1,
    alpha: 1,
    speed: 1,
  });
});
