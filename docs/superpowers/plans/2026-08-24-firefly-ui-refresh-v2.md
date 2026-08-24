# Firefly UI Refresh v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the blog presentation shell around a Firefly-like responsive grid and hue-layered visual system while preserving the existing background manager, SEKAI player, immersive experience, Moments, guestbook, and public APIs.

**Architecture:** Keep `HeroSlideshow.astro`, `SekaiPlayer.astro`, and API libraries as business-logic owners. `BaseLayout.astro` owns the shared shell; a new `FloatingControls.astro` safely proxies the existing background-settings trigger and hosts theme/back-to-top controls while the existing SEKAI button remains the canonical player entry. Homepage sidebars are view-only widgets, and `/player` gets only selector/state-machine repairs rather than a rewrite.

**Tech Stack:** Astro 6, TypeScript, CSS, Node `node:test`, existing Astro ClientRouter, existing Moments/public-interactions APIs.

**Spec:** `docs/superpowers/specs/2026-08-24-firefly-ui-refresh-v2-design.md` on branch `design/firefly-ui-refresh`.

## Global Constraints

- Public site/domain remains `https://lidure22.xyz`; public API remains `https://api.lidure22.xyz/api`.
- Do not rewrite HeroSlideshow media/cache/poster/loop logic unless a failing regression test proves it is required.
- Do not rewrite SekaiPlayer import/search/filter/playback/visualizer logic unless a failing regression test proves it is required.
- Do not introduce mandatory article categories or migrate existing Markdown frontmatter.
- `/player` must have navigation, player entry, and background settings access by default, with no standard Banner/footer.
- Wide homepage target: 1280–1360px, three regions at >=1200px; two columns at 850–1199px; one column below 850px.
- Guestbook desktop target: 1180–1240px total width, 340–380px sticky composer/admin column plus message stream.
- Keep Project SEKAI identity through selective pink/purple/cyan/warm semantic accents, not global glow/gradient effects.
- Design/spec/plan artifacts stay on the design branch and are not part of the final production merge unless explicitly requested.

---

## File Structure Map

### Shared shell

- `src/layouts/BaseLayout.astro` — mounts persistent business components, shared navigation, Banner/standard shell, and floating utility surface.
- `src/components/SiteHeader.astro` — navigation only; no longer owns the theme toggle.
- `src/components/FloatingControls.astro` — new shell-level utility surface: background proxy, ThemeToggle, back-to-top. It does **not** duplicate the SEKAI player.
- `src/styles/firefly-refresh.css` — replace v1 standard-page tokens/layout/card rules with v2 hue-layered shell and responsive grid rules.
- `src/styles/immersive-nav.css` — new focused immersive navigation/floating-control rules; do not mix page-card styling into it.

### Homepage widgets

- `src/components/SidebarWidget.astro` — reusable semantic widget shell.
- `src/components/HomeLeftSidebar.astro` — identity, real counts, shortcuts, tag/category-like navigation.
- `src/components/HomeRightSidebar.astro` — recent tags, Moments preview, site stats, music launcher/status, announcement.
- `src/components/MusicStatusWidget.astro` — view-only observer of existing SEKAI DOM; clicks existing `#sekaiPlayerBtn`.
- `src/components/RecentMomentsWidget.astro` — client-side read-only consumer of existing `fetchMoments({ limit: 3 })`.
- `src/pages/index.astro` — composes the three-region homepage.
- `src/components/HomePostCard.astro` — denser article metadata and semantic accents, no business logic.

### Guestbook

- `src/pages/messages.astro` — preserve IDs/script/API calls, replace presentation markup wrappers and CSS with desktop two-column layout.

### Immersive state repair

- `src/pages/player.astro` — minimal selector/state-group changes only; no player/danmaku API rewrite.

### Tests

- `tests/firefly-ui-refresh.test.mjs` — extend existing source/built contracts to v2.
- `tests/site-build.test.mjs` — retain business regressions; change only if a stale assertion conflicts with confirmed current behavior.

---

### Task 1: Lock v2 regressions before changing production code

**Files:**
- Modify: `tests/firefly-ui-refresh.test.mjs`
- Test: `tests/firefly-ui-refresh.test.mjs`

