import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/posts/[slug].astro');
const layout = read('src/layouts/BaseLayout.astro');
const css = read('src/styles/article.css');
const bannerlessCss = read('src/styles/bannerless-pages.css');

test('article can opt out of the standard banner with a dedicated bannerless shell', () => {
  assert.match(layout, /showBanner\?: boolean/);
  assert.match(layout, /showBanner\s*=\s*true/);
  assert.match(layout, /\{showBanner\s*&&\s*\(/);
  assert.match(layout, /'is-bannerless':\s*isStandard\s*&&\s*!showBanner/);
  assert.match(layout, /bannerless-pages\.css/);
  assert.match(page, /showBanner=\{false\}/);
  assert.match(bannerlessCss, /body\.layout-standard\.is-bannerless \.standard-page-surface\s*\{[\s\S]*margin-top:\s*0/);
  assert.match(bannerlessCss, /body\.layout-standard\.is-bannerless \.standard-content\s*\{[\s\S]*padding-top:\s*96px/);
  assert.match(bannerlessCss, /data-wallpaper-mode="banner"[\s\S]*body\.layout-standard\.is-bannerless \.site-header/);
  assert.match(bannerlessCss, /color:\s*var\(--standard-text\)/);
});

test('article uses the personal-publication structure and shared toc', () => {
  assert.match(page, /const \{ Content, headings \} = await render\(post\)/);
  assert.match(page, /ArticleToc/);
  assert.match(page, /article-reading\.css['"];[\s\S]*article\.css['"];/);
  assert.match(page, /class="article-publication"/);
  assert.match(page, /class="article-masthead"/);
  assert.match(page, /class="article-title"/);
  assert.match(page, /class="article-deck"/);
  assert.match(page, /class="article-meta"/);
  assert.match(page, /class="article-tags"/);
  assert.match(page, /class="article-reading-canvas"/);
  assert.match(page, /class="article-end"/);
  assert.match(page, /class="article-comments"/);
  assert.doesNotMatch(page, /class="article-bookmark"/);
  assert.doesNotMatch(page, /article-bookmark-tick/);
  assert.doesNotMatch(page, /ISSUE\s*\{/);
  assert.doesNotMatch(page, /article-meta-rail/);
  assert.doesNotMatch(page, /article-comments-label/);
  assert.doesNotMatch(page, /Discussion/);
  assert.doesNotMatch(page, /class="post-shell"/);
});

test('final article stylesheet is reading-first rather than card-first', () => {
  assert.match(css, /\.article-publication\s*\{[\s\S]*max-width:\s*var\(--content-max\)/);
  assert.match(css, /\.article-prose\s*\{[\s\S]*max-width:\s*var\(--reading-max\)/);
  assert.match(css, /counter-reset:\s*article-section/);
  assert.match(css, /counter-increment:\s*article-section/);
  assert.match(css, /counter\(article-section, decimal-leading-zero\)/);
  assert.match(css, /\.article-prose p:has\(> img:only-child\)/);
  assert.match(css, /\.article-prose blockquote/);
  assert.match(css, /\.article-prose pre/);
  assert.match(css, /\.article-prose table/);
  assert.match(css, /\.article-toc-desktop/);
  assert.match(css, /\.article-toc-mobile/);
  assert.match(css, /@media \(max-width:\s*760px\)/);
  assert.doesNotMatch(css, /\.article-bookmark/);
  assert.doesNotMatch(css, /box-shadow:\s*0\s+18px\s+60px/);
});

test('article page delegates toc and progress behavior out of the old inline bookmark controller', () => {
  assert.doesNotMatch(page, /data-article-chapter/);
  assert.doesNotMatch(page, /__articlePublicationCleanup/);
  assert.doesNotMatch(page, /--chapter-offset/);
  assert.doesNotMatch(page, /class="article-bookmark"/);
  assert.doesNotMatch(page, /--wallpaper-blur/);
});
