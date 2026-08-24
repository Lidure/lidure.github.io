# Firefly UI Refresh v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the blog presentation shell around a Firefly-like responsive grid and hue-layered visual system while preserving the current background manager, SEKAI player, immersive experience, Moments, guestbook, and public APIs.

**Architecture:** `HeroSlideshow.astro`, `SekaiPlayer.astro`, and the existing API libraries remain business-logic owners. `BaseLayout.astro` owns the shared shell; a new `FloatingControls.astro` safely proxies the existing background-settings trigger and hosts theme/back-to-top controls while the current `#sekaiPlayerBtn` remains the only real player entry. Homepage sidebars are read-only view consumers, and `/player` receives selector/state-machine repairs rather than a rewrite.

**Tech Stack:** Astro 6, TypeScript, CSS, Node `node:test`, Astro ClientRouter, existing Moments/public-interactions APIs.

**Spec:** `docs/superpowers/specs/2026-08-24-firefly-ui-refresh-v2-design.md` on branch `design/firefly-ui-refresh`.

## Global Constraints

- Public site/domain remains `https://lidure22.xyz`; public API remains `https://api.lidure22.xyz/api`.
- Do not rewrite HeroSlideshow media/cache/poster/loop logic unless a failing regression test proves it is required.
- Do not rewrite SekaiPlayer import/search/filter/playback/visualizer logic unless a failing regression test proves it is required.
- Do not introduce mandatory article categories or migrate existing Markdown frontmatter.
- `/player` must show navigation, player entry, and background settings access by default, with no standard Banner/footer.
- Wide homepage target: 1280–1360px, three regions at >=1200px; two columns at 850–1199px; one column below 850px.
- Guestbook desktop target: 1180–1240px total width, 340–380px sticky composer/admin column plus message stream.
- Use semantic pink/purple/cyan/warm accents; do not restore global glow/gradient-heavy styling.
- Design/spec/plan files remain on the design branch and do not enter the production merge unless explicitly requested.

---

## File Structure

- `src/layouts/BaseLayout.astro` — shared shell and standard/immersive split.
- `src/components/SiteHeader.astro` — navigation only.
- `src/components/FloatingControls.astro` — background proxy, ThemeToggle, back-to-top.
- `src/styles/firefly-refresh.css` — v2 standard-page tokens, grid, cards, guestbook.
- `src/styles/immersive-nav.css` — immersive navigation/floating-control presentation only.
- `src/components/SidebarWidget.astro` — reusable widget shell.
- `src/components/HomeLeftSidebar.astro` — identity, real counts, shortcuts, category-like navigation.
- `src/components/HomeRightSidebar.astro` — popular tags, Moments preview, music status, site stats, announcement.
- `src/components/MusicStatusWidget.astro` — observes current SEKAI DOM; never creates audio/fetches playlists.
- `src/components/RecentMomentsWidget.astro` — read-only `fetchMoments({ limit: 3 })` consumer.
- `src/pages/index.astro` — homepage composition/data shaping.
- `src/pages/messages.astro` — presentation rewrite only; business IDs/API calls preserved.
- `src/pages/player.astro` — minimal hide-state selector repair only.
- `tests/firefly-ui-refresh.test.mjs` — v2 source/built contracts.
- `tests/site-build.test.mjs` — existing business regressions.

---

### Task 1: Lock the v2 regression contracts

**Files:**
- Modify: `tests/firefly-ui-refresh.test.mjs`

**Interfaces:**
- Consumes: current v1 source/build output.
- Produces: clean RED tests for shell controls, immersive selectors, homepage regions, and guestbook width.

- [ ] **Step 1: Make the source helper safe for not-yet-created files**

Change the import/helper section to:

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const sourceUrl = (path) => new URL(`../${path}`, import.meta.url);
const sourceExists = (path) => existsSync(sourceUrl(path));
const readSource = (path) => readFileSync(sourceUrl(path), 'utf8');
const readBuilt = (path) => readFileSync(new URL(`../dist/${path}`, import.meta.url), 'utf8');
```

- [ ] **Step 2: Add failing v2 contracts**

```js
test('shared shell mounts navigation and floating controls for both modes', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /<SiteHeader\s+currentPath=/);
  assert.match(layout, /<FloatingControls\s*\/?>/);
  assert.doesNotMatch(layout, /isStandard\s*\?\s*\([\s\S]*?<SiteHeader/);
});

