import { readSession } from './auth';
import { hashAuthorToken, verifyAuthorToken } from './message-board';

export interface MessageStickerEnv {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
  ALLOWED_ORIGIN?: string;
  SESSION_SECRET?: string;
}

export type MessageStickerItem = {
  id: string;
  stickerKey: string;
  x: number;
  y: number;
  rotation: number;
  createdAt: number;
  updatedAt: number;
};

type MessageStickerRow = {
  id: string;
  sticker_key: string;
  pos_x: number;
  pos_y: number;
  rotation: number;
  owner_token_hash: string;
  creator_ip_hash: string;
  created_at: number;
  updated_at: number;
};

type StickerDefinition = { width: number; height: number };

export const MESSAGE_STICKER_DEFINITIONS = {
  'hello-kitty-01': { width: 88, height: 94 },
  'cinnamoroll-01': { width: 96, height: 84 },
  'kuromi-01': { width: 88, height: 96 },
  'my-melody-01': { width: 90, height: 98 },
  'pompompurin-01': { width: 96, height: 88 },
  'pochacco-01': { width: 90, height: 96 },
  'keroppi-01': { width: 88, height: 82 },
} as const;

const BOARD_WIDTH = 1200;
const BOARD_MAX_Y = 8000;
const OWNER_STICKER_LIMIT = 5;
const CREATE_RATE_WINDOW_MS = 60_000;
const CREATE_RATE_MAX = 8;
const STICKER_COLUMNS = 'id,sticker_key,pos_x,pos_y,rotation,owner_token_hash,creator_ip_hash,created_at,updated_at';

export async function handleMessageStickerRequest(
  request: Request,
  url: URL,
  env: MessageStickerEnv,
): Promise<Response | null> {
  if (url.pathname !== '/api/message-stickers') return null;
  if (request.method === 'GET') return handleStickerList(request, env);
  if (request.method === 'POST') return handleStickerCreate(request, env);
  if (request.method === 'PATCH') return handleStickerPatch(request, env);
  if (request.method === 'DELETE') return handleStickerDelete(request, env);
  return errorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405, request, env);
}

