import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/posts/[slug].astro');
const toc = read('src/components/ArticleTOC.astro');
const tocCss = read('src/styles/article-toc-sayori.css');
const layoutCssUrl = new URL('../src/styles/article-sayori-layout.css', import.meta.url);
const layoutCss = existsSync(layoutCssUrl) ? readFileSync(layoutCssUrl, 'utf8') : '';

test('article matches Sayori 112rem reading canvas all the way through the BaseLayout shell', () => {
  assert.ok(layoutCss.length > 0, 'Sayori layout override should exist');
  assert.match(layoutCss, /body\.layout-standard:has\(\.article-publication\)\s+\.standard-content\s*\{[\s\S]*width:\s*min\(100%,\s*112rem\)/);
  assert.match(layoutCss, /\.article-publication\s*\{[\s\S]*width:\s*min\(100%,\s*112rem\)/);
  assert.match(layoutCss, /\.article-publication\s*\{[\s\S]*padding-inline:\s*1rem/);
  assert.match(layoutCss, /@media \(min-width:\s*1280px\)[\s\S]*\.sayori-reading-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(13\.5rem,\s*16rem\)\s+minmax\(0,\s*1fr\)\s+minmax\(12rem,\s*15rem\)/);
  assert.match(layoutCss, /\.sayori-reading-grid\s*\{[\s\S]*gap:\s*1rem/);
});

test('desktop rails clear the fixed 64px header and remain sticky', () => {
  assert.match(layoutCss, /\.sayori-reading-grid\s*\{[\s\S]*align-items:\s*stretch/);
  assert.match(layoutCss, /\.sayori-toc-sidebar[\s\S]*\.sayori-right-sidebar\s*\{[\s\S]*align-self:\s*stretch/);
  assert.match(layoutCss, /\.sayori-sidebar-sticky\s*\{[\s\S]*position:\s*sticky[\s\S]*top:\s*5rem/);
  assert.match(layoutCss, /\.sayori-sidebar-sticky\s*\{[\s\S]*max-height:\s*none/);
  assert.match(layoutCss, /\.sayori-sidebar-sticky\s*\{[\s\S]*overflow:\s*visible/);
  assert.doesNotMatch(layoutCss, /\.sayori-reading-grid\s*\{[\s\S]*align-items:\s*start/);
  assert.doesNotMatch(layoutCss, /\.sayori-sidebar-sticky\s*\{[\s\S]*overflow-y:\s*auto/);
});

test('TOC badge geometry follows Sayori SidebarTOC exactly', () => {
  assert.match(toc, /depthLevel === 0 \? \(\s*badgeIndex\s*\) : depthLevel === 1 \? \(\s*<span class="toc-badge-dot"><\/span>/s);
  assert.match(tocCss, /\.toc-item\s*\{[\s\S]*gap:\s*0\.5rem[\s\S]*padding:\s*0\.5rem[\s\S]*min-height:\s*2\.25rem/);
  assert.match(tocCss, /\.toc-badge\s*\{[\s\S]*width:\s*1\.25rem[\s\S]*height:\s*1\.25rem[\s\S]*border-radius:\s*0\.5rem[\s\S]*font-size:\s*0\.75rem/);
  assert.match(tocCss, /\.toc-item\.toc-level-1\s+\.toc-badge\s*\{[\s\S]*margin-left:\s*1rem/);
  assert.match(tocCss, /\.toc-item\.toc-level-2\s+\.toc-badge\s*\{[\s\S]*margin-left:\s*2rem/);
  assert.match(tocCss, /\.toc-badge-dot\s*\{[\s\S]*width:\s*0\.5rem[\s\S]*height:\s*0\.5rem[\s\S]*border-radius:\s*0\.1875rem/);
  assert.match(tocCss, /\.toc-badge-dot-sm\s*\{[\s\S]*width:\s*0\.375rem[\s\S]*height:\s*0\.375rem[\s\S]*border-radius:\s*0\.25rem/);
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
