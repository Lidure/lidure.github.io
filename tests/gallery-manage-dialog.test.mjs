import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('dialog controller uses one layer with escape, focus trap and focus restoration', async () => {
  const source = await read('src/lib/gallery-manage-dialog-controller.mjs');
  assert.match(source, /event\.key\s*===\s*['"]Escape['"]/);
  assert.match(source, /event\.key\s*!==\s*['"]Tab['"]/);
  assert.match(source, /previouslyFocused/);
  assert.match(source, /\.focus\(\)/);
  assert.doesNotMatch(source, /modal-mask|confirm-mask|iframe/);
});
