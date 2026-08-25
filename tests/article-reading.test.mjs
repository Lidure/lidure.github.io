import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/posts/[slug].astro');
const layout = read('src/layouts/BaseLayout.astro');

test('article can opt out of the standard banner without changing the standard surface', () => {
  assert.match(layout, /showBanner\?: boolean/);
  assert.match(layout, /showBanner\s*=\s*true/);
  assert.match(layout, /\{showBanner\s*&&\s*\(/);
  assert.match(layout, /class="standard-page-surface"/);
  assert.match(page, /showBanner=\{false\}/);
});

test('article uses the personal-publication structure and retires PR 43 chrome', () => {
  assert.match(page, /const \{ Content, headings \} = await render\(post\)/);
  assert.match(page, /const chapterHeadings = headings\.filter\(\(heading\) => heading\.depth === 2\)/);
  assert.match(page, /class="article-publication"/);
  assert.match(page, /class="article-masthead"/);
  assert.match(page, /class="article-title"/);
  assert.match(page, /class="article-deck"/);
  assert.match(page, /class="article-meta"/);
  assert.match(page, /class="article-tags"/);
  assert.match(page, /class="article-reading-canvas"/);
  assert.match(page, /class="article-bookmark"/);
  assert.match(page, /class="article-end"/);
  assert.match(page, /class="article-comments"/);
  assert.doesNotMatch(page, /ISSUE\s*\{/);
  assert.doesNotMatch(page, /article-meta-rail/);
  assert.doesNotMatch(page, /article-comments-label/);
  assert.doesNotMatch(page, /Discussion/);
  assert.doesNotMatch(page, /class="post-shell"/);
});
