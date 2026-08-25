# Moments Life Wall V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PR #43 journal-card Moments presentation with a bannerless personal life wall where text, photos, video, dates, reactions, comments, and the composer form one uneven but controlled content stream.

**Architecture:** Keep `src/pages/moments.astro` as the owner of API/auth/upload/reaction/lightbox behavior, but make date grouping and visual classification direct rendering responsibilities instead of a post-render enhancer. Introduce one small pure `moments-life-wall.mjs` helper for deterministic date/media classification, add one authoritative `moments-life-wall.css`, remove the PR #43 journal enhancer/style, and change pin reordering to a custom event so the page can preserve date groups after an immediate pin/unpin reorder.

**Tech Stack:** Astro 6, TypeScript in Astro client scripts, browser DOM APIs, CSS Grid, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-25-article-moments-human-v2-design.md`

## Dependency

Execute after Task 1 of `docs/superpowers/plans/2026-08-25-article-publication-v2.md`, which adds `BaseLayout` prop `showBanner?: boolean` with default `true`. If this plan is executed alone, implement that exact BaseLayout contract first.

## Global Constraints

- Moments passes `showBanner={false}` and removes `showTime={true}` so the life wall owns the page entrance.
- Keep category names exactly `全部 / 生活 / 音乐 / 游戏 / 吐槽` as supplied by existing data.
- Preserve Moments API contracts, authentication, secure-cookie session flow, image upload, video upload/poster generation, emoji insertion, filtering, reactions, comments, deletion, lightbox, pin/unpin, and retry/error behavior.
- Preserve all functional IDs/hooks unless a task changes the producer and every consumer atomically.
- Remove `Moments · Journal`, stat blocks, bordered hero, film-strip pills, PR #43 neat date chapters, uniform rounded glass cards, and filled category pills.
- Stop importing and delete `src/styles/moments-journal.css` and `src/lib/moments-journal-enhancer.mjs`; do not stack another enhancer over them.
- No month-navigation UI in V2.
- Date marks are not sticky; today uses one static accent dot, no pulse.
- Desktop content variants are deterministic: `moment--whisper`, `moment--text`, `moment--photo-one`, `moment--photo-two`, `moment--photo-three`, `moment--gallery`, `moment--video`.
- Only secondary images in `photo-three` and `gallery` may use a deterministic tilt up to `1deg`; no random rotation and no tilt on mobile.
- Under `720px`, flatten to one column with horizontal day headings and no sticky date rail.
- Reduced motion must disable decorative movement and smooth behavior.

---

### Task 1: Retire the PR #43 journal enhancer and establish V2 regression tests

**Files:**
- Modify: `src/components/MomentsPinControls.astro`
- Delete later in this task: `src/lib/moments-journal-enhancer.mjs`
- Delete later in this task: `src/styles/moments-journal.css`
- Replace: `tests/moments-journal-layout.test.mjs`
- Modify: `package.json` only if renaming the test file; preferred approach keeps the current filename to avoid script churn.

**Interfaces:**
- Consumes: existing pin-control component and `#moments-list`.
- Produces: pin controls independent from layout enhancement; source regression test that forbids PR #43 imports/copy.

- [ ] **Step 1: Replace `tests/moments-journal-layout.test.mjs` with the V2 baseline test**

```js
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/moments.astro');
const pins = read('src/components/MomentsPinControls.astro');

test('moments v2 retires the PR 43 journal enhancer', () => {
  assert.doesNotMatch(pins, /installMomentsJournalEnhancer/);
  assert.doesNotMatch(pins, /moments-journal\.css/);
  assert.equal(existsSync(new URL('../src/lib/moments-journal-enhancer.mjs', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/styles/moments-journal.css', import.meta.url)), false);
  assert.doesNotMatch(page, /Moments · Journal/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/moments-journal-layout.test.mjs
```

Expected: FAIL because the pin component still imports/installs the enhancer and both files exist.

- [ ] **Step 3: Remove only journal-enhancer wiring from `MomentsPinControls.astro`**

Delete these imports:

```ts
import { installMomentsJournalEnhancer } from '../lib/moments-journal-enhancer.mjs';
import '../styles/moments-journal.css';
```

Delete this call from `initMomentsPinControls()`:

```ts
installMomentsJournalEnhancer(listRoot, signal);
```

Do not alter API imports, decoration, pin button creation, error handling, or lifecycle cleanup in this step.

- [ ] **Step 4: Delete the two retired PR #43 files**

```bash
git rm src/lib/moments-journal-enhancer.mjs src/styles/moments-journal.css
```

- [ ] **Step 5: Run focused test and verify GREEN**

```bash
node --test tests/moments-journal-layout.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/MomentsPinControls.astro tests/moments-journal-layout.test.mjs package.json
git commit -m "refactor: retire moments journal enhancer"
```

