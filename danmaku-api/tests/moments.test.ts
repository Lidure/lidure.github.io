import { describe, expect, it, vi } from "vitest";

import worker from "../src/index";
import {
  createMoment,
  deleteMoment,
  listMoments,
  normalizeMomentInput,
  type CreateMomentInput,
} from "../src/moments";

type BoundStatement = {
  all: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
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
          return handler(sql, args);
        },
      };
    },
  } as unknown as D1Database;
}

function validMomentInput(overrides: Partial<CreateMomentInput> = {}): CreateMomentInput {
  return {
    date: "2026-06-18T10:08",
    category: "生活",
    text: "今天把 moments API 搭起来了。",
    link: "https://lidure.xyz/posts/cloudflare",
    media: [
      { kind: "image", url: "https://media.lidure.xyz/moments/a.png" },
      { kind: "video", url: "https://media.lidure.xyz/moments/a.mp4" },
      { kind: "poster", url: "https://media.lidure.xyz/moments/a-poster.jpg" },
    ],
    ...overrides,
  };
}

function makeEnv(overrides: Record<string, unknown> = {}) {
  return {
    DB: makeDb(() => makeBoundStatement()),
    MEDIA: {} as R2Bucket,
    ALLOWED_ORIGINS:
      "https://lidure.xyz,https://www.lidure.xyz,http://localhost:4321,http://127.0.0.1:4321",
    PUBLIC_MEDIA_BASE_URL: "https://media.lidure.xyz",
    SESSION_SECRET: "test-session-secret",
    ...overrides,
  };
}

describe("normalizeMomentInput", () => {
  it("returns normalized fields for a valid payload", () => {
    const result = normalizeMomentInput(validMomentInput(), {
      publicMediaBaseUrl: "https://media.lidure.xyz",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected normalized input");
    }

    expect(result.value).toEqual({
      date: "2026-06-18T10:08",
      category: "生活",
      text: "今天把 moments API 搭起来了。",
      link: "https://lidure.xyz/posts/cloudflare",
      media: [
        { kind: "image", url: "https://media.lidure.xyz/moments/a.png" },
        { kind: "video", url: "https://media.lidure.xyz/moments/a.mp4" },
        { kind: "poster", url: "https://media.lidure.xyz/moments/a-poster.jpg" },
      ],
    });
  });

  it("rejects empty text", () => {
    const result = normalizeMomentInput(validMomentInput({ text: "   " }), {
      publicMediaBaseUrl: "https://media.lidure.xyz",
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_TEXT", message: "Moment text is required" },
    });
  });

  it("rejects an unknown category", () => {
    const result = normalizeMomentInput(
      validMomentInput({ category: "学习" as CreateMomentInput["category"] }),
      { publicMediaBaseUrl: "https://media.lidure.xyz" }
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_CATEGORY", message: "Moment category is invalid" },
    });
  });

  it("rejects text longer than 2000 characters", () => {
    const result = normalizeMomentInput(validMomentInput({ text: "a".repeat(2001) }), {
      publicMediaBaseUrl: "https://media.lidure.xyz",
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "TEXT_TOO_LONG", message: "Moment text must be 2000 characters or fewer" },
    });
  });

  it("rejects an invalid link", () => {
    const result = normalizeMomentInput(validMomentInput({ link: "notaurl" }), {
      publicMediaBaseUrl: "https://media.lidure.xyz",
    });

    expect(result).toEqual({
      ok: false,
      error: { code: "INVALID_LINK", message: "Moment link must be a valid http(s) URL" },
    });
  });

  it("rejects more than 9 media items", () => {
    const result = normalizeMomentInput(
      validMomentInput({
        media: Array.from({ length: 10 }, (_, index) => ({
          kind: "image" as const,
          url: `https://media.lidure.xyz/moments/${index}.png`,
        })),
      }),
      { publicMediaBaseUrl: "https://media.lidure.xyz" }
    );

    expect(result).toEqual({
      ok: false,
      error: { code: "TOO_MANY_MEDIA", message: "Moment media must contain 9 items or fewer" },
    });
  });
});

