import { listMoments } from "./moments";

interface Env {
  DB: D1Database;
  MEDIA?: R2Bucket;
  ALLOWED_ORIGINS?: string;
  ALLOWED_ORIGIN?: string;
  PUBLIC_MEDIA_BASE_URL?: string;
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
      if (url.pathname === "/api/moments") {
        if (request.method === "GET") {
          return handleListMoments(url, request, env);
        }

        if (request.method === "POST" || request.method === "DELETE") {
          return requireSessionBoundary(request, env);
        }

        return json({ error: "Method not allowed" }, 405, request, env);
      }

      if (url.pathname.startsWith("/api/moments/")) {
        if (request.method === "DELETE") {
          return requireSessionBoundary(request, env);
        }

        return json({ error: "Method not allowed" }, 405, request, env);
      }

      if (url.pathname !== "/api/danmaku") {
        return json({ error: "Not found" }, 404, request, env);
      }

      if (request.method === "GET") {
        return handleList(url, request, env);
      }

      if (request.method === "POST") {
        return handleCreate(request, env);
      }

      return json({ error: "Method not allowed" }, 405, request, env);
    } catch (error) {
      console.error(JSON.stringify({ level: "error", message: "Unhandled request error", error: String(error) }));
      return json({ error: "Internal server error" }, 500, request, env);
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

function requireSessionBoundary(request: Request, env: Env): Response {
  return json(
    {
      error: "Authentication required",
      code: "SESSION_REQUIRED",
    },
    401,
    request,
    env
  );
}

async function handleList(url: URL, request: Request, env: Env): Promise<Response> {
  const track = normalizeTrack(url.searchParams.get("track"));
  if (!track) {
    return json({ error: "Missing track" }, 400, request, env);
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
    return json({ error: "Expected application/json" }, 415, request, env);
  }

  const body = await readJsonBody(request);
  const track = normalizeTrack(body.track);
  const text = normalizeText(body.text);
  const time = normalizeTime(body.time);
  const color = normalizeColor(body.color);

  if (!track || !text || time == null) {
    return json({ error: "Invalid danmaku" }, 400, request, env);
  }

  const ipHash = await hashClient(request);
  const now = Date.now();
  const recent = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM danmaku WHERE ip_hash = ? AND created_at > ?"
  ).bind(ipHash, now - RATE_LIMIT_WINDOW_MS).first<{ count: number }>();

  if ((recent?.count || 0) >= RATE_LIMIT_MAX) {
    return json({ error: "Too many danmaku" }, 429, request, env);
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

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  } catch {
    return {};
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
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = (env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || "*")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const allowAll = allowedOrigins.includes("*");
  const fallbackOrigin = allowedOrigins[0] || "*";
  headers.set("Access-Control-Allow-Origin", allowAll ? "*" : (origin && allowedOrigins.includes(origin) ? origin : fallbackOrigin));
  headers.set("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  return headers;
}

function json(
  payload: unknown,
  status: number,
  request: Request,
  env: Env,
  options: {
    cacheControl?: string;
  } = {}
): Response {
  const headers = corsHeaders(request, env);
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("Cache-Control", options.cacheControl || "no-store");
  return new Response(JSON.stringify(payload), { status, headers });
}
