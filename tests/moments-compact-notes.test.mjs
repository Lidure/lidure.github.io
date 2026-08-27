import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/moments.astro');
const css = read('src/styles/article-moments-followup.css');
const interactions = read('src/lib/public-interactions.ts');

test('short text-only Moments notes use compact paper widths without narrowing the main column', () => {
  assert.match(page, /data-note-size/);
  assert.match(page, /textLength\s*<=\s*32/);
  assert.match(page, /textLength\s*<=\s*72/);
  assert.match(css, /\[data-note-size=["']tiny["']\][\s\S]*width:\s*min\(100%,\s*32rem\)\s*!important/);
  assert.match(css, /\[data-note-size=["']compact["']\][\s\S]*width:\s*min\(100%,\s*42rem\)\s*!important/);
  assert.match(css, /\.moments-main-column\s*\{[\s\S]*width:\s*100%/);
});

test('media and long Moments notes keep the full center-column width', () => {
  assert.match(page, /hasMedia\s*\?\s*['"]full['"]/);
  assert.match(css, /\[data-note-size=["']full["']\][\s\S]*width:\s*100%\s*!important/);
});

test('preview comments stay hidden when a Moment has no comments', () => {
  assert.match(interactions, /const hideWhenEmpty\s*=\s*previewCount\s*>\s*0/);
  assert.match(interactions, /root\.hidden\s*=\s*hideWhenEmpty/);
  assert.match(interactions, /if\s*\(!comments\.length\)[\s\S]*root\.hidden\s*=\s*true/);
  assert.match(interactions, /root\.hidden\s*=\s*false/);
});
