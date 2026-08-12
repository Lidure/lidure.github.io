import {
  clearSessionCookie,
  createSession,
  readSession,
  sessionCookie,
  verifyPassword,
} from "./auth";
import {
  buildMomentMediaKey,
  publicMediaUrlForKey,
  validateUpload,
} from "./media";
import { createMoment, deleteMoment, listMoments, type CreateMomentInput } from "./moments";

interface Env {
  DB: D1Database;
  MEDIA?: R2Bucket;
  ALLOWED_ORIGINS?: string;
  ALLOWED_ORIGIN?: string;
  PUBLIC_MEDIA_BASE_URL?: string;
  ADMIN_PASSWORD_HASH?: string;
  SESSION_SECRET?: string;
}

type DanmakuRow = {
  id: string;
  track: string;
  text: string;
  time: number;
  color: string | null;
  created_at: number;
};

const MAX_TEXT_LENGTH = 60;
const MAX_TRACK_LENGTH = 160;
const MAX_LIMIT = 300;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 8;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      }

      const url = new URL(request.url);
      if (url.pathname === "/api/auth/login") {
        if (request.method === "POST") {
          return handleLogin(request, env);
        }

        return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405, request, env);
      }

      if (url.pathname === "/api/auth/logout") {
        if (request.method === "POST") {
          return handleLogout(request, env);
        }

        return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405, request, env);
      }

      if (url.pathname === "/api/auth/session") {
        if (request.method === "GET") {
          return handleSession(request, env);
        }

        return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405, request, env);
      }

      if (url.pathname === "/api/moments") {
        if (request.method === "GET") {
          return handleListMoments(url, request, env);
        }

        if (request.method === "POST") {
          return handleCreateMoment(request, env);
        }

        return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405, request, env);
      }

      if (url.pathname === "/api/messages") {
        if (request.method === "GET") return handleMessagesList(url, request, env);
        if (request.method === "POST") return handleMessagesCreate(request, env);
      }
      if (url.pathname === "/api/comments") {
        if (request.method === "GET") return handleCommentsList(url, request, env);
        if (request.method === "POST") return handleCommentsCreate(request, env);
        if (request.method === "DELETE") return handleCommentsDelete(request, env);
      }
      if (url.pathname === "/api/comment-reactions" && request.method === "POST") {
        return handleCommentReactionCreate(request, env);
      }

      if (url.pathname === "/api/media/upload") {
        if (request.method === "POST") {
          return handleUploadMedia(request, env);
        }

        return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405, request, env);
      }

      if (url.pathname.startsWith("/api/moments/")) {
        if (request.method === "DELETE") {
          return handleDeleteMoment(url, request, env);
        }

        return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405, request, env);
      }

      if (url.pathname !== "/api/danmaku") {
        return errorResponse("Not found", "NOT_FOUND", 404, request, env);
      }

      if (request.method === "GET") {
        return handleList(url, request, env);
      }

      if (request.method === "POST") {
        return handleCreate(request, env);
      }

      return errorResponse("Method not allowed", "METHOD_NOT_ALLOWED", 405, request, env);
    } catch (error) {
      console.error(JSON.stringify({ level: "error", message: "Unhandled request error", error: String(error) }));
      return errorResponse("Internal server error", "INTERNAL_ERROR", 500, request, env);
    }
  }
};

