export const WAVE_LAYERS = Object.freeze([
  { y: 0, alpha: 0.22, duration: 8.4, phase: 0 },
  { y: 3, alpha: 0.42, duration: 9.3, phase: 0.23 },
  { y: 5, alpha: 0.58, duration: 10.1, phase: 0.51 },
  { y: 7, alpha: 0.72, duration: 11.2, phase: 0.76 },
]);

const STRENGTH = Object.freeze({
  soft: { amplitude: 0.72, alpha: 0.72 },
  standard: { amplitude: 1, alpha: 1 },
  strong: { amplitude: 1.22, alpha: 1.12 },
});

const SPEED = Object.freeze({
  slow: 0.72,
  normal: 1,
  fast: 1.32,
});

export function resolveWavePreset(settings = {}) {
  const strength = STRENGTH[settings.waveStrength] || STRENGTH.standard;
  return {
    amplitude: strength.amplitude,
    alpha: strength.alpha,
    speed: SPEED[settings.waveSpeed] || SPEED.normal,
  };
}
