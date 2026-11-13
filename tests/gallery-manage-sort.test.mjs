import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  galleryImageIndex,
  sortManagedImages,
  MANAGE_SORT_MODES,
} from '../src/lib/gallery-manage-sort.mjs';

const source = [
  { path: 'gallery/甲/2.png', category: '甲', filename: '2.png' },
  { path: 'gallery/乙/11.png', category: '乙', filename: '11.png' },
  { path: 'gallery/甲/1.jpg', category: '甲', filename: '1.jpg' },
  { path: 'gallery/乙/cover.webp', category: '乙', filename: 'cover.webp' },
];

const names = (items) => items.map(item => item.filename);

test('All mode uses global numeric IDs before pagination', () => {
  const result = sortManagedImages(source, 'index_desc');
  assert.deepEqual(names(result), ['11.png', '2.png', '1.jpg', 'cover.webp']);
  assert.deepEqual(names(sortManagedImages(source, 'index_asc')), [
    '1.jpg', '2.png', '11.png', 'cover.webp',
  ]);
  assert.deepEqual(names(result.slice(0, 2)), ['11.png', '2.png']);
});

test('cloud time sort transparently approximates chronological order using global IDs', () => {
  assert.deepEqual(names(sortManagedImages(source, 'time_desc')), names(sortManagedImages(source, 'index_desc')));
  assert.deepEqual(names(sortManagedImages(source, 'time_asc')), names(sortManagedImages(source, 'index_asc')));
});

test('name sorting and invalid mode fallback are deterministic', () => {
  assert.deepEqual(names(sortManagedImages(source, 'name_asc')), [
    '1.jpg', '11.png', '2.png', 'cover.webp',
  ]);
  assert.deepEqual(names(sortManagedImages(source, 'name_desc')), [
    'cover.webp', '2.png', '11.png', '1.jpg',
  ]);
  assert.deepEqual(sortManagedImages(source, 'nonsense'), sortManagedImages(source, 'time_desc'));
  assert.deepEqual(names(source), ['2.png', '11.png', '1.jpg', 'cover.webp']);
  assert.equal(galleryImageIndex({ filename: '145.jpg' }), 145);
  assert.equal(galleryImageIndex({ filename: 'cover.webp' }), null);
  assert.equal(MANAGE_SORT_MODES.length, 6);
});

test('native management page includes sort controls and keeps existing All category', async () => {
  const html = await readFile(new URL('../src/components/GalleryManageWorkspace.astro', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../src/lib/gallery-manage-controller.mjs', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/styles/gallery-manage-components.css', import.meta.url), 'utf8');
  assert.match(html, /id="gallery-manage-sort"/);
  assert.match(html, /value="time_desc"/);
  assert.match(html, /value="index_asc"/);
  assert.match(html, /按全局编号近似/);
  assert.match(controller, /label: '全部'/);
  assert.match(controller, /return sortManagedImages\(images, state\.sortMode\)/);
  assert.match(controller, /state\.page = 1;\s*renderGrid\(\);/);
  assert.match(controller, /paginate\(currentImages\(\), state\.page, PAGE_SIZE\)/);
  assert.match(css, /\.gallery-manage-sort-toolbar/);
});
