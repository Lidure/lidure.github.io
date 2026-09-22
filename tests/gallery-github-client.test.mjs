import assert from 'node:assert/strict';
import test from 'node:test';

import { createGalleryGitHubClient } from '../src/lib/gallery-github-client.mjs';

test('client validates fixed repository write access and never leaks token in errors', async () => {
  const calls = [];
  const client = createGalleryGitHubClient({
    token: 'secret-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ message: 'Bad credentials secret-token' }), { status: 401 });
    },
  });
  await assert.rejects(client.validateWriteAccess(), error => {
    assert.equal(error.code, 'auth');
    assert.doesNotMatch(error.message, /secret-token/);
    return true;
  });
  assert.equal(calls[0].url, 'https://api.github.com/repos/Lidure/airi-gallery-images');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
});

test('rate limit and permission failures are distinguished', async () => {
  const rateLimited = createGalleryGitHubClient({
    token: 'x',
    fetchImpl: async () => new Response('{"message":"API rate limit exceeded"}', {
      status: 403,
      headers: { 'x-ratelimit-remaining': '0' },
    }),
  });
  await assert.rejects(rateLimited.getBranchHead(), error => error?.code === 'rate-limit');

  const forbidden = createGalleryGitHubClient({
    token: 'x',
    fetchImpl: async () => new Response('{"message":"Resource not accessible"}', {
      status: 403,
      headers: { 'x-ratelimit-remaining': '42' },
    }),
  });
  await assert.rejects(forbidden.getBranchHead(), error => error?.code === 'permission');
});

test('ref conflicts and network failures are categorized', async () => {
  const conflict = createGalleryGitHubClient({
    token: 'x',
    fetchImpl: async () => new Response('{"message":"Reference update failed"}', { status: 422 }),
  });
  await assert.rejects(conflict.updateRef('abc'), error => error?.code === 'ref-conflict');

  const offline = createGalleryGitHubClient({
    token: 'x',
    fetchImpl: async () => { throw new TypeError('Failed to fetch'); },
  });
  await assert.rejects(offline.getBranchHead(), error => error?.code === 'network' && error?.retryable === true);
});

test('request adapter returns transaction-compatible data and query params', async () => {
  const calls = [];
  const client = createGalleryGitHubClient({
    token: 'x',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response('{"tree":[]}', { status: 200 });
    },
  });
  const result = await client.request('GET', '/repos/Lidure/airi-gallery-images/git/trees/abc', {
    params: { recursive: '1' },
  });
  assert.equal(result.status, 200);
  assert.deepEqual(result.data, { tree: [] });
  assert.match(calls[0].url, /recursive=1/);
});