**Interfaces:**
- Consumes: current v1 layout/build output.
- Produces: failing contracts for shared floating controls, immersive visibility, three-region homepage, wide guestbook, and obsolete-selector removal.

- [ ] **Step 1: Add failing source/built contracts**

Replace the existing immersive/home assertions with the following v2 contracts while retaining the existing B3 Banner and header-listener tests:

```js
const playerSource = () => readSource('src/pages/player.astro');

 test('shared shell mounts navigation and floating controls for both modes', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /<SiteHeader\s+currentPath=/);
  assert.match(layout, /<FloatingControls\s*\/?>/);
  assert.doesNotMatch(layout, /isStandard\s*\?\s*\([\s\S]*?<SiteHeader/);
});

test('immersive hide state uses current shell selectors', () => {
  const player = playerSource();
  assert.doesNotMatch(player, /querySelector\(['"]\.topbar['"]\)/);
  assert.match(player, /querySelector\(['"]\.site-header['"]\)/);
  assert.match(player, /querySelector\(['"]\.site-floating-controls['"]\)/);
});

test('homepage exposes three semantic regions', () => {
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

- [ ] **Step 2: Run the focused regression test and verify RED**

Run:

```bash
npm run build
node --test tests/firefly-ui-refresh.test.mjs
```

Expected: failures for missing `FloatingControls`, missing three homepage regions, old 760px guestbook, and `.topbar` still present in `player.astro`.

- [ ] **Step 3: Commit only the failing tests**

```bash
git add tests/firefly-ui-refresh.test.mjs
git commit -m "test: define Firefly v2 shell regressions"
```

---

### Task 2: Restore the shared shell and create safe floating controls

**Files:**
- Create: `src/components/FloatingControls.astro`
- Create: `src/styles/immersive-nav.css`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/SiteHeader.astro`
- Modify: `src/styles/firefly-refresh.css`
- Test: `tests/firefly-ui-refresh.test.mjs`

**Interfaces:**
- Consumes: existing `#hero-settings-btn`, `#sekaiPlayerBtn`, and `ThemeToggle.astro` behavior.
- Produces: `.site-floating-controls`, `#floating-background-btn`, `#floating-back-to-top`, shared navigation in both layout modes.

- [ ] **Step 1: Add source contracts for proxy behavior**

Add:

```js
test('floating controls proxy existing background settings instead of reimplementing it', () => {
  const controls = readSource('src/components/FloatingControls.astro');
  assert.match(controls, /id="floating-background-btn"/);
  assert.match(controls, /getElementById\(['"]hero-settings-btn['"]\)/);
  assert.match(controls, /\.click\(\)/);
  assert.match(controls, /<ThemeToggle\s*\/?>/);
  assert.match(controls, /id="floating-back-to-top"/);
  assert.doesNotMatch(controls, /sekaiPlayerPanel|sekaiAudio|fetchMoments/);
});
```

Run `node --test tests/firefly-ui-refresh.test.mjs`; expected FAIL because the component does not exist.

- [ ] **Step 2: Create `FloatingControls.astro` with no duplicated business logic**

Use this structure:

```astro
---
import ThemeToggle from './ThemeToggle.astro';
---

<div class="site-floating-controls" aria-label="站点快捷控制">
  <button id="floating-background-btn" class="site-floating-control is-background" type="button" aria-label="背景设置" title="背景设置">
    <span aria-hidden="true">▣</span>
  </button>
  <ThemeToggle />
  <button id="floating-back-to-top" class="site-floating-control is-top" type="button" aria-label="返回顶部" title="返回顶部">
    <span aria-hidden="true">↑</span>
  </button>
</div>

<script is:inline>
(function () {
  function initFloatingControls() {
    var root = document.querySelector('.site-floating-controls');
    var background = document.getElementById('floating-background-btn');
    var top = document.getElementById('floating-back-to-top');
    var originalBackground = document.getElementById('hero-settings-btn');
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

    window.addEventListener('scroll', syncTopVisibility, { passive: true });
    syncTopVisibility();

    if (originalBackground) document.body.classList.add('floating-controls-ready');
  }

  if (!window.__floatingControlsPageLoadBound) {
    window.__floatingControlsPageLoadBound = true;
    document.addEventListener('astro:page-load', initFloatingControls);
  }
  initFloatingControls();
})();
</script>
```

