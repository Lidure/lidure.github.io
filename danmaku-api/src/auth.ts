const SESSION_COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_MAX_AGE_SECONDS = SESSION_MAX_AGE_MS / 1000;
const PASSWORD_PREFIX = "pbkdf2";
const PASSWORD_HASH = "sha256";
const PASSWORD_ITERATIONS = 310000;
const PASSWORD_KEY_LENGTH = 32;

const textEncoder = new TextEncoder();

type SessionPayload = {
  exp: number;
};

export type SessionCheckResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; reason: "missing" | "invalid" | "expired" };

export async function verifyPassword(password: string, encodedHash: string): Promise<boolean> {
  const parsed = parsePasswordHash(encodedHash);
  if (!parsed) {
    return false;
  }

  const passwordKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: parsed.salt,
      iterations: parsed.iterations,
      hash: "SHA-256",
    },
    passwordKey,
    parsed.hash.byteLength * 8
  );

  return constantTimeEqual(new Uint8Array(derivedBits), parsed.hash);
}

export async function createSession(secret: string, nowMs: number = Date.now()): Promise<string> {
  const payload: SessionPayload = {
    exp: nowMs + SESSION_MAX_AGE_MS,
  };
  const encodedPayload = encodeBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = await signValue(secret, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifySession(
  cookieValue: string,
  secret: string,
  nowMs: number = Date.now()
): Promise<SessionPayload | null> {
  const parsed = await verifySessionValue(cookieValue, secret);
  if (!parsed || parsed.exp <= nowMs) {
    return null;
  }

  return parsed;
}

export async function readSession(
  request: Request,
  secret: string,
  nowMs: number = Date.now()
): Promise<SessionCheckResult> {
  const cookieValue = getSessionCookieValue(request);
  if (!cookieValue) {
    return { ok: false, reason: "missing" };
  }

  const payload = await verifySessionValue(cookieValue, secret);
  if (!payload) {
    return { ok: false, reason: "invalid" };
  }

  if (payload.exp <= nowMs) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, session: payload };
}

export function getSessionCookieValue(request: Request): string | null {
  return parseCookieHeader(request.headers.get("Cookie")).get(SESSION_COOKIE_NAME) ?? null;
}

export function sessionCookie(
  value: string,
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS
): string {
  return `${SESSION_COOKIE_NAME}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie(): string {
  return sessionCookie("", 0);
}

async function verifySessionValue(cookieValue: string, secret: string): Promise<SessionPayload | null> {
  const parts = cookieValue.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const [encodedPayload, encodedSignature] = parts;
  const expectedSignature = await signValue(secret, encodedPayload);
  if (!constantTimeEqual(decodeBase64Url(encodedSignature), decodeBase64Url(expectedSignature))) {
    return null;
  }

  try {
    const payload = JSON.parse(textDecoder().decode(decodeBase64Url(encodedPayload))) as SessionPayload;
    if (!payload || typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return null;
    }

    return { exp: payload.exp };
  } catch {
    return null;
  }
}

async function signValue(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(value));
  return encodeBase64Url(new Uint8Array(signature));
}

function parsePasswordHash(
  encodedHash: string
): { iterations: number; salt: Uint8Array; hash: Uint8Array } | null {
  const parts = encodedHash.split("$");
  if (parts.length !== 5) {
    return null;
  }

  const [prefix, hashName, iterationsRaw, saltRaw, hashRaw] = parts;

  if (
    prefix !== PASSWORD_PREFIX ||
    hashName !== PASSWORD_HASH ||
    iterationsRaw !== String(PASSWORD_ITERATIONS)
  ) {
    return null;
  }

  const salt = decodeCanonicalBase64Url(saltRaw);
  const hash = decodeCanonicalBase64Url(hashRaw);
  if (!salt || !hash) {
    return null;
  }

  if (hash.byteLength !== PASSWORD_KEY_LENGTH || salt.byteLength === 0) {
    return null;
  }

  return { iterations: PASSWORD_ITERATIONS, salt, hash };
}

function parseCookieHeader(header: string | null): Map<string, string> {
  const pairs = new Map<string, string>();
  if (!header) {
    return pairs;
  }

  for (const part of header.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    if (key) {
      pairs.set(key, value);
    }
  }

  return pairs;
}

function encodeBase64Url(value: Uint8Array): string {
  const binary = Array.from(value, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return new Uint8Array();
  }
}

function decodeCanonicalBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) {
    return null;
  }

  const decoded = decodeBase64Url(value);
  if (encodeBase64Url(decoded) !== value) {
    return null;
  }

  return decoded;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength || left.byteLength === 0) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    diff |= left[index] ^ right[index];
  }

  return diff === 0;
}

function textDecoder(): TextDecoder {
  return new TextDecoder();
}
