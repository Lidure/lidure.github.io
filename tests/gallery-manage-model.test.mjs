import assert from 'node:assert/strict';
import test from 'node:test';

import {
  groupManagedItems,
  normalizeRemoteItems,
  paginateManagedItems,
  reconcileDelete,
} from '../src/lib/gallery-manage-model.mjs';

test('remote normalization drops unsafe and staging paths while preserving sha and size', () => {
  const items = normalizeRemoteItems([
    { type: 'blob', path: 'gallery/B/2.gif', sha: 'b', size: 2 },
    { type: 'blob', path: 'gallery/A/10.png', sha: 'a10', size: 10 },
    { type: 'blob', path: 'gallery/A/.airi-renumber-1.png', sha: 'bad' },
    { type: 'blob', path: 'gallery/A/nested/3.png', sha: 'bad2' },
  ]);
  assert.deepEqual(items.map(item => item.path), ['gallery/A/10.png', 'gallery/B/2.gif']);
  assert.equal(items[0].sha, 'a10');
  assert.equal(items[0].size, 10);
});

test('grouping and pagination are deterministic', () => {
  const items = normalizeRemoteItems([
    { path: 'gallery/A/10.png' },
    { path: 'gallery/A/2.png' },
    { path: 'gallery/B/1.gif' },
  ]);
  const groups = groupManagedItems(items);
  assert.deepEqual(groups.map(group => [group.category, group.items.map(item => item.filename)]), [
    ['A', ['2.png', '10.png']],
    ['B', ['1.gif']],
  ]);
  const page = paginateManagedItems(groups[0].items, 2, 1);
  assert.equal(page.page, 2);
  assert.equal(page.totalPages, 2);
  assert.equal(page.items[0].filename, '10.png');
});

test('authoritative remote presence wins over optimistic delete state', () => {
  const item = { path: 'gallery/Bang/12.gif' };
  assert.deepEqual(reconcileDelete([item], item.path, new Set([item.path])), [item]);
  assert.deepEqual(reconcileDelete([item], item.path, new Set()), []);
});
