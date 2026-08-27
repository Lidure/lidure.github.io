import { readSession } from './auth';
import {
  NOTE_COLORS,
  chooseMessagePlacement,
  classifyMessageNoteSize,
  createAuthorToken,
  deriveLegacyNoteMeta,
  hashAuthorToken,
  toGuestMessageItem,
  verifyAuthorToken,
  type MessageNoteColor,
  type MessageNoteSize,
  type OccupiedNote,
} from './message-board';

export interface MessageRouteEnv {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
  ALLOWED_ORIGIN?: string;
  SESSION_SECRET?: string;
}

type MessageRow = {
  id: string;
  user_id: string;
  text: string;
  created_at: number;
  note_color: MessageNoteColor | null;
  note_size: MessageNoteSize | null;
  pos_x: number | null;
  pos_y: number | null;
  rotation: number | null;
  author_token_hash: string | null;
  updated_at: number | null;
};

const MESSAGE_MAX_TEXT = 800;
const FOOTPRINT_WIDTH: Record<MessageNoteSize, number> = {
  small: 220,
  medium: 270,
  large: 330,
};

export async function handleStickyMessageRequest(
  request: Request,
  url: URL,
  env: MessageRouteEnv,
): Promise<Response | null> {
  if (url.pathname !== '/api/messages') return null;
  if (request.method === 'GET') return handleMessagesList(url, request, env);
  if (request.method === 'POST') return handleMessagesCreate(request, env);
  if (request.method === 'PATCH') return handleMessagesPatch(request, env);
  if (request.method === 'DELETE') return handleMessagesDelete(request, env);
  return null;
}

async function handleMessagesList(url: URL, request: Request, env: MessageRouteEnv): Promise<Response> {
  const syncCursor = Date.now();
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 80));
  const since = Math.max(0, Number(url.searchParams.get('since')) || 0);
  const before = Math.max(0, Number(url.searchParams.get('before')) || 0);
  const columns = 'id,user_id,text,created_at,note_color,note_size,pos_x,pos_y,rotation,author_token_hash,updated_at';

  let statement: D1PreparedStatement;
  if (since > 0) {
    statement = env.DB.prepare(
      `SELECT ${columns} FROM guest_messages WHERE COALESCE(updated_at, created_at) > ? AND COALESCE(updated_at, created_at) <= ? ORDER BY COALESCE(updated_at, created_at) ASC, id ASC LIMIT ?`,
    ).bind(since, syncCursor, limit);
  } else if (before > 0) {
    statement = env.DB.prepare(
      `SELECT ${columns} FROM guest_messages WHERE created_at < ? ORDER BY created_at DESC, id DESC LIMIT ?`,
    ).bind(before, limit);
  } else {
    statement = env.DB.prepare(
      `SELECT ${columns} FROM guest_messages ORDER BY created_at DESC, id DESC LIMIT ?`,
    ).bind(limit);
  }

  const { results } = await statement.all<MessageRow>();
  const rows = results || [];
  const ids = rows.map((row) => row.id);
  const commentCounts: Record<string, number> = {};
  const reactionCounts: Record<string, Record<string, number>> = {};

  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const comments = await env.DB.prepare(
      `SELECT target_id, COUNT(*) AS count FROM comments WHERE target_type = 'message' AND target_id IN (${placeholders}) GROUP BY target_id`,
    ).bind(...ids).all<{ target_id: string; count: number }>();
    for (const row of comments.results || []) commentCounts[row.target_id] = Number(row.count) || 0;

    const reactions = await env.DB.prepare(
      `SELECT message_id, emoji, COUNT(*) AS count FROM message_reactions WHERE message_id IN (${placeholders}) GROUP BY message_id, emoji`,
    ).bind(...ids).all<{ message_id: string; emoji: string; count: number }>();
    for (const row of reactions.results || []) {
      reactionCounts[row.message_id] ||= {};
      reactionCounts[row.message_id][row.emoji] = Number(row.count) || 0;
    }
  }

  const mapped = rows.map((row) => toGuestMessageItem(row, commentCounts[row.id] || 0, reactionCounts[row.id] || {}));
  resolveLegacyCollisions(mapped);
  const oldest = mapped.reduce((value, item) => Math.min(value, item.createdAt), Number.POSITIVE_INFINITY);

  return json({
    items: mapped,
    now: syncCursor,
    nextCursor: syncCursor,
    ...(mapped.length === limit && Number.isFinite(oldest) ? { nextBefore: oldest } : {}),
  }, 200, request, env);
}

