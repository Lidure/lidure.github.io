import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('search embeds parseable post data without a runtime jsonData reference', () => {
  const html = read('search/index.html');
  assert.doesNotMatch(html, /\$\{jsonData\}/);

  const match = html.match(
    /<script id="__SEARCH_DATA" type="application\/json">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, 'search data script should be present');

  const posts = JSON.parse(match[1]);
  assert.ok(posts.some((post) => post.title.includes('光流')));
});

test('public URLs use the custom domain and include social metadata', () => {
  const sitemap = read('sitemap-index.xml');
  const home = read('index.html');

  assert.match(sitemap, /https:\/\/lidure22\.xyz\/sitemap-0\.xml/);
  assert.match(home, /rel="canonical" href="https:\/\/lidure22\.xyz\/"/);
  assert.match(home, /property="og:title"/);
});

test('optical-flow article has one h1 and no unparsed inline delimiters', () => {
  const html = read('posts/视觉光流公式推导与文献/index.html');

  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /\\\(/);
});

test('optimized identity assets are used and remain small', () => {
  const home = read('index.html');

  assert.match(home, /\/p0-256\.webp/);
  assert.match(home, /\/favicon-32\.png/);
  assert.ok(statSync(new URL('../public/p0-256.webp', import.meta.url)).size < 100_000);
  assert.ok(statSync(new URL('../public/favicon-32.png', import.meta.url)).size < 50_000);
});

test('rendered background configuration starts with a static image', () => {
  const home = read('index.html');
  const match = home.match(/data-defaults="([^"]+)"/);
  assert.ok(match, 'background defaults should be rendered');

  const defaults = JSON.parse(
    match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'),
  );
  assert.match(defaults[0], /\.(?:jpe?g|png|webp)$/i);
  assert.ok(defaults.some((source) => /\.mp4$/i.test(source)));
});

test('rendered moments management controls are hidden by default', () => {
  const html = read('moments/index.html');
  const publishButton = html.match(/<button\b[^>]*id="publish-toggle"[^>]*>/)?.[0];
  const publishPanel = html.match(/<div\b[^>]*id="publish-box"[^>]*>/)?.[0];

  assert.ok(publishButton, 'publish toggle should exist');
  assert.match(publishButton, /data-admin-only/);
  assert.match(publishButton, /\bhidden\b/);
  assert.ok(publishPanel, 'publish panel should exist');
  assert.match(publishPanel, /data-admin-only/);
  assert.match(publishPanel, /\bhidden\b/);
});
