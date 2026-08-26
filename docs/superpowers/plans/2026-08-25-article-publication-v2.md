# Article Publication V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PR #43 editorial-card article page with a bannerless, authored personal-publication layout that prioritizes Chinese long-form reading, asymmetric rich content, and a minimal chapter bookmark rail.

**Architecture:** Add one narrow `showBanner?: boolean` capability to `BaseLayout`, then rebuild `src/pages/posts/[slug].astro` around a masthead + reading canvas instead of a dominant card. Replace `article-reading.css` wholesale, keep `estimateReadingMinutes`, render H2 bookmark ticks from Astro `headings`, and use one page-local controller for chapter positions and reading progress without touching wallpaper state.

**Tech Stack:** Astro 6, TypeScript, Astro Content Collections, CSS custom properties/counters, Node built-in test runner, KaTeX.

**Spec:** `docs/superpowers/specs/2026-08-25-article-moments-human-v2-design.md`

## Global Constraints

- `BaseLayout` adds exactly `showBanner?: boolean`, default `true`.
- This plan wires the article page to `showBanner={false}`; the Moments plan consumes the same capability.
- Keep the global site header, HeroSlideshow wallpaper source, particles, player, visual settings, page transitions, standard content surface, and footer.
- Preserve Markdown, KaTeX, comments, light/dark mode, theme hue, wallpaper modes, reduced motion, and Astro client-side transitions.
- Remove `ISSUE {year}`, visible `article-meta-rail`, glowing H2 accent bar, dominant rounded article card, `Discussion / 评论区`, and the old generic vertical progress bar.
- Do not add AI summaries, a TOC card, Mac traffic-light code decoration, or required frontmatter.
- Article outer width target: `1100–1180px`; reading column target: `700–740px`.
- H2 chapter numbers are visual CSS counters only and never change heading IDs/content.
- Mobile hides the bookmark rail and uses only a thin top progress line.

---

### Task 1: Add the exact BaseLayout banner opt-out

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/posts/[slug].astro`
- Modify: `tests/article-reading.test.mjs`

**Interfaces:**
- Produces: `showBanner?: boolean` with default `true`; article passes `showBanner={false}`.

- [ ] **Step 1: Write the failing layout contract test**

Replace the first test in `tests/article-reading.test.mjs` with:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/posts/[slug].astro');
const layout = read('src/layouts/BaseLayout.astro');

test('article can opt out of the standard banner without changing the standard surface', () => {
  assert.match(layout, /showBanner\?: boolean/);
  assert.match(layout, /showBanner\s*=\s*true/);
  assert.match(layout, /\{showBanner\s*&&\s*\(/);
  assert.match(layout, /class="standard-page-surface"/);
  assert.match(page, /showBanner=\{false\}/);
});
```

- [ ] **Step 2: Run test and verify RED**

```bash
node --test tests/article-reading.test.mjs
```

Expected: FAIL on missing `showBanner` contract.

- [ ] **Step 3: Implement `showBanner` in `BaseLayout.astro`**

Add to `Props`:

```ts
showBanner?: boolean;
```

Add to the existing props destructuring:

```ts
showBanner = true,
```

Wrap the existing banner stage exactly like this, preserving its current SVG/button contents:

```astro
{showBanner && (
  <div class="blog-banner-stage">
    <BlogBanner title={resolvedBannerTitle} subtitle={resolvedBannerSubtitle} />
    <BannerWaves />
    <button id="fullscreen-scroll-indicator" class="fullscreen-scroll-indicator" type="button" aria-label="向下浏览">
      <svg class="fullscreen-scroll-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m6.5 9.5 5.5 5.5 5.5-5.5" />
      </svg>
    </button>
  </div>
)}
```

Do not wrap `.standard-page-surface` or the footer.

- [ ] **Step 4: Opt the article out**

Add to the existing `BaseLayout` call in `src/pages/posts/[slug].astro`:

```astro
showBanner={false}
```

- [ ] **Step 5: Run focused test and verify GREEN**

```bash
node --test tests/article-reading.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/layouts/BaseLayout.astro src/pages/posts/[slug].astro tests/article-reading.test.mjs
git commit -m "feat: allow article pages to own page chrome"
```

---

### Task 2: Rebuild the article masthead and semantic reading structure

**Files:**
- Modify: `src/pages/posts/[slug].astro`
- Modify: `tests/article-reading.test.mjs`