async function handleListMoments(url: URL, request: Request, env: Env): Promise<Response> {
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || "50", 10);
  const limit = Number.isFinite(requestedLimit) ? requestedLimit : 50;
  const cursor = url.searchParams.get("cursor") || undefined;

  const payload = await listMoments(env.DB, limit, cursor);
  return json(payload, 200, request, env, {
    cacheControl: "public, max-age=30, stale-while-revalidate=120",
  });
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (!isJsonRequest(request)) {
    return errorResponse("Expected application/json", "UNSUPPORTED_MEDIA_TYPE", 415, request, env);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return errorResponse("Request body must be valid JSON.", "BAD_JSON", 400, request, env);
  }

  const password = typeof body.value.password === "string" ? body.value.password : "";
  const passwordHash = env.ADMIN_PASSWORD_HASH || "";
  const sessionSecret = env.SESSION_SECRET || "";

  if (!passwordHash || !sessionSecret) {
    return errorResponse("Authentication is not configured.", "AUTH_UNAVAILABLE", 500, request, env);
  }

  const valid = await verifyPassword(password, passwordHash);
  if (!valid) {
    return errorResponse(
      "Login failed, please check the password.",
      "AUTH_INVALID",
      401,
      request,
      env
    );
  }

  const now = Date.now();
  const cookieValue = await createSession(sessionSecret, now);
  const session = await readSession(
    new Request(request.url, {
      method: request.method,
      headers: { Cookie: sessionCookie(cookieValue) },
    }),
    sessionSecret,
    now
  );
  const exp = session.ok ? session.session.exp : now + 604_800_000;

  return json(
    { authenticated: true, exp },
    200,
    request,
    env,
    {
      headers: {
        "Set-Cookie": sessionCookie(cookieValue),
      },
    }
  );
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  return json(
    { authenticated: false },
    200,
    request,
    env,
    {
      headers: {
        "Set-Cookie": clearSessionCookie(),
      },
    }
  );
}

async function handleSession(request: Request, env: Env): Promise<Response> {
  const sessionState = await requireSession(request, env);
  if (sessionState instanceof Response) {
    return sessionState;
  }

  return json(
    { authenticated: true, exp: sessionState.exp },
    200,
    request,
    env
  );
}

async function handleCreateMoment(request: Request, env: Env): Promise<Response> {
  const sessionState = await requireSession(request, env);
  if (sessionState instanceof Response) {
    return sessionState;
  }

  if (!isJsonRequest(request)) {
    return errorResponse("Expected application/json", "UNSUPPORTED_MEDIA_TYPE", 415, request, env);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return errorResponse("Request body must be valid JSON.", "BAD_JSON", 400, request, env);
  }

  try {
    const item = await createMoment(env.DB, body.value as CreateMomentInput, {
      publicMediaBaseUrl: env.PUBLIC_MEDIA_BASE_URL,
    });
    return json({ item }, 201, request, env);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "INVALID_MOMENT";
    const message =
      error instanceof Error && error.message ? error.message : "Moment payload is invalid";
    return errorResponse(message, code, 400, request, env);
  }
}

async function handleUploadMedia(request: Request, env: Env): Promise<Response> {
  const sessionState = await requireSession(request, env);
  if (sessionState instanceof Response) {
    return sessionState;
  }

  if (!env.MEDIA) {
    return errorResponse("Media storage is not configured.", "MEDIA_UNAVAILABLE", 500, request, env);
  }

  if (!isMultipartRequest(request)) {
    return errorResponse("Expected multipart/form-data.", "UNSUPPORTED_MEDIA_TYPE", 415, request, env);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("Multipart form data is invalid.", "BAD_MULTIPART", 400, request, env);
  }

  const upload = form.get("file");
  if (!isFileUpload(upload)) {
    return errorResponse("Uploaded media file is required.", "MEDIA_EMPTY", 400, request, env);
  }

  const validation = validateUpload(
    { type: upload.type, size: upload.size },
    { requestedKind: form.get("kind") }
  );
  if (!validation.ok) {
    if (validation.code === "MEDIA_EMPTY") {
      return errorResponse("Uploaded media file is empty.", validation.code, 400, request, env);
    }

    if (validation.code === "MEDIA_TYPE_NOT_ALLOWED") {
      return errorResponse("Media type is not allowed.", validation.code, 415, request, env);
    }

    return json(
      {
        error: "Uploaded media exceeds the size limit.",
        code: validation.code,
        limit: validation.limit,
      },
      413,
      request,
      env
    );
  }

  const key = buildMomentMediaKey(new Date(Date.now()), crypto.randomUUID(), validation.extension);
  await env.MEDIA.put(key, await upload.arrayBuffer(), {
    httpMetadata: { contentType: validation.contentType },
  });

  return json(
    {
      url: publicMediaUrlForKey(env.PUBLIC_MEDIA_BASE_URL, key),
      key,
      kind: validation.kind,
    },
    201,
    request,
    env
  );
}

