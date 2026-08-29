import { describe, expect, it, vi } from 'vitest';
import { handleMessageStickerRequest, type MessageStickerEnv } from '../src/message-stickers';

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

describe('public message sticker list contract', () => {
  it('lists public stickers without exposing ownership hashes', async () => {
    const request = new Request('https://example.test/api/message-stickers', {
      headers: { 'X-Message-Sticker-Owner': '12345678901234567890123456789012' },
    });
    const response = await handleMessageStickerRequest(
      request,
      new URL(request.url),
      makeEnv(),
    );

    expect(response?.status).toBe(200);
    const body = await response!.json() as any;
    expect(body.items).toEqual([]);
    expect(body.ownedIds).toEqual([]);
    expect(body.ownedCount).toBe(0);
    expect(JSON.stringify(body)).not.toContain('owner_token_hash');
  });
});
