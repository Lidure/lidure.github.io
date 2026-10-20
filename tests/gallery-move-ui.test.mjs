import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = p => readFileSync(p, 'utf8');
const controller = src('src/lib/gallery-manage-controller.mjs');
const layout = src('src/components/GalleryManageWorkspace.astro');
const style = src('src/styles/gallery-manage-components.css');

test('native blog gallery contains opt-in batch move toolbar', () => {
  for (const id of [
    'gallery-manage-move-bar', 'gallery-manage-move-mode', 'gallery-manage-move-tools',
    'gallery-manage-move-count', 'gallery-manage-move-page', 'gallery-manage-move-clear',
    'gallery-manage-move-open',
  ]) {
    assert.ok(layout.includes('id="' + id + '"'), id);
    assert.ok(controller.includes("root.querySelector('#" + id + "')"), id);
  }
  assert.ok(controller.includes('state.connected && !!state.selectedCategory'));
  assert.ok(controller.includes('state.moveSelection.size < CLOUD_MOVE_MAX'));
  assert.ok(controller.includes('resetMoveSelection()'));
  assert.ok(controller.includes('state.moveSelection.add(image.path)'));
});
test('visual confirmation binds to fixed GitHub repository with one-time commit', () => {
  assert.match(controller, /import \{ previewCloudMove, confirmCloudMove, CLOUD_MOVE_MAX \}/);
  assert.ok(controller.includes("owner: 'Lidure', repo: 'airi-gallery-images'"));
  assert.ok(controller.includes('request: state.client.request'));
  assert.ok(controller.includes("image.loading = 'lazy'"));
  assert.ok(controller.includes('plan = null; // A confirmed preview can only be submitted once.'));
  assert.ok(controller.includes('renderGrid();'));
  assert.ok(controller.includes("move.textContent = '移动'"));
  assert.ok(controller.includes("setStatus('GitHub 已提交迁移，但页面刷新失败"));
  assert.ok(!layout.includes('onclick='));
});
test('move dialog displays actual images rather than a number list', () => {
  assert.ok(controller.includes('galleryProxyUrl(path)'));
  assert.ok(controller.includes('thumb.classList.toggle(\'is-large\')'));
  assert.ok(controller.includes("'预览迁移'"));
  assert.ok(controller.includes("'确认移动 '"));
  assert.ok(!controller.includes("paths.map(path => '#'"));
  assert.ok(style.includes('.gallery-manage-move-preview'));
  assert.ok(style.includes('.gallery-manage-card.is-move-selected'));
});
