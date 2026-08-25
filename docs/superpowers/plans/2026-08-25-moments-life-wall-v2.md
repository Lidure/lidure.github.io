# Moments Life Wall V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the PR #43 journal-card Moments presentation with a bannerless personal life wall where text, photos, video, dates, reactions, comments, and the composer form one uneven but controlled content stream.

**Architecture:** Keep `src/pages/moments.astro` as the owner of API/auth/upload/reaction/lightbox behavior, but make date grouping and visual classification direct rendering responsibilities instead of a post-render enhancer. Introduce a pure `moments-life-wall.mjs` helper for local-date/media classification, add one authoritative `moments-life-wall.css`, remove the PR #43 journal enhancer/style, and change pin reordering to a custom event so the page can rebuild valid day groups after pin/unpin.

**Tech Stack:** Astro 6, TypeScript in Astro client scripts, browser DOM APIs, CSS Grid, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-25-article-moments-human-v2-design.md`

## Dependency

Execute after Task 1 of `docs/superpowers/plans/2026-08-25-article-publication-v2.md`, which adds `BaseLayout` prop `showBanner?: boolean` with default `true`.

## Global Constraints

- Moments passes `showBanner={false}` and removes `showTime={true}`.
- Keep category names from existing data; visible filter text is `全部` plus each `categoryOrder` name.
- Preserve API, authentication, secure-cookie session flow, image upload, video upload/poster generation, emoji insertion, filtering, reactions, comments, deletion, lightbox, pin/unpin, retry/error behavior, and existing functional IDs.
- Remove `Moments · Journal`, stat blocks, bordered hero, film-strip pills, PR #43 date-card treatment, uniform rounded glass cards, and filled category pills.
- Delete `src/styles/moments-journal.css` and `src/lib/moments-journal-enhancer.mjs`; never stack V2 over that enhancer.
- No month-navigation UI.
- Date marks are not sticky; today uses one static accent dot.
- Deterministic variants: `moment--whisper`, `moment--text`, `moment--photo-one`, `moment--photo-two`, `moment--photo-three`, `moment--gallery`, `moment--video`.
- Only secondary images in `photo-three` and `gallery` may tilt, maximum `1deg`; no randomness and no tilt under `720px`.
- Under `720px`, use one content column and horizontal day headings.
- Reduced motion disables decorative movement and smooth behavior.

---

### Task 1: Retire the PR #43 journal enhancer

**Files:**
- Modify: `src/components/MomentsPinControls.astro`
- Delete: `src/lib/moments-journal-enhancer.mjs`
- Delete: `src/styles/moments-journal.css`
- Replace: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Produces: pin controls with no layout-enhancer responsibility.

- [ ] **Step 1: Replace the test file baseline**

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
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/moments-journal-layout.test.mjs
```

- [ ] **Step 3: Remove enhancer wiring from `MomentsPinControls.astro`**

Delete:

```ts
import { installMomentsJournalEnhancer } from '../lib/moments-journal-enhancer.mjs';
import '../styles/moments-journal.css';
```

Delete:

```ts
installMomentsJournalEnhancer(listRoot, signal);
```

Keep every pin/API/lifecycle function otherwise unchanged.

- [ ] **Step 4: Delete retired files**

```bash
git rm src/lib/moments-journal-enhancer.mjs src/styles/moments-journal.css
```

- [ ] **Step 5: Run focused test and verify GREEN**

- [ ] **Step 6: Commit, including deletions**

```bash
git add -A src/components/MomentsPinControls.astro src/lib/moments-journal-enhancer.mjs src/styles/moments-journal.css tests/moments-journal-layout.test.mjs
git commit -m "refactor: retire moments journal enhancer"
```

---

### Task 2: Add deterministic local-date and layout helpers

**Files:**
- Create: `src/lib/moments-life-wall.mjs`
- Modify: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Produces:
  - `getMomentDateKey(value)`
  - `getMomentDayParts(value)`
  - `classifyMomentLayout({ text, imageCount, videoCount })`

- [ ] **Step 1: Add failing helper tests**

