import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('article page exposes editorial reading structure', () => {
  const page = read('src/pages/posts/[slug].astro');
  const util = read('src/utils/article-reading.ts');
  const css = read('src/styles/article-reading.css');

  assert.match(util, /export function estimateReadingMinutes\(source: string\)/);
  assert.match(util, /[\\u3400-\\u9fff]/);
  assert.match(page, /estimateReadingMinutes\(post\.body/);
  assert.match(page, /class="article-meta-rail"/);
  assert.match(page, /class="article-issue-stamp"/);
  assert.match(page, /class="article-reading-time"/);
  assert.match(page, /class="article-tag-list"/);
  assert.match(page, /class="article-reading-progress"/);
  assert.match(page, /--article-reading-progress/);
  assert.match(page, /getBoundingClientRect\(\)/);
  assert.match(page, /astro:page-load/);
  assert.match(page, /prefers-reduced-motion/);

  assert.match(css, /\.post-shell[^\{]*\{[\s\S]*?max-width:\s*980px/);
  assert.match(css, /\.post-shell \.prose[^\{]*\{[\s\S]*?max-width:\s*760px/);
  assert.match(css, /\.prose p:has\(> img:only-child\)/);
  assert.match(css, /\.prose h2::before/);
  assert.match(css, /\.prose blockquote/);
  assert.match(css, /\.prose pre/);
  assert.match(css, /\.prose table/);
  assert.match(css, /article-reading-progress/);
  assert.match(css, /@media \(max-width:\s*760px\)/);
  assert.match(css, /data-card-opacity/);
  assert.match(css, /data-card-border="false"/);
});
