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
    [{ name: 'x.gif', perceptualHash: 'aaaaaaaaaaaaaaaa' }, { name: 'y.webp', perceptualHash: 'bbbbbbbbbbbbbbbb' }],
  );
  assert.deepEqual(plans.map(item => item.path), ['gallery/Bang/13.gif', 'gallery/Bang/14.webp']);
});

test('unsafe category names are rejected before path planning', () => {
  for (const category of ['', '.', '..', 'A/B', 'A\\B']) {
    assert.throws(() => planUploadPaths([], category, [{ name: 'x.png' }]), /分类/);
  }
});

test('manifest parser and serializer preserve production perceptual-index shape', () => {
  const payload = {
    version: 1,
    algorithm: 'dhash64-nn-white-v1',
    files: {
      'gallery/A/1.png': { perceptual_hash: '0123456789abcdef' },
      'gallery/A/bad.png': { perceptual_hash: 'not-a-hash' },
    },
  };
  const parsed = parseGalleryIndex(payload);
  assert.deepEqual(parsed, { 'gallery/A/1.png': '0123456789abcdef' });
  assert.deepEqual(JSON.parse(serializeGalleryIndex(parsed)), {
    version: 1,
    algorithm: 'dhash64-nn-white-v1',
    files: {
      'gallery/A/1.png': { perceptual_hash: '0123456789abcdef' },
    },
  });
});

test('index updates are exact-path only', () => {
  const start = { 'gallery/A/1.png': 'aaaaaaaaaaaaaaaa', 'gallery/A/10.png': 'bbbbbbbbbbbbbbbb' };
  const added = addIndexEntries(start, [{ path: 'gallery/B/11.gif', perceptualHash: 'cccccccccccccccc' }]);
  assert.equal(added['gallery/B/11.gif'], 'cccccccccccccccc');
  assert.deepEqual(removeIndexEntry(start, 'gallery/A/1.png'), { 'gallery/A/10.png': 'bbbbbbbbbbbbbbbb' });
});
