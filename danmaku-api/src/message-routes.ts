import {
  chooseMessagePlacement,
  deriveLegacyNoteMeta,
  toGuestMessageItem,
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
  note_color: string | null;
  note_size: MessageNoteSize | null;
  pos_x: number | null;
  pos_y: number | null;
  rotation: number | null;
  author_token_hash: string | null;
  updated_at: number | null;
};

export async function handleStickyMessageRequest(
  request: Request,
  url: URL,
  env: MessageRouteEnv,
): Promise<Response | null> {
  if (url.pathname !== '/api/messages' || request.method !== 'GET') return null;
  return handleMessagesList(url, request, env);
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

function json(payload: unknown, status: number, request: Request, env: MessageRouteEnv): Response {
  const headers = corsHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), { status, headers });
}
