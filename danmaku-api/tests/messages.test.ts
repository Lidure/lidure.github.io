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

  it('uses updated_at/created_at for incremental sync', async () => {
    const seen: string[] = [];
    const db = makeDb((sql) => { seen.push(sql); return makeBoundStatement(); });
    await worker.fetch(new Request('https://example.com/api/messages?since=1234'), makeEnv({ DB: db }));
    expect(seen.join('\n')).toContain('COALESCE(updated_at, created_at) > ?');
  });
});
