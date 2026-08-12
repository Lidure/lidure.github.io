import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
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

  it('includes session credentials on moments management requests', () => {
    const momentsSource = readFileSync(
      new URL('../../src/pages/moments.astro', import.meta.url),
      'utf8',
    );
    const managementRequests = [...momentsSource.matchAll(
      /fetch\(MOMENTS_API_URL,\s*\{([\s\S]*?)\n\s*\}\);/g,
    )]
      .map((match) => match[1])
      .filter((options) => /method:\s*'(?:POST|DELETE)'/.test(options));

    expect(managementRequests).toHaveLength(2);
    for (const options of managementRequests) {
      expect(options).toMatch(/credentials:\s*'include'/);
    }
  });
});
