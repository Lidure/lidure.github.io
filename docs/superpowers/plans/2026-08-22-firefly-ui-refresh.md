# Firefly UI Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将普通博客页面改造成 B3 视频 Banner + Firefly 式内容布局，同时保留现有背景轮播、音乐播放器、碎碎念业务和 `/player` 全屏沉浸体验。

**Architecture:** 不重写 `HeroSlideshow.astro` 的媒体加载、海报和循环逻辑，而是在 `BaseLayout.astro` 增加 `standard | immersive` 两种布局模式，并用一层新的 `firefly-refresh.css` 只覆盖 `body.layout-standard`。首页拆成独立 Banner、文章卡和个人侧栏组件；普通文章、归档、标签、搜索、留言和碎碎念继续沿用原业务 DOM，但继承新的普通页设计 token 和壳层样式。`/player` 显式使用 immersive 模式，保持全屏背景和原交互。

**Tech Stack:** Astro 6, TypeScript, CSS, Node.js built-in test runner, existing Astro ClientRouter, existing `HeroSlideshow`, `SekaiPlayer`, `ThemeToggle`.

**Spec:** `docs/superpowers/specs/2026-08-22-firefly-ui-refresh-design.md`

## Global Constraints

- 不迁移或复制 Firefly 主题源码，只借鉴信息层级与视觉秩序。
- 普通页桌面 Banner 约 50vh，移动端目标 36vh（允许 34–38vh 范围）。
- 普通页主内容宽度约 1100–1180px，首页桌面双栏约 70/30，移动端单栏。
- 普通页卡片接近实色、14–16px 圆角、极淡边框、无彩色 glow；毛玻璃仅用于滚动后的 navbar、弹层和必要控制面板。
- 普通页动画以 150–250ms 的颜色、透明度和约 1px 位移为主，不新增持续漂浮/呼吸发光。
- `/player` 保留 100vh 全屏视频背景和现有沉浸交互，不套普通 Banner/实色内容背景。
- 不引入新的运行时依赖。
- 不改写 `HeroSlideshow` 已有的视频循环守卫、poster、上传/设置逻辑；相关现有测试必须继续通过。
- 所有写入在独立实现分支完成；每个任务独立验证后再提交。

---

## File Structure

### New files

- `src/components/SiteHeader.astro` — 普通页 sticky navbar、移动导航、当前路由高亮，复用 `ThemeToggle`。
- `src/components/BlogBanner.astro` — 普通页 Banner 文案层，只负责标题/副标题，不负责媒体播放。
- `src/components/HomeProfileSidebar.astro` — 首页个人资料、统计、快捷入口和标签摘要。
- `src/components/HomePostCard.astro` — 首页 Firefly 式文章卡，支持可选封面。
- `src/styles/firefly-refresh.css` — 仅作用于 `body.layout-standard` 的新视觉层；避免直接重写沉浸页样式。
- `tests/firefly-ui-refresh.test.mjs` — 布局模式、Banner、首页结构和沉浸隔离的源码/构建契约测试。

### Modified files

- `src/layouts/BaseLayout.astro` — 新增布局模式、普通页 Banner/Header 壳、body class；继续挂载背景、粒子和播放器。
- `src/components/HeroSlideshow.astro` — 只增加 standard/immersive 的呈现尺寸 CSS；媒体逻辑不改。
- `src/components/ThemeToggle.astro` — 收敛普通页按钮视觉，不改主题状态逻辑。
- `src/content.config.ts` — 新增可选 `cover` 字段，现有文章无需迁移。
- `src/pages/index.astro` — 移除 landing-page Hero/quick-link 卡片，改成文章主栏 + 个人侧栏。
- `src/pages/player.astro` — 显式传入 `layoutMode="immersive"`。
- `src/pages/posts/[slug].astro` — Banner 使用文章标题，正文去掉重复 kicker/H1。
- `src/pages/posts/index.astro` — Banner 使用“文章”，保留时间线/GitHub 项目业务。
- `src/pages/tags/index.astro` — Banner 使用“标签”，删除重复 kicker/H1。
- `src/pages/search.astro` — Banner 使用“搜索”，删除重复 kicker/H1。
- `src/pages/messages.astro` — Banner 使用“留言板”，去掉页面内部 AI 风 hero 壳；保留留言业务逻辑。
- `src/pages/moments.astro` — Banner 使用“碎碎念”，删除内部漂浮 bubble hero；保留统计、发布、筛选与时间线业务。
- `package.json` — 将新 UI 契约测试加入 `test:site`。