Important: only hide the original `#hero-settings-btn` after `.floating-controls-ready` is present, so a JS failure leaves the original background trigger usable.

- [ ] **Step 3: Move theme ownership from header to floating controls**

In `SiteHeader.astro`:

```diff
-import ThemeToggle from './ThemeToggle.astro';
...
-        <ThemeToggle />
```

Keep all route links and the existing ClientRouter-safe scroll listener.

- [ ] **Step 4: Render `SiteHeader` and `FloatingControls` outside the standard-only branch**

`BaseLayout.astro` body should use this exact ownership model:

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

Add imports:

```ts
import FloatingControls from '../components/FloatingControls.astro';
import '../styles/immersive-nav.css';
```

Do not render standard footer/Banner in the immersive branch.

- [ ] **Step 5: Add focused shell CSS**

In `firefly-refresh.css`, add standard floating-control positioning and hide the legacy background button only after successful proxy setup:

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
```

Create `immersive-nav.css` with an explicit immersive shell:

```css
body.layout-immersive .site-header {
  position: fixed;
  inset: 0 0 auto;
  z-index: 10020;
  color: #fff;
  background: linear-gradient(to bottom, rgba(7, 8, 18, .46), transparent);
}

body.layout-immersive .site-header-inner {
  width: min(calc(100% - 32px), 1280px);
  min-height: 64px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: 24px;
}

body.layout-immersive .site-floating-controls {
  position: fixed;
  right: 24px;
  bottom: 92px;
  z-index: 10010;
  display: grid;
  gap: 9px;
}
```

Also define immersive `.site-nav-panel`, link, mobile toggle/menu styles so the component is fully styled outside `body.layout-standard`.

- [ ] **Step 6: Verify focused GREEN**

Run:

```bash
npm run build
node --test tests/firefly-ui-refresh.test.mjs
```

Expected: shared-shell/proxy tests PASS. Homepage/guestbook/obsolete-player-selector tests may still fail and are handled by later tasks.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/BaseLayout.astro src/components/SiteHeader.astro src/components/FloatingControls.astro src/styles/firefly-refresh.css src/styles/immersive-nav.css tests/firefly-ui-refresh.test.mjs
git commit -m "feat: restore shared navigation and floating controls"
```

---

### Task 3: Repair immersive hide-state groups without rewriting the player page

**Files:**
- Modify: `src/pages/player.astro`
- Test: `tests/firefly-ui-refresh.test.mjs`

**Interfaces:**
- Consumes: `.site-header`, `.site-floating-controls`, existing `.sekai-player-btn`, `#hero-settings-panel`, danmaku composer, cover, danmaku stage, visualizer canvas.
- Produces: four-stage UI visibility state with current selectors.

- [ ] **Step 1: Add a test for exact stage ownership**

```js
test('immersive hide stages preserve player/background access until stage two', () => {
  const player = readSource('src/pages/player.astro');
  assert.match(player, /stage1:\s*\[\s*document\.querySelector\(['"]\.site-header['"]\)/);
  assert.match(player, /stage2:\s*\[[\s\S]*?document\.querySelector\(['"]\.site-floating-controls['"]\)/);
  assert.match(player, /document\.querySelector\(['"]\.sekai-player-btn['"]\)/);
  assert.match(player, /hideStage === 1[\s\S]*?setOpacity\(t\.stage1, '0'\)[\s\S]*?setOpacity\(t\.stage2, ''\)/);
});
```

Run focused test; expected FAIL with old dynamically-pushed `.topbar` groups.

- [ ] **Step 2: Replace `getTargets()` with explicit current groups**

Use:

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

Remove all `.topbar` references in this hide-state block. Do not alter danmaku fetch/send, visualization math, or player event integrations.

- [ ] **Step 3: Keep the four-state transitions explicit**

Preserve the existing transition body, ensuring Stage 1 hides only Stage 1:

