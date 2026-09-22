import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GITHUB_MAX_BLOB_BYTES,
  commitGitHubUploadTransaction,
  exactRemoteMatch,
  similarRemoteMatches,
} from '../src/lib/gallery-upload-transaction.mjs';

test('exact duplicate matching is scoped to category and blob sha', () => {
  const tree = [
    { type: 'blob', path: 'gallery/A/1.png', sha: 'same' },
    { type: 'blob', path: 'gallery/B/2.png', sha: 'same' },
  ];
  assert.equal(exactRemoteMatch(tree, 'same', 'A')?.path, 'gallery/A/1.png');
  assert.equal(exactRemoteMatch(tree, 'same', 'C'), null);
});

test('similar matches keep distance <= 6 and rank nearest first', () => {
  const index = {
    'gallery/A/1.png': '0000000000000000',
    'gallery/A/2.png': '0000000000000001',
    'gallery/A/3.png': 'ffffffffffffffff',
    'gallery/B/4.png': '0000000000000000',
  };
  assert.deepEqual(
    similarRemoteMatches(index, '0000000000000000', 'A').map(item => item.path),
    ['gallery/A/1.png', 'gallery/A/2.png'],
  );
});

test('files above GitHub blob limit fail before any remote request', async () => {
  let requested = false;
  await assert.rejects(commitGitHubUploadTransaction({
    owner: 'Lidure', repo: 'airi-gallery-images', branch: 'main',
    request: async () => { requested = true; return {}; },
    items: [{ path: 'gallery/A/1.png', size: GITHUB_MAX_BLOB_BYTES + 1, loadContentBase64: async () => 'x' }],
    manifest: { path: 'gallery/gallery_index.json', contentBase64: 'e30=' },
  }), /100 MiB/);
  assert.equal(requested, false);
});

function transactionFixture() {
  const calls = [];
  const request = async (method, path, options = {}) => {
    calls.push({ method, path, body: options.body });
    if (method === 'GET' && path.endsWith('/git/ref/heads/main')) return { data: { object: { sha: 'head-1' } } };
    if (method === 'GET' && path.endsWith('/git/commits/head-1')) return { data: { tree: { sha: 'tree-1' } } };
    if (method === 'GET' && path.endsWith('/git/trees/tree-1')) return { data: { truncated: false, tree: [] } };
    if (method === 'POST' && path.endsWith('/git/blobs')) return { data: { sha: `blob-${options.body.content}` } };
    if (method === 'POST' && path.endsWith('/git/trees')) return { data: { sha: 'tree-2' } };
    if (method === 'POST' && path.endsWith('/git/commits')) return { data: { sha: 'commit-2' } };
    if (method === 'PATCH' && path.endsWith('/git/refs/heads/main')) return { data: {} };
    throw new Error(`unexpected request: ${method} ${path}`);
  };
  return { calls, request };
}

test('image and gallery index are committed in one ref update', async () => {
  const fixture = transactionFixture();
  const result = await commitGitHubUploadTransaction({
    owner: 'Lidure', repo: 'airi-gallery-images', branch: 'main', request: fixture.request,
    items: [{ path: 'gallery/A/10.png', size: 5, expectedBlobSha: 'expected', loadContentBase64: async () => 'image' }],
    manifest: { path: 'gallery/gallery_index.json', contentBase64: 'manifest' },
  });
  assert.equal(result.commitSha, 'commit-2');
  assert.equal(fixture.calls.filter(call => call.method === 'PATCH').length, 1);
  const treeBody = fixture.calls.find(call => call.method === 'POST' && call.path.endsWith('/git/trees')).body;
  assert.deepEqual(treeBody.tree.map(entry => entry.path).sort(), ['gallery/A/10.png', 'gallery/gallery_index.json']);
});
