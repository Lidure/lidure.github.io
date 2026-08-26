import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const helperUrl = new URL('../src/lib/article-toc.mjs', import.meta.url);
const componentUrl = new URL('../src/components/ArticleToc.astro', import.meta.url);
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

test('article page renders the shared H2/H3 toc component', () => {
  assert.equal(existsSync(componentUrl), true, 'ArticleToc component should exist');

  const page = read('src/pages/posts/[slug].astro');
  const toc = read('src/components/ArticleToc.astro');

  assert.match(page, /buildArticleToc\(headings\)/);
  assert.match(page, /shouldShowArticleToc\(tocEntries\)/);
  assert.match(page, /<ArticleToc entries=\{tocEntries\}/);
  assert.match(toc, /class="article-toc-desktop"/);
  assert.match(toc, /class="article-toc-mobile"/);
  assert.match(toc, /<details/);
  assert.match(toc, /data-depth=\{entry\.depth\}/);
  assert.match(toc, /data-article-heading=\{entry\.slug\}/);
  assert.match(toc, /href=\{`#\$\{entry\.slug\}`\}/);
});
