import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import test from 'node:test';

const url = (path) => new URL(`../${path}`, import.meta.url);

function sourceFiles(dir) {
  return readdirSync(url(dir), { withFileTypes: true }).flatMap((entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:astro|css|js|mjs|ts|tsx|jsx)$/.test(entry.name) ? [path] : [];
  });
}

test('production source has no legacy visual stylesheet references', () => {
  const files = [...sourceFiles('src'), 'package.json'];
  const legacy = /firefly-(?:refresh|v2|v4|v5|v6|wallpaper-modes)|article-reading\.css|moments-life-wall\.css|bannerless-pages\.css/;

  for (const file of files) {
    assert.doesNotMatch(readFileSync(url(file), 'utf8'), legacy, file);
  }
});

test('final build contains all primary and auxiliary routes', () => {
  for (const path of [
    'dist/index.html',
    'dist/posts/index.html',
    'dist/moments/index.html',
    'dist/archive/index.html',
    'dist/about/index.html',
    'dist/tags/index.html',
    'dist/messages/index.html',
    'dist/search/index.html',
    'dist/player/index.html',
    'dist/sekai-quest/index.html',
  ]) {
    assert.equal(existsSync(url(path)), true, path);
  }
});