```js
const helpersUrl = new URL('../src/lib/moments-life-wall.mjs', import.meta.url);

test('life wall classification is deterministic', async () => {
  const { classifyMomentLayout } = await import(helpersUrl.href + `?t=${Date.now()}`);
  assert.equal(classifyMomentLayout({ text: '今天有点困', imageCount: 0, videoCount: 0 }), 'whisper');
  assert.equal(classifyMomentLayout({ text: '这是一段明显超过三十二个字符的普通碎碎念内容，用来确认它会进入普通文字布局而不是短句布局。', imageCount: 0, videoCount: 0 }), 'text');
  assert.equal(classifyMomentLayout({ imageCount: 1 }), 'photo-one');
  assert.equal(classifyMomentLayout({ imageCount: 2 }), 'photo-two');
  assert.equal(classifyMomentLayout({ imageCount: 3 }), 'photo-three');
  assert.equal(classifyMomentLayout({ imageCount: 4 }), 'gallery');
  assert.equal(classifyMomentLayout({ imageCount: 2, videoCount: 1 }), 'video');
});

test('date helpers use the local calendar day', async () => {
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

- [ ] **Step 3: Create `src/lib/moments-life-wall.mjs`**

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
  if (Number.isNaN(parsed.getTime())) return { key, dateLabel: key, weekdayLabel: '', machineDate: key };
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

- [ ] **Step 4: Run focused test and verify GREEN**

- [ ] **Step 5: Commit**

```bash
git add src/lib/moments-life-wall.mjs tests/moments-journal-layout.test.mjs
git commit -m "feat: add deterministic moments wall layout rules"
```

---

### Task 3: Replace the page entrance, text filter, and composer presentation

**Files:**
- Modify: `src/pages/moments.astro`
- Create: `src/styles/moments-life-wall.css`
- Modify: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Consumes: `BaseLayout.showBanner`; preserves `#publish-toggle`, `#toggle-icon`, `#publish-box`, `.pill[data-category]`, and every form/session/upload ID.
- Produces: `.moments-wall-head`, `.moments-wall-filter`, `.moments-compose-trigger`.

- [ ] **Step 1: Add failing page-entrance assertions**

```js
test('moments owns a quiet bannerless page entrance', () => {
  assert.match(page, /showBanner=\{false\}/);
  assert.doesNotMatch(page, /showTime=\{true\}/);
  assert.match(page, /class="moments-wall-head"/);
  assert.match(page, /class="controls-bar moments-wall-filter"/);
  assert.match(page, /class="fab moments-compose-trigger"/);
  assert.match(page, /今天想记点什么？/);
  assert.doesNotMatch(page, /hero-stats/);
  assert.doesNotMatch(page, /hero-bubbles/);
  assert.doesNotMatch(page, /✨ Moments/);
});
```

- [ ] **Step 2: Run and verify RED**

- [ ] **Step 3: Add stylesheet import and BaseLayout props**

Frontmatter:

```astro
import '../styles/moments-life-wall.css';
```

BaseLayout:

```astro
<BaseLayout
  title="碎碎念 | 搁浅 的小窝"
  description="游戏，音乐、生活、吐槽，随时碎碎念。"
  showBanner={false}
>
```

- [ ] **Step 4: Replace old Hero + controls markup**

```astro
<header class="moments-wall-head">
  <h1>碎碎念</h1>
  <p>随手记下路过脑海和生活里的小事。</p>
</header>

<div class="controls-bar moments-wall-filter" aria-label="筛选碎碎念">
  <div class="cat-pills">
    <button class="pill active" data-category="all">全部</button>
    {categoryOrder.map((cat) => <button class="pill" data-category={cat}>{cat}</button>)}
  </div>
  <button class="fab moments-compose-trigger" id="publish-toggle" aria-label="写一条碎碎念">
    <span id="toggle-icon" aria-hidden="true">✎</span>
    <span class="moments-compose-label">今天想记点什么？</span>
  </button>
</div>
```

- [ ] **Step 5: Simplify composer copy without changing behavior hooks**

Use:

```astro
<span class="panel-title">写点什么</span>
<textarea name="text" rows="3" placeholder="现在脑子里在想什么？" required></textarea>
<button type="submit" class="submit-btn" id="submit-btn">发布</button>
```

Keep date/category/link/emoji/upload/poster/session/login/logout/close/form-message controls and IDs.