---

### Task 2: Build deterministic date/media classification helpers

**Files:**
- Create: `src/lib/moments-life-wall.mjs`
- Modify: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Produces:
  - `getMomentDateKey(value: string | Date): string`
  - `getMomentDayParts(value: string | Date): { key: string, dateLabel: string, weekdayLabel: string, machineDate: string }`
  - `classifyMomentLayout(input: { text?: string, imageCount?: number, videoCount?: number }): string`
- Consumes: browser/Node standard `Date`; no DOM and no project API imports.

- [ ] **Step 1: Add failing unit tests**

Append:

```js
const helpersUrl = new URL('../src/lib/moments-life-wall.mjs', import.meta.url);

test('life wall layout classification is deterministic', async () => {
  const { classifyMomentLayout } = await import(helpersUrl.href + `?t=${Date.now()}`);
  assert.equal(classifyMomentLayout({ text: '今天有点困', imageCount: 0, videoCount: 0 }), 'whisper');
  assert.equal(classifyMomentLayout({ text: '这是一段超过三十二个字符的普通碎碎念内容，用来确保它进入普通文本布局。', imageCount: 0, videoCount: 0 }), 'text');
  assert.equal(classifyMomentLayout({ text: 'photo', imageCount: 1, videoCount: 0 }), 'photo-one');
  assert.equal(classifyMomentLayout({ text: 'photo', imageCount: 2, videoCount: 0 }), 'photo-two');
  assert.equal(classifyMomentLayout({ text: 'photo', imageCount: 3, videoCount: 0 }), 'photo-three');
  assert.equal(classifyMomentLayout({ text: 'photo', imageCount: 4, videoCount: 0 }), 'gallery');
  assert.equal(classifyMomentLayout({ text: 'video', imageCount: 2, videoCount: 1 }), 'video');
});

test('life wall date helpers use local calendar parts', async () => {
  const { getMomentDateKey, getMomentDayParts } = await import(helpersUrl.href + `?d=${Date.now()}`);
  const local = new Date(2026, 7, 25, 23, 30, 0);
  assert.equal(getMomentDateKey(local), '2026-08-25');
  assert.deepEqual(getMomentDayParts(local), {
    key: '2026-08-25',
    dateLabel: '08 / 25',
    weekdayLabel: 'TUE',
    machineDate: '2026-08-25',
  });
});
```

- [ ] **Step 2: Run and verify RED**

Expected: FAIL because the helper module does not exist.

- [ ] **Step 3: Create the helper module exactly**

```js
export function getMomentDateKey(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(value ?? '').slice(0, 10) || 'unknown';
}

export function getMomentDayParts(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  const key = getMomentDateKey(value);
  if (Number.isNaN(parsed.getTime())) {
    return { key, dateLabel: key, weekdayLabel: '', machineDate: key };
  }
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const weekdayLabel = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][parsed.getDay()];
  return { key, dateLabel: `${month} / ${day}`, weekdayLabel, machineDate: key };
}

export function classifyMomentLayout({ text = '', imageCount = 0, videoCount = 0 } = {}) {
  if (videoCount > 0) return 'video';
  if (imageCount >= 4) return 'gallery';
  if (imageCount === 3) return 'photo-three';
  if (imageCount === 2) return 'photo-two';
  if (imageCount === 1) return 'photo-one';
  return Array.from(String(text).trim()).length <= 32 ? 'whisper' : 'text';
}
```

- [ ] **Step 4: Run focused test and commit**

```bash
node --test tests/moments-journal-layout.test.mjs
git add src/lib/moments-life-wall.mjs tests/moments-journal-layout.test.mjs
git commit -m "feat: add deterministic moments wall layout rules"
```

---

### Task 3: Replace the Moments page entrance, filter, and composer UI

**Files:**
- Modify: `src/pages/moments.astro`
- Create: `src/styles/moments-life-wall.css`
- Modify: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Consumes: `BaseLayout.showBanner`, existing IDs `#publish-toggle`, `#toggle-icon`, `#publish-box`, `.pill[data-category]`, all existing form/session/upload IDs.
- Produces: `.moments-wall-head`, `.moments-wall-filter`, `.moments-compose-trigger`, `.moments-compose-label`, direct import of `moments-life-wall.css`.

- [ ] **Step 1: Add failing structure assertions**

Append:

```js
test('moments owns a quiet bannerless page entrance', () => {
  assert.match(page, /showBanner=\{false\}/);
  assert.doesNotMatch(page, /showTime=\{true\}/);
  assert.match(page, /class="moments-wall-head"/);
  assert.match(page, /class="controls-bar moments-wall-filter"/);
  assert.match(page, /class="fab moments-compose-trigger"/);
  assert.match(page, /class="moments-compose-label">今天想记点什么？/);
  assert.doesNotMatch(page, /hero-stats/);
  assert.doesNotMatch(page, /hero-bubbles/);
  assert.doesNotMatch(page, /✨ Moments/);
});
```

