import assert from 'node:assert/strict';
import test from 'node:test';
import { commitGitHubDeleteTransaction } from '../src/lib/gallery-delete-transaction.mjs';

function successfulHarness() {
  const calls = [];
  const request = async (method, path, options = {}) => {
    calls.push({ method, path, options });
    if (method === 'GET' && path.endsWith('/git/ref/heads/main')) return { data: { object: { sha: 'head' } } };
    if (method === 'GET' && path.endsWith('/git/commits/head')) return { data: { tree: { sha: 'tree' } } };
    if (method === 'GET' && path.endsWith('/git/trees/tree')) return { data: { truncated: false, tree: [
      { type: 'blob', path: 'gallery/A/1.png', sha: 'image-old' },
      { type: 'blob', path: 'gallery/gallery_index.json', sha: 'manifest-old' },
    ] } };
    if (method === 'POST' && path.endsWith('/git/blobs')) return { data: { sha: 'manifest-new' } };
    if (method === 'POST' && path.endsWith('/git/trees')) return { data: { sha: 'tree-new' } };
    if (method === 'POST' && path.endsWith('/git/commits')) return { data: { sha: 'commit-new' } };
    if (method === 'PATCH' && path.endsWith('/git/refs/heads/main')) return { data: {} };
    throw new Error(`unexpected ${method} ${path}`);
  };
  return { calls, request };
}

test('delete transaction removes image and updates index in one tree commit', async () => {
  const { calls, request } = successfulHarness();
  const result = await commitGitHubDeleteTransaction({
    owner: 'Lidure', repo: 'airi-gallery-images', branch: 'main', request,
    imagePath: 'gallery/A/1.png',
    manifest: { path: 'gallery/gallery_index.json', contentBase64: 'e30=', expectedSha: 'manifest-old' },
    sleep: async () => {},
  });
  assert.equal(result.commitSha, 'commit-new');
  const treeCall = calls.find(call => call.method === 'POST' && call.path.endsWith('/git/trees'));
  assert.deepEqual(treeCall.options.body.tree, [
    { path: 'gallery/A/1.png', mode: '100644', type: 'blob', sha: null },
    { path: 'gallery/gallery_index.json', mode: '100644', type: 'blob', sha: 'manifest-new' },
  ]);
  const patch = calls.find(call => call.method === 'PATCH');
  assert.deepEqual(patch.options.body, { sha: 'commit-new', force: false });
});

test('delete transaction fails closed when image is already absent', async () => {
  const request = async (method, path) => {
    if (path.endsWith('/git/ref/heads/main')) return { data: { object: { sha: 'head' } } };
    if (path.endsWith('/git/commits/head')) return { data: { tree: { sha: 'tree' } } };
    if (path.endsWith('/git/trees/tree')) return { data: { truncated: false, tree: [
      { type: 'blob', path: 'gallery/gallery_index.json', sha: 'manifest-old' },
    ] } };
    throw new Error(`unexpected ${method} ${path}`);
  };
  await assert.rejects(commitGitHubDeleteTransaction({
    owner: 'Lidure', repo: 'airi-gallery-images', request,
    imagePath: 'gallery/A/1.png',
    manifest: { path: 'gallery/gallery_index.json', contentBase64: 'e30=', expectedSha: 'manifest-old' },
    sleep: async () => {},
  }), error => error.code === 'IMAGE_NOT_FOUND');
});

test('delete transaction refuses a stale gallery index', async () => {
  const request = async (method, path) => {
    if (path.endsWith('/git/ref/heads/main')) return { data: { object: { sha: 'head' } } };
    if (path.endsWith('/git/commits/head')) return { data: { tree: { sha: 'tree' } } };
    if (path.endsWith('/git/trees/tree')) return { data: { truncated: false, tree: [
      { type: 'blob', path: 'gallery/A/1.png', sha: 'image-old' },
      { type: 'blob', path: 'gallery/gallery_index.json', sha: 'manifest-other' },
    ] } };
    throw new Error(`unexpected ${method} ${path}`);
  };
  await assert.rejects(commitGitHubDeleteTransaction({
    owner: 'Lidure', repo: 'airi-gallery-images', request,
    imagePath: 'gallery/A/1.png',
    manifest: { path: 'gallery/gallery_index.json', contentBase64: 'e30=', expectedSha: 'manifest-old' },
    sleep: async () => {},
  }), error => error.code === 'MANIFEST_CONFLICT');
});
