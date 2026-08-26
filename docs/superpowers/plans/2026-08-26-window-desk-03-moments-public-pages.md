# Window Desk Redesign 03: Moments & Public Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework Moments into a content-first “生活切片墙” and bring posts, archive, tags, messages, About, search, and footer into one quiet visual language without breaking existing APIs or admin hooks.

**Architecture:** Keep existing Moments runtime and message API behavior intact, changing only semantic markup and presentation where possible. Introduce `moments.css` and `pages.css` as final semantic styles; move GitHub project display from `/posts` to `/about`; create a dedicated `/archive`; preserve graceful fallbacks for GitHub/API failures.

**Tech Stack:** Astro 6, TypeScript, CSS, existing Moments API and interaction helpers, existing `getGitHubProjects()`, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-26-window-desk-tide-paper-design.md`

## Global Constraints

- Moments first visual layer is text/photo/time; Reaction/comment/admin actions are secondary.
- Preserve upload, Reaction, comments, auth, delete, pin, lightbox, API calls, IDs, and accessibility names.
- Emoji and reaction pickers remain collapsed by default.
- Category filtering becomes text + accent underline, not filled pills.
- Morning/day/evening/night metadata remains deterministic and visually subtle.
- `/posts` becomes writing-only; GitHub projects move to `/about`.
- `/archive` is a chronological index, not a duplicate card feed.
- `/tags` becomes a text index with counts, not a pill cloud.
- `/messages` becomes a guestbook while keeping current form IDs and admin/API hooks.
- `/about` is text-first: author, site, interests, current work, selected projects, contact/links.
- GitHub project retrieval failure must render a normal About page with the project subsection omitted or a quiet inline fallback, never fail the build.

---

## File Structure

**Create**
- `src/styles/moments.css` — final Moments content-first styling.
- `src/styles/pages.css` — posts/archive/tags/messages/about/search/footer shared ordinary-page styles.
- `src/pages/archive.astro` — chronological article index.
- `src/pages/about.astro` — author/site/interests/projects page.
- `tests/window-desk-public-pages.test.mjs` — structural contracts for routes and page responsibilities.

**Modify**
- `src/pages/moments.astro` — import `moments.css`, lighten top structure while preserving all critical IDs/hooks.
- `src/components/MomentsPinControls.astro` — only if needed to rename/add semantic presentation classes; do not alter network/admin behavior.
- `src/pages/posts/index.astro` — remove GitHub projects; render writing index only.
- `src/pages/tags/index.astro` and `src/pages/tags/[tag].astro` — text-index/list presentation.
- `src/pages/messages.astro` — guestbook structure, same form/admin IDs.
- `src/pages/search.astro` — align shell/results with shared pages language.
- `src/layouts/BaseLayout.astro` — import `pages.css`, revise footer content/links.
- `tests/moments-journal-layout.test.mjs` — update visual-language assertions while retaining behavior hooks.
- `package.json` — add public-page test.

---

### Task 1: Lock Moments behavior before visual migration

**Files:**
- Modify: `tests/moments-journal-layout.test.mjs`
- Create: `src/styles/moments.css`
- Modify: `src/pages/moments.astro`

**Interfaces:**
- Preserve IDs: `publish-toggle`, `publish-box`, `publish-form`, `image-input`, `image-previews`, `moments-session-status`, `moments-login`, `moment-lightbox`, `moments-retry`.
- Preserve calls/hooks: `renderMomentReactions`, `createCommentsWidget('moment', ...)`, `uploadToR2`/media upload path, `captureVideoPoster`, delete and pin API paths.

- [ ] **Step 1: Rewrite the visual-only Moments test into the new contract before implementation**

Keep existing functional tests unchanged. Replace only the `sunlit notes uses a paper-note visual language` test with:

```js
test('moments uses a content-first life-slice visual language', () => {
  const css = read('src/styles/moments.css');
  assert.match(css, /\.moments-shell/);
  assert.match(css, /\.moments-wall-filter \.pill\.active::after/);
  assert.match(css, /\.moment-card/);
  assert.match(css, /\.moment-media/);
  assert.match(css, /\.moment-actions/);
  assert.match(css, /\.moment-daypart/);
  assert.match(css, /@media \(max-width:\s*720px\)/);
  assert.doesNotMatch(css, /rotate\(/);
  assert.doesNotMatch(css, /box-shadow:\s*0 13px 30px/);
});
```

Also change the stylesheet read path from `moments-life-wall.css` to `moments.css`.

- [ ] **Step 2: Run Moments test and verify RED**

```bash
node --test tests/moments-journal-layout.test.mjs
```

Expected: FAIL because `src/styles/moments.css` does not exist.

- [ ] **Step 3: Add `moments.css` and switch the page import**

Change:

```astro
import '../styles/moments-life-wall.css';
```

to:

```astro
import '../styles/moments-life-wall.css'; // temporary migration fallback, removed in Plan 04
import '../styles/moments.css';
```

Create `moments.css` around semantic content hierarchy:

```css
.moments-shell {
  width: min(100%, 900px);
  margin-inline: auto;
  font-family: var(--font-body);
}

.moments-wall-head {
  margin-bottom: clamp(36px, 6vw, 64px);
}

.moments-wall-filter .pill {
  position: relative;
  border: 0;
  background: transparent;
  color: var(--muted);
}

.moments-wall-filter .pill.active {
  color: var(--ink);
}

.moments-wall-filter .pill.active::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: -5px;
  height: 2px;
  background: var(--accent);
}