- [ ] **Step 2: Run and verify RED**

- [ ] **Step 3: Import the new authoritative stylesheet in page frontmatter**

```astro
import '../styles/moments-life-wall.css';
```

- [ ] **Step 4: Change `BaseLayout` call**

Use:

```astro
<BaseLayout
  title="碎碎念 | 搁浅 的小窝"
  description="游戏，音乐、生活、吐槽，随时碎碎念。"
  showBanner={false}
>
```

Remove `showTime={true}`.

- [ ] **Step 5: Replace the old Hero + controls markup only**

Replace the old `.moments-hero` and `.controls-bar` blocks with:

```astro
<header class="moments-wall-head">
  <h1>碎碎念</h1>
  <p>随手记下路过脑海和生活里的小事。</p>
</header>

<div class="controls-bar moments-wall-filter" aria-label="筛选碎碎念">
  <div class="cat-pills">
    <button class="pill active" data-category="all">全部</button>
    {categoryOrder.map((cat) => (
      <button class="pill" data-category={cat}>{cat}</button>
    ))}
  </div>
  <button class="fab moments-compose-trigger" id="publish-toggle" aria-label="写一条碎碎念">
    <span id="toggle-icon" aria-hidden="true">✎</span>
    <span class="moments-compose-label">今天想记点什么？</span>
  </button>
</div>
```

Keep the existing publish panel directly after this control row.

- [ ] **Step 6: Simplify visible composer copy without changing IDs**

Change only visual labels:

```astro
<span class="panel-title">写点什么</span>
```

Textarea placeholder:

```astro
placeholder="现在脑子里在想什么？"
```

Submit button text:

```astro
<button type="submit" class="submit-btn" id="submit-btn">发布</button>
```

Keep all upload, emoji, login, date/category, close, form-message and poster IDs.

- [ ] **Step 7: Create the top/composer part of `moments-life-wall.css`**

```css
body.layout-standard .moments-shell {
  width: min(100%, 1120px);
  max-width: 1120px;
  margin: 0 auto;
  padding: clamp(38px, 6vw, 78px) clamp(14px, 3vw, 34px) 60px;
}

body.layout-standard .moments-wall-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 0.55fr);
  align-items: end;
  gap: 34px;
  margin-bottom: 34px;
}
body.layout-standard .moments-wall-head h1 {
  margin: 0;
  color: var(--standard-text);
  font-family: 'Noto Sans SC', sans-serif;
  font-size: clamp(2.5rem, 6vw, 4.6rem);
  font-weight: 760;
  line-height: 1;
  letter-spacing: -0.055em;
}
body.layout-standard .moments-wall-head p {
  margin: 0 0 5px;
  color: var(--standard-muted);
  font-size: 0.88rem;
  line-height: 1.72;
}

body.layout-standard .moments-wall-filter {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 30px;
  padding: 0 0 12px;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--standard-line) 78%, transparent);
  background: transparent;
}
body.layout-standard .moments-wall-filter .cat-pills {
  display: flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
}
body.layout-standard .moments-wall-filter .pill {
  position: relative;
  min-height: 40px;
  padding: 9px 11px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--standard-muted);
  font-size: 0.82rem;
  font-weight: 620;
}
body.layout-standard .moments-wall-filter .pill::after {
  content: '';
  position: absolute;
  left: 11px;
  right: 11px;
  bottom: 2px;
  height: 1px;
  background: transparent;
}
body.layout-standard .moments-wall-filter .pill:hover { color: var(--standard-text); }
body.layout-standard .moments-wall-filter .pill.active { color: var(--standard-text); }
body.layout-standard .moments-wall-filter .pill.active::after { background: var(--standard-accent); }

body.layout-standard .moments-compose-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: auto;
  height: auto;
  min-height: 40px;
  padding: 7px 2px 7px 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--standard-muted);
  font-size: 0.82rem;
  font-weight: 560;
}
body.layout-standard .moments-compose-trigger:hover { color: var(--standard-accent); transform: none; box-shadow: none; }

body.layout-standard .moments-shell .publish-panel {
  position: relative;
  margin: -10px 0 46px;
  padding: 28px 0 30px 42px;
  border: 0;
  border-bottom: 1px solid color-mix(in srgb, var(--standard-line) 82%, transparent);
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
body.layout-standard .moments-shell .publish-panel::before {
  content: '';
  position: absolute;
  left: 12px;
  top: 28px;
  bottom: 30px;
  width: 1px;
  background: color-mix(in srgb, var(--standard-accent) 42%, transparent);
}
body.layout-standard .moments-shell .panel-topbar { margin-bottom: 18px; }
body.layout-standard .moments-shell .panel-title { color: var(--standard-text); font-size: 0.94rem; font-weight: 680; }
body.layout-standard .moments-shell .field textarea { min-height: 150px; line-height: 1.78; }
```

