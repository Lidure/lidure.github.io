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

test('Gallery index path remains canonical', () => {
  assert.equal(GALLERY_INDEX_PATH, 'gallery/gallery_index.json');
});

test('next image number is global across categories', () => {
  const tree = [
    { type: 'blob', path: 'gallery/A/8.png' },
    { type: 'blob', path: 'gallery/B/12.gif' },
    { type: 'blob', path: 'gallery/B/not-number.png' },
  ];
  assert.equal(nextGlobalImageNumber(tree), 13);
});

test('planned paths preserve extensions and increment globally', () => {
  const plans = planUploadPaths(
    [{ type: 'blob', path: 'gallery/A/12.png' }],
    'Bang',
    [{ name: 'x.gif' }, { name: 'y.webp' }],
  );
  assert.deepEqual(plans.map(item => item.path), ['gallery/Bang/13.gif', 'gallery/Bang/14.webp']);
});

test('unsafe categories are rejected', () => {
  for (const category of ['../Bang', 'A/B', 'A\\B', '.', '..', '']) {
    assert.throws(() => planUploadPaths([], category, [{ name: 'x.png' }]), /分类/);
  }
});

test('manifest parser accepts files wrapper and serialization is stable', () => {
  const parsed = parseGalleryIndex({ files: { 'gallery/A/1.png': 'abcd' } });
  assert.deepEqual(parsed, { 'gallery/A/1.png': 'abcd' });
  assert.equal(serializeGalleryIndex(parsed), '{\n  "files": {\n    "gallery/A/1.png": "abcd"\n  }\n}\n');
});

test('index mutations affect exact paths only', () => {
  const index = { 'gallery/A/1.png': 'aa', 'gallery/A/10.png': 'bb' };
  assert.deepEqual(removeIndexEntry(index, 'gallery/A/1.png'), { 'gallery/A/10.png': 'bb' });
  assert.deepEqual(addIndexEntries(index, [{ path: 'gallery/B/11.gif', perceptualHash: 'cc' }]), {
    'gallery/A/1.png': 'aa',
    'gallery/A/10.png': 'bb',
    'gallery/B/11.gif': 'cc',
  });
});
