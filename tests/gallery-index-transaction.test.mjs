import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GALLERY_INDEX_PATH,
  addIndexEntries,
  nextGlobalImageNumber,
  parseGalleryIndex,
  planUploadPaths,
  removeIndexEntry,
  serializeGalleryIndex,
} from '../src/lib/gallery-index-transaction.mjs';

test('gallery index path stays fixed', () => {
  assert.equal(GALLERY_INDEX_PATH, 'gallery/gallery_index.json');
});

test('next image number is global across categories', () => {
  const tree = [
    { type: 'blob', path: 'gallery/A/8.png' },
    { type: 'blob', path: 'gallery/B/12.gif' },
    { type: 'blob', path: 'gallery/B/note.png' },
  ];
  assert.equal(nextGlobalImageNumber(tree), 13);
});

test('planned paths preserve extension and increment globally', () => {
  const plans = planUploadPaths(
    [{ type: 'blob', path: 'gallery/A/12.png' }],
    'Bang',
    [{ name: 'x.gif', perceptualHash: 'aa' }, { name: 'y.webp', perceptualHash: 'bb' }],
  );
  assert.deepEqual(plans.map(item => item.path), ['gallery/Bang/13.gif', 'gallery/Bang/14.webp']);
});

test('unsafe category names are rejected before path planning', () => {
  for (const category of ['', '.', '..', 'A/B', 'A\\B']) {
    assert.throws(() => planUploadPaths([], category, [{ name: 'x.png' }]), /分类/);
  }
});

test('manifest parser and serializer preserve files shape', () => {
  const parsed = parseGalleryIndex({ files: { 'gallery/A/1.png': 'abc' } });
  assert.deepEqual(parsed, { 'gallery/A/1.png': 'abc' });
  assert.deepEqual(JSON.parse(serializeGalleryIndex(parsed)), { files: parsed });
});

test('index updates are exact-path only', () => {
  const start = { 'gallery/A/1.png': 'aa', 'gallery/A/10.png': 'bb' };
  const added = addIndexEntries(start, [{ path: 'gallery/B/11.gif', perceptualHash: 'cc' }]);
  assert.equal(added['gallery/B/11.gif'], 'cc');
  assert.deepEqual(removeIndexEntry(start, 'gallery/A/1.png'), { 'gallery/A/10.png': 'bb' });
});
