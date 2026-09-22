import assert from 'node:assert/strict';
import test from 'node:test';
import { createGalleryGitHubClient } from '../src/lib/gallery-github-client.mjs';

test('client validates fixed repository write permission and sends Bearer token', async () => {
  const calls = [];
  const client = createGalleryGitHubClient({
    token: 'secret-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ permissions: { push: true } }), { status: 200 });
    },
  });
  const result = await client.validateWriteAccess();
  assert.equal(result.canWrite, true);
  assert.equal(calls[0].url, 'https://api.github.com/repos/Lidure/airi-gallery-images');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
});

test('client categorizes auth failure without leaking token', async () => {
  const client = createGalleryGitHubClient({
    token: 'secret-token',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'Bad credentials secret-token' }), { status: 401 }),
  });
  await assert.rejects(client.validateWriteAccess(), error => {
    assert.equal(error.code, 'auth');
    assert.doesNotMatch(error.message, /secret-token/);
    return true;
  });
});

test('client distinguishes rate limit, permission and ref conflict errors', async () => {
  const cases = [
    [403, { 'x-ratelimit-remaining': '0' }, 'rate-limit'],
    [403, { 'x-ratelimit-remaining': '42' }, 'permission'],
    [409, {}, 'conflict'],
    [422, {}, 'conflict'],
  ];
  for (const [status, headers, code] of cases) {
    const client = createGalleryGitHubClient({
      token: 'x',
      fetchImpl: async () => new Response(JSON.stringify({ message: 'failure' }), { status, headers }),
    });
    await assert.rejects(client.request('GET', '/git/ref/heads/main'), error => error.code === code);
  }
});

test('network errors become retryable network errors', async () => {
  const client = createGalleryGitHubClient({
    token: 'x',
    fetchImpl: async () => { throw new TypeError('offline'); },
  });
  await assert.rejects(client.request('GET', '/git/ref/heads/main'), error => (
    error.code === 'network' && error.retryable === true
  ));
});