- [ ] **Step 8: Run focused test and commit**

```bash
node --test tests/moments-journal-layout.test.mjs
git add src/pages/moments.astro src/styles/moments-life-wall.css tests/moments-journal-layout.test.mjs
git commit -m "style: rebuild moments entrance and composer"
```

---

### Task 4: Render day groups and direct life-wall card variants

**Files:**
- Modify: `src/pages/moments.astro`
- Modify: `src/styles/moments-life-wall.css`
- Modify: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Consumes: `getMomentDateKey`, `getMomentDayParts`, `classifyMomentLayout` from `src/lib/moments-life-wall.mjs`; existing `RenderMoment`; `buildMomentCard`; category filtering.
- Produces: `.moment-day-group`, `.moment-day-stamp`, `.moment-day-flow`; `.moment--*` classes; `applyMomentFilter(category: string)`.

- [ ] **Step 1: Add failing source assertions**

Append:

```js
test('moments render date groups and content-derived layout variants directly', () => {
  assert.match(page, /from ['"]\.\.\/lib\/moments-life-wall\.mjs['"]/);
  assert.match(page, /function createMomentDayGroup\(dateKey: string\)/);
  assert.match(page, /function applyMomentFilter\(category: string\)/);
  assert.match(page, /moment-day-group/);
  assert.match(page, /moment-day-stamp/);
  assert.match(page, /moment-day-flow/);
  assert.match(page, /classifyMomentLayout\(/);
  assert.match(page, /moment--\$\{layoutVariant\}/);
});
```

- [ ] **Step 2: Run and verify RED**

- [ ] **Step 3: Import helpers in the client script**

Near the existing client imports add:

```ts
import {
  classifyMomentLayout,
  getMomentDateKey,
  getMomentDayParts,
} from '../lib/moments-life-wall.mjs';
```

- [ ] **Step 4: Add direct day-group creation**

Next to `RenderMoment`, add:

```ts
function createMomentDayGroup(dateKey: string) {
  const group = document.createElement('section');
  group.className = 'moment-day-group';
  group.dataset.date = dateKey;

  const stamp = document.createElement('header');
  stamp.className = 'moment-day-stamp';
  const parts = getMomentDayParts(`${dateKey}T12:00:00`);

  const time = document.createElement('time');
  time.dateTime = parts.machineDate;
  time.className = 'moment-day-date';
  time.textContent = parts.dateLabel;

  const weekday = document.createElement('span');
  weekday.className = 'moment-day-weekday';
  weekday.textContent = parts.weekdayLabel;

  const todayKey = getMomentDateKey(new Date());
  const today = document.createElement('span');
  today.className = 'moment-day-today';
  today.hidden = dateKey !== todayKey;
  today.setAttribute('aria-label', '今天');

  const flow = document.createElement('div');
  flow.className = 'moment-day-flow';

  stamp.append(time, weekday, today);
  group.append(stamp, flow);
  applyScopedStyles(group);
  return { group, flow };
}
```

The today dot is static; do not add animation.

- [ ] **Step 5: Change `buildMomentCard` to add deterministic layout classes before media rendering**

Immediately after creating `card`:

```ts
const videos = (moment.media || []).filter((item) => item.kind === 'video');
const layoutVariant = classifyMomentLayout({
  text: moment.text,
  imageCount: moment.images?.length || 0,
  videoCount: videos.length,
});
card.className = `moment-card moment--${layoutVariant}`;
card.dataset.category = moment.category;
card.dataset.layout = layoutVariant;
```

Reuse the `videos` constant later; delete the later duplicate `const videos = ...` declaration.

Change category text from emoji-filled pill copy to plain category text:

```ts
catPill.textContent = moment.category;
```

Keep `.cat-pill` class because pin/reaction code may query the metadata block; CSS will make it text-like.

- [ ] **Step 6: Replace flat `syncMoments()` append with day grouping**

Use:

```ts
list.innerHTML = '';
let activeDateKey = '';
let activeFlow: HTMLElement | null = null;

moments.forEach((moment, idx) => {
  const dateKey = getMomentDateKey(moment.date);
  if (dateKey !== activeDateKey || !activeFlow) {
    activeDateKey = dateKey;
    const { group, flow } = createMomentDayGroup(dateKey);
    activeFlow = flow;
    list.appendChild(group);
  }
  const card = buildMomentCard(moment, idx, activeCategory);
  if (card) activeFlow.appendChild(card);
});

applyMomentFilter(activeCategory);
setupLightboxForNewCards();
```

Remove `updateStats(moments)` calls and delete the old `updateStats()` function because the stat UI is gone.