---

### Task 1: Lock the standard/immersive layout contract

**Files:**
- Create: `tests/firefly-ui-refresh.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces test expectations for `layoutMode`, `layout-standard`, `layout-immersive`, Banner height variables, `/player` isolation, and homepage component boundaries.

- [ ] **Step 1: Write the failing layout contract tests**

Create `tests/firefly-ui-refresh.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const readBuilt = (path) =>
  readFileSync(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('BaseLayout exposes standard and immersive page modes', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /layoutMode\s*=\s*'standard'/);
  assert.match(layout, /layout-\$\{layoutMode\}/);
  assert.match(layout, /<BlogBanner/);
  assert.match(layout, /<SiteHeader/);
});

test('player explicitly opts into immersive layout', () => {
  const player = readSource('src/pages/player.astro');
  assert.match(player, /layoutMode="immersive"/);
});

test('standard banner keeps B3 desktop and mobile heights', () => {
  const css = readSource('src/styles/firefly-refresh.css');
  assert.match(css, /--blog-banner-height:\s*50vh/);
  assert.match(css, /--blog-banner-height:\s*36vh/);
  assert.match(css, /body\.layout-standard/);
  assert.doesNotMatch(css, /body\.layout-immersive\s+\.post-card/);
});

test('home uses dedicated profile and post-card components', () => {
  const home = readSource('src/pages/index.astro');
  assert.match(home, /HomeProfileSidebar/);
  assert.match(home, /HomePostCard/);
  assert.doesNotMatch(home, /Sweet Blog Corner|floating-shape-a|class="link-grid"/);
});

test('built immersive page has no standard banner shell', () => {
  const html = readBuilt('player/index.html');
  assert.match(html, /layout-immersive/);
  assert.doesNotMatch(html, /class="blog-banner"/);
});
```

- [ ] **Step 2: Add the new test file to the site test script**

Change `package.json`:

```json
"test:site": "node --test tests/site-build.test.mjs tests/sekai-player-search.test.mjs tests/hero-video-loop.test.mjs tests/firefly-ui-refresh.test.mjs"
```

- [ ] **Step 3: Run the focused test and confirm it fails before implementation**

Run:

```bash
node --test tests/firefly-ui-refresh.test.mjs
```

Expected: failures for missing `layoutMode`, `firefly-refresh.css`, `HomeProfileSidebar`, and `HomePostCard`.

- [ ] **Step 4: Commit the test contract**

```bash
git add tests/firefly-ui-refresh.test.mjs package.json
git commit -m "test: define Firefly UI refresh contracts"
```

---

### Task 2: Add the standard page shell and navigation

**Files:**
- Create: `src/components/SiteHeader.astro`
- Create: `src/components/BlogBanner.astro`
- Create: `src/styles/firefly-refresh.css`
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- `BaseLayout` consumes `layoutMode?: 'standard' | 'immersive'`, `bannerTitle?: string`, `bannerSubtitle?: string`.
- `SiteHeader` consumes `currentPath: string`.
- `BlogBanner` consumes `title: string`, `subtitle?: string`.
- `body.layout-standard` is the selector boundary for all ordinary-page visual overrides.

- [ ] **Step 1: Extend BaseLayout props with explicit layout mode**

Use this frontmatter shape in `BaseLayout.astro`:

```astro
---
interface Props {
  title?: string;
  description?: string;
  showTime?: boolean;
  layoutMode?: 'standard' | 'immersive';
  bannerTitle?: string;
  bannerSubtitle?: string;
}