```js
if (hideStage === 0) {
  setOpacity(t.stage1, '');
  setOpacity(t.stage2, '');
  setOpacity(t.stage3, '');
} else if (hideStage === 1) {
  setOpacity(t.stage1, '0');
  setOpacity(t.stage2, '');
  setOpacity(t.stage3, '');
} else if (hideStage === 2) {
  setOpacity(t.stage1, '0');
  setOpacity(t.stage2, '0');
  setOpacity(t.stage3, '');
} else {
  setOpacity(t.stage1, '0');
  setOpacity(t.stage2, '0');
  setOpacity(t.stage3, '0');
}
```

Keep the existing visualizer switcher title/opacity updates around this logic.

- [ ] **Step 4: Run player-specific and site regressions**

```bash
npm run build
node --test tests/firefly-ui-refresh.test.mjs tests/sekai-player-search.test.mjs tests/hero-video-loop.test.mjs
```

Expected: all immersive/shared shell tests PASS; no search/loop regressions.

- [ ] **Step 5: Commit**

```bash
git add src/pages/player.astro tests/firefly-ui-refresh.test.mjs
git commit -m "fix: align immersive hide states with current shell"
```

---

### Task 4: Replace the flat v1 theme with Firefly-like hue layers and a real three-region homepage

**Files:**
- Create: `src/components/SidebarWidget.astro`
- Create: `src/components/HomeLeftSidebar.astro`
- Create: `src/components/HomeRightSidebar.astro`
- Create: `src/components/MusicStatusWidget.astro`
- Create: `src/components/RecentMomentsWidget.astro`
- Modify: `src/components/HomePostCard.astro`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/firefly-refresh.css`
- Test: `tests/firefly-ui-refresh.test.mjs`

**Interfaces:**
- `SidebarWidget.astro` props: `{ title: string; tone?: 'neutral' | 'pink' | 'purple' | 'cyan' | 'warm'; href?: string; hrefLabel?: string }` plus default slot.
- `HomeLeftSidebar.astro` props: `{ postCount: number; tagCount: number; tags: Array<{ name: string; count: number }>; featuredHref: string }`.
- `HomeRightSidebar.astro` receives no business state; child widgets hydrate/read existing client data.
- `MusicStatusWidget.astro` observes `#sekaiTrackTitle`, `#sekaiTrackArtist`, and `#sekaiCover`; clicking its launcher clicks existing `#sekaiPlayerBtn`.
- `RecentMomentsWidget.astro` calls existing `fetchMoments({ limit: 3 })` only.

- [ ] **Step 1: Add tests for v2 widgets and semantic tones**

```js
test('homepage sidebars are view-only consumers of existing services', () => {
  const left = readSource('src/components/HomeLeftSidebar.astro');
  const right = readSource('src/components/HomeRightSidebar.astro');
  const music = readSource('src/components/MusicStatusWidget.astro');
  const moments = readSource('src/components/RecentMomentsWidget.astro');

  assert.match(left, /SidebarWidget/);
  assert.match(right, /MusicStatusWidget/);
  assert.match(right, /RecentMomentsWidget/);
  assert.match(music, /getElementById\(['"]sekaiPlayerBtn['"]\)/);
  assert.match(moments, /fetchMoments\(\{\s*limit:\s*3\s*\}\)/);
  assert.doesNotMatch(music, /new Audio|fetch\(/);
});
```

Run focused test; expected FAIL because widgets do not exist.

- [ ] **Step 2: Create reusable `SidebarWidget.astro`**

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

No JS and no API ownership in this component.

- [ ] **Step 3: Build `HomeLeftSidebar.astro` from real metadata only**

Render:

```astro
<aside class="home-left-sidebar" aria-label="站点信息">
  <SidebarWidget title="搁浅" tone="pink">
    <img class="sidebar-profile-avatar" src="/p0-256.webp" alt="搁浅" />
    <p class="sidebar-profile-intro">记录游戏、音乐、项目与日常。</p>
    <dl class="sidebar-profile-stats">
      <div><dt>文章</dt><dd>{postCount}</dd></div>
      <div><dt>标签</dt><dd>{tagCount}</dd></div>
    </dl>
  </SidebarWidget>

  <SidebarWidget title="快速入口" tone="cyan">
    <nav class="sidebar-shortcuts">
      <a href="/posts">文章归档</a>
      <a href="/moments">碎碎念</a>
      <a href="/messages">留言板</a>
      <a href={featuredHref}>精选文章</a>
    </nav>
  </SidebarWidget>

  <SidebarWidget title="常用标签" tone="purple" href="/tags" hrefLabel="全部">
    <div class="sidebar-tag-cloud">
      {tags.slice(0, 8).map((tag) => <a href={`/tags/${encodeURIComponent(tag.name)}`}>{tag.name}<span>{tag.count}</span></a>)}
    </div>
  </SidebarWidget>
</aside>
```

