import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GITHUB_MAX_BLOB_BYTES,
  commitGitHubUploadTransaction,
  exactRemoteMatch,
  similarRemoteMatches,
} from '../src/lib/gallery-upload-transaction.mjs';

test('exact remote match is scoped to category and blob sha', () => {
  const tree = [
    { type: 'blob', path: 'gallery/A/1.png', sha: 'same' },
    { type: 'blob', path: 'gallery/B/2.png', sha: 'same' },
  ];
  assert.equal(exactRemoteMatch(tree, 'same', 'A')?.path, 'gallery/A/1.png');
  assert.equal(exactRemoteMatch(tree, 'same', 'C'), null);
});

test('similar matches keep Hamming distance <= 6 and nearest first', () => {
  const index = {
    'gallery/A/1.png': '0000000000000000',
    'gallery/A/2.png': '0000000000000001',
    'gallery/A/3.png': 'ffffffffffffffff',
    'gallery/B/4.png': '0000000000000000',
  };
  const matches = similarRemoteMatches(index, '0000000000000000', 'A');
  assert.deepEqual(matches.map(item => item.path), ['gallery/A/1.png', 'gallery/A/2.png']);
});

test('transaction rejects a global numeric collision before creating blobs', async () => {
  let writes = 0;
  const request = async (method, path) => {
    if (method !== 'GET') writes++;
    if (path.endsWith('/git/ref/heads/main')) return { data: { object: { sha: 'head' } } };
    if (path.endsWith('/git/commits/head')) return { data: { tree: { sha: 'tree' } } };
    if (path.endsWith('/git/trees/tree')) return { data: { truncated: false, tree: [
      { type: 'blob', path: 'gallery/Other/12.png', sha: 'old' },
      { type: 'blob', path: 'gallery/gallery_index.json', sha: 'manifest' },
    ] } };
    throw new Error(`unexpected ${method} ${path}`);
  };
  await assert.rejects(
    commitGitHubUploadTransaction({
      owner: 'Lidure', repo: 'airi-gallery-images', request,
      items: [{ path: 'gallery/Bang/12.gif', size: 3, loadContentBase64: async () => 'YWJj' }],
      manifest: { path: 'gallery/gallery_index.json', contentBase64: 'e30=' },
      sleep: async () => {},
    }),
    error => error.code === 'GLOBAL_NUMBER_CONFLICT',
  );
  assert.equal(writes, 0);
});

test('transaction commits image and manifest together with force false', async () => {
  const calls = [];
  let blobCounter = 0;
  const request = async (method, path, options = {}) => {
    calls.push({ method, path, options });
    if (method === 'GET' && path.endsWith('/git/ref/heads/main')) return { data: { object: { sha: 'head' } } };
    if (method === 'GET' && path.endsWith('/git/commits/head')) return { data: { tree: { sha: 'tree' } } };
    if (method === 'GET' && path.endsWith('/git/trees/tree')) return { data: { truncated: false, tree: [
      { type: 'blob', path: 'gallery/gallery_index.json', sha: 'manifest' },
    ] } };
    if (method === 'POST' && path.endsWith('/git/blobs')) return { data: { sha: `blob-${++blobCounter}` } };
    if (method === 'POST' && path.endsWith('/git/trees')) return { data: { sha: 'new-tree' } };
    if (method === 'POST' && path.endsWith('/git/commits')) return { data: { sha: 'new-commit' } };
    if (method === 'PATCH' && path.endsWith('/git/refs/heads/main')) return { data: {} };
    throw new Error(`unexpected ${method} ${path}`);
  };
  const result = await commitGitHubUploadTransaction({
    owner: 'Lidure', repo: 'airi-gallery-images', request,
    items: [{ path: 'gallery/Bang/12.gif', size: 3, loadContentBase64: async () => 'YWJj' }],
    manifest: { path: 'gallery/gallery_index.json', contentBase64: 'e30=' },
    sleep: async () => {},
  });
  assert.equal(result.commitSha, 'new-commit');
  const treeCall = calls.find(call => call.method === 'POST' && call.path.endsWith('/git/trees'));
  assert.equal(treeCall.options.body.tree.length, 2);
  const patch = calls.find(call => call.method === 'PATCH');
  assert.deepEqual(patch.options.body, { sha: 'new-commit', force: false });
});

test('transaction rejects files over GitHub 100 MiB hard limit', async () => {
  await assert.rejects(
    commitGitHubUploadTransaction({
      owner: 'Lidure', repo: 'airi-gallery-images', request: async () => ({}),
      items: [{ path: 'gallery/A/1.png', size: GITHUB_MAX_BLOB_BYTES + 1, loadContentBase64: async () => '' }],
      manifest: { path: 'gallery/gallery_index.json', contentBase64: 'e30=' },
    }),
    /100 MiB/,
  );
});