const {
  title = '搁浅 的小窝',
  description = '一个使用 Astro 和 GitHub Pages 搭建的个人博客。',
  showTime = false,
  layoutMode = 'standard',
  bannerTitle = '搁浅的小窝',
  bannerSubtitle = '把喜欢的东西，认真地收进小站里。',
} = Astro.props;

const isStandard = layoutMode === 'standard';
---
```

Preserve all existing SEO, theme bootstrap, media cleanup, Busuanzi, `HeroSlideshow`, `SekaiParticles`, `SekaiPlayer`, ClientRouter and loop-guard code.

- [ ] **Step 2: Create BlogBanner**

Create `src/components/BlogBanner.astro`:

```astro
---
interface Props {
  title: string;
  subtitle?: string;
}
const { title, subtitle } = Astro.props;
---
<section class="blog-banner" aria-labelledby="blog-banner-title">
  <div class="blog-banner-copy">
    <h1 id="blog-banner-title">{title}</h1>
    {subtitle && <p>{subtitle}</p>}
  </div>
</section>
```

- [ ] **Step 3: Create SiteHeader with all existing routes still reachable**

Create `src/components/SiteHeader.astro` with these primary links:

```ts
const primaryLinks = [
  { href: '/', label: '首页' },
  { href: '/posts', label: '文章' },
  { href: '/moments', label: '碎碎念' },
  { href: '/messages', label: '留言' },
];
```

Keep `/tags`, `/search`, `/player`, `/sekai-quest` in the right-side utility area. Reuse `<ThemeToggle />`. Mark current primary link using:

```ts
const isActive = (href: string) =>
  href === '/' ? currentPath === '/' : currentPath.startsWith(href);
```

Mobile behavior: a single `button.site-nav-toggle` toggles `data-open="true"` on `.site-nav-panel`; bind on `astro:page-load` with an element dataset guard, and close the panel after a navigation link is clicked.

- [ ] **Step 4: Wire the shell in BaseLayout**

Render the body as:

```astro
<body class={`layout-${layoutMode}`}>
  <HeroSlideshow />
  <SekaiParticles />
  <SekaiPlayer />

  {isStandard ? (
    <>
      <SiteHeader currentPath={Astro.url.pathname} />
      <BlogBanner title={bannerTitle} subtitle={bannerSubtitle} />
      <div class="standard-page-surface">
        <main class="content-area standard-content">
          {showTime && <div class="clock-row"><ClockDisplay /></div>}
          <slot />
        </main>
        <footer class="footer">
          <div class="footer-inner"><p>Built with Astro and GitHub Pages.</p></div>
        </footer>
      </div>
    </>
  ) : (
    <main class="immersive-content"><slot /></main>
  )}
</body>
```

Do not render the old `.site-shell > .topbar` markup.

- [ ] **Step 5: Add the base B3 CSS shell**

Create `src/styles/firefly-refresh.css` and import it **after** `global.css` in `BaseLayout.astro`.

Start with exact standard tokens:

```css
body.layout-standard {
  --blog-banner-height: 50vh;
  --standard-page-bg: #15151a;
  --standard-card-bg: #1d1d23;
  --standard-text: #eeeeF2;
  --standard-muted: #9b9ba5;
  --standard-line: rgba(255,255,255,.08);
  --standard-accent: #ef709b;
  background: var(--standard-page-bg);
  color: var(--standard-text);
}

[data-theme="light"] body.layout-standard {
  --standard-page-bg: #f6f6f8;
  --standard-card-bg: #ffffff;
  --standard-text: #25252a;
  --standard-muted: #6f7078;
  --standard-line: rgba(25,25,30,.08);
  --standard-accent: #d95f8b;
}

.blog-banner {
  position: relative;
  z-index: 2;
  height: var(--blog-banner-height);
  min-height: 320px;
  display: grid;
  place-items: center;
  padding: 72px 24px 48px;
  color: #fff;
  text-align: center;
}

