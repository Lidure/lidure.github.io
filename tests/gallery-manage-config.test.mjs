import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GALLERY_BRANCH,
  GALLERY_REPOSITORY,
  GALLERY_ROOT,
  githubApi,
  isSafeManagedImagePath,
} from '../src/lib/gallery-manage-config.mjs';

test('native manager is permanently scoped to the Airi Gallery image repository', () => {
  assert.equal(GALLERY_REPOSITORY, 'Lidure/airi-gallery-images');
  assert.equal(GALLERY_BRANCH, 'main');
  assert.equal(GALLERY_ROOT, 'gallery');
  assert.equal(
    githubApi('/git/refs/heads/main'),
    'https://api.github.com/repos/Lidure/airi-gallery-images/git/refs/heads/main',
  );
});

test('managed paths reject staging, traversal, nesting and unsupported files', () => {
  assert.equal(isSafeManagedImagePath('gallery/Bang/12.gif'), true);
  assert.equal(isSafeManagedImagePath('gallery/Bang/.airi-renumber-1.gif'), false);
  assert.equal(isSafeManagedImagePath('gallery/Bang/nested/12.gif'), false);
  assert.equal(isSafeManagedImagePath('gallery/../12.gif'), false);
  assert.equal(isSafeManagedImagePath('gallery/Bang/readme.txt'), false);
});
