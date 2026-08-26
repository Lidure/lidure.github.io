# Window Desk Redesign 01: Foundation & Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the single visual foundation for 「窗边书桌 × 潮汐纸页」, unify typography and navigation, and replace the three-column portal homepage with a personal, content-first home page.

**Architecture:** Introduce semantic design tokens and focused `site-shell.css` / `home.css` files while legacy Firefly styles remain temporarily loaded for migration safety. The new rules load after legacy files and are scoped by stable semantic classes; legacy files are deleted only in Plan 04. Home static content comes from a tiny typed config, articles remain Astro content collection data, and recent Moments are progressively enhanced from the existing public API with a fail-closed hidden fallback.

**Tech Stack:** Astro 6, TypeScript, CSS custom properties, Node built-in test runner, existing `src/lib/moments-api.ts`.

**Spec:** `docs/superpowers/specs/2026-08-26-window-desk-tide-paper-design.md`

## Global Constraints

- Preserve fullscreen/banner wallpaper, theme hue, visual settings, waves, player, page transitions, and existing business APIs.
- Visual direction is `70% 日常小清新 + 30% ACG 个人气质`.
- Body/UI font: `Zen Maru Gothic`, fallback `PingFang SC`, `Microsoft YaHei`, `sans-serif`.
- `Ma Shan Zheng` is limited to the site name and rare handwritten accents; code font remains unchanged.
- Theme color is an accent for current state, links, thin lines, focus/hover, and TOC state; do not flood whole surfaces with it.
- Do not add a new numbered Firefly stylesheet. Semantic styles are `tokens.css`, `site-shell.css`, `home.css`, `article.css`, `moments.css`, and `pages.css`.
- Wallpaper is atmosphere, not a structural dependency: the layout must remain readable with wallpaper disabled.
- Desktop may use mild asymmetry; decorative offsets are removed on mobile.
- Existing critical controls must remain keyboard accessible and `prefers-reduced-motion` / `data-reduce-motion` compatible.

---

## File Structure

**Create**
- `src/styles/tokens.css` — canonical typography, ink/paper/line/accent, spacing, radius, shadow, and width tokens.
- `src/styles/site-shell.css` — ordinary-page body, header/navigation, page surface, footer primitives, focus states.
- `src/styles/home.css` — homepage-only layout and responsive rhythm.
- `src/data/home-presence.ts` — small editable personal status/config source.
- `src/components/HomeRecentMoments.astro` — progressive recent-Moments preview that hides itself on API failure.
- `tests/window-desk-foundation.test.mjs` — structural contract for tokens, fonts, imports, navigation, homepage, and fallback behavior.

**Modify**
- `src/layouts/BaseLayout.astro` — load new semantic styles after current migration styles; switch Google Fonts to Zen Maru Gothic + Ma Shan Zheng; refine footer markup.
- `src/components/SiteHeader.astro` — primary navigation becomes 首页 / 文章 / 碎碎念 / 归档 / 关于; utilities are secondary.
- `src/pages/index.astro` — remove three-column portal and build personal-first sections.
- `package.json` — add the new structural test to `test:site`.

**Do not delete yet**
- `src/styles/firefly-*.css`, `src/styles/global.css`, `src/styles/bannerless-pages.css`.
- `HomeLeftSidebar.astro`, `HomeRightSidebar.astro`, `HomePostCard.astro` until Plan 04 confirms no remaining imports.

---

### Task 1: Lock the new design-token and font contract

**Files:**
- Create: `tests/window-desk-foundation.test.mjs`
- Create: `src/styles/tokens.css`
- Create: `src/styles/site-shell.css`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `package.json`

**Interfaces:**
- Produces CSS variables: `--font-body`, `--font-hand`, `--font-mono`, `--ink`, `--muted`, `--paper`, `--paper-soft`, `--line`, `--accent`, `--accent-soft`, `--content-max`, `--reading-max`.
- `--accent` must derive from existing `--theme-hue` so visual settings continue to control the site.

- [ ] **Step 1: Write the failing structural test**

Create `tests/window-desk-foundation.test.mjs` with:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const layout = () => read('src/layouts/BaseLayout.astro');
const tokens = () => read('src/styles/tokens.css');

