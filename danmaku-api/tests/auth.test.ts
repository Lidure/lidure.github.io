import { pbkdf2Sync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import worker from "../src/index";
import {
  clearSessionCookie,
  createSession,
  sessionCookie,
  verifyPassword,
  verifySession,
} from "../src/auth";

type BoundStatement = {
  all: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  sql?: string;
  args?: unknown[];
};

function makeBoundStatement(overrides: Partial<BoundStatement> = {}): BoundStatement {
  return {
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({}),
    ...overrides,
  };
}

function makeDb(handler: (sql: string, args: unknown[]) => BoundStatement): D1Database {
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            sql,
            args,
            ...handler(sql, args),
          };
        },
      };
    },
    async batch(statements: BoundStatement[]) {
      const results: unknown[] = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    },
  } as unknown as D1Database;
}

function makePasswordHash(password: string): string {
  const salt = Buffer.from("auth-test-salt-1");
  const hash = pbkdf2Sync(password, salt, 310000, 32, "sha256");
  return `pbkdf2$sha256$310000$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function makePasswordHashWithSalt(password: string, salt: Buffer, encodedSalt: string): string {
  const hash = pbkdf2Sync(password, salt, 310000, 32, "sha256");
  return `pbkdf2$sha256$310000$${encodedSalt}$${hash.toString("base64url")}`;
}

function validMomentInput() {
  return {
    date: "2026-08-12T09:30",
    category: "生活",
    text: "Added auth-protected publishing",
    media: [
      {
        kind: "image",
        url: "https://media.lidure.xyz/moments/2026/08/44444444-4444-4444-8444-444444444444.png",
      },
    ],
  };
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    DB: makeDb(() => makeBoundStatement()),
    ALLOWED_ORIGINS:
      "https://lidure.xyz,https://www.lidure.xyz,http://localhost:4321,http://127.0.0.1:4321",
    PUBLIC_MEDIA_BASE_URL: "https://media.lidure.xyz",
    ADMIN_PASSWORD_HASH: makePasswordHash("correct horse"),
    SESSION_SECRET: "test-session-secret",
    ...overrides,
  };
}

describe("auth helpers", () => {
  it("verifies a matching PBKDF2 password hash", async () => {
    await expect(verifyPassword("correct horse", makePasswordHash("correct horse"))).resolves.toBe(
      true
    );
  });

  it("rejects the wrong password for a PBKDF2 hash", async () => {
    await expect(verifyPassword("wrong", makePasswordHash("correct horse"))).resolves.toBe(false);
  });

  it.each([
    ["wrong part count", "pbkdf2$sha256$310000$only-salt"],
    ["wrong prefix", makePasswordHash("correct horse").replace("pbkdf2", "argon2")],
    ["wrong hash name", makePasswordHash("correct horse").replace("sha256", "sha512")],
    ["iteration suffix", makePasswordHash("correct horse").replace("$310000$", "$310000abc$")],
    ["fractional iterations", makePasswordHash("correct horse").replace("$310000$", "$310000.5$")],
    [
      "standard base64 salt",
      makePasswordHashWithSalt(
        "correct horse",
        Buffer.from([251, 252, 253, 254, 255, 1, 2, 3]),
        Buffer.from([251, 252, 253, 254, 255, 1, 2, 3]).toString("base64").replace(/=+$/g, "")
      ),
    ],
    ["empty salt", makePasswordHash("correct horse").replace(/\$[^$]+\$[^$]+$/, "$$hash")],
    ["wrong hash length", makePasswordHash("correct horse").replace(/\$[^$]+$/, "$c2hvcnQ")],
  ])("rejects malformed PBKDF2 hashes with %s", async (_caseName, encodedHash) => {
    await expect(verifyPassword("correct horse", encodedHash)).resolves.toBe(false);
  });

  it("round-trips and expires signed sessions", async () => {
    const createdAt = Date.UTC(2026, 7, 12, 1, 0, 0);
    const cookieValue = await createSession("test-session-secret", createdAt);

    await expect(verifySession(cookieValue, "test-session-secret", createdAt + 1_000)).resolves.toEqual({
      exp: createdAt + 604_800_000,
    });

    await expect(
      verifySession(cookieValue, "test-session-secret", createdAt + 604_800_000 + 1)
    ).resolves.toBeNull();
  });

  it("rejects tampered signed sessions and emits secure cookie helpers", async () => {
    const cookieValue = await createSession("test-session-secret", Date.UTC(2026, 7, 12, 1, 0, 0));
    const tampered =
      cookieValue.slice(0, -1) + (cookieValue.endsWith("A") ? "B" : "A");

    await expect(verifySession(tampered, "test-session-secret")).resolves.toBeNull();
    expect(sessionCookie(cookieValue)).toContain("HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800");
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });
});

describe("auth worker routes", () => {
  it("logs in with an allowed origin, enables credentialed CORS, and sets the session cookie", async () => {
    const response = await worker.fetch(
      new Request("https://api.lidure.xyz/api/auth/login", {
        method: "POST",
        headers: {
          Origin: "https://lidure.xyz",
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({ password: "correct horse" }),
      }),
      makeEnv() as Parameters<typeof worker.fetch>[1]
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://lidure.xyz");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Set-Cookie")).toContain(
      "HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800"
    );
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      exp: expect.any(Number),
    });
  });

  it("returns AUTH_INVALID for an incorrect password", async () => {
    const response = await worker.fetch(
      new Request("https://api.lidure.xyz/api/auth/login", {
        method: "POST",
        headers: {
          Origin: "https://lidure.xyz",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password: "wrong" }),
      }),
      makeEnv() as Parameters<typeof worker.fetch>[1]
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Login failed, please check the password.",
      code: "AUTH_INVALID",
    });
  });

  it("returns BAD_JSON for malformed auth JSON", async () => {
    const response = await worker.fetch(
      new Request("https://api.lidure.xyz/api/auth/login", {
        method: "POST",
        headers: {
          Origin: "https://lidure.xyz",
          "Content-Type": "application/json",
        },
        body: "{",
      }),
      makeEnv() as Parameters<typeof worker.fetch>[1]
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Request body must be valid JSON.",
      code: "BAD_JSON",
    });
  });

  it("returns AUTH_REQUIRED when no session cookie is present", async () => {
    const response = await worker.fetch(
      new Request("https://api.lidure.xyz/api/auth/session", {
        method: "GET",
        headers: { Origin: "https://lidure.xyz" },
      }),
      makeEnv() as Parameters<typeof worker.fetch>[1]
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required.",
      code: "AUTH_REQUIRED",
    });
  });

  it("returns AUTH_EXPIRED and clears the cookie for an expired session", async () => {
    const startedAt = Date.UTC(2026, 7, 1, 0, 0, 0);
    const cookieValue = await createSession("test-session-secret", startedAt);
    const nowSpy = vi.spyOn(Date, "now").mockReturnValue(startedAt + 604_800_000 + 1);

    try {
      const response = await worker.fetch(
        new Request("https://api.lidure.xyz/api/auth/session", {
          method: "GET",
          headers: {
            Origin: "https://lidure.xyz",
            Cookie: sessionCookie(cookieValue),
          },
        }),
        makeEnv() as Parameters<typeof worker.fetch>[1]
      );

      expect(response.status).toBe(401);
      expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0");
      await expect(response.json()).resolves.toEqual({
        error: "Session expired. Please log in again.",
        code: "AUTH_EXPIRED",
      });
    } finally {
      nowSpy.mockRestore();
    }
  });

  it("creates a moment once a valid session cookie is present", async () => {
    const insertStatements: Array<{ sql: string; args: unknown[] }> = [];
    const db = makeDb((sql, args) => {
      if (sql.startsWith("INSERT INTO moments") || sql.startsWith("INSERT INTO moment_media")) {
        insertStatements.push({ sql, args });
        return makeBoundStatement({
          run: vi.fn().mockResolvedValue({}),
        });
      }

      if (sql.includes("SELECT m.id")) {
        return makeBoundStatement({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: "moment-created",
                date: "2026-08-12T09:30",
                category: "生活",
                text: "Added auth-protected publishing",
                link: null,
                created_at: "2026-08-12T09:30:00.000Z",
                updated_at: "2026-08-12T09:30:00.000Z",
                media_id: "media-created",
                media_kind: "image",
                media_url: "https://media.lidure.xyz/moments/2026/08/44444444-4444-4444-8444-444444444444.png",
                media_sort_order: 0,
              },
            ],
          }),
        });
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const cookieValue = await createSession("test-session-secret", Date.UTC(2026, 7, 12, 1, 0, 0));
    const response = await worker.fetch(
      new Request("https://api.lidure.xyz/api/moments", {
        method: "POST",
        headers: {
          Origin: "https://lidure.xyz",
          Cookie: sessionCookie(cookieValue),
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(validMomentInput()),
      }),
      makeEnv({ DB: db }) as Parameters<typeof worker.fetch>[1]
    );

    expect(response.status).toBe(201);
    expect(insertStatements).toHaveLength(2);
    await expect(response.json()).resolves.toEqual({
      item: {
        id: "moment-created",
        date: "2026-08-12T09:30",
        category: "生活",
        text: "Added auth-protected publishing",
        images: [
          "https://media.lidure.xyz/moments/2026/08/44444444-4444-4444-8444-444444444444.png",
        ],
        media: [
          {
            kind: "image",
            url: "https://media.lidure.xyz/moments/2026/08/44444444-4444-4444-8444-444444444444.png",
          },
        ],
      },
    });
  });

  it("deletes a moment once a valid session cookie is present", async () => {
    const runCalls: Array<{ sql: string; args: unknown[] }> = [];
    const db = makeDb((sql, args) => {
      if (sql.startsWith("DELETE FROM moment_media") || sql.startsWith("DELETE FROM moments")) {
        runCalls.push({ sql, args });
        return makeBoundStatement();
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });
    const cookieValue = await createSession("test-session-secret", Date.UTC(2026, 7, 12, 1, 0, 0));

    const response = await worker.fetch(
      new Request("https://api.lidure.xyz/api/moments/moment-1", {
        method: "DELETE",
        headers: {
          Origin: "https://lidure.xyz",
          Cookie: sessionCookie(cookieValue),
        },
      }),
      makeEnv({ DB: db }) as Parameters<typeof worker.fetch>[1]
    );

    expect(response.status).toBe(204);
    expect(runCalls).toEqual([
      { sql: "DELETE FROM moment_media WHERE moment_id = ?", args: ["moment-1"] },
      { sql: "DELETE FROM moments WHERE id = ?", args: ["moment-1"] },
    ]);
  });
});