async function handleDeleteMoment(url: URL, request: Request, env: Env): Promise<Response> {
  const sessionState = await requireSession(request, env);
  if (sessionState instanceof Response) {
    return sessionState;
  }

  const momentId = url.pathname.slice("/api/moments/".length).trim();
  if (!momentId) {
    return errorResponse("Moment id is required", "INVALID_MOMENT_ID", 400, request, env);
  }

  await deleteMoment(env.DB, momentId);
  return noContent(204, request, env);
}

async function handleMessagesList(url: URL, request: Request, env: Env) {
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const { results } = await env.DB.prepare("SELECT id,user_id,text,created_at FROM guest_messages ORDER BY created_at DESC LIMIT ?").bind(limit).all<any>();
  return json({ items: (results || []).map((r: any) => ({ id: r.id, userId: r.user_id, text: r.text, createdAt: r.created_at, commentCount: 0 })), now: Date.now() }, 200, request, env);
}

async function handleMessagesCreate(request: Request, env: Env) {
  if (!isJsonRequest(request)) return errorResponse("Expected application/json", "UNSUPPORTED_MEDIA_TYPE", 415, request, env);
  const body = await readJsonBody(request); const userId = normalizePublicUserId(body.ok ? body.value.userId : ""); const text = normalizePublicText(body.ok ? body.value.text : "", 500);
  if (!userId || !text) return errorResponse("Missing userId or text", "BAD_REQUEST", 400, request, env);
  const now = Date.now(), id = crypto.randomUUID(), ipHash = await hashClient(request);
  await env.DB.prepare("INSERT INTO guest_messages (id,user_id,text,ip_hash,created_at) VALUES (?,?,?,?,?)").bind(id,userId,text,ipHash,now).run();
  return json({ item: { id,userId,text,createdAt:now,commentCount:0 } }, 201, request, env);
}

async function handleCommentsList(url: URL, request: Request, env: Env) {
  const targetType = normalizeTargetType(url.searchParams.get("targetType")), targetId = (url.searchParams.get("targetId") || "").trim();
  if (!targetType || !targetId) return errorResponse("Missing target", "BAD_REQUEST", 400, request, env);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 80));
  const { results } = await env.DB.prepare("SELECT id,target_type,target_id,user_id,text,created_at FROM comments WHERE target_type=? AND target_id=? ORDER BY created_at ASC LIMIT ?").bind(targetType,targetId,limit).all<any>();
  return json({ items: (results || []).map(toPublicComment), now: Date.now() }, 200, request, env);
}

async function handleCommentsCreate(request: Request, env: Env) {
  if (!isJsonRequest(request)) return errorResponse("Expected application/json", "UNSUPPORTED_MEDIA_TYPE", 415, request, env);
  const body = await readJsonBody(request); const b = body.ok ? body.value : {}; const targetType = normalizeTargetType(b.targetType), targetId = typeof b.targetId === "string" ? b.targetId.trim() : "", userId = normalizePublicUserId(b.userId), text = normalizePublicText(b.text, 500);
  if (!targetType || !targetId || !userId || !text) return errorResponse("Missing comment fields", "BAD_REQUEST", 400, request, env);
  const now = Date.now(), id = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO comments (id,target_type,target_id,user_id,text,ip_hash,created_at) VALUES (?,?,?,?,?,?,?)").bind(id,targetType,targetId,userId,text,await hashClient(request),now).run();
  return json({ item: { id,targetType,targetId,userId,text,createdAt:now,reactions:{} } }, 201, request, env);
}

