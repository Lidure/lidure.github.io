import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('manager configuration is fixed to the Blog gallery repository', async () => {
  const config = await import('../src/lib/gallery-manage-config.mjs');
  assert.equal(config.GALLERY_REPOSITORY, 'Lidure/airi-gallery-images');
  assert.equal(config.GALLERY_BRANCH, 'main');
  assert.equal(config.GALLERY_ROOT, 'gallery');
  assert.equal(
    config.githubApi('/git/ref/heads/main'),
    'https://api.github.com/repos/Lidure/airi-gallery-images/git/ref/heads/main',
  );
  assert.equal(config.isSafeManagedImagePath('gallery/Bang/12.gif'), true);
  assert.equal(config.isSafeManagedImagePath('gallery/Bang/.airi-renumber-x.gif'), false);
  assert.equal(config.isSafeManagedImagePath('gallery/Bang/nested/12.gif'), false);
});

test('ephemeral token session never touches Web Storage', async () => {
  const source = await read('src/lib/gallery-manage-controller.mjs');
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.cookie/);
  const { createTokenSession } = await import('../src/lib/gallery-manage-controller.mjs');
  const session = createTokenSession();
  assert.equal(session.get(), '');
  session.set('secret-token');
  assert.equal(session.get(), 'secret-token');
  session.clear();
  assert.equal(session.get(), '');
});

test('native management route has no iframe or legacy overlay', async () => {
  const page = await read('src/pages/gallery/manage.astro');
  const workspace = await read('src/components/GalleryManageWorkspace.astro');
  const source = `${page}\n${workspace}`;
  assert.match(page, /GalleryManageWorkspace/);
  assert.match(page, /gallery-manage\.css/);
  assert.match(workspace, /gallery-manage-root/);
  assert.match(workspace, /gallery-manage-upload/);
  assert.match(workspace, /gallery-manage-grid/);
  assert.match(workspace, /gallery-manage-dialog/);
  assert.doesNotMatch(source, /<iframe/i);
  assert.doesNotMatch(source, /gallery-manager-overlay/);
});
