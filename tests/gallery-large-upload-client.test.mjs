import assert from 'node:assert/strict';
import test from 'node:test';

import { uploadLargeBlob } from '../src/lib/gallery-large-upload-client.mjs';

const ROUTE = 'https://airigallery.lidure22.xyz/__gallery-github-blob/Lidure/airi-gallery-images';

test('large upload uses only fixed Cloud route and ephemeral auth', async () => {
  const calls = [];
  const file = new Blob(['abc'], { type: 'image/png' });
  const result = await uploadLargeBlob({
    file,
    token: 'secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response('{"sha":"blob123"}', { status: 201 });
    },
  });
  assert.deepEqual(result, { sha: 'blob123' });
  assert.equal(calls[0].url, ROUTE);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret');
  assert.equal(calls[0].init.headers['X-Gallery-Content-Encoding'], 'base64');
  assert.equal(calls[0].init.headers['X-Gallery-Blob-Size'], '3');
  assert.ok(calls[0].init.body instanceof ReadableStream);
});

test('streamed request body encodes file bytes as base64 without JSON wrapping', async () => {
  let encoded = '';
  await uploadLargeBlob({
    file: new Blob(['abcde']),
    token: 'secret',
    fetchImpl: async (_url, init) => {
      encoded = await new Response(init.body).text();
      return new Response('{"sha":"blob123"}', { status: 201 });
    },
  });
  assert.equal(encoded, 'YWJjZGU=');
});

test('large upload errors are categorized without leaking token', async () => {
  await assert.rejects(uploadLargeBlob({
    file: new Blob(['abc']),
    token: 'very-secret-token',
    fetchImpl: async () => new Response('{"message":"Bad token very-secret-token"}', { status: 401 }),
  }), error => {
    assert.equal(error.code, 'auth');
    assert.doesNotMatch(error.message, /very-secret-token/);
    return true;
  });
});

test('large upload enforces Worker raw file ceiling before network', async () => {
  let called = false;
  const fake = { size: 64 * 1024 * 1024 + 1, stream() { throw new Error('must not stream'); } };
  await assert.rejects(uploadLargeBlob({
    file: fake,
    token: 'secret',
    fetchImpl: async () => { called = true; },
  }), /64 MiB/);
  assert.equal(called, false);
});