async function handleCommentsDelete(request: Request, env: Env) { const body = await readJsonBody(request); const id = body.ok && typeof body.value.id === "string" ? body.value.id : ""; if (!id) return errorResponse("Missing id","BAD_REQUEST",400,request,env); await env.DB.prepare("DELETE FROM comment_reactions WHERE comment_id=?").bind(id).run(); await env.DB.prepare("DELETE FROM comments WHERE id=?").bind(id).run(); return json({ deleted:true },200,request,env); }

async function handleCommentReactionCreate(request: Request, env: Env) { const body = await readJsonBody(request); const b=body.ok?body.value:{}; const id=typeof b.commentId==='string'?b.commentId:''; const emoji=typeof b.emoji==='string'?b.emoji:''; if(!id||!emoji)return errorResponse('Missing reaction','BAD_REQUEST',400,request,env); const ip=await hashClient(request); await env.DB.prepare('DELETE FROM comment_reactions WHERE comment_id=? AND ip_hash=?').bind(id,ip).run(); await env.DB.prepare('INSERT INTO comment_reactions (comment_id,emoji,ip_hash,created_at) VALUES (?,?,?,?)').bind(id,emoji,ip,Date.now()).run(); return json({ reactions:{[emoji]:1}, selectedEmoji:emoji },200,request,env); }

function normalizeTargetType(value: unknown): "moment" | "message" | "" { return value === "moment" || value === "message" ? value : ""; }
function normalizePublicUserId(value: unknown): string { return typeof value === "string" ? value.replace(/\s+/g," ").trim().slice(0,32) : ""; }
function normalizePublicText(value: unknown, max: number): string { return typeof value === "string" ? value.replace(/\r\n/g,"\n").replace(/\r/g,"\n").trim().slice(0,max) : ""; }
function toPublicComment(r: any) { return { id:r.id,targetType:r.target_type,targetId:r.target_id,userId:r.user_id,text:r.text,createdAt:r.created_at,reactions:{} }; }

async function requireSession(request: Request, env: Env): Promise<{ exp: number } | Response> {
  const sessionSecret = env.SESSION_SECRET || "";
  if (!sessionSecret) {
    return errorResponse("Authentication is not configured.", "AUTH_UNAVAILABLE", 500, request, env);
  }

  const session = await readSession(request, sessionSecret);
  if (session.ok) {
    return session.session;
  }

  if (session.reason === "expired") {
    return errorResponse("Session expired. Please log in again.", "AUTH_EXPIRED", 401, request, env, {
      headers: {
        "Set-Cookie": clearSessionCookie(),
      },
    });
  }

  return errorResponse("Authentication required.", "AUTH_REQUIRED", 401, request, env, {
    headers: session.reason === "invalid" ? { "Set-Cookie": clearSessionCookie() } : undefined,
  });
}

async function handleList(url: URL, request: Request, env: Env): Promise<Response> {
  const track = normalizeTrack(url.searchParams.get("track"));
  if (!track) {
    return errorResponse("Missing track", "BAD_REQUEST", 400, request, env);
  }

  const since = Math.max(0, Number.parseInt(url.searchParams.get("since") || "0", 10) || 0);
  const requestedLimit = Number.parseInt(url.searchParams.get("limit") || String(MAX_LIMIT), 10);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : MAX_LIMIT));

  const { results } = await env.DB.prepare(
    `SELECT id, track, text, time, color, created_at
     FROM danmaku
     WHERE track = ? AND created_at > ?
     ORDER BY time ASC, created_at ASC
     LIMIT ?`
  ).bind(track, since, limit).all<DanmakuRow>();

  const now = Date.now();

  return json({
    items: (results || []).map(toClientItem),
    now,
    nextCursor: now
  }, 200, request, env);
}