- [ ] **Step 7: Add chapter-aware filter function and use it in the existing click handler**

```ts
function applyMomentFilter(category: string) {
  document.querySelectorAll<HTMLElement>('.moment-day-group').forEach((group) => {
    let visible = 0;
    group.querySelectorAll<HTMLElement>('.moment-card').forEach((card) => {
      const hidden = category !== 'all' && card.dataset.category !== category;
      card.classList.toggle('hidden', hidden);
      if (!hidden) visible += 1;
    });
    group.hidden = visible === 0;
  });
}
```

Replace the current direct card-loop in category button click with:

```ts
applyMomentFilter(tab.dataset.category ?? 'all');
```

- [ ] **Step 8: Add the date-flow/card-shell part of `moments-life-wall.css`**

```css
body.layout-standard .moments-shell .moments-list {
  display: grid;
  gap: clamp(42px, 6vw, 72px);
  margin: 0;
  padding: 0;
  border: 0;
}
body.layout-standard .moment-day-group {
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  gap: clamp(22px, 4vw, 54px);
  align-items: start;
}
body.layout-standard .moment-day-group[hidden] { display: none; }
body.layout-standard .moment-day-stamp {
  padding-top: 5px;
  color: var(--standard-muted);
  font-variant-numeric: tabular-nums;
}
body.layout-standard .moment-day-date {
  display: block;
  color: color-mix(in srgb, var(--standard-text) 19%, transparent);
  font-size: clamp(1.65rem, 3vw, 2.7rem);
  font-weight: 760;
  line-height: 1;
  letter-spacing: -0.055em;
  white-space: nowrap;
}
body.layout-standard .moment-day-weekday {
  display: inline-block;
  margin-top: 8px;
  font-size: 0.62rem;
  font-weight: 720;
  letter-spacing: 0.15em;
}
body.layout-standard .moment-day-today {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin: 0 0 1px 8px;
  border-radius: 50%;
  background: var(--standard-accent);
}
body.layout-standard .moment-day-today[hidden] { display: none; }
body.layout-standard .moment-day-flow {
  display: grid;
  gap: clamp(26px, 4vw, 46px);
  min-width: 0;
}

body.layout-standard .moments-shell .moment-card {
  position: relative;
  width: 100%;
  margin: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  transform: none;
}
body.layout-standard .moments-shell .moment-card::before,
body.layout-standard .moments-shell .card-glow { display: none; }
body.layout-standard .moments-shell .card-content { padding: 0; }
body.layout-standard .moments-shell .card-meta {
  justify-content: flex-start;
  gap: 10px;
  margin-bottom: 10px;
}
body.layout-standard .moments-shell .card-meta-left,
body.layout-standard .moments-shell .card-actions { gap: 9px; }
body.layout-standard .moments-shell .cat-pill {
  position: relative;
  padding: 0 0 0 11px;
  border: 0;
  border-radius: 0;
  background: none !important;
  color: var(--standard-muted) !important;
  font-size: 0.72rem;
  font-weight: 620;
}
body.layout-standard .moments-shell .cat-pill::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--standard-accent);
  transform: translateY(-50%);
}
body.layout-standard .moments-shell .card-date {
  color: color-mix(in srgb, var(--standard-muted) 78%, transparent);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}
body.layout-standard .moments-shell .card-text {
  max-width: 64ch;
  margin: 0 0 13px;
  color: var(--standard-text);
  font-size: 1rem;
  line-height: 1.8;
  white-space: pre-wrap;
}
body.layout-standard .moments-shell .moment--whisper {
  width: min(88%, 650px);
  margin-left: clamp(0px, 5vw, 58px);
}
body.layout-standard .moments-shell .moment--whisper .card-text {
  max-width: 28ch;
  font-size: clamp(1.16rem, 1.2vw + 0.96rem, 1.42rem);
  line-height: 1.65;
}
body.layout-standard .moments-shell .moment--text { width: min(100%, 760px); }
```

- [ ] **Step 9: Run focused test and commit**

```bash
node --test tests/moments-journal-layout.test.mjs
git add src/pages/moments.astro src/styles/moments-life-wall.css tests/moments-journal-layout.test.mjs
git commit -m "feat: render moments as a direct life wall"
```

---

### Task 5: Give photos and video content-specific composition

**Files:**
- Modify: `src/styles/moments-life-wall.css`
- Modify: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Consumes: `.moment--photo-one`, `.moment--photo-two`, `.moment--photo-three`, `.moment--gallery`, `.moment--video`, existing `.card-images[data-count]`.
- Produces: deterministic asymmetric media composition; no random JS.

- [ ] **Step 1: Add failing style assertions**

