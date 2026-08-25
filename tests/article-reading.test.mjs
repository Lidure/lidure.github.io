import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('article page exposes editorial metadata and reading-time hooks', () => {
  const page = read('src/pages/posts/[slug].astro');
  const util = read('src/utils/article-reading.ts');

  assert.match(util, /export function estimateReadingMinutes\(source: string\)/);
  assert.match(util, /[\\u3400-\\u9fff]/);
  assert.match(page, /estimateReadingMinutes\(post\.body/);
  assert.match(page, /class="article-meta-rail"/);
  assert.match(page, /class="article-issue-stamp"/);
  assert.match(page, /class="article-reading-time"/);
  assert.match(page, /class="article-tag-list"/);
});

test('article page scopes reading progress to the prose region', () => {
  const page = read('src/pages/posts/[slug].astro');
  assert.match(page, /class="article-reading-progress"/);
  assert.match(page, /--article-reading-progress/);
  assert.match(page, /getBoundingClientRect\(\)/);
  assert.match(page, /document\.addEventListener\(['"]astro:page-load['"]/);
  assert.match(page, /prefers-reduced-motion/);
  assert.match(page, /astro:before-swap/);
});

test('article stylesheet provides editorial hierarchy and responsive media', () => {
  const css = read('src/styles/article-reading.css');
  assert.match(css, /\.post-shell\s*\{[\s\S]*max-width:\s*980px/);
  assert.match(css, /\.post-shell \.prose\s*\{[\s\S]*max-width:\s*760px/);
  assert.match(css, /\.prose p:has\(> img:only-child\)/);
  assert.match(css, /\.prose h2::before/);
  assert.match(css, /\.prose blockquote/);
  assert.match(css, /\.prose pre/);
  assert.match(css, /\.prose table/);
  assert.match(css, /article-reading-progress/);
  assert.match(css, /@media \(max-width:\s*760px\)/);
  assert.match(css, /var\(--card-opacity-percent/);
});

test('article comments are separated from prose by an editorial boundary', () => {
  const page = read('src/pages/posts/[slug].astro');
  const css = read('src/styles/article-reading.css');
  assert.match(page, /class="article-comments-boundary"/);
  assert.match(page, /class="article-comments-label"/);
  assert.match(css, /\.article-comments-boundary/);
});