.blog-banner-copy h1 {
  margin: 0;
  font: 700 clamp(2.35rem, 5vw, 3rem)/1.12 'Noto Sans SC', sans-serif;
  text-shadow: 0 2px 18px rgba(0,0,0,.38);
}

.blog-banner-copy p {
  margin: 12px 0 0;
  color: rgba(255,255,255,.84);
  font-size: .98rem;
  text-shadow: 0 1px 10px rgba(0,0,0,.35);
}

.standard-page-surface {
  position: relative;
  z-index: 3;
  width: 100%;
  min-height: 55vh;
  margin-top: -28px;
  padding: 0 16px 48px;
  background: var(--standard-page-bg);
  border-radius: 22px 22px 0 0;
}

.standard-content {
  width: min(100%, 1160px);
  margin: 0 auto;
  padding: 30px 0 0;
}

@media (max-width: 720px) {
  body.layout-standard { --blog-banner-height: 36vh; }
  .blog-banner { min-height: 260px; padding-top: 64px; }
  .standard-page-surface { margin-top: -24px; border-radius: 18px 18px 0 0; }
  .standard-content { padding-top: 24px; }
}
```

- [ ] **Step 6: Run the focused test**

```bash
node --test tests/firefly-ui-refresh.test.mjs
```

Expected: layout mode and B3 tests now pass; homepage-component assertions still fail.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/BaseLayout.astro src/components/SiteHeader.astro src/components/BlogBanner.astro src/styles/firefly-refresh.css
git commit -m "feat: add standard and immersive blog shells"
```

---

### Task 3: Preserve HeroSlideshow behavior while changing only its presentation

**Files:**
- Modify: `src/components/HeroSlideshow.astro`
- Modify: `src/components/ThemeToggle.astro`
- Test: existing `tests/hero-video-loop.test.mjs`, `tests/site-build.test.mjs`

**Interfaces:**
- `HeroSlideshow` remains a persistent global component with the same IDs and settings storage.
- Layout mode is read only through ancestor/body CSS classes; no media API or JS signature changes.

- [ ] **Step 1: Add mode-aware slideshow container CSS without touching the script**

Replace only the slideshow container positioning rules with:

```css
.hero-slideshow {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
}

:global(body.layout-standard) .hero-slideshow {
  position: absolute;
  inset: 0 0 auto;
  height: var(--blog-banner-height, 50vh);
}

:global(body.layout-immersive) .hero-slideshow {
  position: fixed;
  inset: 0;
  height: 100vh;
}
```

Keep `.slideshow-layer`, `.slideshow-canvas`, hidden native video, poster placeholder, overlay, settings panel and all media JS unchanged.

- [ ] **Step 2: Make standard overlay darker but simpler**

Use:

```css
:global(body.layout-standard) .slideshow-overlay {
  background: rgba(0, 0, 0, .26);
}
```

Do not add new radial gradients or glows.

- [ ] **Step 3: Restyle ThemeToggle only in standard pages**

Append to `ThemeToggle.astro` styles:

```css
:global(body.layout-standard) .theme-toggle {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  border-color: transparent;
  background: transparent;
  color: inherit;
  box-shadow: none;
}

:global(body.layout-standard) .theme-toggle:hover {
  transform: translateY(-1px);
  border-color: var(--standard-line);
  background: rgba(255,255,255,.08);
  box-shadow: none;
}
```

Do not change the theme persistence/client-router script.

- [ ] **Step 4: Run existing hero regressions**

```bash
node --test tests/hero-video-loop.test.mjs
```

Expected: PASS.

Then:

```bash
npm run build
node --test tests/site-build.test.mjs
```

Expected: PASS, including persistent background-media assertions.

- [ ] **Step 5: Commit**

```bash
git add src/components/HeroSlideshow.astro src/components/ThemeToggle.astro
git commit -m "style: adapt persistent background to banner layout"
```

---

### Task 4: Rebuild the homepage around content, not landing-page cards