.moment-card {
  padding-block: clamp(22px, 4vw, 36px);
  border-top: 1px solid var(--line);
  background: transparent;
  box-shadow: none;
  transform: none;
}

.moment-actions {
  color: var(--muted);
  opacity: 0.62;
}

.moment-card:hover .moment-actions,
.moment-card:focus-within .moment-actions {
  opacity: 1;
}

@media (max-width: 720px) {
  .moment-card { transform: none !important; }
  .moment-actions { opacity: 1; }
}
```

Use existing layout classes for single image / multi-image / video and make media the strongest visual element without mandatory rotation/tape decorations.

- [ ] **Step 4: Keep the composer collapsed and visually quiet**

The default page continues to expose `#publish-toggle` with `aria-expanded="false"`. In `moments.css`, render the trigger as a text-like write affordance and only style the full publish panel when opened. Do not change form IDs, auth flow, file inputs, or upload scripts.

- [ ] **Step 5: Run behavior and visual contract tests**

```bash
node --test tests/moments-journal-layout.test.mjs tests/video-poster.test.mjs tests/visual-settings.test.mjs
npm run check
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/styles/moments.css src/pages/moments.astro tests/moments-journal-layout.test.mjs
git commit -m "style: turn moments into life slice feed"
```

---

### Task 2: Make `/posts` writing-only and add `/archive`

**Files:**
- Create: `src/pages/archive.astro`
- Create: `src/styles/pages.css`
- Create: `tests/window-desk-public-pages.test.mjs`
- Modify: `src/pages/posts/index.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `package.json`

**Interfaces:**
- `/posts`: grouped article browsing with title/date/description/`#tags`; no GitHub project query.
- `/archive`: year-grouped chronological index with lightweight count and year anchors.

- [ ] **Step 1: Write failing page-responsibility tests**

