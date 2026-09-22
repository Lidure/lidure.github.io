import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LARGE_UPLOAD_URL,
  uploadLargeGalleryBlob,
} from '../src/lib/gallery-large-upload-client.mjs';

test('large upload route is fixed to the Cloud worker and image repository', () => {
  assert.equal(
    LARGE_UPLOAD_URL,
    'https://airigallery.lidure22.xyz/__gallery-github-blob/Lidure/airi-gallery-images',
  );
});

test('large upload forwards ephemeral token and required integrity headers', async () => {
  const calls = [];
  const file = new Blob(['abc'], { type: 'image/png' });
  Object.defineProperty(file, 'name', { value: 'a.png' });
  const sha = await uploadLargeGalleryBlob(file, {
    token: 'secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ sha: 'blob-sha' }), { status: 200 });
    },
    makeBody: async () => 'YWJj',
    streaming: false,
  });
  assert.equal(sha, 'blob-sha');
  assert.equal(calls[0].url, LARGE_UPLOAD_URL);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret');
  assert.equal(calls[0].init.headers['X-Gallery-Blob-Size'], '3');
  assert.equal(calls[0].init.headers['X-Gallery-Content-Encoding'], 'base64');
});

test('large upload error never includes token and reports retryability', async () => {
  const file = new Blob(['abc'], { type: 'image/png' });
  await assert.rejects(uploadLargeGalleryBlob(file, {
    token: 'secret-token',
    fetchImpl: async () => new Response(JSON.stringify({ message: 'rate limit secret-token' }), {
      status: 429,
      headers: { 'retry-after': '1' },
    }),
    makeBody: async () => 'YWJj',
    streaming: false,
  }), error => {
    assert.equal(error.retryable, true);
    assert.doesNotMatch(error.message, /secret-token/);
    return true;
  });
});