**Files:**
- Create: `src/components/HomeProfileSidebar.astro`
- Create: `src/components/HomePostCard.astro`
- Modify: `src/content.config.ts`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/firefly-refresh.css`

**Interfaces:**
- `HomeProfileSidebar` props: `postCount: number`, `tagCount: number`, `featuredHref: string`.
- `HomePostCard` prop: `post: CollectionEntry<'blog'>`.
- Blog schema adds `cover?: string` only; all existing Markdown remains valid.

- [ ] **Step 1: Add optional cover support**

In `src/content.config.ts` add:

```ts
cover: z.string().optional(),
```

No existing post frontmatter changes are required.

- [ ] **Step 2: Create HomePostCard**

Use this structure:

```astro
---
import type { CollectionEntry } from 'astro:content';
interface Props { post: CollectionEntry<'blog'>; }
const { post } = Astro.props;
const href = `/posts/${post.id.replace(/\.md$/, '')}`;
const minutes = Math.max(1, Math.ceil((post.body ?? '').length / 800));
---
<article class:list={['home-post-card', { 'has-cover': !!post.data.cover }]}>
  <div class="home-post-copy">
    <div class="home-post-meta">
      <time datetime={post.data.pubDate.toISOString()}>{post.data.pubDate.toLocaleDateString('zh-CN')}</time>
      <span>{minutes} 分钟阅读</span>
    </div>
    <h2><a href={href}>{post.data.title}</a></h2>
    <p>{post.data.description}</p>
    <div class="home-post-tags">
      {post.data.tags.map((tag) => <a href={`/tags/${encodeURIComponent(tag)}`}>#{tag}</a>)}
    </div>
  </div>
  {post.data.cover && (
    <a class="home-post-cover" href={href} aria-label={`阅读 ${post.data.title}`}>
      <img src={post.data.cover} alt="" loading="lazy" decoding="async" />
    </a>
  )}
</article>
```

- [ ] **Step 3: Create HomeProfileSidebar**

Use avatar `/p0-256.webp`, nickname `搁浅`, the existing personal description, and these lightweight links:

```ts
const links = [
  { href: 'https://github.com/Lidure/lidure.github.io', label: 'GitHub', external: true },
  { href: '/moments', label: '碎碎念' },
  { href: '/posts', label: '文章归档' },
  { href: featuredHref, label: '精选文章' },
];
```

Statistics must be only `文章 {postCount}` and `标签 {tagCount}`; do not add fake metrics.

- [ ] **Step 4: Replace the home page DOM**

In `src/pages/index.astro`:

- Remove `Greeting`, `ClickStar`, the old `.hero-grid`, `.hero`, `.floating-shape*`, `.link-grid`, and old `.posts-grid` card markup.
- Keep `VisitorCounter` at the bottom.
- Compute unique tag count:

```ts
const tagCount = new Set(posts.flatMap((post) => post.data.tags)).size;
```

- Show at least the latest 5 posts:

```ts
const latestPosts = posts.slice(0, 5);
```

- Call BaseLayout as:

```astro
<BaseLayout
  title="搁浅 的小窝"
  description="一个充满二次元氛围的个人博客，记录游戏、音乐、项目与日常。"
  bannerTitle="搁浅的小窝"
  bannerSubtitle="把喜欢的东西，认真地收进小站里。"
  showTime={true}
>
```

- Body structure:

```astro
<div class="home-layout">
  <section class="home-main-column">
    <header class="home-section-header">
      <h2>最新文章</h2>
      <a href="/posts">全部文章 →</a>
    </header>
    <div class="home-post-list">
      {latestPosts.map((post) => <HomePostCard post={post} />)}
    </div>
  </section>
  <HomeProfileSidebar
    postCount={posts.length}
    tagCount={tagCount}
    featuredHref={featuredPost ? `/posts/${featuredPost.id.replace(/\.md$/, '')}` : '/posts'}
  />
</div>
```

- [ ] **Step 5: Add homepage layout CSS**

Append to `firefly-refresh.css`:

```css
body.layout-standard .home-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 24px;
  align-items: start;
}

body.layout-standard .home-profile-sidebar {
  position: sticky;
  top: 88px;
}

body.layout-standard .home-post-list {
  display: grid;
  gap: 16px;
}

body.layout-standard .home-post-card {
  display: flex;
  min-height: 180px;
  overflow: hidden;
  border: 1px solid var(--standard-line);
  border-radius: 16px;
  background: var(--standard-card-bg);
  transition: transform 180ms ease, border-color 180ms ease, background 180ms ease;
}

body.layout-standard .home-post-card:hover {
  transform: translateY(-1px);
}

body.layout-standard .home-post-cover {
  flex: 0 0 30%;
  min-width: 220px;
}

body.layout-standard .home-post-cover img {
  width: 100%; height: 100%; object-fit: cover;
}

body.layout-standard .home-post-tags a {
  display: inline-flex;
  padding: 4px 8px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--standard-accent) 10%, transparent);
  color: var(--standard-muted);
  font-size: .78rem;
}

