import assert from 'node:assert/strict';
import test from 'node:test';

import { commitGitHubDeleteTransaction } from '../src/lib/gallery-delete-transaction.mjs';

function deleteFixture({ tree = null } = {}) {
  const calls = [];
  const baseTree = tree || [
    { type: 'blob', path: 'gallery/A/1.png', sha: 'image-old' },
    { type: 'blob', path: 'gallery/gallery_index.json', sha: 'manifest-old' },
  ];
  const request = async (method, path, options = {}) => {
    calls.push({ method, path, body: options.body });
    if (method === 'GET' && path.endsWith('/git/ref/heads/main')) return { data: { object: { sha: 'head-1' } } };
    if (method === 'GET' && path.endsWith('/git/commits/head-1')) return { data: { tree: { sha: 'tree-1' } } };
    if (method === 'GET' && path.endsWith('/git/trees/tree-1')) return { data: { truncated: false, tree: baseTree } };
    if (method === 'POST' && path.endsWith('/git/blobs')) return { data: { sha: 'manifest-new' } };
    if (method === 'POST' && path.endsWith('/git/trees')) return { data: { sha: 'tree-2' } };
    if (method === 'POST' && path.endsWith('/git/commits')) return { data: { sha: 'commit-2' } };
    if (method === 'PATCH' && path.endsWith('/git/refs/heads/main')) return { data: {} };
    throw new Error(`unexpected request: ${method} ${path}`);
  };
  return { calls, request };
}

test('delete transaction removes image and updates perceptual index in one commit', async () => {
  const fixture = deleteFixture();
  const result = await commitGitHubDeleteTransaction({
    owner: 'Lidure', repo: 'airi-gallery-images', branch: 'main', request: fixture.request,
    imagePath: 'gallery/A/1.png',
    manifest: { path: 'gallery/gallery_index.json', contentBase64: 'e30=', expectedSha: 'manifest-old' },
  });
  assert.equal(result.commitSha, 'commit-2');
  const treeBody = fixture.calls.find(call => call.method === 'POST' && call.path.endsWith('/git/trees')).body;
  const deleted = treeBody.tree.find(entry => entry.path === 'gallery/A/1.png');
  const manifest = treeBody.tree.find(entry => entry.path === 'gallery/gallery_index.json');
  assert.equal(deleted.sha, null);
  assert.equal(manifest.sha, 'manifest-new');
  assert.equal(fixture.calls.filter(call => call.method === 'PATCH').length, 1);
});

test('delete fails closed when image is absent', async () => {
  const fixture = deleteFixture({ tree: [{ type: 'blob', path: 'gallery/gallery_index.json', sha: 'manifest-old' }] });
  await assert.rejects(commitGitHubDeleteTransaction({
    owner: 'Lidure', repo: 'airi-gallery-images', request: fixture.request,
    imagePath: 'gallery/A/1.png',
    manifest: { path: 'gallery/gallery_index.json', contentBase64: 'e30=', expectedSha: 'manifest-old' },
  }), /不存在/);
  assert.equal(fixture.calls.some(call => call.method === 'POST'), false);
});

test('delete fails closed when manifest snapshot changed', async () => {
  const fixture = deleteFixture({ tree: [
    { type: 'blob', path: 'gallery/A/1.png', sha: 'image-old' },
    { type: 'blob', path: 'gallery/gallery_index.json', sha: 'manifest-newer' },
  ] });
  await assert.rejects(commitGitHubDeleteTransaction({
    owner: 'Lidure', repo: 'airi-gallery-images', request: fixture.request,
    imagePath: 'gallery/A/1.png',
    manifest: { path: 'gallery/gallery_index.json', contentBase64: 'e30=', expectedSha: 'manifest-old' },
  }), error => error?.code === 'MANIFEST_CONFLICT');
});