```js
const wallCss = read('src/styles/moments-life-wall.css');

test('life wall media layouts vary by actual content', () => {
  assert.match(wallCss, /\.moment--photo-one/);
  assert.match(wallCss, /\.moment--photo-two/);
  assert.match(wallCss, /\.moment--photo-three/);
  assert.match(wallCss, /\.moment--gallery/);
  assert.match(wallCss, /\.moment--video/);
  assert.match(wallCss, /grid-template-columns:\s*minmax\(0, 1\.35fr\) minmax\(0, 0\.85fr\)/);
  assert.match(wallCss, /rotate\(-0\.7deg\)/);
  assert.match(wallCss, /@media \(max-width:\s*720px\)/);
});
```

- [ ] **Step 2: Run and verify RED**

- [ ] **Step 3: Append the exact media rules**

```css
body.layout-standard .moments-shell .card-images {
  width: 100%;
  max-width: none;
  margin: 14px 0 12px;
  gap: 8px;
}
body.layout-standard .moments-shell .card-images img,
body.layout-standard .moments-shell .card-images video {
  display: block;
  width: 100%;
  height: auto;
  border: 0;
  border-radius: 5px;
  background: color-mix(in srgb, var(--standard-card-soft) 54%, transparent);
  box-shadow: none;
  transform: none;
}
body.layout-standard .moments-shell .card-images img:hover { transform: none; box-shadow: none; }

body.layout-standard .moments-shell .moment--photo-one { width: min(100%, 850px); }
body.layout-standard .moments-shell .moment--photo-one .card-images {
  display: block;
  width: min(100%, 820px);
}
body.layout-standard .moments-shell .moment--photo-one .card-images img {
  width: auto;
  max-width: 100%;
  max-height: 680px;
  object-fit: contain;
}

body.layout-standard .moments-shell .moment--photo-two { width: min(100%, 900px); }
body.layout-standard .moments-shell .moment--photo-two .card-images {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.85fr);
  align-items: end;
}
body.layout-standard .moments-shell .moment--photo-two .card-images img {
  min-height: 190px;
  max-height: 520px;
  object-fit: cover;
}

body.layout-standard .moments-shell .moment--photo-three { width: min(100%, 920px); }
body.layout-standard .moments-shell .moment--photo-three .card-images {
  display: grid;
  grid-template-columns: minmax(0, 1.42fr) minmax(150px, 0.74fr);
  grid-template-rows: repeat(2, minmax(0, 1fr));
}
body.layout-standard .moments-shell .moment--photo-three .card-images > :first-child {
  grid-row: 1 / 3;
  min-height: 390px;
  object-fit: cover;
}
body.layout-standard .moments-shell .moment--photo-three .card-images > :nth-child(2) { transform: rotate(-0.7deg); }
body.layout-standard .moments-shell .moment--photo-three .card-images > :nth-child(3) { transform: rotate(0.6deg); }
body.layout-standard .moments-shell .moment--photo-three .card-images > :not(:first-child) {
  min-height: 188px;
  object-fit: cover;
}

body.layout-standard .moments-shell .moment--gallery { width: min(100%, 930px); }
body.layout-standard .moments-shell .moment--gallery .card-images {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}
body.layout-standard .moments-shell .moment--gallery .card-images img {
  aspect-ratio: 4 / 3;
  object-fit: cover;
}
body.layout-standard .moments-shell .moment--gallery .card-images > :nth-child(3n + 2) { transform: rotate(-0.5deg); }
body.layout-standard .moments-shell .moment--gallery .card-images > :nth-child(4n) { transform: rotate(0.5deg); }

body.layout-standard .moments-shell .moment--video { width: min(100%, 940px); }
body.layout-standard .moments-shell .moment--video .card-images {
  display: block;
  width: min(100%, 900px);
}
body.layout-standard .moments-shell .moment--video video {
  width: 100%;
  max-height: 72vh;
  border-radius: 7px;
  background: #000;
}

body.layout-standard .moments-shell .card-link {
  display: inline;
  color: var(--standard-muted);
  font-size: 0.78rem;
  text-decoration-color: color-mix(in srgb, var(--standard-accent) 46%, transparent);
  text-underline-offset: 3px;
}
body.layout-standard .moments-shell .card-link:hover { color: var(--standard-accent); }
```

- [ ] **Step 4: Add mobile flattening exactly**