Do not add fake runtime/deployment stats.

- [ ] **Step 4: Create read-only `RecentMomentsWidget.astro`**

Markup IDs/classes:

```astro
<SidebarWidget title="最近碎碎念" tone="cyan" href="/moments" hrefLabel="更多">
  <div id="home-recent-moments" class="recent-moments-list" aria-live="polite">
    <p class="widget-muted">正在加载...</p>
  </div>
</SidebarWidget>
```

Client script:

```ts
import { fetchMoments } from '../lib/moments-api';

async function loadRecentMoments() {
  const root = document.getElementById('home-recent-moments');
  if (!root) return;
  try {
    const { items } = await fetchMoments({ limit: 3 });
    root.replaceChildren(...items.map((item) => {
      const link = document.createElement('a');
      link.className = 'recent-moment-item';
      link.href = '/moments';
      const text = document.createElement('span');
      text.textContent = item.text.length > 48 ? `${item.text.slice(0, 48)}…` : item.text;
      const meta = document.createElement('small');
      meta.textContent = `${item.category} · ${item.date}`;
      link.append(text, meta);
      return link;
    }));
  } catch {
    root.innerHTML = '<a class="widget-muted" href="/moments">去碎碎念看看 →</a>';
  }
}

document.addEventListener('astro:page-load', loadRecentMoments);
loadRecentMoments();
```

No write/auth functions are imported.

- [ ] **Step 5: Create view-only `MusicStatusWidget.astro`**

Use DOM observation rather than a second player state store:

```astro
<SidebarWidget title="正在播放" tone="purple">
  <button id="home-music-launcher" class="music-status-launcher" type="button">
    <img id="home-music-cover" src="/site-icon-512.png" alt="" />
    <span><strong id="home-music-title">SEKAI Player</strong><small id="home-music-artist">点击打开播放器</small></span>
  </button>
</SidebarWidget>

<script is:inline>
(function () {
  function syncMusicWidget() {
    var titleSource = document.getElementById('sekaiTrackTitle');
    var artistSource = document.getElementById('sekaiTrackArtist');
    var coverSource = document.getElementById('sekaiCover');
    var title = document.getElementById('home-music-title');
    var artist = document.getElementById('home-music-artist');
    var cover = document.getElementById('home-music-cover');
    if (title && titleSource) title.textContent = titleSource.textContent || 'SEKAI Player';
    if (artist && artistSource) artist.textContent = artistSource.textContent || 'Project SEKAI';
    if (cover && coverSource && coverSource.getAttribute('src')) cover.src = coverSource.getAttribute('src');
  }

  function initMusicWidget() {
    var launcher = document.getElementById('home-music-launcher');
    if (!launcher || launcher.dataset.initialized === 'true') return;
    launcher.dataset.initialized = 'true';
    launcher.addEventListener('click', function () {
      var player = document.getElementById('sekaiPlayerBtn');
      if (player) player.click();
    });
    ['sekaiTrackTitle', 'sekaiTrackArtist', 'sekaiCover'].forEach(function (id) {
      var target = document.getElementById(id);
      if (target) new MutationObserver(syncMusicWidget).observe(target, { childList: true, subtree: true, attributes: true });
    });
    syncMusicWidget();
  }
  document.addEventListener('astro:page-load', initMusicWidget);
  initMusicWidget();
})();
</script>
```

- [ ] **Step 6: Compose `HomeRightSidebar.astro`**

Use:

