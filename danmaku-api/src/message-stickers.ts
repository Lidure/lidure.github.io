import { hashAuthorToken } from './message-board';

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
  created_at: number;
  updated_at: number;
};

export const MESSAGE_STICKER_DEFINITIONS = {
  'hello-kitty-01': { width: 88, height: 94 },
  'cinnamoroll-01': { width: 96, height: 84 },
  'kuromi-01': { width: 88, height: 96 },
  'my-melody-01': { width: 90, height: 98 },
  'pompompurin-01': { width: 96, height: 88 },
  'pochacco-01': { width: 90, height: 96 },
  'keroppi-01': { width: 88, height: 82 },
} as const;

export async function handleMessageStickerRequest(
  request: Request,
  url: URL,
  env: MessageStickerEnv,
): Promise<Response | null> {
  if (url.pathname !== '/api/message-stickers') return null;
  if (request.method === 'GET') return handleStickerList(request, env);
  return null;
}

async function handleStickerList(request: Request, env: MessageStickerEnv): Promise<Response> {
  const { results } = await env.DB.prepare(
    'SELECT id,sticker_key,pos_x,pos_y,rotation,owner_token_hash,created_at,updated_at FROM message_stickers ORDER BY created_at ASC,id ASC',
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

function normalizeOwnerToken(value: unknown): string {
  if (typeof value !== 'string') return '';
  const token = value.trim();
  return token.length >= 24 && token.length <= 256 ? token : '';
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

function json(payload: unknown, status: number, request: Request, env: MessageStickerEnv): Response {
  const headers = corsHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), { status, headers });
}
