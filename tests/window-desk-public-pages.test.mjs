import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('posts page is writing-only and archive is a dedicated route', () => {
  const posts = read('src/pages/posts/index.astro');
  assert.equal(existsSync(new URL('../src/pages/archive.astro', import.meta.url)), true);
  assert.doesNotMatch(posts, /getGitHubProjects/);
  assert.doesNotMatch(posts, /GitHub 项目/);
  assert.match(posts, /文章/);
  assert.match(posts, /#\{tag\}/);

  const archive = read('src/pages/archive.astro');
  assert.match(archive, /归档/);
  assert.match(archive, /getCollection\('blog'/);
  assert.match(archive, /archive-year/);
});

test('tags are an index instead of a pill cloud', () => {
  const tags = read('src/pages/tags/index.astro');
  assert.match(tags, /tag-index-link/);
  assert.doesNotMatch(tags, /tag-pill/);
  assert.match(tags, /<sup>\{count\}<\/sup>/);
});
