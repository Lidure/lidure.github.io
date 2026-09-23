import assert from 'node:assert/strict';
import test from 'node:test';
import { gitBlobSha, perceptualHash } from '../src/lib/gallery-image-hash.mjs';
import { commitGitHubDeleteTransaction } from '../src/lib/gallery-delete-transaction.mjs';

test('git blob sha uses Git object framing', async () => {
  const blob = new Blob(['hello'], { type: 'image/png' });
  assert.equal(await gitBlobSha(blob), 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0');
});

test('perceptual hash matches Cloud dhash64 left-greater-than-right semantics', async () => {
  const descending = new Uint8Array(72);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 9; x++) descending[y * 9 + x] = 9 - x;
  }
  const ascending = new Uint8Array(72);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 9; x++) ascending[y * 9 + x] = x;
  }
  assert.equal(
    await perceptualHash(new Blob(['x']), { readGray9x8: async () => descending }),
    'ffffffffffffffff',
  );
  assert.equal(
    await perceptualHash(new Blob(['y']), { readGray9x8: async () => ascending }),
    '0000000000000000',
  );
});

function makeDeleteHarness() {
  const calls = [];
  const tree = [
    { type: 'blob', path: 'gallery/A/1.png', sha: 'image-old' },
    { type: 'blob', path: 'gallery/gallery_index.json', sha: 'manifest-old' },
  ];
  const request = async (method, path, options = {}) => {
    calls.push({ method, path, options });
    if (method === 'GET' && path.endsWith('/git/ref/heads/main')) return { data: { object: { sha: 'head-old' } } };
    if (method === 'GET' && path.includes('/git/commits/')) return { data: { tree: { sha: 'tree-old' } } };
    if (method === 'GET' && path.includes('/git/trees/')) return { data: { tree, truncated: false } };
    if (method === 'POST' && path.endsWith('/git/blobs')) return { data: { sha: 'manifest-new' } };
    if (method === 'POST' && path.endsWith('/git/trees')) return { data: { sha: 'tree-new' } };
    if (method === 'POST' && path.endsWith('/git/commits')) return { data: { sha: 'commit-new' } };
    if (method === 'PATCH' && path.endsWith('/git/refs/heads/main')) return { data: { object: { sha: 'commit-new' } } };
    throw new Error(`unexpected ${method} ${path}`);
  };
  return { calls, request };
}

test('delete transaction removes image and index in one non-force commit', async () => {
  const { calls, request } = makeDeleteHarness();
  const result = await commitGitHubDeleteTransaction({
    owner: 'Lidure', repo: 'airi-gallery-images', branch: 'main', request,
    imagePath: 'gallery/A/1.png',
    manifest: { path: 'gallery/gallery_index.json', contentBase64: 'eyJmaWxlcyI6e319', expectedSha: 'manifest-old' },
  });
  assert.equal(result.commitSha, 'commit-new');
  const treeCall = calls.find(call => call.method === 'POST' && call.path.endsWith('/git/trees'));
  assert.equal(treeCall.options.body.tree.some(entry => entry.path === 'gallery/A/1.png' && entry.sha === null), true);
  const patch = calls.find(call => call.method === 'PATCH');
  assert.deepEqual(patch.options.body, { sha: 'commit-new', force: false });
});

test('uncertain delete ref update verifies the exact new manifest blob before claiming success', async () => {
  let verifying = false;
  const initialTree = [
    { type: 'blob', path: 'gallery/A/1.png', sha: 'image-old' },
    { type: 'blob', path: 'gallery/gallery_index.json', sha: 'manifest-old' },
  ];
  const unrelatedTree = [
    { type: 'blob', path: 'gallery/gallery_index.json', sha: 'manifest-old' },
  ];
  const request = async (method, path, options = {}) => {
    if (method === 'GET' && path.endsWith('/git/ref/heads/main')) {
      return { data: { object: { sha: verifying ? 'head-other' : 'head-old' } } };
    }
    if (method === 'GET' && path.includes('/git/commits/')) {
      return { data: { tree: { sha: verifying ? 'tree-other' : 'tree-old' } } };
    }
    if (method === 'GET' && path.includes('/git/trees/')) {
      return { data: { tree: verifying ? unrelatedTree : initialTree, truncated: false } };
    }
    if (method === 'POST' && path.endsWith('/git/blobs')) return { data: { sha: 'manifest-new' } };
    if (method === 'POST' && path.endsWith('/git/trees')) return { data: { sha: 'tree-new' } };
    if (method === 'POST' && path.endsWith('/git/commits')) return { data: { sha: 'commit-new' } };
    if (method === 'PATCH' && path.endsWith('/git/refs/heads/main')) {
      verifying = true;
      throw Object.assign(new Error('upstream result unknown'), { status: 502, retryable: true });
    }
    throw new Error(`unexpected ${method} ${path}`);
  };

  await assert.rejects(
    commitGitHubDeleteTransaction({
      owner: 'Lidure', repo: 'airi-gallery-images', branch: 'main', request,
      imagePath: 'gallery/A/1.png',
      manifest: { path: 'gallery/gallery_index.json', contentBase64: 'eyJmaWxlcyI6e319', expectedSha: 'manifest-old' },
      sleep: async () => {},
    }),
    /upstream result unknown/,
  );
});
