import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const helperUrl = new URL('../src/lib/article-toc.mjs', import.meta.url);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('article toc keeps only H2 and H3 in source order', async () => {
  const { buildArticleToc } = await import(helperUrl.href + `?t=${Date.now()}`);
  const result = buildArticleToc([
    { depth: 1, slug: 'title', text: 'Title' },
    { depth: 2, slug: 'first', text: 'First' },
    { depth: 4, slug: 'deep', text: 'Deep' },
    { depth: 3, slug: 'child', text: 'Child' },
  ]);
  assert.deepEqual(result, [
    { depth: 2, slug: 'first', text: 'First' },
    { depth: 3, slug: 'child', text: 'Child' },
  ]);
});

test('article toc hides when navigation value is too low', async () => {
  const { shouldShowArticleToc } = await import(helperUrl.href + `?t=${Date.now()}`);
  assert.equal(shouldShowArticleToc([]), false);
  assert.equal(shouldShowArticleToc([{ depth: 2, slug: 'one', text: 'One' }]), false);
  assert.equal(shouldShowArticleToc([
    { depth: 2, slug: 'one', text: 'One' },
    { depth: 3, slug: 'two', text: 'Two' },
  ]), true);
});