```astro
<aside class="home-right-sidebar" aria-label="站点动态">
  <RecentMomentsWidget />
  <MusicStatusWidget />
  <SidebarWidget title="站点小记" tone="warm">
    <p class="widget-copy">背景、音乐和碎碎念都会慢慢更新。欢迎随便逛逛。</p>
  </SidebarWidget>
  <SidebarWidget title="浏览" tone="neutral">
    <VisitorCounter />
  </SidebarWidget>
</aside>
```

Import and reuse `VisitorCounter.astro`; do not duplicate Busuanzi logic.

- [ ] **Step 7: Rewrite homepage composition and compute tag counts**

In `index.astro`:

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
  <HomeRightSidebar />
</div>
```

Remove the standalone old profile sidebar and old `home-footer-stats` visitor-counter placement.

- [ ] **Step 8: Replace flat theme tokens with semantic hue layers**

At the top of `firefly-refresh.css`, replace the v1 neutral-only tokens with:

```css
body.layout-standard {
  --blog-banner-height: 50vh;
  --hue-pink: 338;
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

Map existing standard aliases (`--standard-page-bg`, `--standard-card-bg`, etc.) to the v2 variables during migration so ordinary pages do not break:

```css
body.layout-standard {
  --standard-page-bg: var(--v2-page);
  --standard-card-bg: var(--v2-card);
  --standard-card-soft: var(--v2-card-raised);
  --standard-text: var(--v2-text);
  --standard-muted: var(--v2-muted);
  --standard-line: var(--v2-line);
  --standard-accent: var(--v2-pink);
}
```

- [ ] **Step 9: Add responsive three/two/one-column CSS**

```css
body.layout-standard .standard-content,
body.layout-standard .footer {
  width: min(calc(100% - 32px), 1340px);
}

.home-v2-grid {
  display: grid;
  grid-template-columns: minmax(220px, 240px) minmax(0, 1fr) minmax(260px, 300px);
  gap: 18px;
  align-items: start;
}

.home-left-sidebar,
.home-right-sidebar {
  display: grid;
  gap: 16px;
}

.home-left-sidebar { position: sticky; top: 82px; }
.home-right-sidebar { position: sticky; top: 82px; }

@media (max-width: 1199px) {
  .home-v2-grid { grid-template-columns: minmax(0, 1fr) 300px; }
  .home-left-sidebar { grid-column: 2; grid-row: 1; position: static; }
  .home-main-column { grid-column: 1; grid-row: 1 / span 2; }
  .home-right-sidebar { grid-column: 2; grid-row: 2; position: static; }
}

@media (max-width: 849px) {
  .home-v2-grid { grid-template-columns: 1fr; }
  .home-left-sidebar,
  .home-main-column,
  .home-right-sidebar { grid-column: 1; grid-row: auto; }
  .home-left-sidebar { order: 1; }
  .home-main-column { order: 2; }
  .home-right-sidebar { order: 3; }
}
```

Add `.sidebar-widget` and `.tone-*` styles with subtle 2px top accent or icon tint, not full-card gradients.

- [ ] **Step 10: Make article cards denser, not larger**

Keep existing `HomePostCard` DOM contract but ensure metadata has date + reading time + tags, optional cover is 28–32% width, card radius ~16px, and hover translation is at most `-2px`. Do not add new API/state logic.

- [ ] **Step 11: Verify homepage GREEN**

```bash
npm run build
node --test tests/firefly-ui-refresh.test.mjs tests/site-build.test.mjs
```

Expected: homepage/widget tests PASS and existing site behavior tests stay green.

- [ ] **Step 12: Commit**

```bash
git add src/components/SidebarWidget.astro src/components/HomeLeftSidebar.astro src/components/HomeRightSidebar.astro src/components/MusicStatusWidget.astro src/components/RecentMomentsWidget.astro src/components/HomePostCard.astro src/pages/index.astro src/styles/firefly-refresh.css tests/firefly-ui-refresh.test.mjs
git commit -m "feat: build Firefly-style homepage grid and widgets"
```

---

### Task 5: Redesign the guestbook as a wide desktop composer + message stream

**Files:**
- Modify: `src/pages/messages.astro`
- Modify: `src/styles/firefly-refresh.css`
- Test: `tests/firefly-ui-refresh.test.mjs`
- Test: `tests/site-build.test.mjs`

**Interfaces:**
- Preserve IDs: `message-admin`, `message-session-status`, `message-logout`, `message-login`, `message-login-password`, `message-login-submit`, `message-form`, `message-user-id`, `message-text`, `message-status`, `message-submit`, `messages-list`.
- Preserve imports/calls: `createCommentsWidget`, `createGuestMessage`, `deleteGuestMessage`, `fetchGuestMessages`, `getSession`, `login`, `logout`.

- [ ] **Step 1: Add a preservation contract before markup changes**

```js
test('guestbook v2 keeps all business hooks while changing layout only', () => {
  const messages = readSource('src/pages/messages.astro');
  for (const id of [
    'message-admin', 'message-session-status', 'message-logout', 'message-login',
    'message-login-password', 'message-login-submit', 'message-form',
    'message-user-id', 'message-text', 'message-status', 'message-submit', 'messages-list'
  ]) assert.match(messages, new RegExp(`id=["']${id}["']`));
  for (const call of ['createGuestMessage', 'deleteGuestMessage', 'fetchGuestMessages', 'getSession', 'login', 'logout']) {
    assert.match(messages, new RegExp(call));
  }
});
```

Run focused test; it should PASS before the visual rewrite, proving the contract is meaningful.

- [ ] **Step 2: Replace only the guestbook presentation wrappers**

Use:

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

Keep the existing form fields/buttons unchanged inside the wrappers.

- [ ] **Step 3: Update `renderMessages()` to expose count without changing API behavior**

Add:

```ts
const summary = document.getElementById('messages-summary');
```

At the start of `renderMessages(messages)`:

```ts
if (summary) summary.textContent = messages.length ? `共 ${messages.length} 条留言` : '还没有留言';
```

Do not change fetch/delete/create semantics.

- [ ] **Step 4: Replace the old 760px CSS with responsive two-column layout**

```css
body.layout-standard .messages-shell {
  width: min(100%, 1220px);
  margin: 0 auto;
}