describe("moments data access", () => {
  it("returns no nextCursor on the final page when there is no extra moment", async () => {
    const db = makeDb((sql, args) => {
      if (sql.includes("SELECT m.id")) {
        expect(args.at(-1)).toBe(3);

        return makeBoundStatement({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: "moment-2",
                date: "2026-06-18T10:08",
                category: "生活",
                text: "第二条",
                link: "https://lidure.xyz/two",
                created_at: "2026-06-18T10:08:00.000Z",
                updated_at: "2026-06-18T10:08:00.000Z",
                media_id: "media-1",
                media_kind: "image",
                media_url: "https://media.lidure.xyz/moments/2.png",
                media_sort_order: 0,
              },
              {
                id: "moment-2",
                date: "2026-06-18T10:08",
                category: "生活",
                text: "第二条",
                link: "https://lidure.xyz/two",
                created_at: "2026-06-18T10:08:00.000Z",
                updated_at: "2026-06-18T10:08:00.000Z",
                media_id: "media-2",
                media_kind: "poster",
                media_url: "https://media.lidure.xyz/moments/2-poster.jpg",
                media_sort_order: 1,
              },
              {
                id: "moment-1",
                date: "2026-06-17",
                category: "游戏",
                text: "第一条",
                link: null,
                created_at: "2026-06-17T09:00:00.000Z",
                updated_at: "2026-06-17T09:00:00.000Z",
                media_id: null,
                media_kind: null,
                media_url: null,
                media_sort_order: null,
              },
            ],
          }),
        });
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const result = await listMoments(db, 2);

    expect(result).toEqual({
      items: [
        {
          id: "moment-2",
          date: "2026-06-18T10:08",
          category: "生活",
          text: "第二条",
          link: "https://lidure.xyz/two",
          images: ["https://media.lidure.xyz/moments/2.png"],
          media: [
            { kind: "image", url: "https://media.lidure.xyz/moments/2.png" },
            { kind: "poster", url: "https://media.lidure.xyz/moments/2-poster.jpg" },
          ],
        },
        {
          id: "moment-1",
          date: "2026-06-17",
          category: "游戏",
          text: "第一条",
          images: [],
          media: [],
        },
      ],
      nextCursor: null,
    });
  });

  it("returns nextCursor only when an extra moment exists beyond the page limit", async () => {
    const db = makeDb((sql, args) => {
      if (sql.includes("SELECT m.id")) {
        expect(args.at(-1)).toBe(3);

        return makeBoundStatement({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: "moment-3",
                date: "2026-06-19",
                category: "生活",
                text: "第三条",
                link: null,
                created_at: "2026-06-19T09:00:00.000Z",
                updated_at: "2026-06-19T09:00:00.000Z",
                media_id: null,
                media_kind: null,
                media_url: null,
                media_sort_order: null,
              },
              {
                id: "moment-2",
                date: "2026-06-18T10:08",
                category: "生活",
                text: "第二条",
                link: "https://lidure.xyz/two",
                created_at: "2026-06-18T10:08:00.000Z",
                updated_at: "2026-06-18T10:08:00.000Z",
                media_id: "media-1",
                media_kind: "image",
                media_url: "https://media.lidure.xyz/moments/2.png",
                media_sort_order: 0,
              },
              {
                id: "moment-2",
                date: "2026-06-18T10:08",
                category: "生活",
                text: "第二条",
                link: "https://lidure.xyz/two",
                created_at: "2026-06-18T10:08:00.000Z",
                updated_at: "2026-06-18T10:08:00.000Z",
                media_id: "media-2",
                media_kind: "poster",
                media_url: "https://media.lidure.xyz/moments/2-poster.jpg",
                media_sort_order: 1,
              },
              {
                id: "moment-1",
                date: "2026-06-17",
                category: "游戏",
                text: "第一条",
                link: null,
                created_at: "2026-06-17T09:00:00.000Z",
                updated_at: "2026-06-17T09:00:00.000Z",
                media_id: null,
                media_kind: null,
                media_url: null,
                media_sort_order: null,
              },
            ],
          }),
        });
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const result = await listMoments(db, 2);

    expect(result).toEqual({
      items: [
        {
          id: "moment-3",
          date: "2026-06-19",
          category: "生活",
          text: "第三条",
          images: [],
          media: [],
        },
        {
          id: "moment-2",
          date: "2026-06-18T10:08",
          category: "生活",
          text: "第二条",
          link: "https://lidure.xyz/two",
          images: ["https://media.lidure.xyz/moments/2.png"],
          media: [
            { kind: "image", url: "https://media.lidure.xyz/moments/2.png" },
            { kind: "poster", url: "https://media.lidure.xyz/moments/2-poster.jpg" },
          ],
        },
      ],
      nextCursor: "2026-06-18T10:08|moment-2",
    });
  });

  it("creates a moment and writes ordered media records", async () => {
    const runCalls: Array<{ sql: string; args: unknown[] }> = [];
    const db = makeDb((sql, args) => {
      if (sql.startsWith("INSERT INTO moments")) {
        runCalls.push({ sql, args });
        return makeBoundStatement();
      }

      if (sql.startsWith("INSERT INTO moment_media")) {
        runCalls.push({ sql, args });
        return makeBoundStatement();
      }

      if (sql.includes("SELECT m.id")) {
        return makeBoundStatement({
          all: vi.fn().mockResolvedValue({
            results: [
              {
                id: args[0],
                date: "2026-06-18T10:08",
                category: "生活",
                text: "今天把 moments API 搭起来了。",
                link: "https://lidure.xyz/posts/cloudflare",
                created_at: "2026-06-18T10:08:00.000Z",
                updated_at: "2026-06-18T10:08:00.000Z",
                media_id: "media-a",
                media_kind: "image",
                media_url: "https://media.lidure.xyz/moments/a.png",
                media_sort_order: 0,
              },
              {
                id: args[0],
                date: "2026-06-18T10:08",
                category: "生活",
                text: "今天把 moments API 搭起来了。",
                link: "https://lidure.xyz/posts/cloudflare",
                created_at: "2026-06-18T10:08:00.000Z",
                updated_at: "2026-06-18T10:08:00.000Z",
                media_id: "media-b",
                media_kind: "video",
                media_url: "https://media.lidure.xyz/moments/a.mp4",
                media_sort_order: 1,
              },
            ],
          }),
        });
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const item = await createMoment(db, validMomentInput(), {
      publicMediaBaseUrl: "https://media.lidure.xyz",
      now: () => "2026-06-18T10:08:00.000Z",
      createId: (() => {
        let index = 0;
        const ids = ["moment-created", "media-a", "media-b", "media-c"];
        return () => ids[index++] ?? `generated-${index++}`;
      })(),
    });

    expect(runCalls).toHaveLength(4);
    expect(runCalls[0].sql).toContain("INSERT INTO moments");
    expect(runCalls[0].args).toEqual([
      "moment-created",
      "2026-06-18T10:08",
      "生活",
      "今天把 moments API 搭起来了。",
      "https://lidure.xyz/posts/cloudflare",
      "2026-06-18T10:08:00.000Z",
      "2026-06-18T10:08:00.000Z",
    ]);
    expect(runCalls[1].args.slice(1)).toEqual([
      "moment-created",
      "image",
      "https://media.lidure.xyz/moments/a.png",
      0,
      "2026-06-18T10:08:00.000Z",
    ]);
    expect(runCalls[2].args.slice(1)).toEqual([
      "moment-created",
      "video",
      "https://media.lidure.xyz/moments/a.mp4",
      1,
      "2026-06-18T10:08:00.000Z",
    ]);
    expect(runCalls[3].args.slice(1)).toEqual([
      "moment-created",
      "poster",
      "https://media.lidure.xyz/moments/a-poster.jpg",
      2,
      "2026-06-18T10:08:00.000Z",
    ]);
    expect(item).toEqual({
      id: "moment-created",
      date: "2026-06-18T10:08",
      category: "生活",
      text: "今天把 moments API 搭起来了。",
      link: "https://lidure.xyz/posts/cloudflare",
      images: ["https://media.lidure.xyz/moments/a.png"],
      media: [
        { kind: "image", url: "https://media.lidure.xyz/moments/a.png" },
        { kind: "video", url: "https://media.lidure.xyz/moments/a.mp4" },
      ],
    });
  });

  it("deletes a moment and its media rows", async () => {
    const runCalls: Array<{ sql: string; args: unknown[] }> = [];
    const db = makeDb((sql, args) => {
      if (sql.startsWith("DELETE FROM moment_media") || sql.startsWith("DELETE FROM moments")) {
        runCalls.push({ sql, args });
        return makeBoundStatement();
      }

      throw new Error(`Unexpected SQL: ${sql}`);
    });

    await deleteMoment(db, "moment-1");

    expect(runCalls).toEqual([
      { sql: "DELETE FROM moment_media WHERE moment_id = ?", args: ["moment-1"] },
      { sql: "DELETE FROM moments WHERE id = ?", args: ["moment-1"] },
    ]);
  });
});

describe("moments worker routes", () => {
  it("returns public list responses with cache headers", async () => {
    const env = makeEnv({
      DB: makeDb((sql) => {
        if (sql.includes("SELECT m.id")) {
          return makeBoundStatement({
            all: vi.fn().mockResolvedValue({
              results: [
                {
                  id: "moment-1",
                  date: "2026-06-18",
                  category: "生活",
                  text: "公开列表",
                  link: null,
                  created_at: "2026-06-18T00:00:00.000Z",
                  updated_at: "2026-06-18T00:00:00.000Z",
                  media_id: null,
                  media_kind: null,
                  media_url: null,
                  media_sort_order: null,
                },
              ],
            }),
          });
        }

        throw new Error(`Unexpected SQL: ${sql}`);
      }),
    });

    const response = await worker.fetch(
      new Request("https://api.lidure.xyz/api/moments?limit=1", {
        method: "GET",
        headers: { Origin: "https://lidure.xyz" },
      }),
      env as Parameters<typeof worker.fetch>[1]
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://lidure.xyz");
    expect(response.headers.get("Cache-Control")).toBe(
      "public, max-age=30, stale-while-revalidate=120"
    );
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: "moment-1",
          date: "2026-06-18",
          category: "生活",
          text: "公开列表",
          images: [],
          media: [],
        },
      ],
      nextCursor: null,
    });
  });

  it("requires a session for POST and does not mutate moments", async () => {
    const mutationSqlCalls: string[] = [];
    const env = makeEnv({
      DB: makeDb((sql) => {
        if (sql.startsWith("INSERT INTO moments") || sql.startsWith("INSERT INTO moment_media")) {
          mutationSqlCalls.push(sql);
        }

        return makeBoundStatement();
      }),
    });

    const response = await worker.fetch(
      new Request("https://api.lidure.xyz/api/moments", {
        method: "POST",
        headers: {
          Origin: "https://lidure.xyz",
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(validMomentInput()),
      }),
      env as Parameters<typeof worker.fetch>[1]
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mutationSqlCalls).toEqual([]);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required.",
      code: "AUTH_REQUIRED",
    });
  });

  it("requires a session for DELETE and does not mutate moments", async () => {
    const mutationSqlCalls: string[] = [];
    const env = makeEnv({
      DB: makeDb((sql) => {
        if (sql.startsWith("DELETE FROM moment_media") || sql.startsWith("DELETE FROM moments")) {
          mutationSqlCalls.push(sql);
        }

        return makeBoundStatement();
      }),
    });

    const response = await worker.fetch(
      new Request("https://api.lidure.xyz/api/moments/moment-1", {
        method: "DELETE",
        headers: { Origin: "https://lidure.xyz" },
      }),
      env as Parameters<typeof worker.fetch>[1]
    );

    expect(response.status).toBe(401);
    expect(mutationSqlCalls).toEqual([]);
    await expect(response.json()).resolves.toEqual({
      error: "Authentication required.",
      code: "AUTH_REQUIRED",
    });
  });
});
