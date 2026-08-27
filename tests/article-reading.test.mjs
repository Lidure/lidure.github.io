import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/posts/[slug].astro');
const indexPage = read('src/pages/posts/index.astro');
const layout = read('src/layouts/BaseLayout.astro');
const css = read('src/styles/article-reading.css');
const followupCss = read('src/styles/article-moments-followup.css');
const safetyCssUrl = new URL('../src/styles/article-layout-safety.css', import.meta.url);
const safetyCss = existsSync(safetyCssUrl) ? readFileSync(safetyCssUrl, 'utf8') : '';
const bannerlessCss = read('src/styles/bannerless-pages.css');
const archiveCssUrl = new URL('../src/styles/article-archive.css', import.meta.url);
const archiveCss = existsSync(archiveCssUrl) ? readFileSync(archiveCssUrl, 'utf8') : '';

test('article can opt out of the standard banner with a dedicated bannerless shell', () => {
  assert.match(layout, /showBanner\?: boolean/);
  assert.match(layout, /showBanner\s*=\s*true/);
  assert.match(layout, /\{showBanner\s*&&\s*\(/);
  assert.match(layout, /'is-bannerless':\s*isStandard\s*&&\s*!showBanner/);
  assert.match(layout, /bannerless-pages\.css/);
  assert.match(page, /showBanner=\{false\}/);
  assert.match(bannerlessCss, /body\.layout-standard\.is-bannerless \.standard-page-surface\s*\{[\s\S]*margin-top:\s*0/);
  assert.match(bannerlessCss, /body\.layout-standard\.is-bannerless \.standard-content\s*\{[\s\S]*padding-top:\s*96px/);
});

test('article archive is content-first and keeps GitHub projects visibly secondary', () => {
  assert.match(indexPage, /article-archive\.css/);
  assert.match(indexPage, /showBanner=\{false\}/);
  assert.match(indexPage, /class="article-archive"/);
  assert.match(indexPage, /class="article-entry-link"/);
  assert.match(indexPage, /class="article-projects-secondary"/);
  assert.doesNotMatch(indexPage, /class="timeline"/);
  assert.match(archiveCss, /\.article-entry-link\s*\{[\s\S]*grid-template-columns:/);
  assert.match(archiveCss, /\.article-entry\s*\{[\s\S]*border-bottom:/);
});

test('article keeps TOC, prose, and companion in physically separate rails', () => {
  assert.match(page, /class="article-reading-canvas"/);
  assert.match(page, /class="article-toc"/);
  assert.match(page, /class="article-companion"/);
  assert.match(layout, /article-moments-followup\.css/);
  assert.match(followupCss, /@import ['"]\.\/article-layout-safety\.css['"]/);
  assert.match(safetyCss, /\.article-reading-canvas\s*\{[\s\S]*grid-template-columns:\s*260px\s+minmax\(0,\s*820px\)\s+240px[\s\S]*column-gap:\s*72px[\s\S]*max-width:\s*1600px/);
  assert.match(safetyCss, /\.article-toc\s*\{[\s\S]*grid-column:\s*1/);
  assert.match(safetyCss, /\.article-prose\s*\{[\s\S]*grid-column:\s*2[\s\S]*min-width:\s*0[\s\S]*max-width:\s*820px/);
  assert.match(safetyCss, /\.article-companion\s*\{[\s\S]*grid-column:\s*3/);
  assert.doesNotMatch(safetyCss, /\.article-toc\s*\{[^}]*position:\s*(?:absolute|fixed)/);
});

test('article wide content is contained by the prose rail and can never invade the TOC', () => {
  assert.match(safetyCss, /\.article-prose table\s*\{[\s\S]*display:\s*block[\s\S]*width:\s*100%[\s\S]*max-width:\s*100%[\s\S]*margin:\s*1\.9em\s+0[\s\S]*overflow-x:\s*auto[\s\S]*transform:\s*none/);
  assert.match(safetyCss, /\.article-prose pre\s*\{[\s\S]*width:\s*100%[\s\S]*max-width:\s*100%[\s\S]*margin:\s*1\.9em\s+0[\s\S]*overflow-x:\s*auto[\s\S]*transform:\s*none/);
  assert.match(safetyCss, /\.article-prose p:has\(> img:only-child\)[\s\S]*\.article-prose figure:has\(img\)\s*\{[\s\S]*width:\s*100%[\s\S]*max-width:\s*100%[\s\S]*margin:\s*2\.25em\s+0[\s\S]*transform:\s*none/);
  assert.match(safetyCss, /\.article-prose blockquote\s*\{[\s\S]*width:\s*100%[\s\S]*margin:\s*1\.9em\s+0/);
  assert.match(safetyCss, /\.article-prose \.katex-display\s*\{[\s\S]*max-width:\s*100%[\s\S]*overflow-x:\s*auto/);
  assert.doesNotMatch(safetyCss, /margin(?:-left)?:\s*[^;}]*-\d+px/);
  assert.doesNotMatch(safetyCss, /translateX\(-50%\)/);
  assert.doesNotMatch(safetyCss, /margin:\s*[^;}]*50%/);
});

test('article collapses desktop rails before the fixed columns can become cramped', () => {
  assert.match(safetyCss, /@media \(max-width:\s*1500px\)[\s\S]*\.article-toc\s*\{\s*display:\s*none/);
  assert.match(safetyCss, /@media \(max-width:\s*1500px\)[\s\S]*\.article-companion\s*\{\s*display:\s*none/);
  assert.match(safetyCss, /@media \(max-width:\s*1500px\)[\s\S]*\.article-toc-mobile\s*\{[\s\S]*display:\s*block/);
});

test('article keeps readable publication typography and responsive content', () => {
  assert.match(css, /counter-reset:\s*article-section/);
  assert.match(css, /counter-increment:\s*article-section/);
  assert.match(css, /counter\(article-section, decimal-leading-zero\)/);
  assert.match(css, /\.article-prose p:has\(> img:only-child\)/);
  assert.match(css, /\.article-prose blockquote/);
  assert.match(css, /\.article-prose pre/);
  assert.match(css, /\.article-prose table/);
  assert.match(css, /@media \(max-width:\s*760px\)/);
});

test('article TOC follows headings, companion progress updates, and lifecycle cleans up', () => {
  assert.match(page, /data-article-toc=/);
  assert.match(page, /classList\.toggle\('is-current'/);
  assert.match(page, /data-article-progress-label/);
  assert.match(page, /textContent = `\$\{Math\.round\(progress \* 100\)\}%`/);
  assert.match(page, /data-article-backtop/);
  assert.match(page, /scrollTo\(\{ top: 0/);
  assert.match(page, /AbortController/);
  assert.match(page, /astro:page-load/);
  assert.match(page, /astro:before-swap/);
});