body.layout-standard .messages-layout {
  display: grid;
  grid-template-columns: minmax(340px, 370px) minmax(0, 1fr);
  gap: 22px;
  align-items: start;
}

body.layout-standard .messages-composer-column {
  position: sticky;
  top: 84px;
}

body.layout-standard .messages-composer-card,
body.layout-standard .message-card {
  border: 1px solid var(--v2-line);
  background: var(--v2-card);
  box-shadow: 0 10px 28px rgb(0 0 0 / .08);
}

body.layout-standard .messages-composer-card {
  border-radius: 16px;
  padding: 20px;
}

body.layout-standard .messages-list {
  display: grid;
  gap: 14px;
}

body.layout-standard .message-card {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  padding: 18px 20px 16px;
}

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

Remove the old `.messages-shell { max-width: 760px; }` rule completely.

- [ ] **Step 5: Verify guestbook business + layout GREEN**

```bash
npm run build
node --test tests/firefly-ui-refresh.test.mjs tests/site-build.test.mjs
```

Expected: wide-layout contract PASS; guestbook admin/delete regressions PASS.

- [ ] **Step 6: Commit**

```bash
git add src/pages/messages.astro src/styles/firefly-refresh.css tests/firefly-ui-refresh.test.mjs tests/site-build.test.mjs
git commit -m "feat: widen and restructure guestbook"
```

---

### Task 6: Harmonize ordinary pages with the v2 shell without expanding scope

**Files:**
- Modify: `src/styles/firefly-refresh.css`
- Modify only if markup requires semantic hooks: `src/pages/posts/index.astro`, `src/pages/posts/[slug].astro`, `src/pages/tags/index.astro`, `src/pages/search.astro`, `src/pages/moments.astro`
- Test: `tests/firefly-ui-refresh.test.mjs`
- Test: `tests/site-build.test.mjs`

**Interfaces:**
- Consumes existing page markup and APIs.
- Produces consistent card/page spacing, semantic accent classes, and no layout regressions.

- [ ] **Step 1: Add a CSS scope regression**

```js
test('v2 page styling remains scoped away from immersive content cards', () => {
  const css = readSource('src/styles/firefly-refresh.css');
  assert.match(css, /body\.layout-standard/);
  assert.doesNotMatch(css, /body\.layout-immersive\s+\.(?:card|post-shell|message-card|moment-card)/);
});
```

