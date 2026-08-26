# Article Reading Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the article detail page into a magazine-like long-form reading surface with an editorial metadata rail, reading-time estimate, responsive reading progress, stronger prose hierarchy, breakout media, and a clear comments boundary.

**Architecture:** Keep article content and the existing `Comments` component intact. Add a small pure reading-time utility, add article-specific structure/hooks in `src/pages/posts/[slug].astro`, and isolate visual rules in a new `src/styles/article-reading.css` imported only by the article page. The reading-progress controller remains page-local and updates one CSS custom property so it cannot interfere with the fullscreen wallpaper controller.

**Tech Stack:** Astro 6, TypeScript, Astro Content Collections, CSS custom properties, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-25-article-moments-layout-design.md`

## Global Constraints

- Preserve current blog content schema and Markdown files.
- Preserve `Comments` functionality.
- Preserve KaTeX rendering and horizontal overflow safety.
- Reuse existing theme variables; do not introduce fixed pink/purple core styling.
- Keep light/dark, theme hue, card opacity/border/follow-theme, fullscreen, and overlay compatibility.
- Do not add a table-of-contents subsystem.
- Respect `prefers-reduced-motion` and `html[data-reduce-motion="true"]`.
- Do not modify the fullscreen wallpaper blur controller.

---

### Task 1: Reading-time utility and editorial metadata rail

**Files:**
- Create: `src/utils/article-reading.ts`
- Modify: `src/pages/posts/[slug].astro`
- Create: `tests/article-reading.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `post.body`, `post.data.pubDate`, `post.data.updatedDate`, `post.data.tags`.
- Produces: `estimateReadingMinutes(source: string): number`; markup classes `.article-meta-rail`, `.article-issue-stamp`, `.article-reading-time`, `.article-tag-list`.

- [ ] **Step 1: Write the failing test**