**Interfaces:**
- Consumes: `post.data.title`, `description`, `pubDate`, `updatedDate`, `tags`, `post.body`, Astro `render(post)`.
- Produces: `.article-publication`, `.article-masthead`, `.article-title`, `.article-deck`, `.article-meta`, `.article-tags`, `.article-reading-canvas`, `.article-bookmark`, `.article-end`, `.article-comments`.

- [ ] **Step 1: Add failing V2 structure assertions**

```js
test('article uses the personal-publication structure and retires PR 43 chrome', () => {
  assert.match(page, /const \{ Content, headings \} = await render\(post\)/);
  assert.match(page, /const chapterHeadings = headings\.filter\(\(heading\) => heading\.depth === 2\)/);
  assert.match(page, /class="article-publication"/);
  assert.match(page, /class="article-masthead"/);
  assert.match(page, /class="article-title"/);
  assert.match(page, /class="article-deck"/);
  assert.match(page, /class="article-meta"/);
  assert.match(page, /class="article-tags"/);
  assert.match(page, /class="article-reading-canvas"/);
  assert.match(page, /class="article-bookmark"/);
  assert.match(page, /class="article-end"/);
  assert.match(page, /class="article-comments"/);
  assert.doesNotMatch(page, /ISSUE\s*\{/);
  assert.doesNotMatch(page, /article-meta-rail/);
  assert.doesNotMatch(page, /article-comments-label/);
  assert.doesNotMatch(page, /Discussion/);
  assert.doesNotMatch(page, /class="post-shell"/);
});
```

- [ ] **Step 2: Run focused test and verify RED**

Expected: FAIL on V2 structure and retired PR #43 markup.

- [ ] **Step 3: Replace frontmatter preparation**

Use:

```astro
const { post } = Astro.props;
const { Content, headings } = await render(post);
const updatedDate = post.data.updatedDate ?? post.data.pubDate;
const readingMinutes = estimateReadingMinutes(post.body ?? '');
const chapterHeadings = headings.filter((heading) => heading.depth === 2);
const publishedMachine = post.data.pubDate.toISOString();
const updatedMachine = updatedDate.toISOString();
const publishedLabel = post.data.pubDate.toLocaleDateString('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).replaceAll('/', '.');
const updatedLabel = updatedDate.toLocaleDateString('zh-CN', {
  month: '2-digit',
  day: '2-digit',
}).replaceAll('/', '.');
```

Delete `issueYear`.

- [ ] **Step 4: Replace the current `<article class="post-shell">` block**

```astro
<article class="article-publication">
  <header class="article-masthead">
    <h1 class="article-title">{post.data.title}</h1>
    {post.data.description && <p class="article-deck">{post.data.description}</p>}

    <div class="article-meta" aria-label="文章信息">
      <time datetime={publishedMachine}>{publishedLabel}</time>
      <span aria-hidden="true">·</span>
      <span>更新于 <time datetime={updatedMachine}>{updatedLabel}</time></span>
      <span aria-hidden="true">·</span>
      <span>约 {readingMinutes} 分钟</span>
    </div>

    {post.data.tags.length > 0 && (
      <div class="article-tags" aria-label="文章标签">
        {post.data.tags.map((tag) => <span>#{tag}</span>)}
      </div>
    )}
  </header>

  <div class="article-reading-canvas">
    <nav class="article-bookmark" aria-label="文章章节">
      <div class="article-bookmark-track">
        <span class="article-bookmark-marker" aria-hidden="true"></span>
        {chapterHeadings.map((heading) => (
          <a
            class="article-bookmark-tick"
            href={`#${heading.slug}`}
            data-article-chapter={heading.slug}
            aria-label={heading.text}
            title={heading.text}
          ></a>
        ))}
      </div>
    </nav>

    <div class="prose article-prose">
      <Content />
    </div>
  </div>

  <div class="article-end" aria-hidden="true"><span>·</span><span>·</span><span>·</span></div>
  <section class="article-comments" aria-label="评论"><Comments /></section>