Create `tests/window-desk-public-pages.test.mjs`:

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('posts page is writing-only and archive is a dedicated route', () => {
  const posts = read('src/pages/posts/index.astro');
  assert.equal(existsSync(new URL('../src/pages/archive.astro', import.meta.url)), true);
  assert.doesNotMatch(posts, /getGitHubProjects/);
  assert.doesNotMatch(posts, /GitHub 项目/);
  assert.match(posts, /文章/);
  assert.match(posts, /#\{tag\}/);

  const archive = read('src/pages/archive.astro');
  assert.match(archive, /归档/);
  assert.match(archive, /getCollection\('blog'/);
  assert.match(archive, /archive-year/);
});
```

Add the test file to `test:site`.

- [ ] **Step 2: Verify RED**

```bash
node --test tests/window-desk-public-pages.test.mjs
```

Expected: FAIL because `/archive` does not exist and `/posts` still contains GitHub projects.

- [ ] **Step 3: Rewrite `/posts` as a writing index**

Remove `getGitHubProjects` import/query entirely. Keep sorted `posts`, derive groups:

```ts
const postsByYear = posts.reduce((groups, post) => {
  const year = String(post.data.pubDate.getFullYear());
  (groups[year] ??= []).push(post);
  return groups;
}, {} as Record<string, typeof posts>);
```

Render each year as:

```astro
<section class="writing-year" aria-labelledby={`year-${year}`}>
  <h2 id={`year-${year}`}>{year}</h2>
  <div class="writing-index">
    {postsByYear[year].map((post) => (
      <article class="writing-entry">
        <time datetime={post.data.pubDate.toISOString()}>{post.data.pubDate.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}</time>
        <div>
          <h3><a href={`/posts/${post.id.replace(/\.md$/, '')}`}>{post.data.title}</a></h3>
          <p>{post.data.description}</p>
          <p class="writing-tags">{post.data.tags.map((tag) => <span>#{tag}</span>)}</p>
        </div>
      </article>
    ))}
  </div>
</section>
```

- [ ] **Step 4: Add `/archive.astro`**

Query/sort the same collection and group by year. Render a compact index with `id={`archive-${year}`}` and links to each article. The page should not duplicate descriptions or large cards.

- [ ] **Step 5: Introduce `pages.css` and wire it into `BaseLayout.astro`**

Import after `site-shell.css`:

```astro
import '../styles/pages.css';
```

Core rules:

```css
.page-reading-shell,
.archive-shell,
.tags-shell,
.messages-shell,
.about-shell,
.search-shell {
  width: min(100%, 920px);
  margin-inline: auto;
}

.writing-entry {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr);
  gap: 20px;
  padding-block: 22px;
  border-top: 1px solid var(--line);
}

.writing-entry time,
.archive-entry time {
  color: var(--muted);
  font-size: 0.86rem;
}

@media (max-width: 680px) {
  .writing-entry { grid-template-columns: 1fr; gap: 8px; }
}
```

- [ ] **Step 6: Run tests and build check**

```bash
node --test tests/window-desk-public-pages.test.mjs
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/posts/index.astro src/pages/archive.astro src/styles/pages.css src/layouts/BaseLayout.astro tests/window-desk-public-pages.test.mjs package.json
git commit -m "feat: separate writing index and archive"
```

---

### Task 3: Convert tags into a text index

**Files:**
- Modify: `src/pages/tags/index.astro`
- Modify: `src/pages/tags/[tag].astro`
- Modify: `src/styles/pages.css`
- Modify: `tests/window-desk-public-pages.test.mjs`

**Interfaces:**
- Tag index link class: `.tag-index-link`.
- Counts remain visible but subdued.
- Tag detail uses the same `.writing-entry` language as `/posts`.

- [ ] **Step 1: Add failing tests**

```js
test('tags are an index instead of a pill cloud', () => {
  const tags = read('src/pages/tags/index.astro');
  assert.match(tags, /tag-index-link/);
  assert.doesNotMatch(tags, /tag-pill/);
  assert.match(tags, /<sup>\{count\}<\/sup>/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test tests/window-desk-public-pages.test.mjs
```

- [ ] **Step 3: Update tag index markup**

Use:

```astro
<nav class="tag-index" aria-label="文章标签">
  {sortedTags.map(([tag, count]) => (
    <a class="tag-index-link" href={`/tags/${encodeURIComponent(tag)}`}>
      <span>{tag}</span><sup>{count}</sup>
    </a>
  ))}
</nav>
```

Style links as text with an accent underline only on hover/focus/current state.

- [ ] **Step 4: Align tag detail page to writing entries**

Reuse `.writing-entry` structure; do not create a second card vocabulary.

- [ ] **Step 5: Test and commit**

```bash
node --test tests/window-desk-public-pages.test.mjs
npm run check
git add src/pages/tags src/styles/pages.css tests/window-desk-public-pages.test.mjs
git commit -m "style: turn tags into text index"
```

---

### Task 4: Add About and move GitHub projects there with graceful fallback

**Files:**
- Create: `src/pages/about.astro`
- Modify: `src/styles/pages.css`
- Modify: `tests/window-desk-public-pages.test.mjs`

**Interfaces:**
- Uses existing `getGitHubProjects(): Promise<GitHubProject[]>`, which already returns `[]` on fetch/non-OK failure.
- About page must remain complete if `projects.length === 0`.

- [ ] **Step 1: Add failing tests**

```js
test('about owns personal context and selected projects with graceful empty state', () => {
  const about = read('src/pages/about.astro');
  assert.match(about, /getGitHubProjects/);
  assert.match(about, /关于/);
  assert.match(about, /最近在做/);
  assert.match(about, /喜欢/);
  assert.match(about, /projects\.length\s*>\s*0/);
  assert.match(about, /about-projects/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test tests/window-desk-public-pages.test.mjs
```

- [ ] **Step 3: Create `about.astro`**

Use a text-first skeleton:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { getGitHubProjects } from '../lib/github-projects';
const projects = await getGitHubProjects();
---
<BaseLayout title="关于 | 搁浅 的小窝" description="关于我和这个小站。" showBanner={false}>
  <article class="about-shell">
    <header class="page-heading"><h1>关于</h1><p>如果你还想多认识我一点。</p></header>
    <section><h2>这里是谁</h2><p>这是一个记录学习、项目、游戏、音乐和日常的小站。</p></section>
    <section><h2>最近在做</h2><p>把正在研究和折腾的事情慢慢整理下来。</p></section>
    <section><h2>喜欢</h2><p>游戏、音乐、动画，以及值得反复回看的小东西。</p></section>
    {projects.length > 0 && (
      <section class="about-projects"><h2>一些项目</h2>{/* text-first project rows */}</section>
    )}
    <section><h2>找到我</h2><p><a href="https://github.com/Lidure">GitHub</a> · <a href="/messages">留言</a> · <a href="/rss.xml">RSS</a></p></section>
  </article>
</BaseLayout>
```

Project rows show name, description, language, updated date, optional homepage. Avoid stats dashboards/skill bars.

- [ ] **Step 4: Test and commit**

```bash
node --test tests/window-desk-public-pages.test.mjs
npm run check
git add src/pages/about.astro src/styles/pages.css tests/window-desk-public-pages.test.mjs
git commit -m "feat: add personal about page"
```

---

### Task 5: Turn Messages into a guestbook without breaking form/admin hooks

**Files:**
- Modify: `src/pages/messages.astro`
- Modify: `src/styles/pages.css`
- Modify: `tests/window-desk-public-pages.test.mjs`

**Interfaces:**
- Preserve IDs: `message-form`, `message-user-id`, `message-text`, `message-status`, `message-submit`, `message-admin`, `message-session-status`, `message-logout`, `message-login`, `message-login-password`, `message-login-submit`, `message-count`, `messages-list`.
- Existing API calls/scripts remain untouched unless a selector must be updated; prefer keeping selectors unchanged.

- [ ] **Step 1: Add failing structure/hook test**

```js
test('messages reads as a guestbook while preserving behavior hooks', () => {
  const page = read('src/pages/messages.astro');
  assert.match(page, /路过的话，留下一句话吧/);
  assert.doesNotMatch(page, /GUESTBOOK/);
  assert.doesNotMatch(page, /RECENT MESSAGES/);
  for (const id of [
    'message-form', 'message-user-id', 'message-text', 'message-status',
    'message-submit', 'message-admin', 'message-session-status', 'message-login',
    'message-count', 'messages-list',
  ]) assert.match(page, new RegExp(`id="${id}"`));
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test tests/window-desk-public-pages.test.mjs
```

- [ ] **Step 3: Restructure only the presentation markup**

Replace the two-column “composer vs stream” framing with:

```astro
<section class="messages-shell">
  <header class="page-heading">
    <h1>留言</h1>
    <p>路过的话，留下一句话吧。</p>
  </header>
  <section class="guestbook-compose" aria-label="写留言">
    <!-- keep the existing form fields and exact IDs -->
  </section>
  <section class="guestbook-stream" aria-labelledby="messages-stream-title">
    <header><h2 id="messages-stream-title">最近留下的话</h2><span><strong id="message-count">—</strong> 条</span></header>
    <div class="messages-list" id="messages-list">...</div>
  </section>
  <!-- keep admin area but visually recessed -->
</section>
```

Move existing inline CSS into `pages.css` where practical; leave runtime scripts intact.

- [ ] **Step 4: Run tests**

```bash
node --test tests/window-desk-public-pages.test.mjs
npm run check
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/messages.astro src/styles/pages.css tests/window-desk-public-pages.test.mjs
git commit -m "style: reshape messages as guestbook"
```

---

### Task 6: Align search and footer with the shared language

**Files:**
- Modify: `src/pages/search.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/site-shell.css`
- Modify: `src/styles/pages.css`
- Modify: `tests/window-desk-public-pages.test.mjs`

**Interfaces:**
- Footer primary copy: `搁浅的小窝 · 2026` and `在自己的角落里慢慢记录。`.
- Footer links: RSS, GitHub, 留言, 返回顶部.

- [ ] **Step 1: Add failing assertions**

```js
test('footer and search use quiet shared page language', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  const search = read('src/pages/search.astro');
  assert.match(layout, /搁浅的小窝 · 2026/);
  assert.match(layout, /在自己的角落里慢慢记录/);
  assert.match(layout, /\/rss\.xml/);
  assert.match(layout, /\/messages/);
  assert.doesNotMatch(layout, />Built with Astro and GitHub Pages\.<\/p>/);
  assert.match(search, /search-shell/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test tests/window-desk-public-pages.test.mjs
```

- [ ] **Step 3: Implement footer and search styling**

Use semantic footer markup:

```astro
<footer class="footer">
  <div class="footer-inner">
    <div><strong>搁浅的小窝 · 2026</strong><p>在自己的角落里慢慢记录。</p></div>
    <nav aria-label="页脚链接">
      <a href="/rss.xml">RSS</a>
      <a href="https://github.com/Lidure">GitHub</a>
      <a href="/messages">留言</a>
      <a href="#top">返回顶部</a>
    </nav>
    <small>Built with Astro · Hosted on GitHub Pages</small>
  </div>
</footer>
```

Ensure the document root/body has a reliable top target (`id="top"` on body is invalid in Astro body class composition if inconvenient; use the first page shell/header or an empty top anchor). Search results use the same text-row vocabulary as writing entries rather than independent heavy cards.

- [ ] **Step 4: Run tests and build**

```bash
node --test tests/window-desk-public-pages.test.mjs tests/moments-journal-layout.test.mjs
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/search.astro src/layouts/BaseLayout.astro src/styles/site-shell.css src/styles/pages.css tests/window-desk-public-pages.test.mjs
git commit -m "style: unify search and footer language"
```

---

### Task 7: Verify Plan 03 as an independently shippable checkpoint

- [ ] **Step 1: Run focused behavior suites**

```bash
node --test tests/moments-journal-layout.test.mjs tests/window-desk-public-pages.test.mjs tests/visual-settings.test.mjs tests/video-poster.test.mjs
```

- [ ] **Step 2: Run the full build and regression suite**

```bash
npm run build
npm run test:site
```

Expected: PASS except obsolete visual-only assertions replaced by equivalent new-design contracts; no business behavior test is removed merely because styling changed.

- [ ] **Step 3: Diff review**

```bash
git diff --stat main...HEAD
git diff main...HEAD -- src/pages/moments.astro src/pages/posts/index.astro src/pages/archive.astro src/pages/tags src/pages/messages.astro src/pages/about.astro src/pages/search.astro src/styles/moments.css src/styles/pages.css
```

Confirm:
- Moments write/admin selectors remain;
- `/posts` no longer calls GitHub API;
- About survives an empty project array;
- `/archive` and `/about` match new navigation paths;
- no legacy visual CSS is deleted yet.

- [ ] **Step 4: Commit verification fixes only when necessary**

```bash
git add <files-fixed-for-plan-03>
git commit -m "test: stabilize public page redesign checkpoint"
```