```css
@media (max-width: 720px) {
  body.layout-standard .moments-shell { padding: 30px 14px 46px; }
  body.layout-standard .moments-wall-head { display: block; margin-bottom: 26px; }
  body.layout-standard .moments-wall-head h1 { font-size: clamp(2.45rem, 15vw, 3.7rem); }
  body.layout-standard .moments-wall-head p { margin-top: 13px; max-width: 30ch; }
  body.layout-standard .moments-wall-filter { align-items: flex-start; flex-direction: column; gap: 6px; }
  body.layout-standard .moments-wall-filter .cat-pills {
    width: 100%;
    overflow-x: auto;
    flex-wrap: nowrap;
    scrollbar-width: none;
  }
  body.layout-standard .moments-compose-trigger { margin-left: 2px; }
  body.layout-standard .moments-shell .publish-panel { margin-top: 0; padding: 22px 0 24px; }
  body.layout-standard .moments-shell .publish-panel::before { display: none; }

  body.layout-standard .moment-day-group { display: block; }
  body.layout-standard .moment-day-stamp {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 20px;
    padding: 0;
  }
  body.layout-standard .moment-day-date { font-size: 1.65rem; }
  body.layout-standard .moment-day-weekday { margin-top: 0; }
  body.layout-standard .moment-day-flow { gap: 30px; }

  body.layout-standard .moments-shell .moment--whisper,
  body.layout-standard .moments-shell .moment--text,
  body.layout-standard .moments-shell .moment--photo-one,
  body.layout-standard .moments-shell .moment--photo-two,
  body.layout-standard .moments-shell .moment--photo-three,
  body.layout-standard .moments-shell .moment--gallery,
  body.layout-standard .moments-shell .moment--video {
    width: 100%;
    margin-left: 0;
  }
  body.layout-standard .moments-shell .moment--whisper .card-text { max-width: 32ch; }
  body.layout-standard .moments-shell .moment--photo-two .card-images,
  body.layout-standard .moments-shell .moment--photo-three .card-images,
  body.layout-standard .moments-shell .moment--gallery .card-images {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: auto;
  }
  body.layout-standard .moments-shell .moment--photo-three .card-images > :first-child { grid-row: auto; min-height: 0; }
  body.layout-standard .moments-shell .moment--photo-three .card-images > *,
  body.layout-standard .moments-shell .moment--gallery .card-images > * { transform: none !important; }
}
```

- [ ] **Step 5: Add reduced-motion protection**

```css
@media (prefers-reduced-motion: reduce) {
  body.layout-standard .moments-shell *,
  body.layout-standard .moments-shell *::before,
  body.layout-standard .moments-shell *::after {
    scroll-behavior: auto !important;
  }
  body.layout-standard .moments-shell .moment-card,
  body.layout-standard .moments-compose-trigger { transition: none !important; }
}
html[data-reduce-motion="true"] body.layout-standard .moments-shell .moment-card,
html[data-reduce-motion="true"] body.layout-standard .moments-compose-trigger { transition: none !important; }
```

- [ ] **Step 6: Run focused test and commit**

```bash
node --test tests/moments-journal-layout.test.mjs
git add src/styles/moments-life-wall.css tests/moments-journal-layout.test.mjs
git commit -m "style: compose moments media as a life wall"
```

---

### Task 6: Preserve immediate pin reorder through a page-owned event

**Files:**
- Modify: `src/components/MomentsPinControls.astro`
- Modify: `src/pages/moments.astro`
- Modify: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Produces event: `moments:pin-order-changed` on `#moments-list` with detail `{ ids: string[] }`.
- Consumes event in Moments page to reorder `currentMoments` and call `syncMoments()` so day groups are rebuilt correctly.

- [ ] **Step 1: Add failing pin-contract assertions**

```js
test('pin reorder is delegated back to the life-wall renderer', () => {
  assert.match(pins, /moments:pin-order-changed/);
  assert.match(pins, /detail:\s*\{\s*ids:/);
  assert.match(page, /moments:pin-order-changed/);
  assert.match(page, /new Map\(ids\.map\(\(id, index\) => \[id, index\]\)\)/);
  assert.match(page, /syncMoments\(currentMoments\)/);
  assert.doesNotMatch(pins, /listRoot\.appendChild\(card\)/);
});
```

- [ ] **Step 2: Run and verify RED**

- [ ] **Step 3: Replace `reorderManagedCards()` in `MomentsPinControls.astro`**

Delete the DOM-moving implementation and use:

```ts
function requestManagedReorder() {
  listRoot.dispatchEvent(new CustomEvent('moments:pin-order-changed', {
    bubbles: true,
    detail: { ids: items.map((item) => item.id) },
  }));
}
```

In `refreshItems`, change:

```ts
if (reorder) reorderManagedCards();
```

to:

```ts
if (reorder) requestManagedReorder();
```

- [ ] **Step 4: Add the page listener inside `initMomentsPage()` using the existing AbortSignal**

```ts
list.addEventListener('moments:pin-order-changed', (event) => {
  const ids = (event as CustomEvent<{ ids?: string[] }>).detail?.ids ?? [];
  if (ids.length === 0) return;
  const rank = new Map(ids.map((id, index) => [id, index]));
  currentMoments.sort((a, b) => {
    const aRank = a.id ? rank.get(a.id) : undefined;
    const bRank = b.id ? rank.get(b.id) : undefined;
    return (aRank ?? Number.MAX_SAFE_INTEGER) - (bRank ?? Number.MAX_SAFE_INTEGER);
  });
  syncMoments(currentMoments);
}, { signal });
```