async function handleStickerList(request: Request, env: MessageStickerEnv): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT ${STICKER_COLUMNS} FROM message_stickers ORDER BY created_at ASC,id ASC`,
  ).bind().all<MessageStickerRow>();

  const rows = results || [];
  const ownerToken = normalizeOwnerToken(request.headers.get('X-Message-Sticker-Owner'));
  const ownerHash = ownerToken ? await hashAuthorToken(ownerToken) : '';
  const ownedIds = ownerHash
    ? rows.filter((row) => row.owner_token_hash === ownerHash).map((row) => row.id)
    : [];

  return json({
    items: rows.map(toMessageStickerItem),
    ownedIds,
    ownedCount: ownedIds.length,
    now: Date.now(),
  }, 200, request, env);
}

async function handleStickerCreate(request: Request, env: MessageStickerEnv): Promise<Response> {
  if (!isJsonRequest(request)) return errorResponse('Expected application/json', 'UNSUPPORTED_MEDIA_TYPE', 415, request, env);
  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse('Request body must be valid JSON.', 'BAD_JSON', 400, request, env);

  const stickerKey = typeof body.value.stickerKey === 'string' ? body.value.stickerKey.trim() : '';
  const definition = getStickerDefinition(stickerKey);
  if (!definition) return errorResponse('Sticker is not approved', 'STICKER_INVALID_KEY', 400, request, env);

  const ownerToken = normalizeOwnerToken(body.value.ownerToken);
  if (!ownerToken) return errorResponse('A valid sticker owner token is required', 'STICKER_OWNER_REQUIRED', 400, request, env);

  const requestedX = Number(body.value.posX);
  const requestedY = Number(body.value.posY);
  if (!Number.isFinite(requestedX) || !Number.isFinite(requestedY)) {
    return errorResponse('Sticker position is invalid', 'STICKER_BAD_POSITION', 400, request, env);
  }

  const now = Date.now();
  const creatorIpHash = await hashClient(request);
  const recent = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM message_stickers WHERE creator_ip_hash = ? AND created_at > ?',
  ).bind(creatorIpHash, now - CREATE_RATE_WINDOW_MS).first<{ count: number }>();
  if ((Number(recent?.count) || 0) >= CREATE_RATE_MAX) {
    return errorResponse('Too many stickers were created recently', 'STICKER_RATE_LIMITED', 429, request, env);
  }

  const ownerTokenHash = await hashAuthorToken(ownerToken);
  const admin = await isAdmin(request, env);
  const owned = await countOwnedStickers(env.DB, ownerTokenHash);
  if (!admin && owned >= OWNER_STICKER_LIMIT) {
    return errorResponse('This browser already has five stickers', 'STICKER_LIMIT_REACHED', 409, request, env);
  }

  const id = crypto.randomUUID();
  const position = clampStickerPosition(requestedX, requestedY, definition);
  const rotation = deterministicStickerRotation(id);
  const row: MessageStickerRow = {
    id,
    sticker_key: stickerKey,
    pos_x: position.x,
    pos_y: position.y,
    rotation,
    owner_token_hash: ownerTokenHash,
    creator_ip_hash: creatorIpHash,
    created_at: now,
    updated_at: now,
  };

  await env.DB.prepare(
    'INSERT INTO message_stickers (id,sticker_key,pos_x,pos_y,rotation,owner_token_hash,creator_ip_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
  ).bind(
    row.id,
    row.sticker_key,
    row.pos_x,
    row.pos_y,
    row.rotation,
    row.owner_token_hash,
    row.creator_ip_hash,
    row.created_at,
    row.updated_at,
  ).run();

  return json({ item: toMessageStickerItem(row), ownedCount: owned + 1 }, 201, request, env);
}

async function handleStickerPatch(request: Request, env: MessageStickerEnv): Promise<Response> {
  if (!isJsonRequest(request)) return errorResponse('Expected application/json', 'UNSUPPORTED_MEDIA_TYPE', 415, request, env);
  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse('Request body must be valid JSON.', 'BAD_JSON', 400, request, env);

  const id = typeof body.value.id === 'string' ? body.value.id.trim() : '';
  if (!id) return errorResponse('Sticker id is required', 'STICKER_BAD_REQUEST', 400, request, env);
  if (body.value.stickerKey !== undefined || body.value.rotation !== undefined || body.value.width !== undefined || body.value.height !== undefined) {
    return errorResponse('Sticker identity and dimensions cannot be changed', 'STICKER_IMMUTABLE_FIELD', 400, request, env);
  }

  const existing = await findSticker(env.DB, id);
  if (!existing) return errorResponse('Sticker not found', 'STICKER_NOT_FOUND', 404, request, env);
  if (!await canMutateSticker(request, env, existing.owner_token_hash, body.value.ownerToken)) {
    return errorResponse('Sticker mutation is forbidden', 'STICKER_FORBIDDEN', 403, request, env);
  }

  const requestedX = Number(body.value.posX);
  const requestedY = Number(body.value.posY);
  if (!Number.isFinite(requestedX) || !Number.isFinite(requestedY)) {
    return errorResponse('Sticker position is invalid', 'STICKER_BAD_POSITION', 400, request, env);
  }
  const definition = getStickerDefinition(existing.sticker_key);
  if (!definition) return errorResponse('Sticker is no longer approved', 'STICKER_INVALID_KEY', 400, request, env);

  const position = clampStickerPosition(requestedX, requestedY, definition);
  const now = Date.now();
  await env.DB.prepare(
    'UPDATE message_stickers SET pos_x=?,pos_y=?,updated_at=? WHERE id=?',
  ).bind(position.x, position.y, now, id).run();

  return json({ item: toMessageStickerItem({
    ...existing,
    pos_x: position.x,
    pos_y: position.y,
    updated_at: now,
  }) }, 200, request, env);
}

async function handleStickerDelete(request: Request, env: MessageStickerEnv): Promise<Response> {
  if (!isJsonRequest(request)) return errorResponse('Expected application/json', 'UNSUPPORTED_MEDIA_TYPE', 415, request, env);
  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse('Request body must be valid JSON.', 'BAD_JSON', 400, request, env);

  const id = typeof body.value.id === 'string' ? body.value.id.trim() : '';
  if (!id) return errorResponse('Sticker id is required', 'STICKER_BAD_REQUEST', 400, request, env);
  const existing = await findSticker(env.DB, id);
  if (!existing) return errorResponse('Sticker not found', 'STICKER_NOT_FOUND', 404, request, env);
  if (!await canMutateSticker(request, env, existing.owner_token_hash, body.value.ownerToken)) {
    return errorResponse('Sticker mutation is forbidden', 'STICKER_FORBIDDEN', 403, request, env);
  }

  await env.DB.prepare('DELETE FROM message_stickers WHERE id = ?').bind(id).run();
  return json({ deleted: true }, 200, request, env);
}

async function countOwnedStickers(db: D1Database, ownerHash: string): Promise<number> {
  const row = await db.prepare(
    'SELECT COUNT(*) AS count FROM message_stickers WHERE owner_token_hash = ?',
  ).bind(ownerHash).first<{ count: number }>();
  return Number(row?.count) || 0;
}

async function findSticker(db: D1Database, id: string): Promise<MessageStickerRow | null> {
  return db.prepare(
    `SELECT ${STICKER_COLUMNS} FROM message_stickers WHERE id = ? LIMIT 1`,
  ).bind(id).first<MessageStickerRow>();
}

async function canMutateSticker(
  request: Request,
  env: MessageStickerEnv,
  expectedOwnerHash: string,
  tokenValue: unknown,
): Promise<boolean> {
  const token = normalizeOwnerToken(tokenValue);
  if (token && await verifyAuthorToken(token, expectedOwnerHash)) return true;
  return isAdmin(request, env);
}

async function isAdmin(request: Request, env: MessageStickerEnv): Promise<boolean> {
  const secret = env.SESSION_SECRET || '';
  if (!secret) return false;
  const session = await readSession(request, secret);
  return session.ok;
}

function normalizeOwnerToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  const token = value.trim();
  return token.length >= 24 && token.length <= 256 ? token : '';
}

function getStickerDefinition(stickerKey: string): StickerDefinition | null {
  return (MESSAGE_STICKER_DEFINITIONS as Record<string, StickerDefinition>)[stickerKey] || null;
}

function clampStickerPosition(x: number, y: number, definition: StickerDefinition) {
  return {
    x: round2(Math.min(BOARD_WIDTH - definition.width, Math.max(0, x))),
    y: round2(Math.min(BOARD_MAX_Y - definition.height, Math.max(0, y))),
  };
}

function deterministicStickerRotation(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return round2(-4 + ((hash >>> 0) / 0xffffffff) * 8);
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function toMessageStickerItem(row: MessageStickerRow): MessageStickerItem {
  return {
    id: row.id,
    stickerKey: row.sticker_key,
    x: row.pos_x,
    y: row.pos_y,
    rotation: row.rotation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function readJsonBody(request: Request): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false }> {
  try {
    const raw = await request.text();
    const body = JSON.parse(raw);
    return {
      ok: true,
      value: body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {},
    };
  } catch {
    return { ok: false };
  }
}

function isJsonRequest(request: Request) {
  return (request.headers.get('content-type') || '').toLowerCase().includes('application/json');
}

async function hashClient(request: Request): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ua = request.headers.get('User-Agent') || '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${ua}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(request: Request, env: MessageStickerEnv): Headers {
  const headers = new Headers();
  const requestOrigin = request.headers.get('Origin') || '';
  const allowedOrigins = (env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || '*')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const allowAll = allowedOrigins.includes('*');
  const allowCredentials = !allowAll && !!requestOrigin && allowedOrigins.includes(requestOrigin);

  if (allowAll) headers.set('Access-Control-Allow-Origin', '*');
  else if (allowCredentials) {
    headers.set('Access-Control-Allow-Origin', requestOrigin);
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  headers.set('Vary', 'Origin');
  return headers;
}

function errorResponse(message: string, code: string, status: number, request: Request, env: MessageStickerEnv): Response {
  return json({ error: message, code }, status, request, env);
}

function json(payload: unknown, status: number, request: Request, env: MessageStickerEnv): Response {
  const headers = corsHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), { status, headers });
}
