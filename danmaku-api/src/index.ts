import {
  clearSessionCookie,
  createSession,
  readSession,
  sessionCookie,
  verifyPassword,
} from "./auth";
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

  return json({
    items: (results || []).map(toClientItem),
    now: Date.now()
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