Place it after the existing list click handler is attached. The event does not change API data; it only updates client order from the already-authoritative pin-control refresh response.

- [ ] **Step 5: Run focused test and commit**

```bash
node --test tests/moments-journal-layout.test.mjs
git add src/components/MomentsPinControls.astro src/pages/moments.astro tests/moments-journal-layout.test.mjs
git commit -m "fix: preserve moments day groups after pin reorder"
```

---

### Task 7: Actions, reactions, comments, lightbox, and final visual regression

**Files:**
- Modify: `src/styles/moments-life-wall.css`
- Modify: `tests/moments-journal-layout.test.mjs`
- Modify if needed: `src/pages/moments.astro`

**Interfaces:**
- Consumes: existing reaction/comment/lightbox/delete/session controls.
- Produces: unclipped controls, desktop secondary-action quieting, mobile tap visibility, green full build/test.

- [ ] **Step 1: Append action-visibility CSS**

```css
body.layout-standard .moments-shell .moment-card .delete-moment-btn,
body.layout-standard .moments-shell .moment-card .pin-moment-btn {
  opacity: 0.46;
}
body.layout-standard .moments-shell .moment-card:hover .delete-moment-btn,
body.layout-standard .moments-shell .moment-card:hover .pin-moment-btn,
body.layout-standard .moments-shell .moment-card:focus-within .delete-moment-btn,
body.layout-standard .moments-shell .moment-card:focus-within .pin-moment-btn {
  opacity: 1;
}
body.layout-standard .moments-shell .moment-reactions,
body.layout-standard .moments-shell .comments-widget {
  position: relative;
  z-index: 1;
}
body.layout-standard .moments-shell .moment-reaction-panel { z-index: 2200; }

@media (max-width: 720px) {
  body.layout-standard .moments-shell .moment-card .delete-moment-btn,
  body.layout-standard .moments-shell .moment-card .pin-moment-btn { opacity: 1; }
}
```

If the actual comments component uses a different root class, inspect its rendered/source class and replace `.comments-widget` with the real existing class; do not invent a second wrapper solely for styling.

- [ ] **Step 2: Add final anti-template regression assertions**

```js
test('retired journal-template UI does not return', () => {
  assert.doesNotMatch(page, /hero-stats/);
  assert.doesNotMatch(page, /stat-total/);
  assert.doesNotMatch(page, /moments-journal-header/);
  assert.doesNotMatch(page, /moments-film-strip/);
  assert.doesNotMatch(page, /bubble-float/);
  assert.doesNotMatch(wallCss, /border-radius:\s*999px[\s\S]{0,160}\.pill/);
  assert.doesNotMatch(wallCss, /moment-today-pulse/);
});
```

- [ ] **Step 3: Run focused and full static tests**

```bash
node --test tests/moments-journal-layout.test.mjs
npm run test:site
```

Expected: PASS.

- [ ] **Step 4: Run full Astro validation/build**

```bash
npm run build
```

Expected: `astro check` and `astro build` PASS.

- [ ] **Step 5: Manual browser smoke checklist on the built/dev page**

Verify all of these with at least desktop and mobile viewport:

1. `/moments` has no normal banner and no separate clock row.
2. Filter hides empty day groups and switching back to `全部` restores them.
3. Open/close composer works; login/logout state still updates.
4. Publish plain text.
5. Publish/select image(s); preview/remove/upload behavior works.
6. Video poster controls still appear and publish.
7. Emoji insertion still writes into textarea.
8. Reaction picker opens outside the unboxed Moment without clipping.
9. Existing comments render under a Moment.
10. Admin delete works.
11. Pin/unpin immediately reorders and the date groups remain valid.
12. Image lightbox opens/closes and multi-image navigation works.
13. Theme hue, light/dark and wallpaper modes remain readable.
14. Under 720px all image tilts disappear and touch controls remain visible.

- [ ] **Step 6: Review scope and stale-file imports**

```bash
git grep -n "moments-journal\|installMomentsJournalEnhancer\|Moments · Journal" -- src tests || true
git diff --check main...HEAD
git diff --stat main...HEAD
```

Expected: no old journal enhancer/style import; only design docs may mention the retired names.

- [ ] **Step 7: Commit final corrections only if necessary**

```bash
git add src/pages/moments.astro src/components/MomentsPinControls.astro src/lib/moments-life-wall.mjs src/styles/moments-life-wall.css tests/moments-journal-layout.test.mjs package.json
git commit -m "test: lock moments life wall v2 behavior"
```

Do not create an empty commit if all checks were already green.
