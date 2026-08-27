import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/posts/[slug].astro');
const indexPage = read('src/pages/posts/index.astro');
const layout = read('src/layouts/BaseLayout.astro');
const css = read('src/styles/article-reading.css');
const followupCss = read('src/styles/article-moments-followup.css');
const bannerlessCss = read('src/styles/bannerless-pages.css');
const archiveCssUrl = new URL('../src/styles/article-archive.css', import.meta.url);
const archiveCss = existsSync(archiveCssUrl) ? readFileSync(archiveCssUrl, 'utf8') : '';
const safetyCssUrl = new URL('../src/styles/article-layout-safety.css', import.meta.url);
const tocUrl = new URL('../src/components/ArticleTOC.astro', import.meta.url);
const toc = existsSync(tocUrl) ? readFileSync(tocUrl, 'utf8') : '';

test('article can opt out of the standard banner with a dedicated bannerless shell', () => {
  assert.match(layout, /showBanner\?: boolean/);
  assert.match(layout, /showBanner\s*=\s*true/);
  assert.match(layout, /\{showBanner\s*&&\s*\(/);
  assert.match(layout, /'is-bannerless':\s*isStandard\s*&&\s*!showBanner/);
  assert.match(page, /showBanner=\{false\}/);
  assert.match(bannerlessCss, /body\.layout-standard\.is-bannerless \.standard-page-surface\s*\{[\s\S]*margin-top:\s*0/);
});

test('article archive remains content-first', () => {
  assert.match(indexPage, /article-archive\.css/);
  assert.match(indexPage, /class="article-archive"/);
  assert.match(archiveCss, /\.article-entry-link\s*\{[\s\S]*grid-template-columns:/);
});

test('article adopts the Sayori-style reading grid instead of the old canvas', () => {
  assert.match(page, /class="sayori-reading-grid"/);
  assert.match(page, /class="sayori-toc-sidebar"/);
  assert.match(page, /class="sayori-main-column"/);
  assert.match(page, /class="sayori-post-card"/);
  assert.match(page, /class="prose article-prose"/);
  assert.match(page, /class="markdown-content"/);
  assert.match(page, /class="sayori-right-sidebar"/);
  assert.doesNotMatch(page, /article-reading-canvas/);
  assert.doesNotMatch(page, /article-companion/);
  assert.match(css, /@media \(min-width:\s*1280px\)[\s\S]*\.sayori-reading-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(13\.5rem,\s*16rem\)\s+minmax\(0,\s*1fr\)\s+minmax\(12rem,\s*15rem\)/);
  assert.match(css, /\.sayori-main-column\s*\{[\s\S]*min-width:\s*0/);
});

test('article uses the Sayori CardTOC structure and visual grammar', () => {
  assert.ok(toc.length > 0, 'ArticleTOC component should exist');
  assert.match(page, /import ArticleTOC from ['"]\.\.\/\.\.\/components\/ArticleTOC\.astro['"]/);
  assert.match(page, /<ArticleTOC\s+headings=\{tocHeadings\}/);
  assert.match(toc, /data-article-card-toc/);
  assert.match(toc, /class="article-toc-card group"/);
  assert.match(toc, /class="article-toc-card-title"/);
  assert.match(toc, /class="article-toc-title-mark"/);
  assert.match(toc, /class="toc-scroll-container"/);
  assert.match(toc, /class="toc-content"/);
  assert.match(toc, /class:list=\{\[\s*['"]toc-item['"],\s*`toc-level-\$\{depthLevel\}`/);
  assert.match(toc, /class:list=\{\[\s*['"]toc-badge['"],\s*\{ ['"]toc-badge-index['"]:/);
  assert.match(toc, /class="toc-badge-dot"/);
  assert.match(toc, /data-article-toc-indicator/);
  assert.match(toc, /class="toc-active-indicator"/);
});

test('Sayori CardTOC keeps the upstream sizing, ellipsis and dashed active indicator', () => {
  assert.match(css, /\.article-toc-card\s*\{[\s\S]*border-radius:\s*var\(--radius-large,\s*1rem\)/);
  assert.match(css, /\.article-toc-card-title\s*\{[\s\S]*font-size:\s*1\.125rem[\s\S]*font-weight:\s*700/);
  assert.match(css, /\.article-toc-title-mark\s*\{[\s\S]*width:\s*0\.25rem[\s\S]*height:\s*1rem/);
  assert.match(css, /\.toc-scroll-container\s*\{[\s\S]*max-height:\s*50vh[\s\S]*overflow-y:\s*auto/);
  assert.match(css, /\.toc-content\s*\{[\s\S]*gap:\s*0\.28rem[\s\S]*contain:\s*layout/);
  assert.match(css, /\.toc-item\s*\{[\s\S]*border-radius:\s*0\.875rem[\s\S]*padding:\s*0\.48rem\s+0\.62rem[\s\S]*min-height:\s*2\.2rem/);
  assert.match(css, /\.toc-item\.toc-level-1\s*\{[\s\S]*padding-left:\s*1\.08rem/);
  assert.match(css, /\.toc-item\.toc-level-2\s*\{[\s\S]*padding-left:\s*1\.62rem/);
  assert.match(css, /\.toc-label\s*\{[\s\S]*text-overflow:\s*ellipsis[\s\S]*white-space:\s*nowrap/);
  assert.match(css, /\.toc-badge\s*\{[\s\S]*width:\s*1\.35rem[\s\S]*height:\s*1\.35rem[\s\S]*border-radius:\s*0\.5rem/);
  assert.match(css, /\.toc-active-indicator\s*\{[\s\S]*border:\s*2px\s+dashed[\s\S]*border-radius:\s*0\.75rem/);
  assert.match(css, /\.group:hover\s+\.toc-active-indicator\s*\{[\s\S]*background:\s*transparent/);
});

test('Sayori CardTOC active range follows visible headings and scrolls itself', () => {
  assert.match(page, /data-article-toc=/);
  assert.match(page, /data-article-toc-indicator/);
  assert.match(page, /classList\.toggle\('visible'/);
  assert.match(page, /indicator\.style\.top/);
  assert.match(page, /indicator\.style\.height/);
  assert.match(page, /tocScrollContainer\.scrollTo/);
  assert.match(page, /IntersectionObserver/);
});

test('Sayori-style prose measures keep wide content inside the article card', () => {
  assert.match(css, /--article-measure:\s*70rem/);
  assert.match(css, /--article-wide-measure:\s*90rem/);
  assert.match(css, /\.markdown-content\s*>\s*:where\(p,\s*ul,\s*ol,\s*blockquote,\s*h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6,\s*hr,\s*details\)[\s\S]*max-width:\s*var\(--article-measure\)/);
  assert.match(css, /\.markdown-content\s*>\s*:where\(figure,\s*picture,\s*table,\s*pre\)[\s\S]*max-width:\s*min\(100%,\s*var\(--article-wide-measure\)\)/);
  assert.match(css, /\.markdown-content table\s*\{[\s\S]*display:\s*block[\s\S]*width:\s*100%[\s\S]*overflow-x:\s*auto/);
  assert.match(css, /\.markdown-content :where\(pre,\s*\.katex-display\)\s*\{[\s\S]*max-width:\s*100%[\s\S]*overflow-x:\s*auto/);
  assert.doesNotMatch(css, /translateX\(-50%\)/);
  assert.doesNotMatch(css, /margin-left:\s*-\d+px/);
});

test('desktop sidebars collapse exactly as the Sayori reading layout does', () => {
  assert.match(css, /@media \(max-width:\s*1279px\)[\s\S]*\.sayori-reading-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@media \(max-width:\s*1279px\)[\s\S]*\.sayori-toc-sidebar[\s\S]*\.sayori-right-sidebar\s*\{[\s\S]*display:\s*none/);
  assert.match(css, /@media \(max-width:\s*1279px\)[\s\S]*\.article-toc-mobile\s*\{[\s\S]*display:\s*block/);
});

test('old article safety override layer is removed', () => {
  assert.equal(existsSync(safetyCssUrl), false);
  assert.doesNotMatch(followupCss, /article-layout-safety\.css/);
  assert.doesNotMatch(followupCss, /\.article-(?:toc|prose|reading-canvas)/);
});

test('article keeps heading tracking, progress, back-to-top and Astro lifecycle cleanup', () => {
  assert.match(page, /data-article-toc=/);
  assert.match(page, /data-article-progress-label/);
  assert.match(page, /textContent = `\$\{Math\.round\(progress \* 100\)\}%`/);
  assert.match(page, /data-article-backtop/);
  assert.match(page, /AbortController/);
  assert.match(page, /astro:page-load/);
  assert.match(page, /astro:before-swap/);
});

test('Sayori attribution is recorded for the adapted reading layout', () => {
  const notices = read('THIRD_PARTY_NOTICES.md');
  assert.match(css, /adapted from Amiyadesi\/sayori-blog/i);
  assert.match(notices, /Amiyadesi\/sayori-blog/);
  assert.match(notices, /Apache License 2\.0/);
});