- [ ] **Step 6: Create `moments-life-wall.css` entrance/composer base**

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
body.layout-standard .moments-wall-filter .cat-pills { display: flex; align-items: center; gap: 3px; min-width: 0; }
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
body.layout-standard .moments-wall-filter .pill:hover,
body.layout-standard .moments-wall-filter .pill.active { color: var(--standard-text); }
body.layout-standard .moments-wall-filter .pill.active::after { background: var(--standard-accent); }
body.layout-standard .moments-compose-trigger {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  width: auto;
  min-height: 40px;
  padding: 7px 2px 7px 10px;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--standard-muted);
  font-size: 0.82rem;
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
body.layout-standard .moments-shell .field textarea { min-height: 150px; line-height: 1.78; }
```

- [ ] **Step 7: Run focused test and verify GREEN**

- [ ] **Step 8: Commit**

```bash
git add src/pages/moments.astro src/styles/moments-life-wall.css tests/moments-journal-layout.test.mjs
git commit -m "style: rebuild moments entrance and composer"
```

---

### Task 4: Render day groups and content-derived Moment variants directly

**Files:**
- Modify: `src/pages/moments.astro`
- Modify: `src/styles/moments-life-wall.css`
- Modify: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Consumes: helper functions from Task 2 and existing `RenderMoment`/`buildMomentCard`.
- Produces: `.moment-day-group`, `.moment-day-stamp`, `.moment-day-flow`, `.moment--*`, `applyMomentFilter(category)`.

- [ ] **Step 1: Add failing source assertions**

```js
test('moments render date groups and content-derived layout variants directly', () => {
  assert.match(page, /from ['"]\.\.\/lib\/moments-life-wall\.mjs['"]/);
  assert.match(page, /function createMomentDayGroup\(dateKey: string\)/);
  assert.match(page, /function applyMomentFilter\(category: string\)/);
  assert.match(page, /moment-day-group/);
  assert.match(page, /classifyMomentLayout\(/);
  assert.match(page, /moment--\$\{layoutVariant\}/);
});
```

- [ ] **Step 2: Run and verify RED**

- [ ] **Step 3: Import helpers in the existing client script**

```ts
import { classifyMomentLayout, getMomentDateKey, getMomentDayParts } from '../lib/moments-life-wall.mjs';
```

- [ ] **Step 4: Add direct day-group creation**

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

  const today = document.createElement('span');
  today.className = 'moment-day-today';
  today.hidden = dateKey !== getMomentDateKey(new Date());
  today.setAttribute('aria-label', '今天');

  const flow = document.createElement('div');
  flow.className = 'moment-day-flow';
  stamp.append(time, weekday, today);
  group.append(stamp, flow);
  applyScopedStyles(group);
  return { group, flow };
}
```

- [ ] **Step 5: Add deterministic layout class in `buildMomentCard()`**

Immediately after creating the card:

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

Reuse `videos` later and delete the duplicate declaration. Set:

```ts
catPill.textContent = moment.category;
```

- [ ] **Step 6: Replace flat `syncMoments()` append with consecutive date groups**

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

Delete old `updateStats()` and its calls because the stat UI no longer exists.

- [ ] **Step 7: Add chapter-aware filtering**

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

In the existing filter click handler, replace direct card toggling with:

```ts
applyMomentFilter(tab.dataset.category ?? 'all');
```

- [ ] **Step 8: Append day-flow and unboxed-card CSS**

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
body.layout-standard .moment-day-stamp { padding-top: 5px; color: var(--standard-muted); font-variant-numeric: tabular-nums; }
body.layout-standard .moment-day-date {
  display: block;
  color: color-mix(in srgb, var(--standard-text) 19%, transparent);
  font-size: clamp(1.65rem, 3vw, 2.7rem);
  font-weight: 760;
  line-height: 1;
  letter-spacing: -0.055em;
  white-space: nowrap;
}
body.layout-standard .moment-day-weekday { display: inline-block; margin-top: 8px; font-size: 0.62rem; font-weight: 720; letter-spacing: 0.15em; }
body.layout-standard .moment-day-today { display: inline-block; width: 6px; height: 6px; margin: 0 0 1px 8px; border-radius: 50%; background: var(--standard-accent); }
body.layout-standard .moment-day-today[hidden] { display: none; }
body.layout-standard .moment-day-flow { display: grid; gap: clamp(26px, 4vw, 46px); min-width: 0; }
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
body.layout-standard .moments-shell .card-meta { justify-content: flex-start; gap: 10px; margin-bottom: 10px; }
body.layout-standard .moments-shell .cat-pill {
  position: relative;
  padding: 0 0 0 11px;
  border: 0;
  border-radius: 0;
  background: none !important;
  color: var(--standard-muted) !important;
  font-size: 0.72rem;
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
body.layout-standard .moments-shell .card-text { max-width: 64ch; margin: 0 0 13px; color: var(--standard-text); font-size: 1rem; line-height: 1.8; white-space: pre-wrap; }
body.layout-standard .moments-shell .moment--whisper { width: min(88%, 650px); margin-left: clamp(0px, 5vw, 58px); }
body.layout-standard .moments-shell .moment--whisper .card-text { max-width: 28ch; font-size: clamp(1.16rem, 1.2vw + 0.96rem, 1.42rem); line-height: 1.65; }
body.layout-standard .moments-shell .moment--text { width: min(100%, 760px); }
```

- [ ] **Step 9: Run focused test and verify GREEN**

- [ ] **Step 10: Commit**

```bash
git add src/pages/moments.astro src/styles/moments-life-wall.css tests/moments-journal-layout.test.mjs
git commit -m "feat: render moments as a direct life wall"
```

---

### Task 5: Compose photos and video according to actual content

**Files:**
- Modify: `src/styles/moments-life-wall.css`
- Modify: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Consumes: `.moment--photo-*`, `.moment--gallery`, `.moment--video`, `.card-images`.

- [ ] **Step 1: Add failing media-layout assertions**

```js
const wallCss = read('src/styles/moments-life-wall.css');

test('life wall media layouts vary by actual content', () => {
  assert.match(wallCss, /\.moment--photo-one/);
  assert.match(wallCss, /\.moment--photo-two/);
  assert.match(wallCss, /\.moment--photo-three/);
  assert.match(wallCss, /\.moment--gallery/);
  assert.match(wallCss, /\.moment--video/);
  assert.match(wallCss, /1\.35fr/);
  assert.match(wallCss, /rotate\(-0\.7deg\)/);
  assert.match(wallCss, /@media \(max-width:\s*720px\)/);
});
```

- [ ] **Step 2: Run and verify RED**

- [ ] **Step 3: Append desktop media composition CSS**

```css
body.layout-standard .moments-shell .card-images { width: 100%; max-width: none; margin: 14px 0 12px; gap: 8px; }
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
body.layout-standard .moments-shell .moment--photo-one .card-images { display: block; width: min(100%, 820px); }
body.layout-standard .moments-shell .moment--photo-one .card-images img { width: auto; max-width: 100%; max-height: 680px; object-fit: contain; }
body.layout-standard .moments-shell .moment--photo-two { width: min(100%, 900px); }
body.layout-standard .moments-shell .moment--photo-two .card-images { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.85fr); align-items: end; }
body.layout-standard .moments-shell .moment--photo-two .card-images img { min-height: 190px; max-height: 520px; object-fit: cover; }
body.layout-standard .moments-shell .moment--photo-three { width: min(100%, 920px); }
body.layout-standard .moments-shell .moment--photo-three .card-images { display: grid; grid-template-columns: minmax(0, 1.42fr) minmax(150px, 0.74fr); grid-template-rows: repeat(2, minmax(0, 1fr)); }
body.layout-standard .moments-shell .moment--photo-three .card-images > :first-child { grid-row: 1 / 3; min-height: 390px; object-fit: cover; }
body.layout-standard .moments-shell .moment--photo-three .card-images > :nth-child(2) { transform: rotate(-0.7deg); }
body.layout-standard .moments-shell .moment--photo-three .card-images > :nth-child(3) { transform: rotate(0.6deg); }
body.layout-standard .moments-shell .moment--photo-three .card-images > :not(:first-child) { min-height: 188px; object-fit: cover; }
body.layout-standard .moments-shell .moment--gallery { width: min(100%, 930px); }
body.layout-standard .moments-shell .moment--gallery .card-images { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
body.layout-standard .moments-shell .moment--gallery .card-images img { aspect-ratio: 4 / 3; object-fit: cover; }
body.layout-standard .moments-shell .moment--gallery .card-images > :nth-child(3n + 2) { transform: rotate(-0.5deg); }
body.layout-standard .moments-shell .moment--gallery .card-images > :nth-child(4n) { transform: rotate(0.5deg); }
body.layout-standard .moments-shell .moment--video { width: min(100%, 940px); }
body.layout-standard .moments-shell .moment--video .card-images { display: block; width: min(100%, 900px); }
body.layout-standard .moments-shell .moment--video video { width: 100%; max-height: 72vh; border-radius: 7px; background: #000; }
body.layout-standard .moments-shell .card-link { display: inline; color: var(--standard-muted); font-size: 0.78rem; text-underline-offset: 3px; }
```

- [ ] **Step 4: Append mobile flattening and reduced-motion rules**

```css
@media (max-width: 720px) {
  body.layout-standard .moments-shell { padding: 30px 14px 46px; }
  body.layout-standard .moments-wall-head { display: block; margin-bottom: 26px; }
  body.layout-standard .moments-wall-head p { margin-top: 13px; max-width: 30ch; }
  body.layout-standard .moments-wall-filter { align-items: flex-start; flex-direction: column; gap: 6px; }
  body.layout-standard .moments-wall-filter .cat-pills { width: 100%; overflow-x: auto; flex-wrap: nowrap; scrollbar-width: none; }
  body.layout-standard .moments-shell .publish-panel { margin-top: 0; padding: 22px 0 24px; }
  body.layout-standard .moments-shell .publish-panel::before { display: none; }
  body.layout-standard .moment-day-group { display: block; }
  body.layout-standard .moment-day-stamp { display: flex; align-items: baseline; gap: 10px; margin-bottom: 20px; padding: 0; }
  body.layout-standard .moment-day-date { font-size: 1.65rem; }
  body.layout-standard .moment-day-weekday { margin-top: 0; }
  body.layout-standard .moment-day-flow { gap: 30px; }
  body.layout-standard .moments-shell .moment--whisper,
  body.layout-standard .moments-shell .moment--text,
  body.layout-standard .moments-shell .moment--photo-one,
  body.layout-standard .moments-shell .moment--photo-two,
  body.layout-standard .moments-shell .moment--photo-three,
  body.layout-standard .moments-shell .moment--gallery,
  body.layout-standard .moments-shell .moment--video { width: 100%; margin-left: 0; }
  body.layout-standard .moments-shell .moment--photo-two .card-images,
  body.layout-standard .moments-shell .moment--photo-three .card-images,
  body.layout-standard .moments-shell .moment--gallery .card-images { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: auto; }
  body.layout-standard .moments-shell .moment--photo-three .card-images > :first-child { grid-row: auto; min-height: 0; }
  body.layout-standard .moments-shell .moment--photo-three .card-images > *,
  body.layout-standard .moments-shell .moment--gallery .card-images > * { transform: none !important; }
}
@media (prefers-reduced-motion: reduce) {
  body.layout-standard .moments-shell .moment-card,
  body.layout-standard .moments-compose-trigger { transition: none !important; }
}
html[data-reduce-motion="true"] body.layout-standard .moments-shell .moment-card,
html[data-reduce-motion="true"] body.layout-standard .moments-compose-trigger { transition: none !important; }
```

- [ ] **Step 5: Run focused test and verify GREEN**

- [ ] **Step 6: Commit**

```bash
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
- Produces event: `moments:pin-order-changed` on `#moments-list`, detail `{ ids: string[] }`.
- Consumes event in Moments page, reorders `currentMoments`, then calls `syncMoments(currentMoments)`.

- [ ] **Step 1: Add failing pin-contract test**

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

- [ ] **Step 3: Replace DOM-moving pin reorder**

In `MomentsPinControls.astro`, replace `reorderManagedCards()` with:

```ts
function requestManagedReorder() {
  listRoot.dispatchEvent(new CustomEvent('moments:pin-order-changed', {
    bubbles: true,
    detail: { ids: items.map((item) => item.id) },
  }));
}
```

In `refreshItems` use:

```ts
if (reorder) requestManagedReorder();
```

- [ ] **Step 4: Add the list event listener inside `initMomentsPage()`**

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

- [ ] **Step 5: Run focused test and verify GREEN**

- [ ] **Step 6: Commit**

```bash
git add src/components/MomentsPinControls.astro src/pages/moments.astro tests/moments-journal-layout.test.mjs
git commit -m "fix: preserve moments day groups after pin reorder"
```

---

### Task 7: Integrate actions/comments and verify the complete page

**Files:**
- Modify: `src/styles/moments-life-wall.css`
- Test: `tests/moments-journal-layout.test.mjs`
- Verify: `src/pages/moments.astro`, `src/components/MomentsPinControls.astro`

**Interfaces:**
- Consumes: existing `.moment-reactions`, `.moment-reaction-panel`, `.public-comments`, `.delete-moment-btn`, `.pin-moment-btn`.

- [ ] **Step 1: Append action/comment visibility CSS using the real comments root class**

```css
body.layout-standard .moments-shell .moment-card .delete-moment-btn,
body.layout-standard .moments-shell .moment-card .pin-moment-btn { opacity: 0.46; }
body.layout-standard .moments-shell .moment-card:hover .delete-moment-btn,
body.layout-standard .moments-shell .moment-card:hover .pin-moment-btn,
body.layout-standard .moments-shell .moment-card:focus-within .delete-moment-btn,
body.layout-standard .moments-shell .moment-card:focus-within .pin-moment-btn { opacity: 1; }
body.layout-standard .moments-shell .moment-reactions,
body.layout-standard .moments-shell .public-comments { position: relative; z-index: 1; }
body.layout-standard .moments-shell .moment-reaction-panel { z-index: 2200; }
@media (max-width: 720px) {
  body.layout-standard .moments-shell .moment-card .delete-moment-btn,
  body.layout-standard .moments-shell .moment-card .pin-moment-btn { opacity: 1; }
}
```

- [ ] **Step 2: Add anti-template regression test**

```js
test('retired journal-template UI does not return', () => {
  assert.doesNotMatch(page, /hero-stats/);
  assert.doesNotMatch(page, /stat-total/);
  assert.doesNotMatch(page, /moments-journal-header/);
  assert.doesNotMatch(page, /moments-film-strip/);
  assert.doesNotMatch(page, /bubble-float/);
  assert.doesNotMatch(wallCss, /moment-today-pulse/);
});
```

- [ ] **Step 3: Run focused and full static tests**

```bash
node --test tests/moments-journal-layout.test.mjs
npm run test:site
```

Expected: PASS.

- [ ] **Step 4: Run Astro validation/build**

```bash
npm run build
```

Expected: `astro check` and `astro build` PASS.

- [ ] **Step 5: Browser smoke-test both desktop and mobile**

Verify exactly:

1. `/moments` has no normal banner and no separate clock row.
2. Filter hides empty day groups and `全部` restores them.
3. Composer open/close, login/logout, plain-text publish, emoji insertion, image upload/preview/removal, video poster controls, and link field still work.
4. Reaction picker opens without clipping; `.public-comments` renders below the Moment.
5. Admin delete works.
6. Pin/unpin immediately reorders and day groups remain valid.
7. Image lightbox opens/closes and navigates multi-image sets.
8. Theme hue, light/dark and wallpaper modes remain readable.
9. Under `720px`, all tilt is gone and pin/delete/reaction/comment controls remain tappable.

- [ ] **Step 6: Verify no stale journal implementation remains**

```bash
git grep -n "moments-journal\|installMomentsJournalEnhancer\|Moments · Journal" -- src tests || true
git diff --check main...HEAD
git diff --stat main...HEAD
```

Expected: no old journal enhancer/style references in `src` or `tests`.

- [ ] **Step 7: Commit only if verification required a correction**

If a correction was necessary:

```bash
git add src/pages/moments.astro src/components/MomentsPinControls.astro src/lib/moments-life-wall.mjs src/styles/moments-life-wall.css tests/moments-journal-layout.test.mjs
git commit -m "test: lock moments life wall v2 behavior"
```

If nothing changed, finish without an empty commit.
