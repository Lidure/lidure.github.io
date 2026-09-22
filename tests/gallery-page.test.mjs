import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('gallery route joins Blog navigation and responsive styling', async () => {
  const [page, header, css] = await Promise.all([
    read('src/pages/gallery.astro'),
    read('src/components/SiteHeader.astro'),
    read('src/styles/gallery.css'),
  ]);
  assert.match(header, /href:\s*['"]\/gallery['"][^}]*label:\s*['"]画廊['"]/);
  assert.match(page, /BaseLayout/);
  assert.match(page, /GalleryBrowser/);
  assert.match(page, /GalleryLightbox/);
  assert.match(page, /GalleryManager/);
  assert.match(page, /gallery\.css/);
  assert.match(css, /\.gallery-grid/);
  assert.match(css, /grid-template-columns/);
  assert.match(css, /repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*1180px\)[\s\S]*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*900px\)[\s\S]*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /\.gallery-manager-overlay/);
  assert.match(css, /\.gallery-lightbox/);
});

test('gallery shell neutralizes Grid automatic minimum sizing', async () => {
  const css = await read('src/styles/gallery.css');
  assert.match(
    css,
    /\.gallery-page-shell\s*\{[^}]*\bmin-width:\s*0\s*;/s,
    'the page shell must allow the parent Grid track to shrink instead of using the category strip min-content width',
  );
});

test('gallery categories use a wrapped filter panel instead of a single scrolling row', async () => {
  const [component, css] = await Promise.all([
    read('src/components/GalleryBrowser.astro'),
    read('src/styles/gallery.css'),
  ]);

  assert.match(component, /class="gallery-filter-panel"/);
  assert.match(component, /class="gallery-filter-heading"/);
  assert.match(css, /\.gallery-category-tabs\s*\{[^}]*\bflex-wrap:\s*wrap\s*;/s);
  assert.doesNotMatch(css, /\.gallery-category-tabs\s*\{[^}]*\boverflow-x:\s*auto\s*;/s);
});
