import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import {
  MESSAGE_REACTION_EMOJIS,
  classifyMessageNoteSize,
  createAuthorToken,
  deriveLegacyNoteMeta,
  hashAuthorToken,
  verifyAuthorToken,
} from '../src/message-board';

const migration = readFileSync(new URL('../migrations/0008_sticky_message_board.sql', import.meta.url), 'utf8');
type FetchEnv = Parameters<typeof worker.fetch>[1];
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

function makeEnv(overrides: Partial<FetchEnv> = {}): FetchEnv {
  return {
    DB: makeDb(() => makeBoundStatement()),
    ALLOWED_ORIGINS: 'https://example.com',
    ...overrides,
  };
}

describe('sticky message board schema', () => {
  it('adds note metadata and one reaction per visitor/message', () => {
    for (const column of ['note_color', 'note_size', 'pos_x', 'pos_y', 'rotation', 'author_token_hash', 'updated_at']) {
      expect(migration).toMatch(new RegExp(`ALTER TABLE guest_messages ADD COLUMN ${column}`));
    }
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS message_reactions/);
    expect(migration).toMatch(/PRIMARY KEY \(message_id, ip_hash\)/);
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id/);
  });
});

describe('sticky message board domain helpers', () => {
  it('classifies notes into three bounded sizes', () => {
    expect(classifyMessageNoteSize('a'.repeat(64))).toBe('small');
    expect(classifyMessageNoteSize('a'.repeat(65))).toBe('medium');
    expect(classifyMessageNoteSize('a'.repeat(220))).toBe('medium');
    expect(classifyMessageNoteSize('a'.repeat(221))).toBe('large');
  });

  it('derives stable legacy metadata without granting ownership', () => {
    const first = deriveLegacyNoteMeta('legacy-id-1', '旧留言');
    const second = deriveLegacyNoteMeta('legacy-id-1', '旧留言');
    expect(second).toEqual(first);
    expect(first.rotation).toBeGreaterThanOrEqual(-4);
    expect(first.rotation).toBeLessThanOrEqual(4);
    expect(first.authorOwned).toBe(false);
  });

  it('creates a one-time token whose hash verifies without storing plaintext', async () => {
    const token = createAuthorToken();
    const hash = await hashAuthorToken(token);
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(hash).not.toContain(token);
    await expect(verifyAuthorToken(token, hash)).resolves.toBe(true);
    await expect(verifyAuthorToken(`${token}x`, hash)).resolves.toBe(false);
  });

  it('limits board quick reactions to the approved set', () => {
    expect(MESSAGE_REACTION_EMOJIS).toEqual(['❤️', '😂', '✨', '👍']);
  });
});

describe('sticky message API list contract', () => {
  it('keeps homepage fields and adds note metadata/cursors', async () => {
    const db = makeDb((sql) => sql.includes('FROM guest_messages')
      ? makeBoundStatement({ all: vi.fn().mockResolvedValue({ results: [{
          id: 'old-1', user_id: '旅人', text: '你好', created_at: 1000,
          note_color: null, note_size: null, pos_x: null, pos_y: null,
          rotation: null, author_token_hash: null, updated_at: null,
        }] }) })
      : makeBoundStatement());
    const response = await worker.fetch(new Request('https://example.com/api/messages?limit=80'), makeEnv({ DB: db }));
    const body = await response.json() as any;
    expect(body.items[0]).toMatchObject({ id: 'old-1', userId: '旅人', text: '你好', createdAt: 1000, note: expect.any(Object) });
    expect(body).toMatchObject({ now: expect.any(Number), nextCursor: expect.any(Number) });
  });

  it('preserves persisted coordinates for legacy messages after an admin move', async () => {
    const db = makeDb((sql) => sql.includes('FROM guest_messages')
      ? makeBoundStatement({ all: vi.fn().mockResolvedValue({ results: [{
          id: 'legacy-moved', user_id: '旧访客', text: '管理员已经挪过我', created_at: 1000,
          note_color: 'yellow', note_size: 'small', pos_x: 712.5, pos_y: 488.25,
          rotation: 2, author_token_hash: null, updated_at: 2000,
        }] }) })
      : makeBoundStatement());
    const response = await worker.fetch(new Request('https://example.com/api/messages?limit=80'), makeEnv({ DB: db }));
    const body = await response.json() as any;
    expect(body.items[0].note).toMatchObject({ x: 712.5, y: 488.25 });
  });

  it('uses updated_at/created_at for incremental sync', async () => {
    const seen: string[] = [];
    const db = makeDb((sql) => { seen.push(sql); return makeBoundStatement(); });
    await worker.fetch(new Request('https://example.com/api/messages?since=1234'), makeEnv({ DB: db }));
    expect(seen.join('\n')).toContain('COALESCE(updated_at, created_at) > ?');
  });
});

