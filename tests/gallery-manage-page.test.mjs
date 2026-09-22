import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('native manager is a standalone Blog page with no iframe or legacy overlay', async () => {
  const page = await read('src/pages/gallery/manage.astro');
  assert.match(page, /GalleryManageWorkspace/);
  assert.match(page, /GalleryManageDialog/);
  assert.match(page, /gallery-manage\.css/);
  assert.doesNotMatch(page, /<iframe/i);
  assert.doesNotMatch(page, /GalleryManager/);
  assert.doesNotMatch(page, /gallery-manager-overlay/);
});

test('workspace exposes connection, sync, upload and native browsing surfaces', async () => {
  const workspace = await read('src/components/GalleryManageWorkspace.astro');
  for (const id of [
    'gallery-manage-root',
    'gallery-manage-status',
    'gallery-manage-connect',
    'gallery-manage-disconnect',
    'gallery-manage-sync',
    'gallery-manage-category',
    'gallery-manage-new-category',
    'gallery-manage-dropzone',
    'gallery-manage-file-input',
    'gallery-manage-upload',
    'gallery-manage-queue',
    'gallery-manage-categories',
    'gallery-manage-grid',
    'gallery-manage-pager',
  ]) assert.match(workspace, new RegExp(`id=["']${id}["']`));
  assert.match(workspace, /返回画廊/);
});

test('one Blog-owned dialog foundation supports all management dialogs', async () => {
  const dialog = await read('src/components/GalleryManageDialog.astro');
  assert.match(dialog, /role="dialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /gallery-manage-dialog/);
  assert.doesNotMatch(dialog, /iframe/i);
});
