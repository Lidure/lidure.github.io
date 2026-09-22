import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildManagedCategories,
  normalizeRemoteTree,
  pageManagedItems,
  reconcileDelete,
} from '../src/lib/gallery-manage-model.mjs';

test('remote tree keeps only safe image blobs and preserves sha/size', () => {
  const items = normalizeRemoteTree([
    { type: 'blob', path: 'gallery/A/1.png', sha: 'a', size: 3 },
    { type: 'blob', path: 'gallery/A/.airi-renumber-x.png', sha: 'b', size: 4 },
    { type: 'tree', path: 'gallery/A', sha: 'c' },
  ]);
  assert.deepEqual(items, [{
    path: 'gallery/A/1.png',
    category: 'A',
    filename: '1.png',
    imageUrl: 'https://airigallery.lidure22.xyz/__gallery-image/gallery/A/1.png',
    sha: 'a',
    size: 3,
  }]);
});

test('managed categories are naturally sorted and paginated', () => {
  const items = normalizeRemoteTree([
    { type: 'blob', path: 'gallery/A/10.png', sha: '10' },
    { type: 'blob', path: 'gallery/A/2.png', sha: '2' },
    { type: 'blob', path: 'gallery/B/1.png', sha: 'b' },
  ]);
  assert.deepEqual(buildManagedCategories(items).map(x => [x.name, x.count]), [['A', 2], ['B', 1]]);
  assert.deepEqual(pageManagedItems(items, 'A', 1, 1).items.map(x => x.filename), ['2.png']);
});

test('delete reconciliation only removes item after remote confirms absence', () => {
  const item = { path: 'gallery/A/1.png' };
  assert.deepEqual(reconcileDelete([item], item.path, new Set([item.path])), [item]);
  assert.deepEqual(reconcileDelete([item], item.path, new Set()), []);
});