describe('sticky message API ownership contract', () => {
  it('returns the plaintext author token once but never inserts it', async () => {
    const writes: unknown[][] = [];
    const db = makeDb((sql, args) => {
      if (sql.startsWith('INSERT INTO guest_messages')) writes.push(args);
      return makeBoundStatement();
    });
    const response = await worker.fetch(new Request('https://example.com/api/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId: 'A', text: 'hello', noteColor: 'pink' }),
    }), makeEnv({ DB: db }));
    const body = await response.json() as any;
    expect(response.status).toBe(201);
    expect(body.authorToken).toEqual(expect.any(String));
    expect(body.item.note.color).toBe('pink');
    expect(JSON.stringify(writes)).not.toContain(body.authorToken);
  });

  it('rejects a wrong author token', async () => {
    const correctHash = await hashAuthorToken('correct-token');
    const db = makeDb((sql) => sql.includes('SELECT author_token_hash')
      ? makeBoundStatement({ first: vi.fn().mockResolvedValue({ author_token_hash: correctHash }) })
      : makeBoundStatement());
    const response = await worker.fetch(new Request('https://example.com/api/messages', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'm1', authorToken: 'wrong-token', posX: 100, posY: 200 }),
    }), makeEnv({ DB: db }));
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ code: 'MESSAGE_FORBIDDEN' });
  });
});

describe('sticky message reaction contract', () => {
  it('adds a supported reaction and returns aggregated counts', async () => {
    const seen: string[] = [];
    const db = makeDb((sql) => {
      seen.push(sql);
      if (sql.includes('SELECT id FROM guest_messages')) {
        return makeBoundStatement({ first: vi.fn().mockResolvedValue({ id: 'm1' }) });
      }
      if (sql.includes('SELECT emoji, COUNT(*) AS count FROM message_reactions')) {
        return makeBoundStatement({ all: vi.fn().mockResolvedValue({ results: [{ emoji: '❤️', count: 2 }] }) });
      }
      return makeBoundStatement();
    });
    const response = await worker.fetch(new Request('https://example.com/api/message-reactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messageId: 'm1', emoji: '❤️', previousEmoji: '' }),
    }), makeEnv({ DB: db }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ reactions: { '❤️': 2 }, selectedEmoji: '❤️' });
    expect(seen.some((sql) => sql.startsWith('INSERT INTO message_reactions'))).toBe(true);
  });

  it('posting the same previous emoji toggles the reaction off', async () => {
    const seen: string[] = [];
    const db = makeDb((sql) => {
      seen.push(sql);
      if (sql.includes('SELECT id FROM guest_messages')) {
        return makeBoundStatement({ first: vi.fn().mockResolvedValue({ id: 'm1' }) });
      }
      return makeBoundStatement();
    });
    const response = await worker.fetch(new Request('https://example.com/api/message-reactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messageId: 'm1', emoji: '❤️', previousEmoji: '❤️' }),
    }), makeEnv({ DB: db }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ selectedEmoji: '' });
    expect(seen.some((sql) => sql.startsWith('INSERT INTO message_reactions'))).toBe(false);
  });

  it('rejects an unsupported emoji', async () => {
    const response = await worker.fetch(new Request('https://example.com/api/message-reactions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messageId: 'm1', emoji: '🚫' }),
    }), makeEnv());
    expect(response.status).toBe(400);
  });
});
