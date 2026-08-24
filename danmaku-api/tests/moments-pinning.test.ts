import { describe, expect, it, vi } from "vitest";

import { createSession, sessionCookie } from "../src/auth";
import worker from "../src/index";
import { listMoments, setMomentPinned } from "../src/moments";

type BoundStatement = {
  all: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  sql?: string;
  args?: unknown[];
};

function statement(overrides: Partial<BoundStatement> = {}): BoundStatement {
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
          return { sql, args, ...handler(sql, args) };
        },
      };
    },
    async batch(statements: BoundStatement[]) {
      const values: unknown[] = [];
      for (const item of statements) values.push(await item.run());
      return values;
    },
  } as unknown as D1Database;
}

function row(id: string, date: string, pinned = 0, pinnedAt: number | null = null) {
  return {
    id,
    date,
    category: "生活",
    text: id,
    link: null,
    created_at: `${date.slice(0, 10)}T00:00:00.000Z`,
    updated_at: `${date.slice(0, 10)}T00:00:00.000Z`,
    legacy_images: null,
    pinned,
    pinned_at: pinnedAt,
    media_id: null,
    media_kind: null,
    media_url: null,
    media_sort_order: null,
  };
}

describe("pinned moments list", () => {
  it("prepends pins and fills the remaining first-page slots with newest unpinned moments", async () => {
    const db = makeDb((sql, args) => {
      if (sql.includes("pinned = 1")) {
        expect(args.at(-1)).toBe(3);
        return statement({ all: vi.fn().mockResolvedValue({ results: [row("pin-new", "2026-08-20", 1, 3000), row("pin-old", "2026-08-10", 1, 2000)] }) });
      }
      if (sql.includes("pinned = 0")) {
        expect(args.at(-1)).toBe(2);
        return statement({ all: vi.fn().mockResolvedValue({ results: [row("normal-new", "2026-08-24"), row("normal-extra", "2026-08-23")] }) });
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    });

    const result = await listMoments(db, 3);
    expect(result.items.map((item) => item.id)).toEqual(["pin-new", "pin-old", "normal-new"]);
    expect(result.items[0]).toMatchObject({ pinned: true, pinnedAt: 3000 });
    expect(result.nextCursor).toBe("2026-08-24|normal-new");
  });

  it("uses only the unpinned stream after a cursor", async () => {
    const calls: string[] = [];
    const db = makeDb((sql) => {
      calls.push(sql);
      if (!sql.includes("pinned = 0")) throw new Error("cursor query must exclude pins");
      return statement({ all: vi.fn().mockResolvedValue({ results: [row("normal-2", "2026-08-22")] }) });
    });

    const result = await listMoments(db, 2, "2026-08-23|normal-3");
    expect(calls).toHaveLength(1);
    expect(result.items.map((item) => item.id)).toEqual(["normal-2"]);
    expect(result.nextCursor).toBeNull();
  });
});

describe("setMomentPinned", () => {
  it("re-pinning an already pinned moment is a strict no-op", async () => {
    const writes: string[] = [];
    const db = makeDb((sql) => {
      if (sql.startsWith("SELECT pinned")) return statement({ first: vi.fn().mockResolvedValue({ pinned: 1, pinned_at: 3000 }) });
      if (sql.includes("SELECT m.id")) return statement({ all: vi.fn().mockResolvedValue({ results: [row("pin", "2026-08-20", 1, 3000)] }) });
      if (sql.startsWith("UPDATE")) writes.push(sql);
      return statement();
    });

    const result = await setMomentPinned(db, "pin", true, { now: () => 5000 });
    expect(writes).toEqual([]);
    expect(result).toEqual({ item: expect.objectContaining({ id: "pin", pinned: true, pinnedAt: 3000 }) });
  });

  it("pinning a fourth moment unpins the oldest and pins the target in one batch", async () => {
    const batches: Array<Array<{ sql: string; args: unknown[] }>> = [];
    const db = {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            if (sql.startsWith("SELECT pinned")) return { sql, args, ...statement({ first: vi.fn().mockResolvedValue({ pinned: 0, pinned_at: null }) }) };
            if (sql.startsWith("SELECT id, pinned_at")) return { sql, args, ...statement({ all: vi.fn().mockResolvedValue({ results: [{ id: "oldest", pinned_at: 1000 }, { id: "middle", pinned_at: 2000 }, { id: "newest", pinned_at: 3000 }] }) }) };
            if (sql.includes("SELECT m.id")) return { sql, args, ...statement({ all: vi.fn().mockResolvedValue({ results: [row("target", "2026-08-24", 1, 5000)] }) }) };
            return { sql, args, ...statement() };
          },
        };
      },
      async batch(items: BoundStatement[]) {
        batches.push(items.map((item) => ({ sql: item.sql ?? "", args: item.args ?? [] })));
        return Promise.all(items.map((item) => item.run()));
      },
    } as unknown as D1Database;

    const result = await setMomentPinned(db, "target", true, { now: () => 5000 });
    expect(batches).toHaveLength(1);
    expect(batches[0][0].sql).toContain("UPDATE moments SET pinned = 0");
    expect(batches[0][0].args).toContain("oldest");
    expect(batches[0][1].sql).toContain("UPDATE moments SET pinned = 1");
    expect(batches[0][1].args).toContain("target");
    expect(result.displacedId).toBe("oldest");
  });

  it("unpinning clears both pin fields", async () => {
    const writes: Array<{ sql: string; args: unknown[] }> = [];
    const db = makeDb((sql, args) => {
      if (sql.startsWith("SELECT pinned")) return statement({ first: vi.fn().mockResolvedValue({ pinned: 1, pinned_at: 3000 }) });
      if (sql.includes("SELECT m.id")) return statement({ all: vi.fn().mockResolvedValue({ results: [row("pin", "2026-08-20", 0, null)] }) });
      if (sql.startsWith("UPDATE")) writes.push({ sql, args });
      return statement();
    });

    const result = await setMomentPinned(db, "pin", false);
    expect(writes[0].sql).toContain("pinned_at = NULL");
    expect(writes[0].args).toContain("pin");
    expect(result.item.pinned).not.toBe(true);
  });
});

describe("PATCH /api/moments/:id/pin", () => {
  const env = (db: D1Database) => ({
    DB: db,
    ALLOWED_ORIGINS: "https://lidure22.xyz",
    SESSION_SECRET: "test-session-secret",
  }) as Parameters<typeof worker.fetch>[1];

  it("requires an admin session", async () => {
    const response = await worker.fetch(new Request("https://api.lidure22.xyz/api/moments/x/pin", {
      method: "PATCH",
      headers: { Origin: "https://lidure22.xyz", "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: true }),
    }), env(makeDb(() => statement())));
    expect(response.status).toBe(401);
  });

  it("rejects non-boolean pinned values after authentication", async () => {
    const cookie = sessionCookie(await createSession("test-session-secret", Date.now()));
    const response = await worker.fetch(new Request("https://api.lidure22.xyz/api/moments/x/pin", {
      method: "PATCH",
      headers: { Origin: "https://lidure22.xyz", Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: "yes" }),
    }), env(makeDb(() => statement())));
    expect(response.status).toBe(400);
  });
});