Create `tests/article-reading.test.mjs` with source-level assertions for the utility and article markup:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('article page exposes editorial metadata and reading-time hooks', () => {
  const page = read('src/pages/posts/[slug].astro');
  const util = read('src/utils/article-reading.ts');

  assert.match(util, /export function estimateReadingMinutes\(source: string\)/);
  assert.match(util, /[\\u3400-\\u9fff]/);
  assert.match(page, /estimateReadingMinutes\(post\.body/);
  assert.match(page, /class="article-meta-rail"/);
  assert.match(page, /class="article-issue-stamp"/);
  assert.match(page, /class="article-reading-time"/);
  assert.match(page, /class="article-tag-list"/);
});
```

Add `tests/article-reading.test.mjs` to `test:site` in `package.json`.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
node --test tests/article-reading.test.mjs
```

Expected: FAIL because `src/utils/article-reading.ts` and the new article classes do not exist yet.

- [ ] **Step 3: Implement the utility**

Create `src/utils/article-reading.ts`:

```ts
export function estimateReadingMinutes(source: string): number {
  const text = source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^\]]+\]\([^)]*\)/g, ' ');

  const hanCount = (text.match(/[\u3400-\u9fff]/g) ?? []).length;
  const latinWordCount = (text.match(/[A-Za-z0-9]+(?:['’_-][A-Za-z0-9]+)*/g) ?? []).length;
  const weightedUnits = hanCount + latinWordCount * 1.7;

  return Math.max(1, Math.ceil(weightedUnits / 450));
}
```

- [ ] **Step 4: Replace the old meta rows with an editorial rail**

In `src/pages/posts/[slug].astro`, import the helper and compute values:

```astro
import { estimateReadingMinutes } from '../../utils/article-reading';
import '../../styles/article-reading.css';

const readingMinutes = estimateReadingMinutes(post.body ?? '');
const issueYear = post.data.pubDate.getFullYear();
const publishedLabel = post.data.pubDate.toLocaleDateString('zh-CN');
const updatedLabel = updatedDate.toLocaleDateString('zh-CN');
```

Replace the current `.post-meta-top` + `.tag-list` block with:

```astro
<header class="article-meta-rail" aria-label="文章信息">
  <span class="article-issue-stamp" aria-hidden="true">ISSUE {issueYear}</span>
  <span>发布于 {publishedLabel}</span>
  <span>更新于 {updatedLabel}</span>
  <span class="article-reading-time">约 {readingMinutes} 分钟阅读</span>
  <div class="article-tag-list" aria-label="文章标签">
    {post.data.tags.map((tag) => <span class="tag">#{tag}</span>)}
  </div>
</header>
```

- [ ] **Step 5: Run focused test and commit**

Run:

```bash
node --test tests/article-reading.test.mjs
```

Expected: PASS.

Commit:

```bash
git add src/utils/article-reading.ts src/pages/posts/[slug].astro tests/article-reading.test.mjs package.json
git commit -m "feat: add editorial article metadata"
```

---

### Task 2: Article-scoped reading progress

**Files:**
- Modify: `src/pages/posts/[slug].astro`
- Modify: `tests/article-reading.test.mjs`

**Interfaces:**
- Consumes: `.post-shell`, `.prose`, browser scroll/resize state.
- Produces: `--article-reading-progress` on `.post-shell`; `.article-reading-progress` decorative element.

- [ ] **Step 1: Extend the failing test**

Add assertions:

```js
assert.match(page, /class="article-reading-progress"/);
assert.match(page, /--article-reading-progress/);
assert.match(page, /getBoundingClientRect\(\)/);
assert.match(page, /document\.addEventListener\(['"]astro:page-load['"]/);
assert.match(page, /prefers-reduced-motion/);
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/article-reading.test.mjs
```

Expected: FAIL on missing progress hooks.

- [ ] **Step 3: Add progress markup**

Inside `<article class="post-shell">`, before the metadata rail:

```astro
<div class="article-reading-progress" aria-hidden="true"><span></span></div>
```

- [ ] **Step 4: Add the article-local controller**

Append to `src/pages/posts/[slug].astro`:

```astro
<script>
  function initArticleReadingProgress() {
    const article = document.querySelector<HTMLElement>('.post-shell');
    const prose = article?.querySelector<HTMLElement>('.prose');
    if (!article || !prose) return;

    let ticking = false;

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

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.dataset.reduceMotion === 'true';
    article.dataset.progressMotion = reducedMotion ? 'reduced' : 'normal';

    window.addEventListener('scroll', requestSync, { passive: true });
    window.addEventListener('resize', requestSync, { passive: true });
    sync();
  }

  document.addEventListener('astro:page-load', initArticleReadingProgress);
  initArticleReadingProgress();
</script>
```

The controller must only set `--article-reading-progress`; it must not write any wallpaper variables.

- [ ] **Step 5: Run focused test and commit**

```bash
node --test tests/article-reading.test.mjs
```

Expected: PASS.

Commit:

```bash
git add src/pages/posts/[slug].astro tests/article-reading.test.mjs
git commit -m "feat: add article reading progress"
```

---

### Task 3: Editorial article stylesheet

**Files:**
- Create: `src/styles/article-reading.css`
- Modify: `tests/article-reading.test.mjs`

**Interfaces:**
- Consumes: existing variables `--standard-card-bg`, `--standard-text`, `--standard-muted`, `--standard-line`, `--standard-accent`, `--standard-accent-soft`.
- Produces: article-specific layout and rich-content treatment scoped under `body.layout-standard .post-shell`.

- [ ] **Step 1: Extend test with required layout rules**

```js
const css = read('src/styles/article-reading.css');
assert.match(css, /\.post-shell\s*\{[\s\S]*max-width:\s*980px/);
assert.match(css, /\.post-shell \.prose\s*\{[\s\S]*max-width:\s*760px/);
assert.match(css, /\.prose p:has\(> img:only-child\)/);
assert.match(css, /\.prose h2::before/);
assert.match(css, /\.prose blockquote/);
assert.match(css, /\.prose pre/);
assert.match(css, /\.prose table/);
assert.match(css, /article-reading-progress/);
assert.match(css, /@media \(max-width:\s*760px\)/);
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/article-reading.test.mjs
```

Expected: FAIL because the stylesheet does not exist.

- [ ] **Step 3: Create the stylesheet**

Create `src/styles/article-reading.css` with these core rules:

```css
body.layout-standard .post-shell {
  --article-progress: var(--article-reading-progress, 0);
  position: relative;
  width: min(100%, 980px);
  max-width: 980px;
  margin-inline: auto;
  padding: clamp(26px, 4vw, 48px);
  border: 1px solid color-mix(in srgb, var(--standard-line) 82%, transparent);
  border-radius: 20px;
  background: color-mix(in srgb, var(--standard-card-bg) 94%, transparent);
  box-shadow: 0 18px 60px rgba(4, 6, 16, 0.07);
}

body.layout-standard .post-shell .prose {
  width: 100%;
  max-width: 760px;
  margin: 34px auto 0;
  color: var(--standard-text);
  font-size: clamp(0.98rem, 0.25vw + 0.94rem, 1.05rem);
  line-height: 1.84;
}

body.layout-standard .article-meta-rail {
  width: min(100%, 820px);
  margin-inline: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 14px;
  padding: 12px 0 18px;
  border-bottom: 1px solid var(--standard-line);
  color: var(--standard-muted);
  font-size: 0.76rem;
  letter-spacing: 0.035em;
}

body.layout-standard .article-issue-stamp {
  display: inline-flex;
  padding: 5px 8px;
  border-radius: 7px;
  color: var(--standard-accent);
  background: var(--standard-accent-soft);
  font-weight: 800;
  letter-spacing: 0.08em;
}

body.layout-standard .article-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-left: auto;
}

body.layout-standard .post-shell .prose p,
body.layout-standard .post-shell .prose ul,
body.layout-standard .post-shell .prose ol {
  margin-block: 1.05em;
}

body.layout-standard .post-shell .prose h2,
body.layout-standard .post-shell .prose h3,
body.layout-standard .post-shell .prose h4 {
  scroll-margin-top: 92px;
  color: var(--standard-text);
}

body.layout-standard .post-shell .prose h2 {
  position: relative;
  margin: 2.5em 0 0.85em;
  padding: 0 0 0 18px;
  border: 0;
  font-size: clamp(1.38rem, 1vw + 1rem, 1.72rem);
}

body.layout-standard .post-shell .prose h2::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.17em;
  width: 4px;
  height: 1.05em;
  border-radius: 999px;
  background: var(--standard-accent);
  box-shadow: 0 0 0 5px var(--standard-accent-soft);
}

body.layout-standard .post-shell .prose h3 {
  margin: 2em 0 0.7em;
  font-size: 1.18rem;
}

body.layout-standard .post-shell .prose a {
  color: var(--standard-accent);
  text-decoration-color: color-mix(in srgb, var(--standard-accent) 42%, transparent);
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

body.layout-standard .post-shell .prose blockquote {
  margin: 1.55em 0;
  padding: 16px 20px;
  border: 0;
  border-left: 3px solid var(--standard-accent);
  border-radius: 0 14px 14px 0;
  background: color-mix(in srgb, var(--standard-accent-soft) 70%, transparent);
  color: var(--standard-muted);
}

body.layout-standard .post-shell .prose pre {
  margin: 1.65em 0;
  padding: 18px 20px;
  border: 1px solid var(--standard-line);
  border-radius: 14px;
  background: color-mix(in srgb, var(--standard-card-soft) 88%, #000 12%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.025);
}

body.layout-standard .post-shell .prose table {
  border: 1px solid var(--standard-line);
  border-radius: 12px;
  background: color-mix(in srgb, var(--standard-card-bg) 96%, transparent);
}

body.layout-standard .post-shell .prose th {
  background: var(--standard-accent-soft);
  color: var(--standard-text);
}

body.layout-standard .post-shell .prose p:has(> img:only-child) {
  width: min(980px, calc(100vw - 48px));
  max-width: 980px;
  margin: 2em 50%;
  transform: translateX(-50%);
}

body.layout-standard .article-reading-progress {
  position: absolute;
  left: 14px;
  top: 110px;
  bottom: 48px;
  width: 2px;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--standard-line) 78%, transparent);
}

body.layout-standard .article-reading-progress span {
  display: block;
  width: 100%;
  height: calc(var(--article-progress) * 100%);
  background: linear-gradient(180deg, var(--standard-accent), color-mix(in srgb, var(--standard-accent) 54%, var(--standard-cyan)));
}

@media (max-width: 760px) {
  body.layout-standard .post-shell {
    padding: 24px 18px 30px;
    border-radius: 16px;
  }

  body.layout-standard .article-meta-rail {
    gap: 7px 10px;
  }

  body.layout-standard .article-tag-list {
    width: 100%;
    margin-left: 0;
  }

  body.layout-standard .post-shell .prose {
    max-width: none;
    margin-top: 28px;
    font-size: 0.97rem;
    line-height: 1.8;
  }

  body.layout-standard .post-shell .prose p:has(> img:only-child) {
    width: 100%;
    margin-inline: 0;
    transform: none;
  }

  body.layout-standard .article-reading-progress {
    position: fixed;
    inset: 0 0 auto;
    z-index: 70;
    width: 100%;
    height: 2px;
    background: transparent;
  }

  body.layout-standard .article-reading-progress span {
    width: calc(var(--article-progress) * 100%);
    height: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  body.layout-standard .article-reading-progress span,
  body.layout-standard .post-shell .prose a {
    transition: none;
  }
}

html[data-reduce-motion="true"] body.layout-standard .article-reading-progress span {
  transition: none;
}
```

When implementing, keep selectors scoped to article pages so existing homepage/card styles are not changed.

- [ ] **Step 4: Run focused test**

```bash
node --test tests/article-reading.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles/article-reading.css tests/article-reading.test.mjs
git commit -m "style: redesign article reading surface"
```

---

### Task 4: Editorial comments boundary and final article verification

**Files:**
- Modify: `src/pages/posts/[slug].astro`
- Modify: `src/styles/article-reading.css`
- Modify: `tests/article-reading.test.mjs`

**Interfaces:**
- Consumes: existing `<Comments />`.
- Produces: `.article-comments-boundary`, `.article-comments-label`.

- [ ] **Step 1: Extend test**

```js
assert.match(page, /class="article-comments-boundary"/);
assert.match(page, /class="article-comments-label"/);
assert.match(css, /\.article-comments-boundary/);
```

- [ ] **Step 2: Run focused test and confirm failure**

```bash
node --test tests/article-reading.test.mjs
```

Expected: FAIL on missing comments boundary.

- [ ] **Step 3: Wrap comments and style the transition**

Replace the direct `<Comments />` with:

```astro
<section class="article-comments-boundary" aria-label="评论区">
  <div class="article-comments-label"><span>Discussion</span><strong>评论区</strong></div>
  <Comments />
</section>
```

Add:

```css
body.layout-standard .article-comments-boundary {
  width: min(100%, 820px);
  margin: 54px auto 0;
  padding-top: 24px;
  border-top: 1px solid var(--standard-line);
}

body.layout-standard .article-comments-label {
  display: flex;
  align-items: baseline;
  gap: 9px;
  margin-bottom: 18px;
}

body.layout-standard .article-comments-label span {
  color: var(--standard-accent);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

body.layout-standard .article-comments-label strong {
  color: var(--standard-text);
  font-size: 0.92rem;
}
```

- [ ] **Step 4: Run article test, site tests, and build**

```bash
node --test tests/article-reading.test.mjs
npm run test:site
npm run build
```

Expected: all PASS.

- [ ] **Step 5: Review article diff and commit**

Check that changed article files are limited to the new utility/style/test plus `[slug].astro` and `package.json`, and that no wallpaper files changed.

Commit:

```bash
git add src/pages/posts/[slug].astro src/styles/article-reading.css tests/article-reading.test.mjs
git commit -m "feat: finish editorial article layout"
```