- [ ] **Step 2: Map ordinary cards to the three-level hierarchy**

Use scoped selectors only:

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

Do not restore global blur/glow.

- [ ] **Step 3: Keep Moments business DOM intact and only tune density**

Do not edit `moments.astro` unless CSS cannot reach a needed wrapper. If markup edits are required, preserve all IDs/data attributes checked by `tests/site-build.test.mjs` (`data-moments-api`, publish form IDs, upload/media hooks, auth/delete hooks).

- [ ] **Step 4: Run complete source/build regressions**

```bash
npm test
```

Expected: PASS. If a stale assertion fails, inspect `main` behavior and update the assertion only when the current production contract is confirmed; never change business code merely to satisfy a stale test.

- [ ] **Step 5: Commit**

```bash
git add src/styles/firefly-refresh.css src/pages/posts/index.astro src/pages/posts/'[slug].astro' src/pages/tags/index.astro src/pages/search.astro src/pages/moments.astro tests/firefly-ui-refresh.test.mjs tests/site-build.test.mjs
git commit -m "style: unify standard pages with Firefly v2 shell"
```

Only add files that actually changed.

---

### Task 7: Final regression verification, temporary CI, and merge hygiene

**Files:**
- Temporary create/delete: `.github/workflows/verify-firefly-v2.yml`
- Temporary generated/delete: `.ci/firefly-v2-test-result.txt`
- No permanent production changes unless verification exposes a real bug.

**Interfaces:**
- Consumes completed implementation branch.
- Produces evidence that the full suite passes in a clean GitHub runner and a final diff with no CI artifacts.

- [ ] **Step 1: Run local/source checks available in the execution environment**

```bash
npm test
```

Expected:
- Astro check: 0 errors;
- Astro build succeeds;
- all Node tests pass.

- [ ] **Step 2: Add a temporary branch-only verification workflow if the execution container cannot install/run Astro reliably**

Use the already-proven write-back pattern:

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
      - name: Run tests and record exit code
        shell: bash
        run: |
          set +e
          mkdir -p .ci
          { npm test; code=$?; echo "__EXIT_CODE__=$code"; exit "$code"; } > .ci/firefly-v2-test-result.txt 2>&1
        continue-on-error: true
      - name: Commit result
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
          git add .ci/firefly-v2-test-result.txt
          git commit -m 'ci: record Firefly v2 verification' || exit 0
          git push
```

- [ ] **Step 3: Read the recorded result and require exit code zero**

Required result marker:

```text
__EXIT_CODE__=0
```

Also verify the summary reports zero failed Node tests and Astro has zero errors.

- [ ] **Step 4: Delete temporary verification files**

Delete:

```text
.github/workflows/verify-firefly-v2.yml
.ci/firefly-v2-test-result.txt
```

Commit cleanup:

```bash
git add -A
git commit -m "chore: remove Firefly v2 verification artifacts"
```

- [ ] **Step 5: Inspect final diff against `main`**

Verify:

```bash
git diff --check main...HEAD
git diff --name-status main...HEAD
```

Expected permanent scope:
- shared shell/floating control files;
- v2 homepage widgets/layout;
- guestbook presentation;
- minimal `player.astro` selector repair;
- v2 CSS;
- tests.

Not expected:
- changes to danmaku API/backend;
- broad changes inside `HeroSlideshow.astro`;
- broad changes inside `SekaiPlayer.astro`;
- deployment/domain changes;
- design/spec/plan files in the production merge.

- [ ] **Step 6: Review the live/preview UI before merge**

Manually verify at minimum:

```text
/                  desktop >= 1200px, medium ~1000px, mobile < 850px
/messages          desktop two-column + mobile one-column
/posts             standard card hierarchy
/moments           existing publish/read interactions still present
/player            nav + SEKAI button + background button visible at Stage 0
```

For `/player`, exercise all four hide stages and verify the next click restores Stage 0.

- [ ] **Step 7: Do not merge until all verification gates are green**

Merge only after the user explicitly authorizes integration. Prefer fast-forward when `main` has not moved and the feature branch is strictly ahead.
