export const WAVE_LAYERS = Object.freeze([
  { y: 0, alpha: 0.18, duration: 9.8, phase: 0.04, drift: 0.18, harmonic: 0.42 },
  { y: 3, alpha: 0.34, duration: 10.9, phase: 0.27, drift: 0.26, harmonic: 0.76 },
  { y: 5, alpha: 0.52, duration: 12.1, phase: 0.53, drift: 0.14, harmonic: 1.08 },
  { y: 7, alpha: 0.68, duration: 13.4, phase: 0.79, drift: 0.22, harmonic: 1.36 },
]);

const STRENGTH = Object.freeze({
  soft: { amplitude: 0.68, alpha: 0.74 },
  standard: { amplitude: 1, alpha: 1 },
  strong: { amplitude: 1.18, alpha: 1.08 },
});

const SPEED = Object.freeze({
  slow: 0.74,
  normal: 1,
  fast: 1.28,
});

export function resolveWavePreset(settings = {}) {
  const strength = STRENGTH[settings.waveStrength] || STRENGTH.standard;
  return {
    amplitude: strength.amplitude,
    alpha: strength.alpha,
    speed: SPEED[settings.waveSpeed] || SPEED.normal,
  };
}
