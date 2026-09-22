import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const requiredIds = [
  'gallery-manage-root',
  'gallery-manage-status',
  'gallery-manage-connect',
  'gallery-manage-sync',
  'gallery-manage-disconnect',
  'gallery-manage-dropzone',
  'gallery-manage-file-input',
  'gallery-manage-category-select',
  'gallery-manage-new-category',
  'gallery-manage-upload-list',
  'gallery-manage-tabs',
  'gallery-manage-grid',
  'gallery-manage-pager',
];

test('standalone route composes native workspace and its isolated stylesheet', async () => {
  const page = await read('src/pages/gallery/manage.astro');
  assert.match(page, /BaseLayout/);
  assert.match(page, /GalleryManageWorkspace/);
  assert.match(page, /gallery-manage\.css/);
  assert.doesNotMatch(page, /<iframe|GalleryManager|airigallery\.lidure22\.xyz/i);
});

test('workspace exposes required management regions and one dialog', async () => {
  const workspace = await read('src/components/GalleryManageWorkspace.astro');
  for (const id of requiredIds) assert.match(workspace, new RegExp(`id=["']${id}["']`));
  assert.match(workspace, /GalleryManageDialog/);
  assert.match(workspace, /返回画廊/);
  assert.match(workspace, /连接 GitHub/);
  assert.match(workspace, /拖拽|拖放/);
  assert.doesNotMatch(workspace, /<iframe|modal-mask|confirm-mask/i);
});

test('management CSS uses native responsive two-region layout without one-line categories', async () => {
  const css = await read('src/styles/gallery-manage.css');
  assert.match(css, /\.gallery-manage-layout\s*\{[^}]*grid-template-columns:/s);
  assert.match(css, /\.gallery-manage-tabs\s*\{[^}]*flex-wrap:\s*wrap/s);
  assert.match(css, /@media\s*\(max-width:\s*720px\)/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /@media\s*\(hover:\s*none\)/);
  assert.doesNotMatch(css, /overflow-x:\s*auto[^}]*gallery-manage-tabs/s);
});
