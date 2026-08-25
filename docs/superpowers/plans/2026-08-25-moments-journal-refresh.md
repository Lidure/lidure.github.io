# Moments Journal Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `碎碎念` into a compact digital-journal page with a smaller header, film-strip category controls, date chapters, today markers, content-aware card variants, scrapbook media layouts, and a lighter publish composer without changing Moments APIs or behavior.

**Architecture:** Keep `src/pages/moments.astro` as the feature owner because its dynamic nodes rely on Astro scoped-style propagation through `applyScopedStyles()`. Make targeted structural/style changes in that file, introduce small pure date/media classification helpers next to the existing `RenderMoment` type, and replace the flat `syncMoments()` append loop with date-chapter containers. Existing upload, auth, reaction, comments, lightbox, delete, and API functions remain untouched except where filtering must become chapter-aware.

**Tech Stack:** Astro 6, TypeScript in Astro scripts, CSS, browser DOM APIs, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-25-article-moments-layout-design.md`

## Global Constraints

- Do not change Moments API contracts, persistence, authentication, upload limits, storage provider, or reaction storage.
- Preserve IDs and hooks used by publish/upload/session/lightbox/reaction behavior.
- Use current theme variables and theme hue; do not make fixed pink/purple the core structure.
- Preserve light/dark, card opacity/border/follow-theme, fullscreen, and overlay modes.
- Keep critical touch controls visible; hover-only behavior may only hide secondary desktop affordances.
- Respect `prefers-reduced-motion` and `html[data-reduce-motion="true"]`.
- Preserve chronological order from the existing API response.
- Avoid a rewrite of the 90kB page; modify only layout/render/style paths needed by the spec.

---

### Task 1: Compact journal header, month/latest stats, and film-strip controls

**Files:**
- Modify: `src/pages/moments.astro`
- Create: `tests/moments-journal-layout.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing `updateStats(moments)`, `.pill[data-category]`, `#publish-toggle`, current category metadata.
- Produces: `.moments-journal-header`, `#stat-month`, `#stat-latest`, `.moments-film-strip`, `.moments-publish-label`.

- [ ] **Step 1: Write the failing source regression test**

Create `tests/moments-journal-layout.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../src/pages/moments.astro', import.meta.url), 'utf8');

test('moments page uses a compact journal header and connected category strip', () => {
  assert.match(page, /moments-hero moments-journal-header/);
  assert.match(page, /id="stat-month"/);
  assert.match(page, /id="stat-latest"/);
  assert.match(page, /controls-bar moments-film-strip/);
  assert.match(page, /class="moments-publish-label"/);
  assert.match(page, /monthCount/);
  assert.match(page, /latestMoment/);
});
```

Add the test to `package.json` `test:site`.

- [ ] **Step 2: Run test and verify RED**

```bash
node --test tests/moments-journal-layout.test.mjs
```

Expected: FAIL because the journal classes/stats do not exist.

- [ ] **Step 3: Restructure the header without changing functional hooks**

Keep `.moments-hero`, `#hero-stats`, and all existing category stat IDs, but change the header to:

```astro
<div class="moments-hero moments-journal-header">
  <div class="hero-bubbles" aria-hidden="true">
    <span class="bubble b1"></span>
    <span class="bubble b2"></span>
  </div>
  <div class="moments-journal-copy">
    <span class="kicker">Moments · Journal</span>
    <h1>碎碎念</h1>
    <p>随手记下的碎片，游戏 · 音乐 · 生活 · 吐槽。</p>
  </div>
  <div class="hero-stats moments-journal-stats" id="hero-stats">
    <span class="stat-badge"><small>全部</small><strong id="stat-total">—</strong></span>
    <span class="stat-badge"><small>本月</small><strong id="stat-month">—</strong></span>
    <span class="stat-badge stat-latest"><small>最近更新</small><strong id="stat-latest">—</strong></span>
  </div>
</div>
```

The old per-category stat elements may be removed because the category strip already communicates categories and `updateStats()` will be updated in the same task.

- [ ] **Step 4: Make the controls a connected strip while preserving IDs/data attributes**

Use:

```astro
<div class="controls-bar moments-film-strip">
  <div class="cat-pills" role="group" aria-label="筛选碎碎念分类">
    <button class="pill active" data-category="all">全部</button>
    {categoryOrder.map((cat) => (
      <button class="pill" data-category={cat}>
        <span aria-hidden="true">{categoryMeta[cat].icon}</span>
        <span>{cat}</span>
      </button>
    ))}
  </div>
  <button class="fab" id="publish-toggle" aria-label="发布新动态">
    <span id="toggle-icon" aria-hidden="true">✏️</span>
    <span class="moments-publish-label">写一条</span>
  </button>
</div>
```

Do not rename `#publish-toggle`, `#toggle-icon`, or `.pill[data-category]`.

- [ ] **Step 5: Update stats computation**

Replace category-count-only UI writes with:

```ts
function updateStats(moments: RenderMoment[]) {
  const totalEl = document.getElementById('stat-total');
  const monthEl = document.getElementById('stat-month');
  const latestEl = document.getElementById('stat-latest');

  const now = new Date();
  const monthCount = moments.filter((moment) => {
    const date = new Date(moment.date);
    return !Number.isNaN(date.getTime())
      && date.getFullYear() === now.getFullYear()
      && date.getMonth() === now.getMonth();
  }).length;
  const latestMoment = moments[0];

  if (totalEl) totalEl.textContent = String(moments.length);
  if (monthEl) monthEl.textContent = String(monthCount);
  if (latestEl) latestEl.textContent = latestMoment ? formatMomentDate(latestMoment.date) : '—';
}
```

- [ ] **Step 6: Run focused test and commit**

```bash
node --test tests/moments-journal-layout.test.mjs
```

Expected: PASS.

Commit:

```bash
git add src/pages/moments.astro tests/moments-journal-layout.test.mjs package.json
git commit -m "feat: add moments journal header"
```

---

### Task 2: Date chapters, today marker, and chapter-aware filtering

**Files:**
- Modify: `src/pages/moments.astro`
- Modify: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Consumes: `RenderMoment.date`, `syncMoments()`, existing category buttons.
- Produces: `getMomentDateKey(date: string): string`, `createDateChapter(dateKey: string): HTMLElement`, `applyMomentFilter(category: string): void`, `.moment-date-chapter`, `.moment-date-heading`, `.moment-date-chapter-list`, `.is-today`.

- [ ] **Step 1: Extend test and verify RED**

Add:

```js
assert.match(page, /function getMomentDateKey\(date: string\)/);
assert.match(page, /function createDateChapter\(dateKey: string\)/);
assert.match(page, /function applyMomentFilter\(category: string\)/);
assert.match(page, /moment-date-chapter/);
assert.match(page, /moment-date-heading/);
assert.match(page, /is-today/);
assert.match(page, /prefers-reduced-motion/);
```

Run:

```bash
node --test tests/moments-journal-layout.test.mjs
```

Expected: FAIL.

- [ ] **Step 2: Add date helpers next to `RenderMoment`**

```ts
function getMomentDateKey(date: string): string {
  const parsed = new Date(date);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return date.slice(0, 10) || 'unknown';
}

function getTodayDateKey(): string {
  return getMomentDateKey(new Date().toISOString());
}

function formatDateChapter(dateKey: string): string {
  const [year, month, day] = dateKey.split('-');
  return `${year} / ${month} / ${day}`;
}

function createDateChapter(dateKey: string) {
  const section = document.createElement('section');
  section.className = 'moment-date-chapter';
  section.dataset.date = dateKey;
  section.classList.toggle('is-today', dateKey === getTodayDateKey());

  const heading = document.createElement('header');
  heading.className = 'moment-date-heading';

  const time = document.createElement('time');
  time.dateTime = dateKey;
  time.textContent = formatDateChapter(dateKey);

  const dot = document.createElement('span');
  dot.className = 'moment-today-dot';
  dot.setAttribute('aria-hidden', 'true');

  const stack = document.createElement('div');
  stack.className = 'moment-date-chapter-list';

  heading.append(time, dot);
  section.append(heading, stack);
  applyScopedStyles(section);
  return section;
}
```

- [ ] **Step 3: Group `syncMoments()` output by consecutive date key**

Replace the flat `moments.forEach(... list.appendChild(card))` section with:

```ts
list.innerHTML = '';
let currentDateKey = '';
let currentChapterList: HTMLElement | null = null;

moments.forEach((moment, idx) => {
  const dateKey = getMomentDateKey(moment.date);
  if (dateKey !== currentDateKey) {
    currentDateKey = dateKey;
    const chapter = createDateChapter(dateKey);
    currentChapterList = chapter.querySelector<HTMLElement>('.moment-date-chapter-list');
    list.appendChild(chapter);
  }

  const card = buildMomentCard(moment, idx, activeCategory);
  if (card) currentChapterList?.appendChild(card);
});

applyMomentFilter(activeCategory);
```

