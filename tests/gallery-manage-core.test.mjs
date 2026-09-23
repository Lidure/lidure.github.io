import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

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

test('GitHub token session persists only for the current browser session', async () => {
  const source = await read('src/lib/gallery-manage-controller.mjs');
  assert.doesNotMatch(source, /localStorage|document\.cookie/);
  assert.match(source, /sessionStorage/);
  const { createTokenSession, GALLERY_TOKEN_SESSION_KEY } = await import('../src/lib/gallery-manage-controller.mjs');
  const storage = memoryStorage();
  const session = createTokenSession(storage);
  assert.equal(session.get(), '');
  session.set('secret-token');
  assert.equal(session.get(), 'secret-token');
  assert.equal(storage.getItem(GALLERY_TOKEN_SESSION_KEY), 'secret-token');

  const restored = createTokenSession(storage);
  assert.equal(restored.get(), 'secret-token');
  restored.clear();
  assert.equal(storage.getItem(GALLERY_TOKEN_SESSION_KEY), null);
  assert.equal(session.get(), '');
});

test('controller cleanup does not erase a valid session token', async () => {
  const source = await read('src/lib/gallery-manage-controller.mjs');
  const cleanupBody = source.split('return () => {')[1] || '';
  assert.doesNotMatch(cleanupBody, /tokenSession\.clear\(\)/);
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

test('connection keeps write controls locked until the first remote sync completes', async () => {
  const source = await read('src/lib/gallery-manage-controller.mjs');
  const connectBody = source.split('async function connect() {')[1]?.split('async function addFiles')[0] || '';
  const connectedAt = connectBody.indexOf('state.connected = true');
  const syncAt = connectBody.indexOf('await syncRemote()');
  const unlockAt = connectBody.indexOf('setBusy(false)', connectedAt);
  assert.ok(connectedAt >= 0 && syncAt > connectedAt, 'connect must establish authenticated state before initial remote sync');
  assert.ok(unlockAt > syncAt, 'write controls must stay disabled until the initial remote sync finishes');
});

test('management lifecycle remounts after BFCache restore without destroying session credentials', async () => {
  const workspace = await read('src/components/GalleryManageWorkspace.astro');
  assert.match(workspace, /addEventListener\(['"]pagehide['"],\s*cleanupGalleryManage\)/);
  assert.match(workspace, /addEventListener\(['"]pageshow['"],/);
  assert.match(workspace, /event\.persisted/);
  assert.match(workspace, /mountGalleryManage\(\)/);
});
