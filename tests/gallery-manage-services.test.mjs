import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createGalleryGitHubClient,
} from '../src/lib/gallery-github-client.mjs';
import {
  GALLERY_INDEX_ALGORITHM,
  GALLERY_INDEX_PATH,
  nextGlobalImageNumber,
  planUploadPaths,
  parseGalleryIndex,
  serializeGalleryIndex,
} from '../src/lib/gallery-index-transaction.mjs';
import {
  createLargeUploadClient,
} from '../src/lib/gallery-large-upload-client.mjs';

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

test('GitHub client validates fixed repo write access and never leaks token', async () => {
  const calls = [];
  const client = createGalleryGitHubClient({
    token: 'secret-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ permissions: { push: true } });
    },
  });
  const result = await client.validateWriteAccess();
  assert.equal(result.canWrite, true);
  assert.match(calls[0].url, /Lidure\/airi-gallery-images$/);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
});

test('GitHub client categorizes auth and rate-limit errors without token text', async () => {
  const auth = createGalleryGitHubClient({
    token: 'secret-token',
    fetchImpl: async () => jsonResponse({ message: 'Bad credentials secret-token' }, 401),
  });
  await assert.rejects(auth.validateWriteAccess(), (error) => {
    assert.equal(error.code, 'auth');
    assert.doesNotMatch(error.message, /secret-token/);
    return true;
  });

  const limited = createGalleryGitHubClient({
    token: 'x',
    fetchImpl: async () => jsonResponse({ message: 'API rate limit exceeded' }, 403, { 'x-ratelimit-remaining': '0' }),
  });
  await assert.rejects(limited.getBranchSnapshot(), (error) => error.code === 'rate-limit');
});

test('GitHub client refuses token-bearing requests outside the fixed Gallery repository', async () => {
  let calls = 0;
  const client = createGalleryGitHubClient({
    token: 'secret-token',
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse({});
    },
  });
  await assert.rejects(
    client.request('GET', 'https://evil.example/repos/Lidure/airi-gallery-images'),
    (error) => error.code === 'scope',
  );
  await assert.rejects(
    client.request('GET', '/repos/Lidure/other-repo/git/ref/heads/main'),
    (error) => error.code === 'scope',
  );
  assert.equal(calls, 0);
});

test('Gallery index preserves the existing Cloud manifest schema and algorithm', () => {
  assert.equal(GALLERY_INDEX_PATH, 'gallery/gallery_index.json');
  assert.equal(GALLERY_INDEX_ALGORITHM, 'dhash64-nn-white-v1');
  const payload = {
    version: 1,
    algorithm: GALLERY_INDEX_ALGORITHM,
    files: {
      'gallery/A/1.png': { perceptual_hash: '0011223344556677' },
    },
  };
  const parsed = parseGalleryIndex(payload);
  assert.deepEqual(parsed, { 'gallery/A/1.png': '0011223344556677' });
  assert.deepEqual(JSON.parse(serializeGalleryIndex(parsed)), payload);
  assert.throws(
    () => parseGalleryIndex({ ...payload, algorithm: 'average-hash-v0' }),
    /算法不兼容/,
  );
});

test('Gallery path planning keeps global numbering across categories', () => {
  const tree = [
    { type: 'blob', path: 'gallery/A/8.png' },
    { type: 'blob', path: 'gallery/B/12.gif' },
  ];
  assert.equal(nextGlobalImageNumber(tree), 13);
  assert.deepEqual(
    planUploadPaths(tree, 'Bang', [{ name: 'a.gif' }, { name: 'b.webp' }]).map(item => item.path),
    ['gallery/Bang/13.gif', 'gallery/Bang/14.webp'],
  );
});

test('large upload client targets fixed Cloud route and checks returned sha', async () => {
  const calls = [];
  const client = createLargeUploadClient({
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({ sha: 'abc123' });
    },
    encodeFile: async () => 'eA==',
  });
  const sha = await client.upload(new Blob(['x'], { type: 'image/png' }), 'token-value');
  assert.equal(sha, 'abc123');
  assert.equal(calls[0].url, 'https://airigallery.lidure22.xyz/__gallery-github-blob/Lidure/airi-gallery-images');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer token-value');
  assert.equal(calls[0].init.headers['X-Gallery-Content-Encoding'], 'base64');
});
