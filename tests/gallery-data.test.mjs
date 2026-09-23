import assert from 'node:assert/strict';
import test from 'node:test';
import * as galleryData from '../src/lib/gallery-data.mjs';
import {
  galleryProxyUrl,
  isGifPath,
  nextPagePrefetchCandidates,
  paginate,
  parseGalleryManifest,
} from '../src/lib/gallery-data.mjs';

test('manifest parser accepts only safe one-level gallery image paths', () => {
  const payload = {
    files: {
      'gallery/airi/10.png': { perceptual_hash: '0'.repeat(16) },
      'gallery/airi/2.gif': { perceptual_hash: '1'.repeat(16) },
      'gallery/cat/a.webp': { perceptual_hash: '2'.repeat(16) },
      'gallery/Bang/.airi-renumber-1-1787908336064376247-3797.gif': { perceptual_hash: '3'.repeat(16) },
      'gallery/airi/nested/b.png': {},
      'gallery/../secret.png': {},
      'gallery//empty.jpg': {},
      'gallery\\evil\\x.png': {},
      'gallery/airi/readme.txt': {},
      'README.md': {},
    },
  };

  assert.deepEqual(parseGalleryManifest(payload), [
    {
      category: 'airi',
      images: [
        { path: 'gallery/airi/2.gif', category: 'airi', filename: '2.gif', extension: '.gif' },
        { path: 'gallery/airi/10.png', category: 'airi', filename: '10.png', extension: '.png' },
      ],
    },
    {
      category: 'cat',
      images: [
        { path: 'gallery/cat/a.webp', category: 'cat', filename: 'a.webp', extension: '.webp' },
      ],
    },
  ]);
});

test('manifest parser rejects invalid payload shapes', () => {
  for (const payload of [null, {}, { files: [] }, { files: null }]) {
    assert.throws(() => parseGalleryManifest(payload), /图库索引格式无效/);
  }
});

test('pagination clamps invalid page numbers and reports totals', () => {
  const items = Array.from({ length: 50 }, (_, i) => i + 1);
  assert.deepEqual(paginate(items, 99, 24), {
    page: 3,
    pageSize: 24,
    totalPages: 3,
    totalItems: 50,
    items: [49, 50],
  });
  assert.equal(paginate([], 1, 24).totalPages, 1);
});

test('Gallery page size fills desktop five-column rows and compact rows', () => {
  assert.equal(typeof galleryData.galleryPageSizeForWidth, 'function');
  assert.equal(galleryData.galleryPageSizeForWidth(1440), 25);
  assert.equal(galleryData.galleryPageSizeForWidth(1181), 25);
  assert.equal(galleryData.galleryPageSizeForWidth(1180), 24);
  assert.equal(galleryData.galleryPageSizeForWidth(900), 24);
  assert.equal(galleryData.galleryPageSizeForWidth(390), 24);
});

test('Gallery page remapping keeps the previous first image visible after resize', () => {
  assert.equal(typeof galleryData.remapGalleryPage, 'function');
  assert.equal(galleryData.remapGalleryPage(2, 25, 24), 2);
  assert.equal(galleryData.remapGalleryPage(3, 25, 24), 3);
  assert.equal(galleryData.remapGalleryPage(3, 24, 25), 2);
  assert.equal(galleryData.remapGalleryPage(1, 25, 24), 1);
});

test('proxy URL encodes each path segment safely', () => {
  assert.equal(
    galleryProxyUrl('gallery/猫 羽/1 #.png'),
    'https://airigallery.lidure22.xyz/__gallery-image/gallery/%E7%8C%AB%20%E7%BE%BD/1%20%23.png',
  );
});

test('next page prefetch is bounded to two non-GIF images', () => {
  const images = [
    'gallery/a/1.png', 'gallery/a/2.png', 'gallery/a/3.png', 'gallery/a/4.png',
    'gallery/a/5.gif', 'gallery/a/6.webp', 'gallery/a/7.jpg', 'gallery/a/8.png',
  ].map((path) => ({
    path,
    category: 'a',
    filename: path.split('/').at(-1),
    extension: path.slice(path.lastIndexOf('.')).toLowerCase(),
  }));

  assert.deepEqual(
    nextPagePrefetchCandidates(images, 1, 4).map((item) => item.path),
    ['gallery/a/6.webp', 'gallery/a/7.jpg'],
  );
  assert.equal(isGifPath('gallery/a/5.GIF'), true);
});