- [ ] **Step 4: Replace the old category filtering loop with chapter-aware filtering**

Add:

```ts
function applyMomentFilter(category: string) {
  document.querySelectorAll<HTMLElement>('.moment-date-chapter').forEach((chapter) => {
    let visibleCards = 0;
    chapter.querySelectorAll<HTMLElement>('.moment-card').forEach((card) => {
      const hidden = category !== 'all' && card.dataset.category !== category;
      card.classList.toggle('hidden', hidden);
      if (!hidden) visibleCards += 1;
    });
    chapter.hidden = visibleCards === 0;
  });
}
```

Change the category button handler to call only:

```ts
applyMomentFilter(tab.dataset.category ?? 'all');
```

This prevents empty date headings after filtering.

- [ ] **Step 5: Add today pulse with reduced-motion protection**

Add scoped CSS:

```css
.moment-today-dot {
  display: none;
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--standard-accent, var(--accent));
}

.moment-date-chapter.is-today .moment-today-dot {
  display: inline-block;
  animation: moment-today-pulse 2.4s ease-in-out infinite;
}

@keyframes moment-today-pulse {
  0%, 100% { opacity: 0.45; transform: scale(0.86); }
  50% { opacity: 1; transform: scale(1.15); }
}

@media (prefers-reduced-motion: reduce) {
  .moment-date-chapter.is-today .moment-today-dot { animation: none; }
}

:global(html[data-reduce-motion="true"]) .moment-date-chapter.is-today .moment-today-dot {
  animation: none;
}
```

- [ ] **Step 6: Run focused test and commit**

```bash
node --test tests/moments-journal-layout.test.mjs
```

Expected: PASS.

Commit:

```bash
git add src/pages/moments.astro tests/moments-journal-layout.test.mjs
git commit -m "feat: group moments into date chapters"
```

---

### Task 3: Content-aware card variants and scrapbook media composition

**Files:**
- Modify: `src/pages/moments.astro`
- Modify: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Consumes: `moment.images`, `moment.media` video entries.
- Produces: `.is-text-only`, `.is-single-media`, `.is-multi-media` on each `.moment-card`; data-count-based scrapbook media rules.

- [ ] **Step 1: Extend test and verify RED**

```js
assert.match(page, /is-text-only/);
assert.match(page, /is-single-media/);
assert.match(page, /is-multi-media/);
assert.match(page, /mediaCount/);
assert.match(page, /\.moment-card\.is-single-media/);
assert.match(page, /\.moment-card\.is-multi-media/);
assert.match(page, /\.card-images\[data-count="2"\]/);
```

Run the focused test; expect FAIL.

- [ ] **Step 2: Classify each card before rendering media**

At the beginning of `buildMomentCard()` after creating the card:

```ts
const videos = (moment.media || []).filter((item) => item.kind === 'video');
const mediaCount = (moment.images?.length || 0) + videos.length;
card.classList.add(
  mediaCount === 0 ? 'is-text-only' : mediaCount === 1 ? 'is-single-media' : 'is-multi-media'
);
```

Reuse this `videos` variable later instead of redeclaring it.

- [ ] **Step 3: Change per-card date display to time-only because the chapter owns the date**

Add:

```ts
function formatMomentTime(date: string): string {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return formatMomentDate(date);
  return parsed.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}
```

Change:

```ts
dateEl.textContent = formatMomentTime(moment.date);
```

Keep `dateEl.dateTime = moment.date` for semantic full-date information.

- [ ] **Step 4: Restyle the timeline as journal chapters and cards**

Replace the heavy global timeline/card treatment with scoped rules equivalent to:

```css
.moments-shell {
  max-width: 960px;
}

.moments-list {
  display: grid;
  gap: 30px;
  padding-left: 0;
  margin-left: 0;
  border-left: 0;
}

.moment-date-chapter {
  display: grid;
  grid-template-columns: 126px minmax(0, 1fr);
  gap: 22px;
}

.moment-date-heading {
  position: sticky;
  top: 86px;
  align-self: start;
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 9px;
  color: var(--standard-muted, var(--muted));
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.1em;
  font-variant-numeric: tabular-nums;
}

.moment-date-chapter-list {
  position: relative;
  display: grid;
  gap: 14px;
}

.moment-date-chapter-list::before {
  content: '';
  position: absolute;
  left: -12px;
  top: 10px;
  bottom: 10px;
  width: 1px;
  background: color-mix(in srgb, var(--standard-accent, var(--accent)) 22%, var(--panel-border));
}

.moment-card {
  margin-left: 0;
  overflow: visible;
  border: 1px solid color-mix(in srgb, var(--standard-line, var(--panel-border)) 88%, transparent);
  border-radius: 16px;
  background: color-mix(in srgb, var(--standard-card-bg, var(--panel)) 94%, transparent);
  box-shadow: 0 10px 34px rgba(4, 6, 16, 0.055);
  backdrop-filter: none;
  transform: none;
}

.moment-card::before {
  left: -17px;
  top: 24px;
  width: 8px;
  height: 8px;
  border: 2px solid var(--standard-card-bg, var(--bg));
  box-shadow: 0 0 0 1px var(--standard-accent, var(--accent));
}

.card-glow {
  width: 3px;
  opacity: 0.68;
  background: var(--standard-accent, var(--accent));
}

.moment-card:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 40px rgba(4, 6, 16, 0.075);
}

.card-content {
  padding: 18px 20px 17px 22px;
}

.moment-card.is-text-only .card-text {
  max-width: 66ch;
  font-size: 1.02rem;
  line-height: 1.82;
}

.moment-card.is-single-media .card-images {
  width: min(100%, 680px);
  max-width: none;
  grid-template-columns: 1fr;
  gap: 0;
}

.moment-card.is-single-media .card-images img,
.moment-card.is-single-media .card-images video {
  max-height: 560px;
  border-radius: 13px;
  object-fit: cover;
}

.moment-card.is-multi-media .card-images {
  width: 100%;
  max-width: none;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.moment-card.is-multi-media .card-images[data-count="2"] {
  grid-template-columns: 1.15fr 0.85fr;
}

.moment-card.is-multi-media .card-images img,
.moment-card.is-multi-media .card-images video {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}
```

Use theme-derived category accents instead of the old fixed `glow-游戏/音乐/生活/吐槽` gradients. Existing category classes can remain for compatibility, but their new visual output should derive from standard variables or `color-mix()`.

- [ ] **Step 5: Run focused test and commit**

```bash
node --test tests/moments-journal-layout.test.mjs
```

Expected: PASS.

Commit:

```bash
git add src/pages/moments.astro tests/moments-journal-layout.test.mjs
git commit -m "style: add moments scrapbook card variants"
```

---

### Task 4: Journal composer, metadata hierarchy, and responsive mobile layout

**Files:**
- Modify: `src/pages/moments.astro`
- Modify: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Consumes: existing `.publish-panel`, `#publish-form`, upload/session/reaction/action hooks.
- Produces: lighter journal-note composer and mobile chapter layout without renaming functional selectors.

- [ ] **Step 1: Extend test for preserved hooks and mobile rules**

```js
for (const hook of [
  'id="publish-toggle"',
  'id="publish-box"',
  'id="publish-form"',
  'id="image-input"',
  'id="image-previews"',
  'id="moments-session-status"',
  'id="moment-lightbox"'
]) assert.match(page, new RegExp(hook));

assert.match(page, /@media \(max-width:\s*720px\)/);
assert.match(page, /\.moment-date-chapter\s*\{[\s\S]*grid-template-columns:\s*1fr/);
assert.match(page, /\.publish-panel/);
assert.match(page, /backdrop-filter:\s*none/);
```

Run focused test; expect failure until the mobile/journal overrides are added.

- [ ] **Step 2: Make the publish panel an opened journal note**

Keep all existing IDs and form controls, but update scoped styling:

```css
.publish-panel {
  position: relative;
  margin: -8px 0 28px;
  padding: 24px;
  border: 1px solid color-mix(in srgb, var(--standard-accent, var(--accent)) 16%, var(--panel-border));
  border-radius: 16px;
  background:
    linear-gradient(90deg, transparent 0 34px, color-mix(in srgb, var(--standard-accent, var(--accent)) 12%, transparent) 34px 35px, transparent 35px),
    color-mix(in srgb, var(--standard-card-bg, var(--panel)) 96%, transparent);
  box-shadow: 0 16px 42px rgba(4, 6, 16, 0.065);
  backdrop-filter: none;
}

.publish-panel::before {
  content: '';
  position: absolute;
  left: 20px;
  top: 20px;
  bottom: 20px;
  width: 5px;
  border-radius: 999px;
  background: repeating-linear-gradient(to bottom, var(--standard-accent, var(--accent)) 0 5px, transparent 5px 12px);
  opacity: 0.42;
}

.publish-form {
  padding-left: 18px;
}

.field textarea {
  min-height: 132px;
  line-height: 1.7;
}
```