@media (max-width: 860px) {
  body.layout-standard .home-layout { grid-template-columns: 1fr; }
  body.layout-standard .home-profile-sidebar { position: static; grid-row: 1; }
}

@media (max-width: 620px) {
  body.layout-standard .home-post-card { display: block; }
  body.layout-standard .home-post-cover { display: block; width: 100%; height: 160px; }
}
```

- [ ] **Step 6: Run focused tests and Astro check**

```bash
node --test tests/firefly-ui-refresh.test.mjs
npm run check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/HomeProfileSidebar.astro src/components/HomePostCard.astro src/content.config.ts src/pages/index.astro src/styles/firefly-refresh.css
git commit -m "feat: rebuild homepage with blog-first layout"
```

---

### Task 5: Apply restrained shared styling to ordinary content pages

**Files:**
- Modify: `src/styles/firefly-refresh.css`
- Modify: `src/pages/posts/index.astro`
- Modify: `src/pages/posts/[slug].astro`
- Modify: `src/pages/tags/index.astro`
- Modify: `src/pages/search.astro`

**Interfaces:**
- Ordinary pages keep existing business classes but receive banner titles through BaseLayout.
- Page content must not repeat the same H1 already displayed in `BlogBanner`.

- [ ] **Step 1: Move page titles into BaseLayout Banner props**

Use these exact calls:

```astro
<BaseLayout title="归档 | 搁浅 的小窝" bannerTitle="文章" bannerSubtitle="按时间浏览文章与项目。">
```

```astro
<BaseLayout title={`${post.data.title} | Lidure Blog`} description={post.data.description} bannerTitle={post.data.title} bannerSubtitle={post.data.description}>
```

```astro
<BaseLayout title="标签 | 搁浅 的小窝" bannerTitle="标签" bannerSubtitle="按主题浏览站内文章。">
```

```astro
<BaseLayout title="搜索 | 搁浅 的小窝" bannerTitle="搜索" bannerSubtitle="找到你想看的内容。">
```

Remove the matching `.kicker` + duplicate `<h1>` from the page body. Keep post metadata, timeline, project cards, tag cloud and search JS intact.

- [ ] **Step 2: Override shared card and text tokens only inside standard pages**

Add:

```css
body.layout-standard .card,
body.layout-standard .archive-shell,
body.layout-standard .post-shell,
body.layout-standard .timeline-item,
body.layout-standard .project-card {
  border-color: var(--standard-line);
  background: var(--standard-card-bg);
  box-shadow: none;
  backdrop-filter: none;
}

body.layout-standard .card,
body.layout-standard .archive-shell,
body.layout-standard .post-shell {
  border-radius: 16px;
}

body.layout-standard .tag,
body.layout-standard .tag-pill,
body.layout-standard .project-pill {
  border-radius: 7px;
  box-shadow: none;
}

body.layout-standard .card:hover {
  transform: translateY(-1px);
  box-shadow: none;
}

body.layout-standard .button {
  border-radius: 9px;
  background: transparent;
  box-shadow: none;
}

body.layout-standard .button.primary {
  background: var(--standard-accent);
  box-shadow: none;
}

