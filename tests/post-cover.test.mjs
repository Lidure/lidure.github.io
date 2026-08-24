import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractFirstMarkdownImage,
  resolvePostCover,
} from '../src/lib/post-cover.mjs';

test('extracts a Markdown image whose filename contains nested parentheses', () => {
  assert.equal(
    extractFirstMarkdownImage('before\n![cover](131770967_p0_master1200(1)(1).png)\nafter'),
    '131770967_p0_master1200(1)(1).png',
  );
});

test('ignores normal links and returns the first image only', () => {
  const body = '[doc](guide.md)\n![first](image-1.png)\n![second](image-2.png)';
  assert.equal(extractFirstMarkdownImage(body), 'image-1.png');
});

test('explicit frontmatter cover wins over a body image', () => {
  assert.equal(
    resolvePostCover({
      cover: '/manual-cover.jpg',
      body: '![x](image.png)',
      postId: 'hello-world.md',
      assets: { '../content/blog/image.png': '/_astro/image.hash.png' },
    }),
    '/manual-cover.jpg',
  );
});

test('relative first image resolves through the Vite content asset map', () => {
  assert.equal(
    resolvePostCover({
      body: '![x](image.png)',
      postId: '视觉光流.md',
      assets: { '../content/blog/image.png': '/_astro/image.hash.png' },
    }),
    '/_astro/image.hash.png',
  );
});

test('nested article paths resolve relative images without escaping the blog root', () => {
  assert.equal(
    resolvePostCover({
      body: '![x](../shared/cover.webp)',
      postId: 'notes/entry.md',
      assets: { '../content/blog/shared/cover.webp': '/_astro/cover.hash.webp' },
    }),
    '/_astro/cover.hash.webp',
  );
});

test('remote and root-relative first images remain usable as-is', () => {
  assert.equal(resolvePostCover({ body: '![x](https://example.com/a.jpg)', postId: 'a.md', assets: {} }), 'https://example.com/a.jpg');
  assert.equal(resolvePostCover({ body: '![x](/images/a.jpg)', postId: 'a.md', assets: {} }), '/images/a.jpg');
});

test('missing local assets fall back to text-only instead of a broken source-relative URL', () => {
  assert.equal(resolvePostCover({ body: '![x](missing.png)', postId: 'a.md', assets: {} }), '');
});
