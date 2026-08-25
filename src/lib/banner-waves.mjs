// Firefly-compatible wave geometry and timing.
// Reference: CuteLeaf/Firefly (MIT). This is a small independent renderer model
// adapted to this site's existing visual-settings API.

export const WAVE_VIEWBOX = Object.freeze({ x: 0, y: 24, width: 150, height: 28 });
export const WAVE_PATH_D = 'M-160 44c30 0 58-18 88-18s 58 18 88 18 58-18 88-18 58 18 88 18 v48h-352z';
export const WAVE_USE_X = 48;

export const WAVE_LAYERS = Object.freeze([
  { y: 0, alpha: 0.25, duration: 8, delay: 0 },
  { y: 3, alpha: 0.5, duration: 9, delay: -2.25 },
  { y: 5, alpha: 0.65, duration: 10, delay: -5 },
  { y: 7, alpha: 0.75, duration: 11, delay: -8.25 },
]);

export const TRANSLATE_FROM = -90;
export const TRANSLATE_TO = 85;
const EASE = Object.freeze([0.5, 0.5, 0.45, 0.5]);

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

function sampleBezierX(u, x1, x2) {
  return 3 * (1 - u) * (1 - u) * u * x1
    + 3 * (1 - u) * u * u * x2
    + u * u * u;
}

function sampleBezierY(u, y1, y2) {
  return 3 * (1 - u) * (1 - u) * u * y1
    + 3 * (1 - u) * u * u * y2
    + u * u * u;
}

function sampleBezierDX(u, x1, x2) {
  return 3 * (1 - u) * (1 - u) * x1
    + 6 * (1 - u) * u * (x2 - x1)
    + 3 * u * u * (1 - x2);
}

export function cubicBezier(x1, y1, x2, y2, t) {
  const clamped = Math.min(1, Math.max(0, t));
  let u = clamped;

  for (let i = 0; i < 6; i += 1) {
    const x = sampleBezierX(u, x1, x2) - clamped;
    const dx = sampleBezierDX(u, x1, x2);
    if (Math.abs(x) < 1e-5 || Math.abs(dx) < 1e-6) break;
    u -= x / dx;
    u = Math.min(1, Math.max(0, u));
  }

  if (Math.abs(sampleBezierX(u, x1, x2) - clamped) > 1e-3) {
    let low = 0;
    let high = 1;
    for (let i = 0; i < 20; i += 1) {
      const mid = (low + high) / 2;
      if (sampleBezierX(mid, x1, x2) < clamped) low = mid;
      else high = mid;
    }
    u = (low + high) / 2;
  }

  return sampleBezierY(u, y1, y2);
}

export function waveTranslate(layer, elapsedSeconds, speed = 1) {
  const elapsed = elapsedSeconds * speed - layer.delay;
  const phase = elapsed / layer.duration - Math.floor(elapsed / layer.duration);
  const eased = cubicBezier(...EASE, phase);
  return TRANSLATE_FROM + (TRANSLATE_TO - TRANSLATE_FROM) * eased;
}

export function waveUseX(layer, elapsedSeconds, speed = 1) {
  return WAVE_USE_X + waveTranslate(layer, elapsedSeconds, speed);
}

export function resolveWavePreset(settings = {}) {
  const strength = STRENGTH[settings.waveStrength] || STRENGTH.standard;
  return {
    amplitude: strength.amplitude,
    alpha: strength.alpha,
    speed: SPEED[settings.waveSpeed] || SPEED.normal,
  };
}
