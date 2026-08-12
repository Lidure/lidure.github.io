import { describe, expect, it, vi } from 'vitest';
import worker from '../src/index';

type FetchEnv = Parameters<typeof worker.fetch>[1];

function makeEnv(overrides: Partial<FetchEnv> = {}): FetchEnv {
  return {
    DB: {
      prepare() {
        return {
          bind() {
            return {
              all: vi.fn().mockResolvedValue({ results: [] }),
              first: vi.fn().mockResolvedValue({ count: 0 }),
              run: vi.fn().mockResolvedValue({}),
            };
          },
        };
      },
    } as unknown as D1Database,
    ALLOWED_ORIGINS: 'https://example.com',
    ...overrides,
  };
}

describe('danmaku API contracts', () => {
  it('returns items and nextCursor for public list responses', async () => {
    const request = new Request('https://example.com/api/danmaku?track=demo', { method: 'GET' });
    const response = await worker.fetch(request, makeEnv());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      items: [],
      nextCursor: expect.anything(),
    });
  });

  it('returns structured error payloads with code fields', async () => {
    const request = new Request('https://example.com/api/danmaku', { method: 'GET' });
    const response = await worker.fetch(request, makeEnv());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.any(String),
      code: expect.any(String),
    });
  });

  it('sends management requests with credentials included', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ items: [] }), {
      headers: { 'Content-Type': 'application/json' },
    }));

    try {
      const res = await fetch('https://example.com/api/moments?limit=200', {
        credentials: 'include',
        cache: 'no-store',
      });

      expect(res.ok).toBe(true);
      expect(fetchSpy).toHaveBeenCalledWith('https://example.com/api/moments?limit=200', expect.objectContaining({
        credentials: 'include',
      }));
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
