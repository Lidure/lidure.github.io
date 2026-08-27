import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/posts/[slug].astro');
const layoutCssUrl = new URL('../src/styles/article-sayori-layout.css', import.meta.url);
const layoutCss = existsSync(layoutCssUrl) ? readFileSync(layoutCssUrl, 'utf8') : '';

test('article matches Sayori 112rem reading canvas and desktop columns', () => {
  assert.ok(layoutCss.length > 0, 'Sayori layout override should exist');
  assert.match(layoutCss, /\.article-publication\s*\{[\s\S]*width:\s*min\(100%,\s*112rem\)/);
  assert.match(layoutCss, /\.article-publication\s*\{[\s\S]*padding-inline:\s*1rem/);
  assert.match(layoutCss, /@media \(min-width:\s*1280px\)[\s\S]*\.sayori-reading-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(13\.5rem,\s*16rem\)\s+minmax\(0,\s*1fr\)\s+minmax\(12rem,\s*15rem\)/);
  assert.match(layoutCss, /\.sayori-reading-grid\s*\{[\s\S]*gap:\s*1rem/);
});

test('desktop TOC uses Sayori sticky behavior without nested sidebar scrolling', () => {
  assert.match(layoutCss, /\.sayori-sidebar-sticky\s*\{[\s\S]*position:\s*sticky[\s\S]*top:\s*1rem/);
  assert.match(layoutCss, /\.sayori-sidebar-sticky\s*\{[\s\S]*max-height:\s*none/);
  assert.match(layoutCss, /\.sayori-sidebar-sticky\s*\{[\s\S]*overflow:\s*visible/);
  assert.doesNotMatch(layoutCss, /\.sayori-sidebar-sticky\s*\{[\s\S]*overflow-y:\s*auto/);
});

test('scroll hot path only updates reading progress and does not scan headings/layout every frame', () => {
  assert.match(page, /function syncReadingProgress\(\)/);
  assert.match(page, /window\.addEventListener\('scroll', requestProgressSync/);
  assert.doesNotMatch(page, /window\.addEventListener\('scroll', requestSync/);
  const progressFn = page.match(/function syncReadingProgress\(\)\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? '';
  assert.doesNotMatch(progressFn, /getBoundingClientRect/);
  assert.doesNotMatch(progressFn, /headingElements/);
  assert.doesNotMatch(progressFn, /tocScrollContainer/);
});

test('TOC active range is observer-driven and only self-scrolls when observer state changes', () => {
  assert.match(page, /const tocObserver = new IntersectionObserver/);
  assert.match(page, /syncTocActiveRange\(\)/);
  assert.match(page, /tocScrollContainer\.scrollTo/);
  assert.match(page, /activeHeadingIds/);
});