test('immersive hide state uses current shell selectors', () => {
  const player = readSource('src/pages/player.astro');
  assert.doesNotMatch(player, /querySelector\(['"]\.topbar['"]\)/);
  assert.match(player, /querySelector\(['"]\.site-header['"]\)/);
  assert.match(player, /querySelector\(['"]\.site-floating-controls['"]\)/);
});

test('homepage exposes left, main, and right regions', () => {
  const home = readSource('src/pages/index.astro');
  assert.match(home, /HomeLeftSidebar/);
  assert.match(home, /home-main-column/);
  assert.match(home, /HomeRightSidebar/);
});

test('guestbook uses a wide two-column desktop shell', () => {
  const messages = readSource('src/pages/messages.astro');
  assert.match(messages, /messages-layout/);
  assert.match(messages, /messages-composer-column/);
  assert.match(messages, /messages-stream-column/);
  assert.doesNotMatch(messages, /max-width:\s*760px/);
});

test('built immersive page keeps core controls without standard chrome', () => {
  const html = readBuilt('player/index.html');
  assert.match(html, /layout-immersive/);
  assert.match(html, /class="site-header"/);
  assert.match(html, /id="sekaiPlayerBtn"/);
  assert.match(html, /id="hero-settings-btn"/);
  assert.match(html, /class="site-floating-controls"/);
  assert.doesNotMatch(html, /class="blog-banner"/);
  assert.doesNotMatch(html, /class="footer"/);
});
```

- [ ] **Step 3: Run and verify RED**

```bash
npm run build
node --test tests/firefly-ui-refresh.test.mjs
```

Expected: assertion failures for missing FloatingControls/home regions, old guestbook width, and old immersive selectors. The test file itself must load successfully; no ENOENT test harness error is acceptable.

- [ ] **Step 4: Commit**

```bash
git add tests/firefly-ui-refresh.test.mjs
git commit -m "test: define Firefly v2 shell regressions"
```

---

### Task 2: Restore the shared shell and add safe floating controls

**Files:**
- Create: `src/components/FloatingControls.astro`
- Create: `src/styles/immersive-nav.css`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/SiteHeader.astro`
- Modify: `src/styles/firefly-refresh.css`
- Modify: `tests/firefly-ui-refresh.test.mjs`

**Interfaces:**
- Consumes: existing `#hero-settings-btn`, `#sekaiPlayerBtn`, `ThemeToggle.astro`.
- Produces: `.site-floating-controls`, `#floating-background-btn`, `#floating-back-to-top`, shared SiteHeader in both modes.

- [ ] **Step 1: Add a clean RED proxy test**

```js
test('floating controls proxy existing background settings instead of duplicating them', () => {
  const path = 'src/components/FloatingControls.astro';
  assert.ok(sourceExists(path), 'FloatingControls.astro must exist');
  const controls = readSource(path);
  assert.match(controls, /id="floating-background-btn"/);
  assert.match(controls, /getElementById\(['"]hero-settings-btn['"]\)/);
  assert.match(controls, /\.click\(\)/);
  assert.match(controls, /<ThemeToggle\s*\/?>/);
  assert.match(controls, /id="floating-back-to-top"/);
  assert.doesNotMatch(controls, /sekaiPlayerPanel|sekaiAudio|fetchMoments/);
});
```

Run `node --test tests/firefly-ui-refresh.test.mjs`; expected FAIL with `FloatingControls.astro must exist`.

- [ ] **Step 2: Create `FloatingControls.astro`**

```astro
---
import ThemeToggle from './ThemeToggle.astro';
---

<div class="site-floating-controls" aria-label="站点快捷控制">
  <button id="floating-background-btn" class="site-floating-control is-background" type="button" aria-label="背景设置" title="背景设置"><span aria-hidden="true">▣</span></button>
  <ThemeToggle />
  <button id="floating-back-to-top" class="site-floating-control is-top" type="button" aria-label="返回顶部" title="返回顶部"><span aria-hidden="true">↑</span></button>
</div>

<script is:inline>
(function () {
  function initFloatingControls() {
    var root = document.querySelector('.site-floating-controls');
    var background = document.getElementById('floating-background-btn');
    var top = document.getElementById('floating-back-to-top');
    if (!root || !background || !top || root.dataset.initialized === 'true') return;
    root.dataset.initialized = 'true';

    background.addEventListener('click', function () {
      var trigger = document.getElementById('hero-settings-btn');
      if (trigger) trigger.click();
    });

    top.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    function syncTopVisibility() {
      top.toggleAttribute('data-visible', window.scrollY > 420);
    }

    if (window.__floatingControlsScrollHandler) {
      window.removeEventListener('scroll', window.__floatingControlsScrollHandler);
    }
    window.__floatingControlsScrollHandler = syncTopVisibility;
    window.addEventListener('scroll', window.__floatingControlsScrollHandler, { passive: true });
    syncTopVisibility();

    if (document.getElementById('hero-settings-btn')) document.body.classList.add('floating-controls-ready');
  }

  if (!window.__floatingControlsPageLoadBound) {
    window.__floatingControlsPageLoadBound = true;
    document.addEventListener('astro:page-load', initFloatingControls);
  }
  initFloatingControls();
})();
</script>
```

- [ ] **Step 3: Remove ThemeToggle from `SiteHeader.astro` and keep all navigation links/listener cleanup unchanged**

Remove only:

```astro
import ThemeToggle from './ThemeToggle.astro';
```

and the `<ThemeToggle />` in `.site-nav-utilities`.

- [ ] **Step 4: Move SiteHeader and FloatingControls outside the standard-only branch in `BaseLayout.astro`**

```astro
<HeroSlideshow />
<SekaiParticles />
<SekaiPlayer />
<SiteHeader currentPath={Astro.url.pathname} />
<FloatingControls />

{isStandard ? (
  <>
    <BlogBanner title={resolvedBannerTitle} subtitle={resolvedBannerSubtitle} />
    <div class="standard-page-surface">...</div>
  </>
) : (
  <main class="immersive-content"><slot /></main>
)}
```

Add:

```ts
import FloatingControls from '../components/FloatingControls.astro';
import '../styles/immersive-nav.css';
```

- [ ] **Step 5: Style the standard floating stack without hiding fallback before JS is ready**

```css
body.layout-standard .site-floating-controls {
  position: fixed;
  right: 24px;
  bottom: 92px;
  z-index: 9998;
  display: grid;
  gap: 9px;
}

body.floating-controls-ready #hero-settings-btn {
  opacity: 0;
  pointer-events: none;
}

.site-floating-control,
.site-floating-controls .theme-toggle {
  width: 42px;
  height: 42px;
  border-radius: 12px;
}

.site-floating-controls .theme-toggle:hover {
  transform: translateY(-1px);
  box-shadow: none;
}
```

Give background/theme/top separate cyan/pink/purple hover colors through `.is-background`, `.theme-toggle`, `.is-top`.

- [ ] **Step 6: Create complete immersive navigation/floating CSS in `immersive-nav.css`**

At minimum:

```css
body.layout-immersive .site-header {
  position: fixed;
  inset: 0 0 auto;
  z-index: 10020;
  color: #fff;
  background: linear-gradient(to bottom, rgba(7, 8, 18, .48), transparent);
}

body.layout-immersive .site-header-inner {
  width: min(calc(100% - 32px), 1280px);
  min-height: 64px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 24px;
}

body.layout-immersive .site-nav-panel,
body.layout-immersive .site-nav-primary,
body.layout-immersive .site-nav-utilities {
  display: flex;
  align-items: center;
}

body.layout-immersive .site-nav-panel {
  flex: 1;
  justify-content: space-between;
}

body.layout-immersive .site-floating-controls {
  position: fixed;
  right: 24px;
  bottom: 92px;
  z-index: 10010;
  display: grid;
  gap: 9px;
}

@media (max-width: 900px) {
  body.layout-immersive .site-nav-toggle { display: block; }
  body.layout-immersive .site-nav-panel { display: none; position: absolute; top: 58px; left: 16px; right: 16px; }
  body.layout-immersive .site-nav-panel[data-open="true"] { display: grid; }
}
```

Also define brand/link/toggle/menu backgrounds for readability over video; do not import standard card CSS.

- [ ] **Step 7: Verify the focused shell tests**

```bash
npm run build
node --test tests/firefly-ui-refresh.test.mjs
```

Expected: FloatingControls and shared-shell assertions PASS; homepage/guestbook/obsolete player selector tests remain RED until their tasks.

- [ ] **Step 8: Commit**

```bash
git add src/layouts/BaseLayout.astro src/components/SiteHeader.astro src/components/FloatingControls.astro src/styles/firefly-refresh.css src/styles/immersive-nav.css tests/firefly-ui-refresh.test.mjs
git commit -m "feat: restore shared shell controls"
```

---

### Task 3: Repair the immersive hide-state groups

**Files:**
- Modify: `src/pages/player.astro`
- Modify: `tests/firefly-ui-refresh.test.mjs`

**Interfaces:**
- Consumes: `.site-header`, `.site-floating-controls`, `.sekai-player-btn`, `#hero-settings-panel`, `#media-panel`, `#media-preview`, danmaku composer, cover, stage, visualizer.
- Produces: Stage 0 all visible; Stage 1 navigation hidden only; Stage 2 floating/player/composer hidden; Stage 3 visual overlays hidden.

- [ ] **Step 1: Add an exact stage-ownership RED test**

```js
test('immersive stage one keeps player and background controls visible', () => {
  const player = readSource('src/pages/player.astro');
  assert.match(player, /stage1:\s*\[\s*document\.querySelector\(['"]\.site-header['"]\)/);
  assert.match(player, /stage2:\s*\[[\s\S]*?document\.querySelector\(['"]\.site-floating-controls['"]\)/);
  assert.match(player, /document\.querySelector\(['"]\.sekai-player-btn['"]\)/);
  assert.match(player, /hideStage === 1[\s\S]*?setOpacity\(t\.stage1, '0'\)[\s\S]*?setOpacity\(t\.stage2, ''\)/);
});
```

Run focused test; expected FAIL with the current `.topbar`/dynamic push grouping.

- [ ] **Step 2: Replace only `getTargets()` with current explicit groups**

```js
function getTargets() {
  return {
    stage1: [
      document.querySelector('.site-header'),
    ].filter(Boolean),
    stage2: [
      document.querySelector('.site-floating-controls'),
      document.querySelector('.sekai-player-btn'),
      document.querySelector('#hero-settings-panel'),
      document.querySelector('#media-panel'),
      document.querySelector('#media-preview'),
      danmakuComposer,
    ].filter(Boolean),
    stage3: [
      document.querySelector('.immersive-cover'),
      document.querySelector('#danmakuStage'),
      canvas,
    ].filter(Boolean),
  };
}
```

Remove the old `.topbar` query and old `stage2.push(...)` loop from this block. Do not alter danmaku network calls or visualizer math.

- [ ] **Step 3: Keep the four transitions explicit**

```js
if (hideStage === 0) {
  setOpacity(t.stage1, ''); setOpacity(t.stage2, ''); setOpacity(t.stage3, '');
} else if (hideStage === 1) {
  setOpacity(t.stage1, '0'); setOpacity(t.stage2, ''); setOpacity(t.stage3, '');
} else if (hideStage === 2) {
  setOpacity(t.stage1, '0'); setOpacity(t.stage2, '0'); setOpacity(t.stage3, '');
} else {
  setOpacity(t.stage1, '0'); setOpacity(t.stage2, '0'); setOpacity(t.stage3, '0');
}
```

Preserve the existing switcher opacity/title updates surrounding this logic.

- [ ] **Step 4: Verify player regressions**

```bash
npm run build
node --test tests/firefly-ui-refresh.test.mjs tests/sekai-player-search.test.mjs tests/hero-video-loop.test.mjs
```

Expected: immersive selector/stage tests PASS; player search/import and Hero loop tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/player.astro tests/firefly-ui-refresh.test.mjs
git commit -m "fix: align immersive hide states with shared shell"
```

---

### Task 4: Build the Firefly-like homepage grid and sidebar widgets

**Files:**
- Create: `src/components/SidebarWidget.astro`
- Create: `src/components/HomeLeftSidebar.astro`
- Create: `src/components/HomeRightSidebar.astro`
- Create: `src/components/MusicStatusWidget.astro`
- Create: `src/components/RecentMomentsWidget.astro`
- Modify: `src/components/HomePostCard.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/firefly-refresh.css`
- Modify: `tests/firefly-ui-refresh.test.mjs`

**Interfaces:**
- `SidebarWidget`: `{ title: string; tone?: 'neutral'|'pink'|'purple'|'cyan'|'warm'; href?: string; hrefLabel?: string }`.
- `HomeLeftSidebar`: `{ postCount: number; tagCount: number; tags: Array<{name:string;count:number}>; featuredHref: string }`.
- `HomeRightSidebar`: `{ tags: Array<{name:string;count:number}> }`.
- `RecentMomentsWidget`: read-only `fetchMoments({ limit: 3 })`.
- `MusicStatusWidget`: reads `#sekaiTrackTitle`, `#sekaiTrackArtist`, `#sekaiCover`; launcher clicks `#sekaiPlayerBtn`.

- [ ] **Step 1: Add clean RED existence/ownership tests**

```js
test('homepage v2 widgets exist and remain view-only consumers', () => {
  for (const path of [
    'src/components/HomeLeftSidebar.astro',
    'src/components/HomeRightSidebar.astro',
    'src/components/MusicStatusWidget.astro',
    'src/components/RecentMomentsWidget.astro',
  ]) assert.ok(sourceExists(path), `${path} must exist`);

  const right = readSource('src/components/HomeRightSidebar.astro');
  const music = readSource('src/components/MusicStatusWidget.astro');
  const moments = readSource('src/components/RecentMomentsWidget.astro');
  assert.match(right, /popular-tags/);
  assert.match(right, /MusicStatusWidget/);
  assert.match(right, /RecentMomentsWidget/);
  assert.match(music, /getElementById\(['"]sekaiPlayerBtn['"]\)/);
  assert.doesNotMatch(music, /new Audio|fetch\(/);
  assert.match(moments, /fetchMoments\(\{\s*limit:\s*3\s*\}\)/);
});
```

Run focused test; expected FAIL on the first missing widget assertion.

- [ ] **Step 2: Create `SidebarWidget.astro`**

```astro
---
interface Props {
  title: string;
  tone?: 'neutral' | 'pink' | 'purple' | 'cyan' | 'warm';
  href?: string;
  hrefLabel?: string;
}
const { title, tone = 'neutral', href, hrefLabel = '查看' } = Astro.props;
---
<section class={`sidebar-widget tone-${tone}`}>
  <header class="sidebar-widget-header">
    <h2>{title}</h2>
    {href && <a href={href}>{hrefLabel}</a>}
  </header>
  <div class="sidebar-widget-body"><slot /></div>
</section>
```

- [ ] **Step 3: Create `HomeLeftSidebar.astro` with identity and content navigation**

Render profile + real counts, then a navigation widget with explicit `精选 / 最新 / 标签` links:

```astro
<SidebarWidget title="内容导航" tone="cyan">
  <nav class="sidebar-shortcuts">
    <a href={featuredHref}>精选</a>
    <a href="#latest-posts-title">最新</a>
    <a href="/tags">标签</a>
    <a href="/posts">归档</a>
  </nav>
</SidebarWidget>
```

Add a compact tag-navigation widget using `tags.slice(0, 5)` so the left side satisfies the existing metadata navigation requirement. Do not invent metrics.

- [ ] **Step 4: Create `RecentMomentsWidget.astro` as a read-only client widget**

```astro
<SidebarWidget title="最近碎碎念" tone="cyan" href="/moments" hrefLabel="更多">
  <div id="home-recent-moments" class="recent-moments-list" aria-live="polite"><p class="widget-muted">正在加载...</p></div>
</SidebarWidget>
```

Client logic:

```ts
import { fetchMoments } from '../lib/moments-api';

async function loadRecentMoments() {
  const root = document.getElementById('home-recent-moments');
  if (!root || root.dataset.loading === 'true') return;
  root.dataset.loading = 'true';
  try {
    const { items } = await fetchMoments({ limit: 3 });
    const nodes = items.map((item) => {
      const link = document.createElement('a');
      link.className = 'recent-moment-item';
      link.href = '/moments';
      const text = document.createElement('span');
      text.textContent = item.text.length > 48 ? `${item.text.slice(0, 48)}…` : item.text;
      const meta = document.createElement('small');
      meta.textContent = `${item.category} · ${item.date}`;
      link.append(text, meta);
      return link;
    });
    root.replaceChildren(...nodes);
  } catch {
    root.innerHTML = '<a class="widget-muted" href="/moments">去碎碎念看看 →</a>';
  } finally {
    root.dataset.loading = 'false';
  }
}

if (!window.__homeMomentsPageLoadBound) {
  window.__homeMomentsPageLoadBound = true;
  document.addEventListener('astro:page-load', loadRecentMoments);
}
loadRecentMoments();
```

- [ ] **Step 5: Create `MusicStatusWidget.astro` without a second player state store**

```astro
<SidebarWidget title="正在播放" tone="purple">
  <button id="home-music-launcher" class="music-status-launcher" type="button">
    <img id="home-music-cover" src="/site-icon-512.png" alt="" />
    <span><strong id="home-music-title">SEKAI Player</strong><small id="home-music-artist">点击打开播放器</small></span>
  </button>
</SidebarWidget>
```

Use a ClientRouter-safe observer lifecycle:

```js
function initMusicWidget() {
  if (window.__homeMusicObservers) window.__homeMusicObservers.forEach(function (observer) { observer.disconnect(); });
  window.__homeMusicObservers = [];
  var launcher = document.getElementById('home-music-launcher');
  if (!launcher || launcher.dataset.initialized === 'true') return;
  launcher.dataset.initialized = 'true';
  launcher.addEventListener('click', function () {
    var player = document.getElementById('sekaiPlayerBtn');
    if (player) player.click();
  });
  ['sekaiTrackTitle', 'sekaiTrackArtist', 'sekaiCover'].forEach(function (id) {
    var target = document.getElementById(id);
    if (!target) return;
    var observer = new MutationObserver(syncMusicWidget);
    observer.observe(target, { childList: true, subtree: true, attributes: true });
    window.__homeMusicObservers.push(observer);
  });
  syncMusicWidget();
}
```

Bind `initMusicWidget` once to `astro:page-load` with a `window.__homeMusicPageLoadBound` guard.

- [ ] **Step 6: Create `HomeRightSidebar.astro` with popular tags plus dynamic widgets**

`HomeRightSidebar` accepts `tags` and renders:

```astro
<aside class="home-right-sidebar" aria-label="站点动态">
  <SidebarWidget title="热门标签" tone="pink" href="/tags" hrefLabel="全部">
    <div class="popular-tags">
      {tags.slice(0, 8).map((tag) => <a href={`/tags/${encodeURIComponent(tag.name)}`}>{tag.name}<span>{tag.count}</span></a>)}
    </div>
  </SidebarWidget>
  <RecentMomentsWidget />
  <MusicStatusWidget />
  <SidebarWidget title="站点小记" tone="warm"><p class="widget-copy">背景、音乐和碎碎念都会慢慢更新。欢迎随便逛逛。</p></SidebarWidget>
  <SidebarWidget title="浏览" tone="neutral"><VisitorCounter /></SidebarWidget>
</aside>
```

If the current tag route is not dynamic, use the repository's actual tag URL convention discovered from `src/pages/tags`; do not invent a route.

- [ ] **Step 7: Compute real tag counts and compose the three-region homepage**

```ts
const tagCounts = new Map<string, number>();
posts.forEach((post) => post.data.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1)));
const tags = [...tagCounts.entries()]
  .map(([name, count]) => ({ name, count }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
```

Compose:

```astro
<div class="home-v2-grid">
  <HomeLeftSidebar postCount={posts.length} tagCount={tags.length} tags={tags} featuredHref={featuredHref} />
  <section class="home-main-column" aria-labelledby="latest-posts-title">...</section>
  <HomeRightSidebar tags={tags} />
</div>
```

Remove the standalone v1 `HomeProfileSidebar` usage and the old footer-level `VisitorCounter` placement.

- [ ] **Step 8: Replace flat v1 tokens with semantic hue layers**

```css
body.layout-standard {
  --blog-banner-height: 50vh;
  --v2-page: oklch(0.17 0.018 285);
  --v2-card: oklch(0.22 0.022 285);
  --v2-card-raised: oklch(0.255 0.026 285);
  --v2-text: oklch(0.93 0.01 285);
  --v2-muted: oklch(0.72 0.025 285);
  --v2-line: rgb(255 255 255 / 0.085);
  --v2-pink: oklch(0.75 0.14 350);
  --v2-purple: oklch(0.72 0.14 305);
  --v2-cyan: oklch(0.76 0.105 205);
  --v2-warm: oklch(0.78 0.12 78);
  --standard-page-bg: var(--v2-page);
  --standard-card-bg: var(--v2-card);
  --standard-card-soft: var(--v2-card-raised);
  --standard-text: var(--v2-text);
  --standard-muted: var(--v2-muted);
  --standard-line: var(--v2-line);
  --standard-accent: var(--v2-pink);
}

[data-theme="light"] body.layout-standard {
  --v2-page: oklch(0.965 0.012 335);
  --v2-card: oklch(0.99 0.008 335);
  --v2-card-raised: oklch(0.945 0.018 335);
  --v2-text: oklch(0.27 0.02 295);
  --v2-muted: oklch(0.53 0.025 295);
  --v2-line: rgb(35 28 45 / 0.09);
}
```

- [ ] **Step 9: Add the required three/two/one-column CSS**

```css
body.layout-standard .standard-content,
body.layout-standard .footer { width: min(calc(100% - 32px), 1340px); }

.home-v2-grid {
  display: grid;
  grid-template-columns: minmax(220px, 240px) minmax(0, 1fr) minmax(260px, 300px);
  gap: 18px;
  align-items: start;
}
.home-left-sidebar,
.home-right-sidebar { display: grid; gap: 16px; position: sticky; top: 82px; }

@media (max-width: 1199px) {
  .home-v2-grid { grid-template-columns: minmax(0, 1fr) 300px; }
  .home-main-column { grid-column: 1; grid-row: 1 / span 2; }
  .home-left-sidebar { grid-column: 2; grid-row: 1; position: static; }
  .home-right-sidebar { grid-column: 2; grid-row: 2; position: static; }
}

@media (max-width: 849px) {
  .home-v2-grid { grid-template-columns: 1fr; }
  .home-left-sidebar, .home-main-column, .home-right-sidebar { grid-column: 1; grid-row: auto; }
  .home-left-sidebar { order: 1; }
  .home-main-column { order: 2; }
  .home-right-sidebar { order: 3; }
}
```

Style `.sidebar-widget` as a compact 12–14px-radius card with a 2px semantic top edge/tint. No full-card glow.

- [ ] **Step 10: Keep HomePostCard dense and restrained**

Preserve date/reading-time/tags/optional cover; keep cover at 28–32% desktop, stack it below 620px, and cap hover movement at `translateY(-2px)`.

- [ ] **Step 11: Verify homepage GREEN**

```bash
npm run build
node --test tests/firefly-ui-refresh.test.mjs tests/site-build.test.mjs
```

- [ ] **Step 12: Commit**

```bash
git add src/components/SidebarWidget.astro src/components/HomeLeftSidebar.astro src/components/HomeRightSidebar.astro src/components/MusicStatusWidget.astro src/components/RecentMomentsWidget.astro src/components/HomePostCard.astro src/pages/index.astro src/styles/firefly-refresh.css tests/firefly-ui-refresh.test.mjs
git commit -m "feat: build Firefly-style homepage grid"
```

---

### Task 5: Redesign the guestbook into a wide composer + message stream

**Files:**
- Modify: `src/pages/messages.astro`
- Modify: `src/styles/firefly-refresh.css`
- Modify: `tests/firefly-ui-refresh.test.mjs`
- Verify: `tests/site-build.test.mjs`

**Interfaces:**
- Preserve IDs: `message-admin`, `message-session-status`, `message-logout`, `message-login`, `message-login-password`, `message-login-submit`, `message-form`, `message-user-id`, `message-text`, `message-status`, `message-submit`, `messages-list`.
- Preserve calls/imports: `createCommentsWidget`, `createGuestMessage`, `deleteGuestMessage`, `fetchGuestMessages`, `getSession`, `login`, `logout`.

- [ ] **Step 1: Add a business-hook preservation test**

```js
test('guestbook v2 preserves existing business hooks', () => {
  const messages = readSource('src/pages/messages.astro');
  for (const id of ['message-admin','message-session-status','message-logout','message-login','message-login-password','message-login-submit','message-form','message-user-id','message-text','message-status','message-submit','messages-list']) {
    assert.match(messages, new RegExp(`id=["']${id}["']`));
  }
  for (const symbol of ['createGuestMessage','deleteGuestMessage','fetchGuestMessages','getSession','login','logout']) {
    assert.match(messages, new RegExp(symbol));
  }
});
```

Run it before edits; expected PASS.

- [ ] **Step 2: Replace presentation wrappers only**

```astro
<section class="messages-shell">
  <div class="messages-layout">
    <aside class="messages-composer-column">
      <div class="messages-composer-card">
        <header class="messages-composer-intro">
          <span class="messages-kicker">GUESTBOOK</span>
          <h2>留下一句话</h2>
          <p>自设一个 ID 就能留言和评论，不需要密钥。</p>
        </header>
        <section class="message-admin" id="message-admin">...</section>
        <form class="message-form" id="message-form">...</form>
      </div>
    </aside>
    <section class="messages-stream-column" aria-labelledby="messages-stream-title">
      <header class="messages-stream-header">
        <div><span class="messages-kicker">MESSAGES</span><h2 id="messages-stream-title">最近留言</h2></div>
        <p id="messages-summary">正在读取留言...</p>
      </header>
      <div class="messages-list" id="messages-list">...</div>
    </section>
  </div>
</section>
```

The `...` above means keep the **existing exact form/admin child markup** in those positions; do not invent new field IDs or alter API payloads.

- [ ] **Step 3: Add message count to `renderMessages`**

```ts
const summary = document.getElementById('messages-summary');
```

At the start of `renderMessages(messages)`:

```ts
if (summary) summary.textContent = messages.length ? `共 ${messages.length} 条留言` : '还没有留言';
```

- [ ] **Step 4: Replace old width CSS with the required layout**

```css
body.layout-standard .messages-shell { width: min(100%, 1220px); margin: 0 auto; }
body.layout-standard .messages-layout {
  display: grid;
  grid-template-columns: minmax(340px, 370px) minmax(0, 1fr);
  gap: 22px;
  align-items: start;
}
body.layout-standard .messages-composer-column { position: sticky; top: 84px; }
body.layout-standard .messages-composer-card,
body.layout-standard .message-card {
  border: 1px solid var(--v2-line);
  background: var(--v2-card);
  box-shadow: 0 10px 28px rgb(0 0 0 / .08);
}
body.layout-standard .messages-composer-card { border-radius: 16px; padding: 20px; }
body.layout-standard .message-card { position: relative; overflow: hidden; border-radius: 16px; padding: 18px 20px 16px; }
body.layout-standard .message-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 2px;
  background: linear-gradient(90deg, var(--v2-pink), var(--v2-purple), var(--v2-cyan));
  opacity: .65;
}
@media (max-width: 849px) {
  body.layout-standard .messages-layout { grid-template-columns: 1fr; }
  body.layout-standard .messages-composer-column { position: static; }
}
```

Remove `.messages-shell { max-width: 760px; }` completely.

- [ ] **Step 5: Verify guestbook layout and business behavior**

```bash
npm run build
node --test tests/firefly-ui-refresh.test.mjs tests/site-build.test.mjs
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/messages.astro src/styles/firefly-refresh.css tests/firefly-ui-refresh.test.mjs
git commit -m "feat: widen and restructure guestbook"
```

---

### Task 6: Harmonize ordinary pages with the v2 card system

**Files:**
- Modify: `src/styles/firefly-refresh.css`
- Modify only when a semantic hook is required: `src/pages/posts/index.astro`, `src/pages/posts/[slug].astro`, `src/pages/tags/index.astro`, `src/pages/search.astro`, `src/pages/moments.astro`
- Modify: `tests/firefly-ui-refresh.test.mjs`
- Verify: `tests/site-build.test.mjs`

**Interfaces:**
- Consumes current page DOM/API hooks.
- Produces consistent primary-card/sidebar-widget/emphasis-card hierarchy scoped to `body.layout-standard`.

- [ ] **Step 1: Add a scope test**

```js
test('v2 card styling stays out of immersive content', () => {
  const css = readSource('src/styles/firefly-refresh.css');
  assert.match(css, /body\.layout-standard/);
  assert.doesNotMatch(css, /body\.layout-immersive\s+\.(?:post-shell|message-card|moment-card|timeline-item)/);
});
```

- [ ] **Step 2: Map ordinary components to the v2 hierarchy**

```css
body.layout-standard .post-shell,
body.layout-standard .archive-shell,
body.layout-standard .message-card {
  background: var(--v2-card);
  border: 1px solid var(--v2-line);
  border-radius: 16px;
}
body.layout-standard .timeline-item,
body.layout-standard .project-card,
body.layout-standard .moment-card {
  background: var(--v2-card);
  border: 1px solid var(--v2-line);
  border-radius: 14px;
}
body.layout-standard .tag,
body.layout-standard .tag-pill,
body.layout-standard .project-pill {
  border-radius: 8px;
  background: color-mix(in oklch, var(--v2-pink) 14%, var(--v2-card));
}
```

Use purple/cyan/warm accents only for music/status/featured/notice semantics; do not recolor every card.

- [ ] **Step 3: Preserve Moments business DOM**

Do not edit `moments.astro` if CSS is sufficient. If a wrapper class is required, change only the wrapper/class and preserve all existing IDs/data attributes used by `tests/site-build.test.mjs`.

- [ ] **Step 4: Run the complete suite**

```bash
npm test
```

Expected: Astro build succeeds and all Node tests pass. If an assertion is stale, confirm current `main` behavior first; update only the stale assertion, not business code.

- [ ] **Step 5: Commit changed files only**

```bash
git add src/styles/firefly-refresh.css tests/firefly-ui-refresh.test.mjs
git add src/pages/posts/index.astro src/pages/posts/'[slug].astro' src/pages/tags/index.astro src/pages/search.astro src/pages/moments.astro 2>/dev/null || true
git commit -m "style: unify standard pages with Firefly v2 shell"
```

Before committing, inspect `git diff --cached --name-only` and unstage page files that did not actually change.

---

### Task 7: Full verification and merge hygiene

**Files:**
- Temporary create/delete: `.github/workflows/verify-firefly-v2.yml`
- Temporary generated/delete: `.ci/firefly-v2-test-result.txt`

**Interfaces:**
- Consumes completed feature branch.
- Produces clean green verification evidence and no temporary files in final diff.

- [ ] **Step 1: Run the full suite locally when dependencies are available**

```bash
npm test
```

Required: Astro check has 0 errors, build succeeds, all Node tests pass.

- [ ] **Step 2: When the execution environment cannot run Astro reliably, add the temporary branch-only GitHub Actions verifier**

```yaml
name: Verify Firefly v2
on:
  push:
    branches: [feat/firefly-ui-refresh-v2]
    paths-ignore:
      - '.ci/firefly-v2-test-result.txt'
permissions:
  contents: write
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - name: Run tests and record result
        shell: bash
        run: |
          set +e
          mkdir -p .ci
          { npm test; code=$?; echo "__EXIT_CODE__=$code"; exit "$code"; } > .ci/firefly-v2-test-result.txt 2>&1
        continue-on-error: true
      - name: Commit result
        shell: bash
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git add .ci/firefly-v2-test-result.txt
          git commit -m 'ci: record Firefly v2 verification' || exit 0
          git push
```

- [ ] **Step 3: Require the recorded result to contain**

```text
__EXIT_CODE__=0
```

Also require zero failed Node tests and zero Astro errors.

- [ ] **Step 4: Remove the temporary workflow/result and commit cleanup**

```bash
git rm .github/workflows/verify-firefly-v2.yml .ci/firefly-v2-test-result.txt
git commit -m "chore: remove Firefly v2 verification artifacts"
```

- [ ] **Step 5: Inspect final scope**

```bash
git diff --check main...HEAD
git diff --name-status main...HEAD
```

Expected permanent scope: shell/floating controls, immersive selector repair, homepage widgets/layout, guestbook presentation, v2 CSS, tests. Not expected: backend/API changes, deployment/domain changes, broad HeroSlideshow/SekaiPlayer rewrites, or design/spec/plan files.

- [ ] **Step 6: Perform visual QA before merge**

Run a real preview (`npm run preview -- --host 0.0.0.0`) in an environment with browser access, or use the repository's existing branch-preview deployment when available. Verify these exact routes and breakpoints:

```text
/          >=1200px, ~1000px, <850px
/messages  desktop two-column, mobile one-column
/posts     standard card hierarchy
/moments   read/publish surfaces still present
/player    Stage 0 nav + SEKAI + background controls visible
```

On `/player`, click the hide-UI control four times and verify Stage 0 -> 1 -> 2 -> 3 -> 0 behavior.

- [ ] **Step 7: Stop before integration unless the user explicitly authorizes merge**

Prefer fast-forward only when `main` has not moved and the implementation branch is strictly ahead.
