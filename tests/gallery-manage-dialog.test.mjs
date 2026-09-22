import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('management uses one accessible Blog-owned dialog surface', async () => {
  const component = await read('src/components/GalleryManageDialog.astro');
  assert.equal((component.match(/role=["']dialog["']/g) || []).length, 1);
  assert.match(component, /id=["']gallery-manage-dialog["']/);
  assert.match(component, /aria-modal=["']true["']/);
  assert.match(component, /gallery-manage-dialog-backdrop/);
  assert.doesNotMatch(component, /<iframe/i);
  assert.doesNotMatch(component, /modal-mask|confirm-mask/);
});

test('dialog controller owns Escape, focus trap and focus restoration', async () => {
  const controller = await read('src/lib/gallery-manage-dialog-controller.mjs');
  assert.match(controller, /event\.key\s*===\s*['"]Escape['"]/);
  assert.match(controller, /previouslyFocused|invoker/);
  assert.match(controller, /\.focus\(\)/);
  assert.match(controller, /Tab/);
  assert.match(controller, /gallery-manage-dialog-open/);
  assert.doesNotMatch(controller, /contentWindow|contentDocument|postMessage/);
});
