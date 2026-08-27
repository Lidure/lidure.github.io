export const BOARD_LOGICAL_WIDTH = 1200;
export const NOTE_FOOTPRINTS = Object.freeze({
  small: Object.freeze({ width: 220, height: 180 }),
  medium: Object.freeze({ width: 270, height: 220 }),
  large: Object.freeze({ width: 330, height: 260 }),
});

const COLORS = ['yellow', 'pink', 'blue', 'green', 'purple'];
const MAX_OVERLAP = 0.22;

export function classifyBoardNoteSize(text) {
  const length = Array.from(String(text ?? '').trim()).length;
  if (length <= 64) return 'small';
  if (length <= 220) return 'medium';
  return 'large';
}

function hashSeed(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) {
    hash ^= char.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function rand01(seed) {
  let x = seed >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return (x >>> 0) / 0xffffffff;
}

export function deriveLegacyBoardNote(id, text) {
  const size = classifyBoardNoteSize(text);
  const footprint = NOTE_FOOTPRINTS[size];
  const seed = hashSeed(id);
  const x = 40 + Math.round(rand01(seed ^ 0x9e3779b9) * Math.max(0, BOARD_LOGICAL_WIDTH - footprint.width - 80));
  const y = 60 + Math.round(rand01(seed ^ 0x85ebca6b) * 700);
  const rotation = Math.round((rand01(seed ^ 0xc2b2ae35) * 8 - 4) * 10) / 10;
  return {
    color: COLORS[seed % COLORS.length],
    size,
    x,
    y,
    rotation,
    legacy: true,
  };
}

function rect(note) {
  const footprint = NOTE_FOOTPRINTS[note.size] || NOTE_FOOTPRINTS.medium;
  return { x: note.x, y: note.y, width: footprint.width, height: footprint.height };
}

export function overlapRatio(a, b) {
  const ra = rect(a);
  const rb = rect(b);
  const overlapWidth = Math.max(0, Math.min(ra.x + ra.width, rb.x + rb.width) - Math.max(ra.x, rb.x));
  const overlapHeight = Math.max(0, Math.min(ra.y + ra.height, rb.y + rb.height) - Math.max(ra.y, rb.y));
  if (!overlapWidth || !overlapHeight) return 0;
  const intersection = overlapWidth * overlapHeight;
  return intersection / Math.min(ra.width * ra.height, rb.width * rb.height);
}

function clampPosition(note) {
  const footprint = NOTE_FOOTPRINTS[note.size] || NOTE_FOOTPRINTS.medium;
  return {
    x: Math.min(Math.max(0, Number(note.x) || 0), BOARD_LOGICAL_WIDTH - footprint.width),
    y: Math.max(0, Number(note.y) || 0),
    size: note.size,
  };
}

function legal(candidate, occupied) {
  return occupied.every((other) => overlapRatio(candidate, other) <= MAX_OVERLAP);
}

export function correctDroppedPosition(note, occupied = []) {
  const base = clampPosition(note);
  if (legal(base, occupied)) return { x: base.x, y: base.y };

  for (let ring = 1; ring <= 20; ring += 1) {
    const radius = ring * 24;
    const offsets = [
      [radius, 0], [-radius, 0], [0, radius], [0, -radius],
      [radius, radius], [radius, -radius], [-radius, radius], [-radius, -radius],
    ];
    for (const [dx, dy] of offsets) {
      const candidate = clampPosition({ x: base.x + dx, y: base.y + dy, size: base.size });
      if (legal(candidate, occupied)) return { x: candidate.x, y: candidate.y };
    }
  }

  return { x: base.x, y: base.y };
}

export function findBestPlacement(seedValue, size, occupied = []) {
  const footprint = NOTE_FOOTPRINTS[size] || NOTE_FOOTPRINTS.medium;
  const maxY = occupied.reduce((value, item) => Math.max(value, item.y + (NOTE_FOOTPRINTS[item.size]?.height || 220)), 500);
  let bandTop = Math.max(40, maxY - 260);
  const seed = hashSeed(seedValue);

  for (let extension = 0; extension < 8; extension += 1) {
    let best = null;
    for (let i = 0; i < 24; i += 1) {
      const r1 = rand01(seed ^ Math.imul(i + 1, 0x9e3779b1));
      const r2 = rand01(seed ^ Math.imul(i + 1, 0x85ebca77));
      const candidate = {
        x: 30 + r1 * Math.max(0, BOARD_LOGICAL_WIDTH - footprint.width - 60),
        y: bandTop + r2 * 300,
        size,
      };
      const overlap = occupied.reduce((sum, item) => sum + overlapRatio(candidate, item), 0);
      const edge = candidate.x < 48 || candidate.x + footprint.width > BOARD_LOGICAL_WIDTH - 48 ? 0.25 : 0;
      const score = overlap * 10 + edge;
      if (!best || score < best.score) best = { candidate, score };
      if (legal(candidate, occupied)) return { x: Math.round(candidate.x), y: Math.round(candidate.y) };
    }
    if (best && legal(best.candidate, occupied)) return { x: Math.round(best.candidate.x), y: Math.round(best.candidate.y) };
    bandTop += 320;
  }

  return { x: 40, y: Math.round(bandTop) };
}

export function computeBoardHeight(notes = []) {
  const lowest = notes.reduce((value, note) => {
    const height = NOTE_FOOTPRINTS[note.size]?.height || NOTE_FOOTPRINTS.medium.height;
    return Math.max(value, (Number(note.y) || 0) + height);
  }, 0);
  return Math.max(720, lowest + 220);
}

export function logicalToRenderedPosition(note, renderedWidth) {
  const width = Math.max(1, Number(renderedWidth) || BOARD_LOGICAL_WIDTH);
  const scale = width / BOARD_LOGICAL_WIDTH;
  return {
    x: note.x * scale,
    y: note.y * scale,
    scale,
  };
}
