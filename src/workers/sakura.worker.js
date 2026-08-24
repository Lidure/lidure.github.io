const MAX_PETALS = 24;
const FRAME_MS = 1000 / 60;

let canvas = null;
let ctx = null;
let width = 1;
let height = 1;
let dpr = 1;
let enabled = false;
let reducedMotion = false;
let density = 0.65;
let speedMultiplier = 1;
let petals = [];
let lastTime = performance.now();
let spawnCarry = 0;

function clamp(value, min, max, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
}

function targetPetalCount() {
  return Math.max(0, Math.round(MAX_PETALS * density));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function createPetal(spawnInside = false) {
  const size = randomBetween(7, 14);
  return {
    x: randomBetween(-30, width + 20),
    y: spawnInside ? randomBetween(-height * 0.2, height * 0.85) : randomBetween(-70, -18),
    size,
    speed: randomBetween(28, 62),
    drift: randomBetween(8, 24),
    wind: randomBetween(8, 28),
    sway: randomBetween(0.7, 1.7),
    phase: randomBetween(0, Math.PI * 2),
    rotation: randomBetween(0, Math.PI * 2),
    spin: randomBetween(-1.1, 1.1),
    tilt: randomBetween(0.45, 1),
    alpha: randomBetween(0.52, 0.9),
    tone: randomBetween(-5, 7),
  };
}

function trimPetals() {
  const target = targetPetalCount();
  if (petals.length > target) petals.length = target;
}

function resetPetals(initial = false) {
  petals = [];
  spawnCarry = 0;
  if (!enabled || reducedMotion) return;
  const target = targetPetalCount();
  const initialCount = initial ? Math.min(Math.round(14 * density), target) : Math.min(6, target);
  for (let i = 0; i < initialCount; i += 1) petals.push(createPetal(true));
}

function resize(nextWidth, nextHeight, nextDpr) {
  width = Math.max(1, Number(nextWidth) || 1);
  height = Math.max(1, Number(nextHeight) || 1);
  dpr = Math.min(2, Math.max(1, Number(nextDpr) || 1));
  if (!canvas || !ctx) return;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function drawPetal(petal) {
  const size = petal.size;
  ctx.save();
  ctx.translate(petal.x, petal.y);
  ctx.rotate(petal.rotation);
  ctx.scale(1, petal.tilt);
  ctx.beginPath();
  ctx.moveTo(0, size * 0.72);
  ctx.bezierCurveTo(-size * 0.7, size * 0.28, -size * 0.64, -size * 0.5, -size * 0.08, -size * 0.84);
  ctx.bezierCurveTo(-size * 0.01, -size * 0.66, size * 0.01, -size * 0.66, size * 0.08, -size * 0.84);
  ctx.bezierCurveTo(size * 0.64, -size * 0.5, size * 0.7, size * 0.28, 0, size * 0.72);
  ctx.closePath();
  ctx.fillStyle = `hsla(${340 + petal.tone}, 88%, 86%, ${petal.alpha})`;
  ctx.shadowColor = `hsla(${338 + petal.tone}, 90%, 72%, ${petal.alpha * 0.28})`;
  ctx.shadowBlur = 5;
  ctx.fill();
  ctx.restore();
}

function updatePetals(dt, nowSeconds) {
  const target = targetPetalCount();
  trimPetals();
  if (target === 0) return;

  const spawnRate = 1.15 * Math.max(0.15, density);
  spawnCarry += dt * spawnRate;
  while (spawnCarry >= 1 && petals.length < target) {
    spawnCarry -= 1;
    petals.push(createPetal(false));
  }

  for (let i = petals.length - 1; i >= 0; i -= 1) {
    const petal = petals[i];
    const breeze = Math.sin(nowSeconds * petal.sway + petal.phase) * petal.wind;
    petal.x += (petal.drift + breeze) * dt * speedMultiplier;
    petal.y += petal.speed * dt * speedMultiplier;
    petal.rotation += petal.spin * dt * speedMultiplier;

    if (petal.y > height + 90 || petal.x > width + 100 || petal.x < -120) {
      petals.splice(i, 1);
    }
  }
}

function renderFrame(now) {
  if (!ctx || !canvas) return;
  const elapsed = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  ctx.clearRect(0, 0, width, height);
  if (!enabled || reducedMotion) return;

  const nowSeconds = now / 1000;
  updatePetals(elapsed, nowSeconds);
  for (const petal of petals) drawPetal(petal);
}

function applySettings(data) {
  if ('enabled' in data) enabled = data.enabled === true;
  if ('reducedMotion' in data) reducedMotion = data.reducedMotion === true;
  if ('density' in data) density = clamp(data.density, 0, 1, density);
  if ('speedMultiplier' in data) speedMultiplier = clamp(data.speedMultiplier, 0.25, 2, speedMultiplier);
  trimPetals();
}

setInterval(() => renderFrame(performance.now()), FRAME_MS);

self.onmessage = (event) => {
  const data = event.data || {};
  if (data.type === 'init') {
    canvas = data.canvas;
    ctx = canvas ? canvas.getContext('2d') : null;
    applySettings(data);
    resize(data.width, data.height, data.dpr);
    resetPetals(true);
    lastTime = performance.now();
    return;
  }

  if (data.type === 'resize') {
    resize(data.width, data.height, data.dpr);
    return;
  }

  if (data.type === 'enabled') {
    applySettings(data);
    resetPetals(enabled);
    return;
  }

  if (data.type === 'settings') {
    applySettings(data);
    if (enabled && !reducedMotion && petals.length === 0) resetPetals(true);
    return;
  }

  if (data.type === 'visibility' && data.hidden === false) {
    lastTime = performance.now();
  }
};