test('window-desk foundation exposes one semantic token layer and Zen Maru body font', () => {
  assert.match(layout(), /tokens\.css/);
  assert.match(layout(), /site-shell\.css/);
  assert.match(layout(), /family=Ma\+Shan\+Zheng&family=Zen\+Maru\+Gothic:wght@400;500;600;700/);
  assert.doesNotMatch(layout(), /Noto\+Sans\+SC/);

  for (const token of [
    '--font-body', '--font-hand', '--font-mono', '--ink', '--muted',
    '--paper', '--paper-soft', '--line', '--accent', '--accent-soft',
    '--content-max', '--reading-max',
  ]) {
    assert.match(tokens(), new RegExp(token.replaceAll('-', '\\-')));
  }
  assert.match(tokens(), /--accent:\s*hsl\(var\(--theme-hue\)/);
});
```

Append `tests/window-desk-foundation.test.mjs` to the existing `test:site` command in `package.json`.

- [ ] **Step 2: Run the targeted test and verify RED**

Run:

```bash
node --test tests/window-desk-foundation.test.mjs
```

Expected: FAIL because `tokens.css`, `site-shell.css`, and the Zen Maru font URL do not exist yet.

- [ ] **Step 3: Add the semantic tokens**

Create `src/styles/tokens.css` with the canonical layer:

```css
:root {
  --font-body: 'Zen Maru Gothic', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-hand: 'Ma Shan Zheng', cursive;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

  --ink: hsl(var(--theme-hue, 255) 12% 18%);
  --muted: hsl(var(--theme-hue, 255) 8% 43%);
  --paper: hsl(var(--theme-hue, 255) 24% 99% / 0.90);
  --paper-soft: hsl(var(--theme-hue, 255) 22% 98% / 0.72);
  --line: hsl(var(--theme-hue, 255) 18% 72% / 0.45);
  --accent: hsl(var(--theme-hue, 255) 64% 55%);
  --accent-soft: hsl(var(--theme-hue, 255) 70% 70% / 0.20);

  --content-max: 1120px;
  --reading-max: 740px;
  --space-page: clamp(20px, 4vw, 48px);
  --radius-soft: 14px;
  --shadow-paper: 0 10px 30px hsl(var(--theme-hue, 255) 18% 12% / 0.06);
}

html[data-theme='dark'] {
  --ink: hsl(var(--theme-hue, 255) 12% 91%);
  --muted: hsl(var(--theme-hue, 255) 9% 68%);
  --paper: hsl(var(--theme-hue, 255) 14% 13% / 0.86);
  --paper-soft: hsl(var(--theme-hue, 255) 13% 15% / 0.68);
  --line: hsl(var(--theme-hue, 255) 14% 62% / 0.30);
  --accent: hsl(var(--theme-hue, 255) 72% 70%);
  --accent-soft: hsl(var(--theme-hue, 255) 72% 64% / 0.16);
}
```

Create `src/styles/site-shell.css` with only shell-level rules. Minimum implementation:

```css
body.layout-standard {
  font-family: var(--font-body);
  color: var(--ink);
}

body.layout-standard .standard-content {
  width: min(100% - (2 * var(--space-page)), var(--content-max));
  margin-inline: auto;
}

body.layout-standard a:focus-visible,
body.layout-standard button:focus-visible,
body.layout-standard input:focus-visible,
body.layout-standard textarea:focus-visible,
body.layout-standard summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
```

- [ ] **Step 4: Wire fonts and semantic styles into `BaseLayout.astro`**

Import the new files after the existing migration styles so this plan can be reviewed independently:

```astro
import '../styles/tokens.css';
import '../styles/site-shell.css';
```

Replace all three Google Font URLs with the same family set:

```text
https://fonts.googleapis.com/css2?family=Ma+Shan+Zheng&family=Zen+Maru+Gothic:wght@400;500;600;700&display=swap
```

Do not remove the legacy Firefly imports in this task; Plan 04 owns deletion after regression coverage is green.

- [ ] **Step 5: Run targeted test and existing visual settings regression**

Run:

```bash
node --test tests/window-desk-foundation.test.mjs tests/visual-settings.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/styles/tokens.css src/styles/site-shell.css src/layouts/BaseLayout.astro tests/window-desk-foundation.test.mjs package.json
git commit -m "style: establish window desk design tokens"
```

---

### Task 2: Simplify the global navigation without removing capabilities

**Files:**
- Modify: `src/components/SiteHeader.astro`
- Modify: `src/styles/site-shell.css`
- Modify: `tests/window-desk-foundation.test.mjs`

**Interfaces:**
- Primary links are exactly `/`, `/posts`, `/moments`, `/archive`, `/about`.
- Secondary utility navigation keeps `/search`, `/messages`, `/tags`, `/player`, `/sekai-quest` reachable.
- Existing mobile `aria-expanded` behavior and Astro navigation cleanup remain intact.

- [ ] **Step 1: Add failing navigation assertions**

Append:

```js
test('site header prioritizes the five human-facing sections and demotes utilities', () => {
  const header = read('src/components/SiteHeader.astro');
  for (const link of [
    "{ href: '/', label: '首页' }",
    "{ href: '/posts', label: '文章' }",
    "{ href: '/moments', label: '碎碎念' }",
    "{ href: '/archive', label: '归档' }",
    "{ href: '/about', label: '关于' }",
  ]) assert.ok(header.includes(link));

  assert.match(header, /class="site-nav-more"/);
  assert.match(header, /\/search/);
  assert.match(header, /\/messages/);
  assert.match(header, /\/tags/);
  assert.match(header, /\/player/);
  assert.match(header, /\/sekai-quest/);
  assert.match(header, /aria-expanded/);
});
```

- [ ] **Step 2: Run targeted test and verify RED**

```bash
node --test tests/window-desk-foundation.test.mjs
```

Expected: FAIL because `/archive`, `/about`, and `.site-nav-more` are absent.

- [ ] **Step 3: Restructure `SiteHeader.astro`**

Use:

```ts
const primaryLinks = [
  { href: '/', label: '首页' },
  { href: '/posts', label: '文章' },
  { href: '/moments', label: '碎碎念' },
  { href: '/archive', label: '归档' },
  { href: '/about', label: '关于' },
];

const utilityLinks = [
  { href: '/search', label: '搜索' },
  { href: '/messages', label: '留言' },
  { href: '/tags', label: '标签' },
  { href: '/player', label: '沉浸' },
  { href: '/sekai-quest', label: '闯关' },
];
```

Render utilities inside a semantic secondary group:

```astro
<div class="site-nav-more" aria-label="更多入口">
  {utilityLinks.map((link) => (
    <a href={link.href} class:list={{ active: isActive(link.href) }}>{link.label}</a>
  ))}
</div>
```

Keep the existing mobile toggle lifecycle and `aria-current` logic.

- [ ] **Step 4: Add quiet navigation styling**

In `site-shell.css`, make the header typographic rather than card-like. The implementation must include:

```css
.site-brand {
  font-family: var(--font-hand);
}

.site-nav-primary a,
.site-nav-more a {
  color: var(--muted);
  text-decoration: none;
}

.site-nav-primary a.active,
.site-nav-primary a[aria-current='page'] {
  color: var(--ink);
  text-decoration: underline;
  text-decoration-color: var(--accent);
  text-decoration-thickness: 2px;
  text-underline-offset: 7px;
}
```

Avoid a large filled active pill.

- [ ] **Step 5: Run targeted tests**

```bash
node --test tests/window-desk-foundation.test.mjs tests/firefly-ui-refresh.test.mjs
```

If an old visual-only assertion fails because it requires the previous utility layout, update that assertion only if it conflicts with the approved spec; do not weaken functional checks for the menu toggle.

- [ ] **Step 6: Commit**

```bash
git add src/components/SiteHeader.astro src/styles/site-shell.css tests/window-desk-foundation.test.mjs
git commit -m "style: simplify primary blog navigation"
```

---

### Task 3: Replace the three-column homepage with a personal-first composition

**Files:**
- Create: `src/data/home-presence.ts`
- Create: `src/styles/home.css`
- Modify: `src/pages/index.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `tests/window-desk-foundation.test.mjs`

**Interfaces:**
- Exports `homePresence` with `intro`, `visual`, and `now`.
- `now` entries use `{ label: string; value: string; href?: string }`.
- The homepage gets articles from the existing `blog` content collection; no CMS is added.

- [ ] **Step 1: Add failing homepage assertions**

```js
test('homepage is personal-first instead of a three-column portal', () => {
  const home = read('src/pages/index.astro');
  assert.match(home, /home-presence/);
  assert.match(home, /最近在/);
  assert.match(home, /最近写下的东西/);
  assert.match(home, /最近的日常/);
  assert.doesNotMatch(home, /HomeLeftSidebar/);
  assert.doesNotMatch(home, /HomeRightSidebar/);
  assert.doesNotMatch(home, /FEATURED/);
  assert.doesNotMatch(home, /RECENT POSTS/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test tests/window-desk-foundation.test.mjs
```

Expected: FAIL on the old three-column homepage.

- [ ] **Step 3: Create editable home presence data**

Create `src/data/home-presence.ts`:

```ts
export type HomeNowItem = {
  label: string;
  value: string;
  href?: string;
};

export const homePresence = {
  intro: '把喜欢的东西，认真地收进小站里。',
  visual: {
    src: '/site-icon-512.png',
    alt: '搁浅的小窝',
  },
  now: [
    { label: '最近在研究', value: '视觉、飞行与一些有趣的小项目' },
    { label: '最近在听', value: '歌单随机播放中', href: '/player' },
    { label: '最近在玩', value: 'Project SEKAI', href: '/sekai-quest' },
  ] satisfies HomeNowItem[],
};
```

The values are intentionally easy to edit later and are not duplicated in page markup.

- [ ] **Step 4: Rewrite `src/pages/index.astro`**

Keep the collection query, but replace the old sidebars/category bar with this semantic skeleton:

```astro
<section class="home-presence" aria-labelledby="home-name">
  <div class="home-presence-copy">
    <p class="home-eyebrow">你好，这里是</p>
    <h1 id="home-name">搁浅</h1>
    <p class="home-intro">{homePresence.intro}</p>
    <dl class="home-now" aria-label="最近在做的事">
      {homePresence.now.map((item) => (
        <div>
          <dt>{item.label}</dt>
          <dd>{item.href ? <a href={item.href}>{item.value}</a> : item.value}</dd>
        </div>
      ))}
    </dl>
  </div>
  <img class="home-presence-visual" src={homePresence.visual.src} alt={homePresence.visual.alt} />
</section>

<section class="home-writing" aria-labelledby="home-writing-title">
  <header><h2 id="home-writing-title">最近写下的东西</h2><a href="/posts">更多文章</a></header>
  <!-- one lead article + 2–4 text-first supporting entries -->
</section>

<section class="home-moments" aria-labelledby="home-moments-title">
  <header><h2 id="home-moments-title">最近的日常</h2><a href="/moments">去碎碎念</a></header>
  <HomeRecentMoments />
</section>

<nav class="home-more" aria-label="更多内容">
  <a href="/archive">归档</a>
  <a href="/messages">留言</a>
  <a href="/about">关于</a>
</nav>
```

For articles:

```ts
const leadPost = posts[0];
const supportingPosts = posts.slice(1, 5);
```

Render the lead article with title + description + date, and supporting entries as date + title + optional `#tag` text. Do not use identical cards.

Import `home.css` from the page or BaseLayout. Prefer page import:

```astro
import '../styles/home.css';
```

- [ ] **Step 5: Implement responsive homepage rhythm**

`src/styles/home.css` must include a two-column first impression only when space allows, text-first article list, and mobile normalization:

```css
.home-presence {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(160px, 260px);
  gap: clamp(32px, 7vw, 88px);
  align-items: center;
  min-height: min(68vh, 680px);
}

.home-writing,
.home-moments {
  margin-top: clamp(72px, 10vw, 128px);
}

.home-writing a,
.home-moments a,
.home-more a {
  color: inherit;
  text-decoration-color: var(--accent);
  text-underline-offset: 4px;
}

@media (max-width: 760px) {
  .home-presence {
    grid-template-columns: 1fr;
    min-height: auto;
  }
  .home-presence-visual {
    width: min(44vw, 180px);
  }
}
```

Avoid universal card backgrounds for each child.

- [ ] **Step 6: Run targeted test and Astro check**

```bash
node --test tests/window-desk-foundation.test.mjs
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data/home-presence.ts src/styles/home.css src/pages/index.astro src/layouts/BaseLayout.astro tests/window-desk-foundation.test.mjs
git commit -m "feat: rebuild homepage as personal space"
```

---

### Task 4: Add recent Moments as progressive enhancement with fail-closed fallback

**Files:**
- Create: `src/components/HomeRecentMoments.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/home.css`
- Modify: `tests/window-desk-foundation.test.mjs`

**Interfaces:**
- Consumes `fetchMoments({ limit: 3, signal })` from `src/lib/moments-api.ts`.
- Produces up to three read-only preview entries inside `[data-home-recent-moments]`.
- On timeout/network/API failure the preview root remains hidden; no error card is shown and homepage content continues normally.

- [ ] **Step 1: Add failing fallback assertions**

```js
test('home recent moments progressively enhances and hides on API failure', () => {
  const component = read('src/components/HomeRecentMoments.astro');
  assert.match(component, /data-home-recent-moments/);
  assert.match(component, /fetchMoments\(\{\s*limit:\s*3/);
  assert.match(component, /root\.hidden\s*=\s*false/);
  assert.match(component, /catch[\s\S]*root\.hidden\s*=\s*true/);
  assert.doesNotMatch(component, /uploadMomentMedia|createMoment|deleteMoment|setMomentPinned/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test tests/window-desk-foundation.test.mjs
```

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement `HomeRecentMoments.astro`**

Use a hidden-by-default shell:

```astro
<div class="home-recent-moments" data-home-recent-moments hidden>
  <div class="home-recent-moments-list"></div>
</div>

<script>
  import { fetchMoments } from '../lib/moments-api';

  const homeWindow = window as typeof window & { __homeMomentsCleanup?: () => void };

  async function initHomeMoments() {
    homeWindow.__homeMomentsCleanup?.();
    const root = document.querySelector<HTMLElement>('[data-home-recent-moments]');
    const list = root?.querySelector<HTMLElement>('.home-recent-moments-list');
    if (!root || !list) return;

    const controller = new AbortController();
    homeWindow.__homeMomentsCleanup = () => controller.abort();
    root.hidden = true;
    list.replaceChildren();

    try {
      const { items } = await fetchMoments({ limit: 3, signal: controller.signal });
      const visible = items.slice(0, 3);
      if (!visible.length) return;
      for (const item of visible) {
        const article = document.createElement('article');
        article.className = 'home-moment-preview';
        const time = document.createElement('time');
        time.dateTime = item.date;
        time.textContent = item.date;
        const text = document.createElement('p');
        text.textContent = item.text || '一张最近留下的照片。';
        article.append(time, text);
        list.append(article);
      }
      root.hidden = false;
    } catch {
      root.hidden = true;
    }
  }

  document.addEventListener('astro:page-load', initHomeMoments);
  document.addEventListener('astro:before-swap', () => homeWindow.__homeMomentsCleanup?.());
  initHomeMoments();
</script>
```

Do not duplicate Moment reaction/comment/admin controls on the homepage.

- [ ] **Step 4: Style previews as content, not social cards**

Add only typographic separators:

```css
.home-moment-preview {
  display: grid;
  grid-template-columns: 7rem minmax(0, 1fr);
  gap: 18px;
  padding-block: 14px;
  border-top: 1px solid var(--line);
}

.home-moment-preview time {
  color: var(--muted);
  font-size: 0.82rem;
}
```

At mobile widths, use one column.

- [ ] **Step 5: Run tests**

```bash
node --test tests/window-desk-foundation.test.mjs tests/moments-journal-layout.test.mjs
npm run check
```

Expected: PASS and existing Moments admin/reaction contracts remain unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/HomeRecentMoments.astro src/pages/index.astro src/styles/home.css tests/window-desk-foundation.test.mjs
git commit -m "feat: surface recent moments on homepage"
```

---

### Task 5: Verify Plan 01 as an independently shippable checkpoint

**Files:**
- Modify only if verification exposes a defect covered by this plan.

- [ ] **Step 1: Run the plan-specific tests**

```bash
node --test tests/window-desk-foundation.test.mjs tests/visual-settings.test.mjs tests/moments-journal-layout.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run full type/build verification**

```bash
npm run build
```

Expected: `astro check` and `astro build` both succeed.

- [ ] **Step 3: Run full site regression suite**

```bash
npm run test:site
```

Expected: PASS, except visual-only legacy tests that are explicitly superseded by the approved design must be updated in the same commit without weakening functional assertions.

- [ ] **Step 4: Review the diff for migration boundaries**

Run:

```bash
git diff --stat main...HEAD
git diff main...HEAD -- src/layouts/BaseLayout.astro src/components/SiteHeader.astro src/pages/index.astro src/styles/tokens.css src/styles/site-shell.css src/styles/home.css
```

Confirm:
- no legacy stylesheet has been deleted yet;
- no Moments write/admin API logic was changed;
- no player/SEKAI runtime code was changed;
- no new numbered Firefly stylesheet exists.

- [ ] **Step 5: Commit any verification-only fixes**

If no fixes are needed, do not create an empty commit. If fixes were required:

```bash
git add <only-files-fixed-for-plan-01>
git commit -m "test: stabilize redesign foundation checkpoint"
```
