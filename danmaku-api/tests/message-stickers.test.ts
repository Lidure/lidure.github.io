import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createSession, sessionCookie } from '../src/auth';
import { hashAuthorToken } from '../src/message-board';
import { handleMessageStickerRequest, type MessageStickerEnv } from '../src/message-stickers';

const migration = readFileSync(new URL('../migrations/0009_message_stickers.sql', import.meta.url), 'utf8');
const OWNER_TOKEN = 'owner-token-123456789012345678901234';
const FOREIGN_TOKEN = 'foreign-token-1234567890123456789012';

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

function makeEnv(overrides: Partial<MessageStickerEnv> = {}): MessageStickerEnv {
  return {
    DB: makeDb(() => makeBoundStatement()),
    ALLOWED_ORIGINS: 'https://example.com',
    ...overrides,
  };
}

function stickerRequest(method: string, body?: Record<string, unknown>, headers: HeadersInit = {}) {
  return new Request('https://example.test/api/message-stickers', {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

async function callSticker(request: Request, env: MessageStickerEnv) {
  return handleMessageStickerRequest(request, new URL(request.url), env);
}

describe('public message sticker schema', () => {
  it('stores ownership, position, timestamps, and a private creation-network hash', () => {
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS message_stickers/);
    for (const column of ['sticker_key', 'pos_x', 'pos_y', 'rotation', 'owner_token_hash', 'creator_ip_hash', 'created_at', 'updated_at']) {
      expect(migration).toMatch(new RegExp(column));
    }
    expect(migration).toMatch(/idx_message_stickers_owner/);
    expect(migration).toMatch(/idx_message_stickers_updated/);
  });
});

describe('public message sticker list contract', () => {
  it('lists public stickers without exposing ownership hashes', async () => {
    const request = stickerRequest('GET', undefined, { 'X-Message-Sticker-Owner': OWNER_TOKEN });
    const response = await callSticker(request, makeEnv());

    expect(response?.status).toBe(200);
    const body = await response!.json() as any;
    expect(body.items).toEqual([]);
    expect(body.ownedIds).toEqual([]);
    expect(body.ownedCount).toBe(0);
    expect(JSON.stringify(body)).not.toContain('owner_token_hash');
    expect(JSON.stringify(body)).not.toContain('creator_ip_hash');
  });
});

describe('public message sticker create contract', () => {
  it('rejects unknown sticker keys with STICKER_INVALID_KEY', async () => {
    const response = await callSticker(stickerRequest('POST', {
      stickerKey: 'not-approved', ownerToken: OWNER_TOKEN, posX: 100, posY: 200,
    }), makeEnv());
    expect(response?.status).toBe(400);
    await expect(response!.json()).resolves.toMatchObject({ code: 'STICKER_INVALID_KEY' });
  });

  it('rejects a sixth sticker for the same browser token', async () => {
    const db = makeDb((sql) => {
      if (sql.includes('creator_ip_hash') && sql.includes('COUNT(*)')) {
        return makeBoundStatement({ first: vi.fn().mockResolvedValue({ count: 0 }) });
      }
      if (sql.includes('owner_token_hash') && sql.includes('COUNT(*)')) {
        return makeBoundStatement({ first: vi.fn().mockResolvedValue({ count: 5 }) });
      }
      return makeBoundStatement();
    });
    const response = await callSticker(stickerRequest('POST', {
      stickerKey: 'hello-kitty-01', ownerToken: OWNER_TOKEN, posX: 100, posY: 200,
    }), makeEnv({ DB: db }));
    expect(response?.status).toBe(409);
    await expect(response!.json()).resolves.toMatchObject({ code: 'STICKER_LIMIT_REACHED' });
  });

  it('clamps sticker coordinates using the approved footprint', async () => {
    const writes: unknown[][] = [];
    const db = makeDb((sql, args) => {
      if (sql.includes('COUNT(*)')) return makeBoundStatement({ first: vi.fn().mockResolvedValue({ count: 0 }) });
      if (sql.startsWith('INSERT INTO message_stickers')) {
        writes.push(args);
        return makeBoundStatement();
      }
      return makeBoundStatement();
    });
    const response = await callSticker(stickerRequest('POST', {
      stickerKey: 'hello-kitty-01', ownerToken: OWNER_TOKEN, posX: 99999, posY: -30,
    }, { 'CF-Connecting-IP': '203.0.113.10', 'User-Agent': 'vitest' }), makeEnv({ DB: db }));
    expect(response?.status).toBe(201);
    const body = await response!.json() as any;
    expect(body.item).toMatchObject({ stickerKey: 'hello-kitty-01', x: 1112, y: 0 });
    expect(writes).toHaveLength(1);
  });

  it('never persists or returns the raw owner token', async () => {
    const writes: unknown[][] = [];
    const db = makeDb((sql, args) => {
      if (sql.includes('COUNT(*)')) return makeBoundStatement({ first: vi.fn().mockResolvedValue({ count: 0 }) });
      if (sql.startsWith('INSERT INTO message_stickers')) writes.push(args);
      return makeBoundStatement();
    });
    const response = await callSticker(stickerRequest('POST', {
      stickerKey: 'cinnamoroll-01', ownerToken: OWNER_TOKEN, posX: 300, posY: 240,
    }), makeEnv({ DB: db }));
    const body = await response!.json() as any;
    expect(response?.status).toBe(201);
    expect(JSON.stringify(writes)).not.toContain(OWNER_TOKEN);
    expect(JSON.stringify(body)).not.toContain(OWNER_TOKEN);
  });
});

describe('public message sticker ownership mutations', () => {
  it('lets the owner move a sticker and rejects a foreign token', async () => {
    const ownerHash = await hashAuthorToken(OWNER_TOKEN);
    const row = {
      id: 's1', sticker_key: 'kuromi-01', pos_x: 50, pos_y: 60, rotation: 2,
      owner_token_hash: ownerHash, creator_ip_hash: 'ip', created_at: 1000, updated_at: 1000,
    };
    const db = makeDb((sql) => {
      if (sql.includes('FROM message_stickers WHERE id = ?')) {
        return makeBoundStatement({ first: vi.fn().mockResolvedValue(row) });
      }
      return makeBoundStatement();
    });
    const env = makeEnv({ DB: db });

    const denied = await callSticker(stickerRequest('PATCH', {
      id: 's1', ownerToken: FOREIGN_TOKEN, posX: 210, posY: 220,
    }), env);
    expect(denied?.status).toBe(403);
    await expect(denied!.json()).resolves.toMatchObject({ code: 'STICKER_FORBIDDEN' });

    const allowed = await callSticker(stickerRequest('PATCH', {
      id: 's1', ownerToken: OWNER_TOKEN, posX: 210, posY: 220,
    }), env);
    expect(allowed?.status).toBe(200);
    await expect(allowed!.json()).resolves.toMatchObject({ item: { id: 's1', x: 210, y: 220 } });
  });

  it('lets an authenticated admin move and delete a foreign sticker', async () => {
    const secret = 'sticker-admin-secret';
    const cookie = sessionCookie(await createSession(secret));
    const row = {
      id: 's-admin', sticker_key: 'my-melody-01', pos_x: 40, pos_y: 50, rotation: -2,
      owner_token_hash: await hashAuthorToken(FOREIGN_TOKEN), creator_ip_hash: 'ip', created_at: 1000, updated_at: 1000,
    };
    const db = makeDb((sql) => sql.includes('FROM message_stickers WHERE id = ?')
      ? makeBoundStatement({ first: vi.fn().mockResolvedValue(row) })
      : makeBoundStatement());
    const env = makeEnv({ DB: db, SESSION_SECRET: secret });

    const moved = await callSticker(stickerRequest('PATCH', {
      id: 's-admin', posX: 400, posY: 410,
    }, { Cookie: cookie }), env);
    expect(moved?.status).toBe(200);

    const deleted = await callSticker(stickerRequest('DELETE', { id: 's-admin' }, { Cookie: cookie }), env);
    expect(deleted?.status).toBe(200);
    await expect(deleted!.json()).resolves.toEqual({ deleted: true });
  });

  it('releases a quota slot after the owner deletes a sticker', async () => {
    const ownerHash = await hashAuthorToken(OWNER_TOKEN);
    let activeCount = 5;
    const row = {
      id: 's-owned', sticker_key: 'pochacco-01', pos_x: 40, pos_y: 50, rotation: 0,
      owner_token_hash: ownerHash, creator_ip_hash: 'ip', created_at: 1000, updated_at: 1000,
    };
    const db = makeDb((sql) => {
      if (sql.includes('creator_ip_hash') && sql.includes('COUNT(*)')) {
        return makeBoundStatement({ first: vi.fn().mockResolvedValue({ count: 0 }) });
      }
      if (sql.includes('owner_token_hash') && sql.includes('COUNT(*)')) {
        return makeBoundStatement({ first: vi.fn().mockImplementation(async () => ({ count: activeCount })) });
      }
      if (sql.includes('FROM message_stickers WHERE id = ?')) {
        return makeBoundStatement({ first: vi.fn().mockResolvedValue(row) });
      }
      if (sql.startsWith('DELETE FROM message_stickers')) {
        return makeBoundStatement({ run: vi.fn().mockImplementation(async () => { activeCount -= 1; return {}; }) });
      }
      if (sql.startsWith('INSERT INTO message_stickers')) {
        return makeBoundStatement({ run: vi.fn().mockImplementation(async () => { activeCount += 1; return {}; }) });
      }
      return makeBoundStatement();
    });
    const env = makeEnv({ DB: db });

    const deleted = await callSticker(stickerRequest('DELETE', { id: 's-owned', ownerToken: OWNER_TOKEN }), env);
    expect(deleted?.status).toBe(200);
    expect(activeCount).toBe(4);

    const created = await callSticker(stickerRequest('POST', {
      stickerKey: 'keroppi-01', ownerToken: OWNER_TOKEN, posX: 100, posY: 100,
    }), env);
    expect(created?.status).toBe(201);
    expect(activeCount).toBe(5);
  });
});

describe('public message sticker creation throttling', () => {
  it('rate-limits rapid creates without blocking GET or owner PATCH', async () => {
    const ownerHash = await hashAuthorToken(OWNER_TOKEN);
    const row = {
      id: 's-rate', sticker_key: 'pompompurin-01', pos_x: 10, pos_y: 20, rotation: 0,
      owner_token_hash: ownerHash, creator_ip_hash: 'ip', created_at: 1000, updated_at: 1000,
    };
    const db = makeDb((sql) => {
      if (sql.includes('creator_ip_hash') && sql.includes('COUNT(*)')) {
        return makeBoundStatement({ first: vi.fn().mockResolvedValue({ count: 8 }) });
      }
      if (sql.includes('owner_token_hash') && sql.includes('COUNT(*)')) {
        return makeBoundStatement({ first: vi.fn().mockResolvedValue({ count: 1 }) });
      }
      if (sql.includes('FROM message_stickers WHERE id = ?')) {
        return makeBoundStatement({ first: vi.fn().mockResolvedValue(row) });
      }
      if (sql.includes('FROM message_stickers ORDER BY')) {
        return makeBoundStatement({ all: vi.fn().mockResolvedValue({ results: [row] }) });
      }
      return makeBoundStatement();
    });
    const env = makeEnv({ DB: db });

    const create = await callSticker(stickerRequest('POST', {
      stickerKey: 'pompompurin-01', ownerToken: OWNER_TOKEN, posX: 50, posY: 60,
    }), env);
    expect(create?.status).toBe(429);
    await expect(create!.json()).resolves.toMatchObject({ code: 'STICKER_RATE_LIMITED' });

    const list = await callSticker(stickerRequest('GET', undefined, { 'X-Message-Sticker-Owner': OWNER_TOKEN }), env);
    expect(list?.status).toBe(200);

    const patch = await callSticker(stickerRequest('PATCH', {
      id: 's-rate', ownerToken: OWNER_TOKEN, posX: 80, posY: 90,
    }), env);
    expect(patch?.status).toBe(200);
  });
});