async function handleMessagesCreate(request: Request, env: MessageRouteEnv): Promise<Response> {
  if (!isJsonRequest(request)) return errorResponse('Expected application/json', 'UNSUPPORTED_MEDIA_TYPE', 415, request, env);
  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse('Request body must be valid JSON.', 'BAD_JSON', 400, request, env);

  const userId = normalizePublicUserId(body.value.userId);
  const text = normalizePublicText(body.value.text, MESSAGE_MAX_TEXT);
  if (!userId || !text) return errorResponse('Missing userId or text', 'BAD_REQUEST', 400, request, env);

  const now = Date.now();
  const id = crypto.randomUUID();
  const ipHash = await hashClient(request);
  const size = classifyMessageNoteSize(text);
  const fallback = deriveLegacyNoteMeta(id, text);
  const requestedColor = normalizeNoteColor(body.value.noteColor);
  const color = requestedColor || fallback.color;
  const occupiedRows = await env.DB.prepare(
    'SELECT id,text,note_size,pos_x,pos_y FROM guest_messages ORDER BY created_at DESC LIMIT 200',
  ).bind().all<{ id: string; text: string; note_size: MessageNoteSize | null; pos_x: number | null; pos_y: number | null }>();
  const occupied: OccupiedNote[] = (occupiedRows.results || []).map((row) => {
    const legacy = deriveLegacyNoteMeta(row.id, row.text);
    return {
      x: row.pos_x ?? legacy.x,
      y: row.pos_y ?? legacy.y,
      size: row.note_size || legacy.size,
    };
  });
  const placement = chooseMessagePlacement(id, occupied, size);
  const authorToken = createAuthorToken();
  const authorTokenHash = await hashAuthorToken(authorToken);

  await env.DB.prepare(
    'INSERT INTO guest_messages (id,user_id,text,ip_hash,created_at,note_color,note_size,pos_x,pos_y,rotation,author_token_hash,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
  ).bind(id, userId, text, ipHash, now, color, size, placement.x, placement.y, fallback.rotation, authorTokenHash, now).run();

  const item = toGuestMessageItem({
    id,
    user_id: userId,
    text,
    created_at: now,
    note_color: color,
    note_size: size,
    pos_x: placement.x,
    pos_y: placement.y,
    rotation: fallback.rotation,
    author_token_hash: authorTokenHash,
    updated_at: now,
  }, 0, {});

  return json({ item, authorToken }, 201, request, env);
}

async function handleMessagesPatch(request: Request, env: MessageRouteEnv): Promise<Response> {
  if (!isJsonRequest(request)) return errorResponse('Expected application/json', 'UNSUPPORTED_MEDIA_TYPE', 415, request, env);
  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse('Request body must be valid JSON.', 'BAD_JSON', 400, request, env);
  const id = typeof body.value.id === 'string' ? body.value.id.trim() : '';
  if (!id) return errorResponse('Missing id', 'BAD_REQUEST', 400, request, env);

  const authRow = await env.DB.prepare('SELECT author_token_hash FROM guest_messages WHERE id = ? LIMIT 1').bind(id).first<{ author_token_hash: string | null }>();
  if (!authRow) return errorResponse('Message not found', 'MESSAGE_NOT_FOUND', 404, request, env);
  const allowed = await canMutateMessage(request, env, authRow.author_token_hash, body.value.authorToken);
  if (!allowed) return errorResponse('Message mutation is forbidden', 'MESSAGE_FORBIDDEN', 403, request, env);

  const existing = await env.DB.prepare(
    'SELECT id,user_id,text,created_at,note_color,note_size,pos_x,pos_y,rotation,author_token_hash,updated_at FROM guest_messages WHERE id = ? LIMIT 1',
  ).bind(id).first<MessageRow>();
  if (!existing) return errorResponse('Message not found', 'MESSAGE_NOT_FOUND', 404, request, env);

  const text = body.value.text === undefined ? existing.text : normalizePublicText(body.value.text, MESSAGE_MAX_TEXT);
  if (!text) return errorResponse('Message text is required', 'BAD_REQUEST', 400, request, env);
  const size = classifyMessageNoteSize(text);
  const color = body.value.noteColor === undefined ? (existing.note_color || deriveLegacyNoteMeta(id, text).color) : normalizeNoteColor(body.value.noteColor);
  if (!color) return errorResponse('Invalid note color', 'BAD_REQUEST', 400, request, env);
  const fallback = deriveLegacyNoteMeta(id, text);
  const currentX = existing.pos_x ?? fallback.x;
  const currentY = existing.pos_y ?? fallback.y;
  const requestedX = body.value.posX === undefined ? currentX : Number(body.value.posX);
  const requestedY = body.value.posY === undefined ? currentY : Number(body.value.posY);
  if (!Number.isFinite(requestedX) || !Number.isFinite(requestedY)) return errorResponse('Invalid note position', 'BAD_REQUEST', 400, request, env);
  const x = Math.min(1200 - FOOTPRINT_WIDTH[size], Math.max(0, requestedX));
  const y = Math.max(0, requestedY);
  const now = Date.now();

  await env.DB.prepare(
    'UPDATE guest_messages SET text=?,note_color=?,note_size=?,pos_x=?,pos_y=?,updated_at=? WHERE id=?',
  ).bind(text, color, size, x, y, now, id).run();

  return json({ item: toGuestMessageItem({ ...existing, text, note_color: color, note_size: size, pos_x: x, pos_y: y, updated_at: now }) }, 200, request, env);
}

