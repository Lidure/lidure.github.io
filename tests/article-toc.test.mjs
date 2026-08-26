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
  assert.match(toc, /class="[^"]*article-toc-desktop[^"]*"/);
  assert.match(toc, /class="[^"]*article-toc-mobile[^"]*"/);
  assert.match(toc, /<details/);
  assert.match(toc, /data-depth=\{entry\.depth\}/);
  assert.match(toc, /data-article-heading=\{entry\.slug\}/);
  assert.match(toc, /href=\{`#\$\{entry\.slug\}`\}/);
});

test('toc controller supports scrollspy, reduced motion, mobile close, and Astro cleanup', () => {
  const toc = read('src/components/ArticleToc.astro');
  assert.match(toc, /__articleTocCleanup/);
  assert.match(toc, /AbortController/);
  assert.match(toc, /prefers-reduced-motion:\s*reduce/);
  assert.match(toc, /dataset\.reduceMotion/);
  assert.match(toc, /classList\.toggle\('is-current'/);
  assert.match(toc, /history\.replaceState/);
  assert.match(toc, /scrollIntoView/);
  assert.match(toc, /closest\('details'/);
  assert.match(toc, /astro:page-load/);
  assert.match(toc, /astro:before-swap/);
  assert.match(toc, /--article-reading-progress/);
});

test('article css is reading-first and responsive', () => {
  const css = read('src/styles/article.css');
  assert.match(css, /\.article-prose\s*\{[\s\S]*max-width:\s*var\(--reading-max\)/);
  assert.match(css, /\.article-toc-desktop[\s\S]*position:\s*sticky/);
  assert.match(css, /\.article-toc-link\.is-current/);
  assert.match(css, /li\[data-depth=['"]3['"]\]/);
  assert.match(css, /max-height:\s*calc\(100vh/);
  assert.match(css, /\.article-toc-mobile/);
  assert.match(css, /@media \(max-width:\s*940px\)/);
  assert.match(css, /\.article-prose blockquote/);
  assert.match(css, /\.article-prose pre/);
  assert.match(css, /\.article-prose table/);
  assert.match(css, /scroll-margin-top/);
  assert.doesNotMatch(css, /box-shadow:\s*0\s+18px\s+60px/);
});