async function handleCreate(request: Request, env: Env): Promise<Response> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return errorResponse("Expected application/json", "UNSUPPORTED_MEDIA_TYPE", 415, request, env);
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return errorResponse("Request body must be valid JSON.", "BAD_JSON", 400, request, env);
  }
  const track = normalizeTrack(body.value.track);
  const text = normalizeText(body.value.text);
  const time = normalizeTime(body.value.time);
  const color = normalizeColor(body.value.color);

  if (!track || !text || time == null) {
    return errorResponse("Invalid danmaku", "INVALID_DANMAKU", 400, request, env);
  }

  const ipHash = await hashClient(request);
  const now = Date.now();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM danmaku WHERE ip_hash = ? AND created_at > ?"
  ).bind(ipHash, now - RATE_LIMIT_WINDOW_MS).first<{ count: number }>();

  if ((recent?.count || 0) >= RATE_LIMIT_MAX) {
    return errorResponse("Too many danmaku", "RATE_LIMITED", 429, request, env);
  }

  const item = {
    id: crypto.randomUUID(),
    track,
    text,
    time,
    color,
    createdAt: now
  };

  await env.DB.prepare(
    `INSERT INTO danmaku (id, track, text, time, color, ip_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(item.id, item.track, item.text, item.time, item.color, ipHash, item.createdAt).run();

  return json({ item }, 201, request, env);
}

async function readJsonBody(
  request: Request
): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false }> {
  try {
    const body = await request.json();
    return {
      ok: true,
      value: body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {},
    };
  } catch {
    return { ok: false };
  }
}

function normalizeTrack(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, MAX_TRACK_LENGTH) : "";
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT_LENGTH) : "";
}

function normalizeTime(value: unknown): number | null {
  const time = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(time) || time < 0 || time > 60 * 60 * 6) return null;
  return Math.round(time * 100) / 100;
}

function normalizeColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : null;
}

async function hashClient(request: Request): Promise<string> {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ua = request.headers.get("User-Agent") || "";
  const data = new TextEncoder().encode(`${ip}|${ua}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toClientItem(row: DanmakuRow) {
  return {
    id: row.id,
    track: row.track,
    text: row.text,
    time: row.time,
    color: row.color || undefined,
    createdAt: row.created_at
  };
}

function corsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers();
  const requestOrigin = request.headers.get("Origin") || "";
  const allowedOrigins = (env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "*")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowAll = allowedOrigins.includes("*");
  const allowCredentials = !allowAll && !!requestOrigin && allowedOrigins.includes(requestOrigin);

  if (allowAll) {
    headers.set("Access-Control-Allow-Origin", "*");
  } else if (allowCredentials) {
    headers.set("Access-Control-Allow-Origin", requestOrigin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  headers.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  return headers;
}

function isJsonRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("application/json");
}

function isMultipartRequest(request: Request): boolean {
  const contentType = request.headers.get("content-type") || "";
  return contentType.toLowerCase().includes("multipart/form-data");
}

function isFileUpload(value: File | string | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "size" in value &&
    "type" in value &&
    typeof value.arrayBuffer === "function" &&
    typeof value.size === "number" &&
    typeof value.type === "string"
  );
}

function errorResponse(
  message: string,
  code: string,
  status: number,
  request: Request,
  env: Env,
  options: {
    cacheControl?: string;
    headers?: HeadersInit;
  } = {}
): Response {
  return json({ error: message, code }, status, request, env, options);
}

function json(
  payload: unknown,
  status: number,
  request: Request,
  env: Env,
  options: {
    cacheControl?: string;
    headers?: HeadersInit;
  } = {}
): Response {
  const headers = corsHeaders(request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", options.cacheControl || "no-store");
  if (options.headers) {
    for (const [key, value] of new Headers(options.headers).entries()) {
      headers.set(key, value);
    }
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function noContent(
  status: number,
  request: Request,
  env: Env,
  options: {
    headers?: HeadersInit;
  } = {}
): Response {
  const headers = corsHeaders(request, env);
  headers.set("Cache-Control", "no-store");
  if (options.headers) {
    for (const [key, value] of new Headers(options.headers).entries()) {
      headers.set(key, value);
    }
  }
  return new Response(null, { status, headers });
}