async function handleMessagesDelete(request: Request, env: MessageRouteEnv): Promise<Response> {
  if (!isJsonRequest(request)) return errorResponse('Expected application/json', 'UNSUPPORTED_MEDIA_TYPE', 415, request, env);
  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse('Request body must be valid JSON.', 'BAD_JSON', 400, request, env);
  const id = typeof body.value.id === 'string' ? body.value.id.trim() : '';
  if (!id) return errorResponse('Missing id', 'BAD_REQUEST', 400, request, env);

  const authRow = await env.DB.prepare('SELECT author_token_hash FROM guest_messages WHERE id = ? LIMIT 1').bind(id).first<{ author_token_hash: string | null }>();
  if (!authRow) return errorResponse('Message not found', 'MESSAGE_NOT_FOUND', 404, request, env);
  const allowed = await canMutateMessage(request, env, authRow.author_token_hash, body.value.authorToken);
  if (!allowed) return errorResponse('Message mutation is forbidden', 'MESSAGE_FORBIDDEN', 403, request, env);

  await env.DB.prepare('DELETE FROM message_reactions WHERE message_id = ?').bind(id).run();
  await env.DB.prepare("DELETE FROM comment_reactions WHERE comment_id IN (SELECT id FROM comments WHERE target_type = 'message' AND target_id = ?)").bind(id).run();
  await env.DB.prepare("DELETE FROM comments WHERE target_type = 'message' AND target_id = ?").bind(id).run();
  await env.DB.prepare('DELETE FROM guest_messages WHERE id = ?').bind(id).run();
  return json({ deleted: true }, 200, request, env);
}

async function canMutateMessage(request: Request, env: MessageRouteEnv, expectedHash: string | null, tokenValue: unknown): Promise<boolean> {
  const token = typeof tokenValue === 'string' ? tokenValue : '';
  if (expectedHash && token && await verifyAuthorToken(token, expectedHash)) return true;
  const secret = env.SESSION_SECRET || '';
  if (!secret) return false;
  const session = await readSession(request, secret);
  return session.ok;
}

function resolveLegacyCollisions(items: ReturnType<typeof toGuestMessageItem>[]): void {
  const ordered = [...items].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const occupied: OccupiedNote[] = [];

  for (const item of ordered) {
    if (item.legacy) {
      const fallback = deriveLegacyNoteMeta(item.id, item.text);
      const placed = chooseMessagePlacement(item.id, occupied, item.note.size);
      item.note.x = placed.x;
      item.note.y = placed.y;
      item.note.color = fallback.color;
      item.note.rotation = fallback.rotation;
    }
    occupied.push({ x: item.note.x, y: item.note.y, size: item.note.size });
  }
}

function normalizeNoteColor(value: unknown): MessageNoteColor | '' {
  return typeof value === 'string' && (NOTE_COLORS as readonly string[]).includes(value) ? value as MessageNoteColor : '';
}

function normalizePublicUserId(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 32) : '';
}

function normalizePublicText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().slice(0, max) : '';
}

async function readJsonBody(request: Request): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false }> {
  try {
    const raw = await request.text();
    const body = JSON.parse(raw);
    return { ok: true, value: body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {} };
  } catch {
    return { ok: false };
  }
}

function isJsonRequest(request: Request): boolean {
  return (request.headers.get('content-type') || '').toLowerCase().includes('application/json');
}

async function hashClient(request: Request): Promise<string> {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const ua = request.headers.get('User-Agent') || '';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}|${ua}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(request: Request, env: MessageRouteEnv): Headers {
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

function errorResponse(message: string, code: string, status: number, request: Request, env: MessageRouteEnv): Response {
  return json({ error: message, code }, status, request, env);
}

function json(payload: unknown, status: number, request: Request, env: MessageRouteEnv): Response {
  const headers = corsHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), { status, headers });
}
