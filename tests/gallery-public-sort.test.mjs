import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { galleryImageIndex, sortManagedImages } from '../src/lib/gallery-manage-sort.mjs';
import { paginate, nextPagePrefetchCandidates } from '../src/lib/gallery-data.mjs';

const categories = [
  { category: '爱莉', images: [
    { path: 'gallery/爱莉/2.png', category: '爱莉', filename: '2.png' },
    { path: 'gallery/爱莉/1.jpg', category: '爱莉', filename: '1.jpg' },
  ] },
  { category: '猫羽', images: [
    { path: 'gallery/猫羽/11.webp', category: '猫羽', filename: '11.webp' },
    { path: 'gallery/猫羽/封面.gif', category: '猫羽', filename: '封面.gif' },
  ] },
];
const all = categories.flatMap(category => category.images);
const names = images => images.map(item => item.path);

test('All merges categories and orders globally before pagination', () => {
  const sorted = sortManagedImages(all, 'time_desc');
  assert.deepEqual(names(sorted), [
    'gallery/猫羽/11.webp', 'gallery/爱莉/2.png', 'gallery/爱莉/1.jpg', 'gallery/猫羽/封面.gif',
  ]);
  const page1 = paginate(sorted, 1, 2);
  const page2 = paginate(sorted, 2, 2);
  assert.equal(page1.totalItems, 4);
  assert.deepEqual(names([...page1.items, ...page2.items]), names(sorted));
  assert.equal(page2.page, 2);
  assert.deepEqual(categories[0].images.map(x => x.filename), ['2.png', '1.jpg']);
});

test('All and individual categories support all sorting modes without modifying manifest', () => {
  assert.deepEqual(names(sortManagedImages(all, 'time_desc')), names(sortManagedImages(all, 'index_desc')));
  assert.deepEqual(names(sortManagedImages(all, 'time_asc')), names(sortManagedImages(all, 'index_asc')));
  assert.deepEqual(names(sortManagedImages(all, 'index_asc')).slice(0, 3), [
    'gallery/爱莉/1.jpg', 'gallery/爱莉/2.png', 'gallery/猫羽/11.webp',
  ]);
  assert.deepEqual(names(sortManagedImages(categories[0].images, 'index_asc')), [
    'gallery/爱莉/1.jpg', 'gallery/爱莉/2.png',
  ]);
  assert.equal(sortManagedImages(all, 'name_desc').length, 4);
  assert.equal(galleryImageIndex(all[3]), null);
});

test('prefetch candidates still respect sorted next-page order and GIF exclusion', () => {
  const sorted = sortManagedImages(all, 'index_desc');
  const prefetch = nextPagePrefetchCandidates(sorted, 1, 2, 2);
  assert.deepEqual(prefetch.map(item => item.filename), ['1.jpg']);
});

test('public gallery has an explicit All filter and sort selection', async () => {
  const component = await readFile(new URL('../src/components/GalleryBrowser.astro', import.meta.url), 'utf8');
  const controller = await readFile(new URL('../src/lib/gallery-browser-controller.mjs', import.meta.url), 'utf8');
  const css = await readFile(new URL('../src/styles/gallery.css', import.meta.url), 'utf8');

  assert.match(component, /id="gallery-sort"/);
  assert.match(component, /value="time_desc"/);
  assert.match(component, /value="time_asc"/);
  assert.match(component, /value="index_desc"/);
  assert.match(component, /value="index_asc"/);
  assert.match(component, /value="name_asc"/);
  assert.match(component, /value="name_desc"/);
  assert.match(component, /按全局编号近似/);
  assert.match(controller, /category:\s*'', label:\s*'全部'/);
  assert.match(controller, /state\.categories\.flatMap\(/);
  assert.match(controller, /sortManagedImages\(category\.images, state\.sortMode\)/);
  assert.match(controller, /state\.sortMode = sortSelect\.value;\s*state\.page = 1/);
  assert.match(controller, /sortSelect\.removeEventListener\('change', onSortChange\)/);
  assert.match(controller, /gallery:image-open/);
  assert.match(controller, /nextPagePrefetchCandidates\(/);
  assert.match(css, /\.gallery-sort-toolbar/);
  assert.match(css, /@media \(max-width: 720px\)/);
});

test('All uses empty sentinel, never colliding with a literal 分类“全部”', async () => {
  const controller = await readFile(new URL('../src/lib/gallery-browser-controller.mjs', import.meta.url), 'utf8');
  assert.match(controller, /category:\s*''\s*,\s*images:\s*state\.categories\.flatMap/);
  assert.match(controller, /state\.category\s*\?\s*state\.categories\.find/);
  const example = [...categories, { category: '全部', images: [{ path: 'gallery/全部/8.png', category: '全部', filename: '8.png' }] }];
  assert.equal(example.find(entry => entry.category === '全部').images.length, 1);
  assert.equal(example.flatMap(entry => entry.images).length, 5);
});