body.layout-standard .prose {
  color: var(--standard-text);
}
```

Do not globally remove `.kicker`; feature pages that still intentionally use one may keep it.

- [ ] **Step 3: Run build and existing site tests**

```bash
npm run build
npm run test:site
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/styles/firefly-refresh.css src/pages/posts/index.astro src/pages/posts/[slug].astro src/pages/tags/index.astro src/pages/search.astro
git commit -m "style: refresh ordinary content pages"
```

---

### Task 6: Remove the remaining AI-style hero treatments from messages and moments without touching business logic

**Files:**
- Modify: `src/pages/messages.astro`
- Modify: `src/pages/moments.astro`
- Modify: `src/styles/firefly-refresh.css`

**Interfaces:**
- Message IDs, auth controls, public-interactions functions, moments API hooks, publish controls, media poster flow and category selectors must remain unchanged.

- [ ] **Step 1: Convert the guestbook to the standard Banner**

Change BaseLayout call to:

```astro
<BaseLayout
  title="留言板 | 搁浅 的小窝"
  description="给博客留下想说的话。"
  bannerTitle="留言板"
  bannerSubtitle="路过也可以留下一句话。"
>
```

Replace `.messages-hero` with a simple introductory paragraph block or remove it entirely. Delete its hand-written-font/gradient/blur styles. Keep `#message-admin`, `#message-form`, `#messages-list` and all script identifiers exactly unchanged.

Standard-page overrides for the form/card:

```css
body.layout-standard .message-form,
body.layout-standard .message-card,
body.layout-standard .message-admin {
  background: var(--standard-card-bg);
  border: 1px solid var(--standard-line);
  box-shadow: none;
  backdrop-filter: none;
  border-radius: 14px;
}

body.layout-standard #message-submit {
  background: var(--standard-accent);
  border-radius: 9px;
  box-shadow: none;
}
```

- [ ] **Step 2: Convert Moments to the standard Banner**

Change BaseLayout call to:

```astro
<BaseLayout
  title="碎碎念 | 搁浅 的小窝"
  description="游戏、音乐、生活、吐槽，随时碎碎念。"
  bannerTitle="碎碎念"
  bannerSubtitle="游戏 · 音乐 · 生活 · 吐槽，想到什么就记什么。"
  showTime={true}
>
```

Remove `.hero-bubbles`, `.bubble`, `.b1`, `.b2`, `.b3`, `@keyframes bubble-float` and the duplicated `<h1>碎碎念</h1>`. Keep `#hero-stats` directly under a small `.moments-summary` block so the dynamic counts still update.

Restyle `.pill.active` and `.fab` to solid accent/no glow **only in standard mode**; do not change button IDs or category data attributes.

- [ ] **Step 3: Run the business regression tests**

```bash
npm run build
node --test tests/site-build.test.mjs
```

Expected: all moments publishing/auth/video-poster and guestbook auth/delete assertions PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/messages.astro src/pages/moments.astro src/styles/firefly-refresh.css
git commit -m "style: simplify moments and guestbook surfaces"
```

---

### Task 7: Isolate immersive mode and verify full-screen video remains intact

**Files:**
- Modify: `src/pages/player.astro`
- Modify: `src/styles/firefly-refresh.css`
- Test: `tests/firefly-ui-refresh.test.mjs`, existing hero/player tests

**Interfaces:**
- `/player` must use `layoutMode="immersive"`.
- Standard navbar, standard Banner, standard surface and standard footer must not render on `/player`.
- Existing `.immersive-*`, danmaku, visualizer and player controls remain unchanged.

- [ ] **Step 1: Opt player into immersive mode**

Change the opening layout call to:

```astro
<BaseLayout
  title="沉浸空间 | 搁浅 的小窝"
  description="沉浸式音乐与视觉体验。"
  layoutMode="immersive"
>
```

Do not move or rename any immersive controls.

- [ ] **Step 2: Add minimal immersive shell safety styles**

```css
body.layout-immersive {
  margin: 0;
  min-height: 100vh;
  overflow-x: hidden;
}

