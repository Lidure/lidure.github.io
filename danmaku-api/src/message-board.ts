export const MESSAGE_REACTION_EMOJIS = ['❤️', '😂', '✨', '👍'] as const;
export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple'] as const;

export type MessageNoteSize = 'small' | 'medium' | 'large';
export type MessageNoteColor = typeof NOTE_COLORS[number];

export type MessageNoteMeta = {
  color: MessageNoteColor;
  size: MessageNoteSize;
  x: number;
  y: number;
  rotation: number;
  authorOwned: boolean;
};

export type OccupiedNote = {
  x: number;
  y: number;
  size: MessageNoteSize;
};

const BOARD_WIDTH = 1200;
const MAX_OVERLAP_RATIO = 0.22;
const ACTIVE_BAND_HEIGHT = 320;
const FOOTPRINTS: Record<MessageNoteSize, { width: number; height: number }> = {
  small: { width: 220, height: 180 },
  medium: { width: 270, height: 220 },
  large: { width: 330, height: 260 },
};

export function classifyMessageNoteSize(text: string): MessageNoteSize {
  const length = Array.from(text.trim()).length;
  if (length <= 64) return 'small';
  if (length <= 220) return 'medium';
  return 'large';
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function nextRandom(state: number): number {
  let x = state || 0x6d2b79f5;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
}

function randomUnit(state: number): [number, number] {
  const next = nextRandom(state);
  return [next, next / 0x100000000];
}

function overlapArea(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): number {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function scoreCandidate(candidate: { x: number; y: number; size: MessageNoteSize }, occupied: OccupiedNote[]): { score: number; overlapRatio: number } {
  const footprint = FOOTPRINTS[candidate.size];
  const rect = { x: candidate.x, y: candidate.y, width: footprint.width, height: footprint.height };
  let overlap = 0;
  for (const note of occupied) {
    const other = FOOTPRINTS[note.size];
    overlap += overlapArea(rect, { x: note.x, y: note.y, width: other.width, height: other.height });
  }
  const ratio = Math.min(1, overlap / (footprint.width * footprint.height));
  const left = candidate.x;
  const right = BOARD_WIDTH - (candidate.x + footprint.width);
  const edgePenalty = Math.max(0, 36 - Math.min(left, right));
  return { score: ratio * 10_000 + edgePenalty * 3, overlapRatio: ratio };
}

export function chooseMessagePlacement(seed: string | number, occupied: OccupiedNote[], size: MessageNoteSize = 'medium') {
  let state = typeof seed === 'number' ? seed >>> 0 : fnv1a(seed);
  const footprint = FOOTPRINTS[size];
  const highestBottom = occupied.reduce((max, note) => Math.max(max, note.y + FOOTPRINTS[note.size].height), 0);
  let bandStart = Math.max(40, highestBottom - ACTIVE_BAND_HEIGHT);

  for (let band = 0; band < 8; band += 1) {
    let best: { x: number; y: number; score: number; overlapRatio: number } | null = null;
    for (let index = 0; index < 24; index += 1) {
      let unit;
      [state, unit] = randomUnit(state);
      const x = 40 + unit * Math.max(1, BOARD_WIDTH - footprint.width - 80);
      [state, unit] = randomUnit(state);
      const y = bandStart + 30 + unit * Math.max(1, ACTIVE_BAND_HEIGHT - footprint.height + 80);
      const scored = scoreCandidate({ x, y, size }, occupied);
      if (!best || scored.score < best.score) best = { x, y, ...scored };
    }
    if (best && best.overlapRatio <= MAX_OVERLAP_RATIO) {
      return { x: Math.round(best.x * 100) / 100, y: Math.round(best.y * 100) / 100 };
    }
    bandStart += ACTIVE_BAND_HEIGHT;
  }

  return { x: 40, y: bandStart + 30 };
}

export function deriveLegacyNoteMeta(id: string, text: string): MessageNoteMeta {
  let state = fnv1a(id);
  let unit;
  [state, unit] = randomUnit(state);
  const color = NOTE_COLORS[Math.floor(unit * NOTE_COLORS.length) % NOTE_COLORS.length];
  [state, unit] = randomUnit(state);
  const x = 40 + unit * 860;
  [state, unit] = randomUnit(state);
  const y = 60 + unit * 700;
  [state, unit] = randomUnit(state);
  const rotation = -4 + unit * 8;
  return {
    color,
    size: classifyMessageNoteSize(text),
    x: Math.round(x * 100) / 100,
    y: Math.round(y * 100) / 100,
    rotation: Math.round(rotation * 100) / 100,
    authorOwned: false,
  };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function createAuthorToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function hashAuthorToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyAuthorToken(token: string, expectedHash: string): Promise<boolean> {
  const actual = await hashAuthorToken(token);
  if (actual.length !== expectedHash.length) return false;
  let diff = 0;
  for (let index = 0; index < actual.length; index += 1) diff |= actual.charCodeAt(index) ^ expectedHash.charCodeAt(index);
  return diff === 0;
}

export function toGuestMessageItem(row: any, commentCount = 0, reactions: Record<string, number> = {}) {
  const legacy = deriveLegacyNoteMeta(row.id, row.text);
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    commentCount,
    reactions,
    note: {
      color: row.note_color || legacy.color,
      size: row.note_size || legacy.size,
      x: row.pos_x ?? legacy.x,
      y: row.pos_y ?? legacy.y,
      rotation: row.rotation ?? legacy.rotation,
    },
    legacy: !row.author_token_hash,
  };
}