- [ ] **Step 3: Lower metadata/actions visual priority without hiding touch actions**

```css
.card-meta {
  margin-bottom: 12px;
}

.card-date,
.delete-moment-btn,
.card-link,
.moment-reactions {
  color: var(--standard-muted, var(--muted));
}

@media (hover: hover) and (pointer: fine) {
  .moment-card .delete-moment-btn {
    opacity: 0.38;
  }
  .moment-card:hover .delete-moment-btn,
  .moment-card:focus-within .delete-moment-btn {
    opacity: 1;
  }
}
```

Do not hide reactions or delete controls on touch devices.

- [ ] **Step 4: Add intentional mobile layout**

```css
@media (max-width: 720px) {
  .moments-shell {
    max-width: none;
    padding-inline: 0;
  }

  .moments-journal-header {
    grid-template-columns: 1fr;
    padding: 24px 20px;
    text-align: left;
  }

  .moments-journal-stats {
    justify-content: flex-start;
  }

  .moments-film-strip {
    align-items: center;
    overflow: hidden;
  }

  .cat-pills {
    flex: 1;
    flex-wrap: nowrap;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .moments-publish-label {
    display: none;
  }

  .moment-date-chapter {
    grid-template-columns: 1fr;
    gap: 9px;
  }

  .moment-date-heading {
    position: static;
    padding: 0 2px;
  }

  .moment-date-chapter-list {
    gap: 12px;
  }

  .moment-date-chapter-list::before,
  .moment-card::before {
    display: none;
  }

  .card-content {
    padding: 16px;
  }

  .moment-card.is-multi-media .card-images,
  .moment-card.is-multi-media .card-images[data-count="2"] {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .publish-panel {
    padding: 20px 16px;
  }

  .publish-form {
    padding-left: 12px;
  }
}
```

- [ ] **Step 5: Run focused test and commit**

```bash
node --test tests/moments-journal-layout.test.mjs
```

Expected: PASS.

Commit:

```bash
git add src/pages/moments.astro tests/moments-journal-layout.test.mjs
git commit -m "style: finish moments journal layout"
```

---

### Task 5: Moments behavior regression and integration verification

**Files:**
- Modify only if a regression test exposes a real issue: `src/pages/moments.astro`
- Modify: `tests/moments-journal-layout.test.mjs` only for missing invariant coverage, not to weaken assertions.

**Interfaces:**
- Consumes: all existing Moments functionality.
- Produces: verified unchanged upload/auth/reaction/lightbox/delete behavior around the new presentation.

- [ ] **Step 1: Add invariant assertions for critical existing behavior**

Add:

```js
assert.match(page, /renderMomentReactions\(moment/);
assert.match(page, /setupLightboxForNewCards\(\)/);
assert.match(page, /deleteMomentViaApi/);
assert.match(page, /uploadToR2/);
assert.match(page, /MOMENT_REACTIONS_API_URL/);
assert.match(page, /createCommentsWidget\(['"]moment['"]/);
assert.match(page, /applyScopedStyles\(card\)/);
```

- [ ] **Step 2: Run focused and existing Moments-related tests**

```bash
node --test tests/moments-journal-layout.test.mjs
npm run test:site
```

Expected: PASS.

- [ ] **Step 3: Run Astro type/build validation**

```bash
npm run build
```

Expected: `astro check` and `astro build` both PASS.

- [ ] **Step 4: Review the final diff before PR**

Confirm:

- no API/auth/storage modules changed,
- no upload limits changed,
- no reaction API URL/storage behavior changed,
- no wallpaper controller/style files changed,
- `moments.astro` retains `#publish-toggle`, `#publish-box`, `#publish-form`, media input IDs, session IDs, reaction classes, and lightbox IDs.

- [ ] **Step 5: Commit final regression guard if needed**

If Task 5 only added assertions:

```bash
git add tests/moments-journal-layout.test.mjs
git commit -m "test: protect moments journal behavior"
```

If no file changed after verification, do not create an empty commit.