body.layout-immersive .immersive-content {
  position: relative;
  z-index: 1;
  min-height: 100vh;
}
```

No standard-page token override may be prefixed with `body.layout-immersive`.

- [ ] **Step 3: Run focused and existing tests**

```bash
npm run build
node --test tests/firefly-ui-refresh.test.mjs tests/hero-video-loop.test.mjs tests/sekai-player-search.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/player.astro src/styles/firefly-refresh.css
git commit -m "fix: isolate immersive player layout"
```

---

### Task 8: Final responsive and regression verification

**Files:**
- Modify only files that fail verification; no opportunistic refactors.

**Interfaces:**
- This task produces the review-ready branch; no new feature surface.

- [ ] **Step 1: Run the complete automated suite**

```bash
npm test
```

Expected: `astro check`, `astro build`, all `test:site` tests and existing hero/player tests PASS.

- [ ] **Step 2: Start local preview and perform the desktop visual checklist**

Run:

```bash
npm run preview -- --host 0.0.0.0
```

At ~1440px width verify:

1. `/` has ~50vh video Banner; title/subtitle only; no `Sweet Blog Corner`, floating circles, five quick-link cards or gradient CTA.
2. Navbar is transparent over the Banner and gains a restrained semi-opaque/blurred state after scrolling.
3. Homepage main area is article column + ~300px profile sidebar; sidebar sticks below navbar.
4. Article cards use near-solid backgrounds, 14–16px radius, tiny/no shadow, no colored glow.
5. `/posts`, `/tags`, `/search`, `/messages`, `/moments` share the same ordinary page shell.
6. `/player` is full viewport, has no ordinary Banner/navbar/footer, and background video remains full-screen.
7. Background settings button/panel still opens, background on/off persists, video media still loops.
8. SekaiPlayer remains usable on ordinary pages and on `/player`.

- [ ] **Step 3: Perform mobile visual verification**

At 390×844 verify:

1. Standard Banner height is ~36vh and text remains legible.
2. Main content becomes one column; profile card appears before latest articles and is not sticky.
3. Post cover, if present, moves above/below text without horizontal overflow.
4. Navbar mobile panel opens/closes and all existing destinations remain reachable.
5. No page causes horizontal scrolling except intentional code/table overflow inside article prose.
6. `/player` continues to use full viewport dimensions and its composer/controls remain reachable.

- [ ] **Step 4: Check reduced-motion behavior**

Add to `firefly-refresh.css` if not already present:

```css
@media (prefers-reduced-motion: reduce) {
  body.layout-standard *,
  body.layout-standard *::before,
  body.layout-standard *::after {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

Do not apply this selector to `body.layout-immersive`; immersive visualization behavior is managed by its own page.

- [ ] **Step 5: Re-run the full suite after any visual fixes**

```bash
npm test
```

Expected: PASS with no new warnings/errors from Astro check.

- [ ] **Step 6: Review the final diff scope**

```bash
git diff --stat main...HEAD
git diff --name-only main...HEAD
```

Expected changed scope: layout/components/styles/pages/tests/content schema/package script only. No changes to `danmaku-api`, music data, Cloudflare/GitHub deployment config, background media URLs, or unrelated game logic.

- [ ] **Step 7: Commit final verification-only fixes if needed**

```bash
git add <only files changed by verification>
git commit -m "fix: polish responsive Firefly UI refresh"
```

If Step 2–4 required no changes, skip this commit.

---

## Self-review checklist

- Spec coverage: B3 50/36vh Banner, sticky navbar, 70/30 homepage layout, sticky profile sidebar, Firefly-style post cards, restrained tokens, ordinary/immersive split, and full-screen `/player` all map to explicit tasks above.
- Regression coverage: existing background loop/poster/media lifecycle tests are preserved and rerun; moments auth/media-poster and guestbook management tests are rerun; no background/media JS rewrite is planned.
- Scope control: feature-specific business logic remains in place. The only schema addition is optional `cover`, so existing content is backwards-compatible.
- No new dependency is required.
- No placeholder/TODO implementation step remains in this plan.