</article>
```

- [ ] **Step 5: Run focused test and verify GREEN**

```bash
node --test tests/article-reading.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/posts/[slug].astro tests/article-reading.test.mjs
git commit -m "feat: rebuild article as a personal publication"
```

---

### Task 3: Replace article styling with the authored publication language

**Files:**
- Replace: `src/styles/article-reading.css`
- Modify: `tests/article-reading.test.mjs`

**Interfaces:**
- Consumes: V2 markup and existing `--standard-*`, `--card-opacity-percent`, wallpaper data attributes.
- Produces: 1160px publication canvas, 720px reading column, CSS H2 counters, asymmetric rich-content breakouts, mobile flattening.

- [ ] **Step 1: Add failing style assertions**

```js
const css = read('src/styles/article-reading.css');

test('article stylesheet is publication-first rather than card-first', () => {
  assert.match(css, /\.article-publication\s*\{[\s\S]*max-width:\s*1160px/);
  assert.match(css, /\.article-prose\s*\{[\s\S]*max-width:\s*720px/);
  assert.match(css, /counter-reset:\s*article-section/);
  assert.match(css, /counter-increment:\s*article-section/);
  assert.match(css, /counter\(article-section, decimal-leading-zero\)/);
  assert.match(css, /\.article-prose p:has\(> img:only-child\)/);
  assert.match(css, /\.article-prose blockquote/);
  assert.match(css, /\.article-prose pre/);
  assert.match(css, /\.article-prose table/);
  assert.match(css, /@media \(max-width:\s*760px\)/);
  assert.doesNotMatch(css, /box-shadow:\s*0 18px 60px/);
});
```

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because PR #43 styles are still present.

- [ ] **Step 3: Replace `src/styles/article-reading.css`**

Use this exact structural stylesheet as the new base; existing KaTeX package CSS remains imported by the page:

```css
body.layout-standard .article-publication {
  --article-progress: var(--article-reading-progress, 0);
  position: relative;
  width: min(100%, 1160px);
  max-width: 1160px;
  margin: 0 auto;
  padding: clamp(46px, 7vw, 92px) clamp(18px, 4vw, 54px) 64px;
  color: var(--standard-text);
}
body.layout-standard .article-masthead {
  width: min(100%, 980px);
  margin: 0 auto clamp(48px, 7vw, 82px);
  padding-bottom: 26px;
}
body.layout-standard .article-title {
  max-width: 18ch;
  margin: 0;
  color: var(--standard-text);
  font-family: 'Noto Sans SC', sans-serif;
  font-size: clamp(2.25rem, 5.2vw, 3.85rem);
  font-weight: 760;
  line-height: 1.14;
  letter-spacing: -0.045em;
  text-wrap: balance;
}
body.layout-standard .article-deck {
  width: min(34ch, 42%);
  margin: clamp(24px, 4vw, 44px) 0 0 auto;
  padding-left: 18px;
  border-left: 1px solid color-mix(in srgb, var(--standard-accent) 58%, transparent);
  color: var(--standard-muted);
  font-size: 0.94rem;
  line-height: 1.8;
}
body.layout-standard .article-meta,
body.layout-standard .article-tags {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  color: var(--standard-muted);
  font-size: 0.76rem;
  font-variant-numeric: tabular-nums;
}
body.layout-standard .article-meta { margin-top: 30px; }
body.layout-standard .article-tags { margin-top: 9px; color: color-mix(in srgb, var(--standard-accent) 72%, var(--standard-muted)); }
body.layout-standard .article-tags span { padding: 0; border: 0; background: none; }
body.layout-standard .article-masthead::after {
  content: '';
  display: block;
  width: 54px;
  height: 1px;
  margin-top: 25px;
  background: color-mix(in srgb, var(--standard-accent) 58%, transparent);
}
body.layout-standard .article-reading-canvas { position: relative; }
body.layout-standard .article-prose {
  counter-reset: article-section;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  color: var(--standard-text);
  font-size: clamp(1rem, 0.18vw + 0.97rem, 1.055rem);
  line-height: 1.82;
  overflow: visible;
  text-wrap: pretty;
}
body.layout-standard .article-prose p,
body.layout-standard .article-prose ul,
body.layout-standard .article-prose ol { margin-block: 1.02em; }
body.layout-standard .article-prose li + li { margin-top: 0.34em; }
body.layout-standard .article-prose h2,
body.layout-standard .article-prose h3,
body.layout-standard .article-prose h4 {
  color: var(--standard-text);
  font-family: 'Noto Sans SC', sans-serif;
  scroll-margin-top: 96px;
  text-wrap: balance;
}
body.layout-standard .article-prose h2 {
  counter-increment: article-section;
  position: relative;
  margin: 3.2em 0 1em;
  padding: 0;
  border: 0;
  font-size: clamp(1.45rem, 1.3vw + 1rem, 1.82rem);
  line-height: 1.34;
}
body.layout-standard .article-prose h2::before {
  content: counter(article-section, decimal-leading-zero);
  position: absolute;
  right: calc(100% + 22px);
  top: 0.12em;
  color: color-mix(in srgb, var(--standard-accent) 34%, transparent);
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0.08em;
  font-variant-numeric: tabular-nums;
}
body.layout-standard .article-prose h3 { margin: 2.25em 0 0.72em; font-size: 1.2rem; }
body.layout-standard .article-prose h4 { margin: 1.8em 0 0.58em; font-size: 1.02rem; }
body.layout-standard .article-prose a {
  color: var(--standard-text);
  text-decoration-color: color-mix(in srgb, var(--standard-accent) 54%, transparent);
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}
body.layout-standard .article-prose a:hover { color: var(--standard-accent); text-decoration-color: currentColor; }
body.layout-standard .article-prose blockquote {
  width: calc(100% + 54px);
  margin: 1.8em 0 1.8em -54px;
  padding: 2px 0 2px 22px;
  border: 0;
  border-left: 1px solid color-mix(in srgb, var(--standard-accent) 58%, transparent);
  border-radius: 0;
  background: none;
  color: var(--standard-muted);
  font-size: 1.04em;
}
body.layout-standard .article-prose code:not(pre code) {
  padding: 0.12em 0.34em;
  border-radius: 4px;
  background: color-mix(in srgb, var(--standard-card-soft) 76%, transparent);
  color: var(--standard-text);
}
body.layout-standard .article-prose pre {
  width: min(900px, calc(100vw - 42px));
  max-width: 900px;
  margin: 1.9em 50%;
  padding: 20px 22px;
  transform: translateX(-50%);
  overflow-x: auto;
  border: 1px solid color-mix(in srgb, var(--standard-line) 88%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--standard-card-soft) 88%, #000 12%);
  box-shadow: none;
}
body.layout-standard .article-prose table {
  display: table;
  width: min(900px, calc(100vw - 42px));
  max-width: 900px;
  margin: 1.9em 50%;
  transform: translateX(-50%);
  border: 0;
  border-collapse: collapse;
  background: transparent;
}
body.layout-standard .article-prose th,
body.layout-standard .article-prose td {
  padding: 10px 12px;
  border: 0;
  border-bottom: 1px solid var(--standard-line);
  background: transparent;
  text-align: left;
}
body.layout-standard .article-prose th { color: var(--standard-text); font-weight: 720; }
body.layout-standard .article-prose p:has(> img:only-child) {
  width: min(980px, calc(100vw - 42px));
  max-width: 980px;
  margin: 2.15em 50%;
  transform: translateX(-50%);
}
body.layout-standard .article-prose img {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: min(80vh, 900px);
  height: auto;
  margin-inline: auto;
  border: 0;
  border-radius: 5px;
  box-shadow: none;
}
body.layout-standard .article-prose img:hover { transform: none; box-shadow: none; }
body.layout-standard .article-prose .katex-display {
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}
body.layout-standard .article-end {
  display: flex;
  justify-content: center;
  gap: 8px;
  margin: 68px auto 38px;
  color: color-mix(in srgb, var(--standard-accent) 58%, var(--standard-muted));
}
body.layout-standard .article-comments {
  width: min(100%, 780px);
  margin: 0 auto;
  padding-top: 26px;
  border-top: 1px solid color-mix(in srgb, var(--standard-line) 76%, transparent);
}
html[data-wallpaper-mode="fullscreen"] body.layout-standard .article-publication,
html[data-wallpaper-mode="overlay"] body.layout-standard .article-publication {
  background: color-mix(
    in srgb,
    color-mix(in srgb, var(--standard-card-bg) var(--card-opacity-percent, 92%), transparent) 34%,
    transparent
  );
}
@media (max-width: 760px) {
  body.layout-standard .article-publication { padding: 34px 16px 44px; }
  body.layout-standard .article-masthead { margin-bottom: 42px; padding-bottom: 12px; }
  body.layout-standard .article-title { max-width: none; font-size: clamp(2rem, 10vw, 3rem); letter-spacing: -0.035em; }
  body.layout-standard .article-deck { width: 100%; margin: 22px 0 0; padding-left: 13px; }
  body.layout-standard .article-meta { margin-top: 22px; }
  body.layout-standard .article-prose { max-width: none; line-height: 1.78; }
  body.layout-standard .article-prose h2::before { position: static; display: block; margin-bottom: 7px; }
  body.layout-standard .article-prose blockquote { width: 100%; margin: 1.6em 0; padding-left: 16px; }
  body.layout-standard .article-prose pre,
  body.layout-standard .article-prose p:has(> img:only-child) { width: calc(100vw - 20px); }
  body.layout-standard .article-prose table {
    display: block;
    width: calc(100vw - 20px);
    overflow-x: auto;
  }
}
```

- [ ] **Step 4: Run focused test and verify GREEN**

```bash
node --test tests/article-reading.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add src/styles/article-reading.css tests/article-reading.test.mjs
git commit -m "style: give articles an authored publication layout"
```

---

### Task 4: Implement bookmark rail and mobile progress

**Files:**
- Modify: `src/pages/posts/[slug].astro`
- Modify: `src/styles/article-reading.css`
- Modify: `tests/article-reading.test.mjs`

**Interfaces:**
- Consumes: `.article-prose`, `.article-bookmark-tick[data-article-chapter]`, rendered heading IDs.
- Produces: `--article-reading-progress` on `.article-publication`; `--chapter-offset` on ticks.

- [ ] **Step 1: Add failing controller assertions**

```js
test('article bookmark rail follows headings and cleans up across Astro navigation', () => {
  assert.match(page, /--article-reading-progress/);
  assert.match(page, /--chapter-offset/);
  assert.match(page, /AbortController/);
  assert.match(page, /astro:page-load/);
  assert.match(page, /astro:before-swap/);
  assert.doesNotMatch(page, /--wallpaper-blur/);
});
```

- [ ] **Step 2: Run and verify RED**

- [ ] **Step 3: Replace the current article page script**

```astro
<script>
  const articleWindow = window as typeof window & {
    __articlePublicationCleanup?: () => void;
    __articlePublicationLifecycleBound?: boolean;
  };

  function initArticlePublication() {
    articleWindow.__articlePublicationCleanup?.();
    const article = document.querySelector<HTMLElement>('.article-publication');
    const prose = article?.querySelector<HTMLElement>('.article-prose');
    if (!article || !prose) return;

    const controller = new AbortController();
    const { signal } = controller;
    const ticks = Array.from(article.querySelectorAll<HTMLAnchorElement>('.article-bookmark-tick'));
    let ticking = false;

    const measureChapters = () => {
      const proseTop = prose.getBoundingClientRect().top + window.scrollY;
      const proseHeight = Math.max(1, prose.offsetHeight);
      ticks.forEach((tick) => {
        const id = tick.dataset.articleChapter;
        const heading = id ? document.getElementById(id) : null;
        if (!heading) return;
        const headingTop = heading.getBoundingClientRect().top + window.scrollY;
        const offset = Math.min(1, Math.max(0, (headingTop - proseTop) / proseHeight));
        tick.style.setProperty('--chapter-offset', String(offset));
      });
    };

    const sync = () => {
      ticking = false;
      const rect = prose.getBoundingClientRect();
      const start = window.scrollY + rect.top;
      const end = start + prose.offsetHeight - window.innerHeight;
      const span = Math.max(1, end - start);
      const progress = Math.min(1, Math.max(0, (window.scrollY - start) / span));
      article.style.setProperty('--article-reading-progress', String(progress));
    };

    const requestSync = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(sync);
    };

    ticks.forEach((tick) => {
      tick.addEventListener('click', (event) => {
        const id = tick.dataset.articleChapter;
        const heading = id ? document.getElementById(id) : null;
        if (!heading) return;
        event.preventDefault();
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          || document.documentElement.dataset.reduceMotion === 'true';
        heading.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', `#${encodeURIComponent(id)}`);
      }, { signal });
    });

    window.addEventListener('scroll', requestSync, { passive: true, signal });
    window.addEventListener('resize', () => {
      measureChapters();
      requestSync();
    }, { passive: true, signal });

    articleWindow.__articlePublicationCleanup = () => controller.abort();
    measureChapters();
    sync();
  }

  if (!articleWindow.__articlePublicationLifecycleBound) {
    articleWindow.__articlePublicationLifecycleBound = true;
    document.addEventListener('astro:page-load', initArticlePublication);
    document.addEventListener('astro:before-swap', () => articleWindow.__articlePublicationCleanup?.());
  }

  initArticlePublication();
</script>
```

- [ ] **Step 4: Append bookmark/progress CSS**

```css
body.layout-standard .article-bookmark {
  position: absolute;
  left: max(12px, calc(50% - 468px));
  top: 0;
  bottom: 0;
  width: 26px;
  pointer-events: none;
}
body.layout-standard .article-bookmark-track {
  position: sticky;
  top: 116px;
  width: 26px;
  height: min(48vh, 320px);
  margin-top: 12px;
  pointer-events: auto;
}
body.layout-standard .article-bookmark-track::before {
  content: '';
  position: absolute;
  left: 12px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: color-mix(in srgb, var(--standard-line) 86%, transparent);
}
body.layout-standard .article-bookmark-marker {
  position: absolute;
  z-index: 2;
  left: 9px;
  top: calc(var(--article-progress) * 100%);
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--standard-accent);
  transform: translateY(-50%);
}
body.layout-standard .article-bookmark-tick {
  position: absolute;
  left: 8px;
  top: calc(var(--chapter-offset, 0) * 100%);
  width: 9px;
  height: 1px;
  background: color-mix(in srgb, var(--standard-muted) 65%, transparent);
  transform: translateY(-50%);
}
body.layout-standard .article-bookmark-tick:hover,
body.layout-standard .article-bookmark-tick:focus-visible {
  width: 15px;
  background: var(--standard-accent);
  outline: none;
}
@media (max-width: 900px) {
  body.layout-standard .article-bookmark { display: none; }
  body.layout-standard .article-publication::before {
    content: '';
    position: fixed;
    z-index: 10060;
    left: 0;
    top: 0;
    width: calc(var(--article-progress) * 100%);
    height: 2px;
    background: var(--standard-accent);
    pointer-events: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  body.layout-standard .article-bookmark-marker,
  body.layout-standard .article-bookmark-tick,
  body.layout-standard .article-publication::before { transition: none !important; }
}
html[data-reduce-motion="true"] body.layout-standard .article-bookmark-marker,
html[data-reduce-motion="true"] body.layout-standard .article-bookmark-tick,
html[data-reduce-motion="true"] body.layout-standard .article-publication::before { transition: none !important; }
```

- [ ] **Step 5: Run focused test and verify GREEN**

```bash
node --test tests/article-reading.test.mjs
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/posts/[slug].astro src/styles/article-reading.css tests/article-reading.test.mjs
git commit -m "feat: add article bookmark reading rail"
```

---

### Task 5: Full article integration verification

**Files:**
- Test: `tests/article-reading.test.mjs`
- Verify: `src/layouts/BaseLayout.astro`, `src/pages/posts/[slug].astro`, `src/styles/article-reading.css`

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: green full site test/build and no PR #43 article presentation hooks.

- [ ] **Step 1: Run focused and full static tests**

```bash
node --test tests/article-reading.test.mjs
npm run test:site
```

Expected: PASS.

- [ ] **Step 2: Run Astro validation/build**

```bash
npm run build
```

Expected: both `astro check` and `astro build` PASS. Verify at least one article containing KaTeX is included in the build output without an error.

- [ ] **Step 3: Review the diff for scope leaks**

```bash
git diff --check main...HEAD
git diff --stat main...HEAD
git diff main...HEAD -- src/layouts/BaseLayout.astro src/pages/posts/[slug].astro src/styles/article-reading.css tests/article-reading.test.mjs
```

Confirm all four statements:

1. `showBanner` defaults to `true`.
2. No homepage/list/archive markup was changed.
3. Article JS writes only article-specific CSS variables.
4. Comments, `katex/dist/katex.min.css`, and `estimateReadingMinutes` remain wired.

- [ ] **Step 4: Commit only if verification required a correction**

If a correction was necessary, stage only the corrected article files and commit:

```bash
git add src/layouts/BaseLayout.astro src/pages/posts/[slug].astro src/styles/article-reading.css tests/article-reading.test.mjs
git commit -m "test: lock article publication v2 behavior"
```

If nothing changed, finish without an empty commit.
