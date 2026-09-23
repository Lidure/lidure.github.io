import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GITHUB_MAX_BLOB_BYTES,
  exactRemoteMatch,
  similarRemoteMatches,
  commitGitHubUploadTransaction,
} from '../src/lib/gallery-upload-transaction.mjs';

function response(data) { return { data }; }

function makeRequestHarness({ conflictOnce = false } = {}) {
  let patchCount = 0;
  const calls = [];
  const tree = [
    { type: 'blob', path: 'gallery/A/1.png', sha: 'existing' },
    { type: 'blob', path: 'gallery/gallery_index.json', sha: 'manifest-old' },
  ];
  const request = async (method, path, options = {}) => {
    calls.push({ method, path, options });
    if (method === 'GET' && path.endsWith('/git/ref/heads/main')) return response({ object: { sha: 'head-old' } });
    if (method === 'GET' && path.includes('/git/commits/')) return response({ tree: { sha: 'tree-old' } });
    if (method === 'GET' && path.includes('/git/trees/')) return response({ tree, truncated: false });
    if (method === 'POST' && path.endsWith('/git/blobs')) return response({ sha: `blob-${calls.length}` });
    if (method === 'POST' && path.endsWith('/git/trees')) return response({ sha: 'tree-new' });
    if (method === 'POST' && path.endsWith('/git/commits')) return response({ sha: 'commit-new' });
    if (method === 'PATCH' && path.endsWith('/git/refs/heads/main')) {
      patchCount += 1;
      if (conflictOnce && patchCount === 1) throw Object.assign(new Error('conflict'), { status: 409 });
      return response({ object: { sha: 'commit-new' } });
    }
    throw new Error(`unexpected ${method} ${path}`);
  };
  return { request, calls };
}

test('exact duplicate is scoped to category and blob sha', () => {
  const tree = [
    { type: 'blob', path: 'gallery/A/1.png', sha: 'same' },
    { type: 'blob', path: 'gallery/B/2.png', sha: 'same' },
  ];
  assert.equal(exactRemoteMatch(tree, 'same', 'A').path, 'gallery/A/1.png');
  assert.equal(exactRemoteMatch(tree, 'missing', 'A'), null);
});

test('similar matches keep hamming distance <= 6 and rank nearest first', () => {
  const index = {
    'gallery/A/1.png': '0000000000000000',
    'gallery/A/2.png': '0000000000000001',
    'gallery/A/3.png': 'ffffffffffffffff',
    'gallery/B/4.png': '0000000000000000',
  };
  const matches = similarRemoteMatches(index, '0000000000000000', 'A');
  assert.deepEqual(matches.map(item => item.path), ['gallery/A/1.png', 'gallery/A/2.png']);
});

test('transaction rejects files above GitHub hard limit', async () => {
  const { request } = makeRequestHarness();
  await assert.rejects(commitGitHubUploadTransaction({
    owner: 'Lidure', repo: 'airi-gallery-images', request,
    items: [{ path: 'gallery/A/2.png', size: GITHUB_MAX_BLOB_BYTES + 1, loadContentBase64: async () => 'eA==' }],
    manifest: { path: 'gallery/gallery_index.json', contentBase64: 'e30=' },
  }), /100 MiB/);
});

test('transaction creates blobs, tree, commit and non-force ref update', async () => {
  const { request, calls } = makeRequestHarness();
  const result = await commitGitHubUploadTransaction({
    owner: 'Lidure', repo: 'airi-gallery-images', branch: 'main', request,
    items: [{ path: 'gallery/A/2.png', size: 10, expectedBlobSha: 'newsha', loadContentBase64: async () => 'eA==' }],
    manifest: { path: 'gallery/gallery_index.json', contentBase64: 'e30=' },
  });
  assert.equal(result.commitSha, 'commit-new');
  const patch = calls.find(call => call.method === 'PATCH');
  assert.deepEqual(patch.options.body, { sha: 'commit-new', force: false });
});
