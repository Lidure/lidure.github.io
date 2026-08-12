# Blog Reliability and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复搜索、域名元数据和光流文章排版，并以静态首屏、延迟视频、优化图片和显式管理模式降低博客首屏负担。

**Architecture:** 保留现有 Astro 静态站点结构和 GitHub Pages 部署。构建时输出搜索数据和站点元数据；客户端仅负责 Fuse.js 搜索、背景空闲加载和碎碎念管理界面切换；写操作仍由现有 API 密钥鉴权。

**Tech Stack:** Astro 6.4、TypeScript 5.8、Fuse.js 7.4、remark-math、rehype-katex、Node.js 内置测试运行器、GitHub Pages。

## Global Constraints

- 不改变现有粉紫暗色视觉、GitHub Pages 部署方式、动态背景和全站播放器功能。
- 碎碎念、评论和表情互动继续向所有访客公开。
- 只有发布、删除和管理密钥界面受 `/moments/?admin=1` 控制，API 密钥仍是最终权限边界。
- 本轮不迁移 MP3、不重做播放器、不调整整体导航结构、不删除原始图片。
- 每项修复先建立失败回归检查，再实施最小改动。

---

### Task 1: 建立构建产物回归测试

**Files:**
- Create: `tests/site-build.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `npm run build` 生成的 `dist/` 静态文件。
- Produces: `npm run test:site` 和完整的 `npm test` 验证入口。

- [ ] **Step 1: 在 `package.json` 增加测试命令**

```json
"test:site": "node --test tests/site-build.test.mjs",
"test": "npm run build && npm run test:site"
```

- [ ] **Step 2: 编写当前状态必然失败的构建产物测试**

```js
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../dist/${path}`, import.meta.url), 'utf8');

test('search embeds parseable post data without a runtime jsonData reference', () => {
  const html = read('search/index.html');
  assert.doesNotMatch(html, /\$\{jsonData\}/);
  const match = html.match(/<script id="__SEARCH_DATA" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match);
  const posts = JSON.parse(match[1]);
  assert.ok(posts.some((post) => post.title.includes('光流')));
});

test('public URLs use the custom domain and include social metadata', () => {
  const sitemap = read('sitemap-index.xml');
  const home = read('index.html');
  assert.match(sitemap, /https:\/\/lidure22\.xyz\/sitemap-0\.xml/);
  assert.match(home, /rel="canonical" href="https:\/\/lidure22\.xyz\/"/);
  assert.match(home, /property="og:title"/);
});

test('optical-flow article has one h1 and no unparsed inline delimiters', () => {
  const html = read('posts/视觉光流公式推导与文献/index.html');
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /\\\(/);
});

test('optimized identity assets are used and remain small', () => {
  const home = read('index.html');
  assert.match(home, /\/p0-256\.webp/);
  assert.match(home, /\/favicon-32\.png/);
  assert.ok(statSync(new URL('../public/p0-256.webp', import.meta.url)).size < 100_000);
  assert.ok(statSync(new URL('../public/favicon-32.png', import.meta.url)).size < 50_000);
});

test('background is static first and video preparation is deferred', () => {
  const source = readFileSync(new URL('../src/components/HeroSlideshow.astro', import.meta.url), 'utf8');
  const staticIndex = source.indexOf('953c5e02532e4eeb9ec758e7fd7e8ad3.jpg');
  const videoIndex = source.indexOf('miku_star.mp4');
  assert.ok(staticIndex >= 0 && staticIndex < videoIndex);
  assert.match(source, /scheduleVideoPreload/);
  assert.match(source, /requestIdleCallback/);
});

test('moments management controls are opt-in', () => {
  const html = read('moments/index.html');
  assert.match(html, /data-admin-only/);
  assert.match(html, /admin=1/);
});
```

- [ ] **Step 3: 安装依赖并生成当前构建**

Run: `npm ci`

Run: `npm run build`

Expected: Astro 类型检查和构建成功，产生 `dist/`。

- [ ] **Step 4: 运行测试并确认因待修复功能而失败**

Run: `npm run test:site`

Expected: 搜索数据、域名元数据、文章 H1、优化图片、背景延迟和管理模式相关断言失败；失败原因不是测试语法或缺失构建目录。

- [ ] **Step 5: 提交测试基线**

```bash
git add package.json tests/site-build.test.mjs
git commit -m "test: add blog build regressions"
```

### Task 2: 修复搜索、最终域名与文章排版

**Files:**
- Modify: `src/pages/search.astro`
- Modify: `astro.config.mjs`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/rss.xml.ts`
- Modify: `src/content/blog/视觉光流公式推导与文献.md`
- Test: `tests/site-build.test.mjs`

**Interfaces:**
- Consumes: Astro 内容集合与 `Astro.site`。
- Produces: `__SEARCH_DATA` JSON 节点、canonical/OG 元数据、单 H1 且 KaTeX 可解析的文章。

- [ ] **Step 1: 安全输出搜索 JSON 并处理缺失数据**

将构建变量改为：

```ts
const jsonData = JSON.stringify(posts).replace(/</g, '\\u003c');
```

用 Astro 原生节点替换运行时模板字符串：

```astro
<script id="__SEARCH_DATA" type="application/json" set:html={jsonData}></script>
```

客户端在解析失败时设置 `search-results` 为“搜索数据加载失败，请刷新页面重试。”，并停止初始化 Fuse.js。

- [ ] **Step 2: 将构建绝对地址统一到最终域名**

```js
export default defineConfig({
  site: 'https://lidure22.xyz',
  // 保留既有 integrations 与 markdown 配置
});
```

RSS 回退值同步改为 `https://lidure22.xyz`。

- [ ] **Step 3: 在基础布局输出 canonical 与 Open Graph**

```astro
const siteBase = Astro.site ?? new URL('https://lidure22.xyz');
const canonicalUrl = new URL(Astro.url.pathname, siteBase);
const socialImageUrl = new URL('/site-icon-512.png', siteBase);

<link rel="canonical" href={canonicalUrl} />
<meta property="og:type" content="website" />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonicalUrl} />
<meta property="og:image" content={socialImageUrl} />
```

- [ ] **Step 4: 删除 Markdown 重复 H1 并将全部 `\\(...\\)` 行内公式替换为 `$...$`**

保留 frontmatter 后的介绍段，从正文第一个段落开始；页面模板继续负责唯一 H1。

- [ ] **Step 5: 构建并运行相关测试**

Run: `npm test`

Expected: 搜索、域名和文章测试通过；图片、背景与管理模式测试仍失败。

- [ ] **Step 6: 提交功能修复**

```bash
git add astro.config.mjs src/layouts/BaseLayout.astro src/pages/rss.xml.ts src/pages/search.astro src/content/blog/视觉光流公式推导与文献.md
git commit -m "fix: restore search and canonical content"
```

### Task 3: 优化身份图片与背景首屏

**Files:**
- Create: `public/p0-256.webp`
- Create: `public/favicon-32.png`
- Create: `public/apple-touch-icon.png`
- Create: `public/site-icon-512.png`
- Modify: `src/pages/index.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/HeroSlideshow.astro`
- Test: `tests/site-build.test.mjs`

**Interfaces:**
- Consumes: `public/p0.jpg`、`public/site2.png` 和现有背景列表。
- Produces: 轻量头像/图标、静态首帧和 `scheduleVideoPreload()` 空闲加载入口。

- [ ] **Step 1: 用可用的图像工具生成固定尺寸资源**

```bash
magick public/p0.jpg -resize 256x256^ -gravity center -extent 256x256 -quality 82 public/p0-256.webp
magick public/site2.png -resize 32x32 public/favicon-32.png
magick public/site2.png -resize 180x180 public/apple-touch-icon.png
magick public/site2.png -resize 512x512 public/site-icon-512.png
```

若环境只提供 ImageMagick 6，则将 `magick` 替换为 `convert`，参数保持一致。

- [ ] **Step 2: 替换页面资源入口**

首页头像使用 `/p0-256.webp`；基础布局使用 32×32 favicon、180×180 Apple Touch Icon 和 512×512 分享图片。

- [ ] **Step 3: 将默认背景列表的首项改为静态 JPG**

把 `953c5e02532e4eeb9ec758e7fd7e8ad3.jpg` 放到 `miku_star.mp4` 之前，保留其他背景顺序。

- [ ] **Step 4: 增加空闲视频准备调度**

实现 `scheduleVideoPreload()`：页面加载完成后通过 `requestIdleCallback(..., { timeout: 4000 })` 设置 `videoPreloadReady = true` 并预热下一段视频；无该 API 时使用 `setTimeout(..., 1500)`。`loadAt()` 只有在 `videoPreloadReady` 为真时调用 `preloadSlide()`。

- [ ] **Step 5: 构建并运行相关测试**

Run: `npm test`

Expected: 搜索、域名、文章、图片和背景测试通过；管理模式测试仍失败。

- [ ] **Step 6: 提交性能优化**

```bash
git add public/p0-256.webp public/favicon-32.png public/apple-touch-icon.png public/site-icon-512.png src/pages/index.astro src/layouts/BaseLayout.astro src/components/HeroSlideshow.astro
git commit -m "perf: defer background video and shrink identity assets"
```

### Task 4: 隐藏碎碎念站长操作并保留公开内容

**Files:**
- Modify: `src/pages/moments.astro`
- Test: `tests/site-build.test.mjs`

**Interfaces:**
- Consumes: 浏览器 `location.search` 和现有 API 密钥逻辑。
- Produces: `adminMode` 布尔状态、`data-admin-only` 标记及动态删除按钮权限显示。

- [ ] **Step 1: 给发布入口、发布面板和密钥区域增加 `data-admin-only` 与默认隐藏状态**

```astro
<button data-admin-only hidden ...>...</button>
<div data-admin-only hidden ...>...</div>
```

- [ ] **Step 2: 在初始化时只根据精确查询值启用管理界面**

```ts
const adminMode = new URLSearchParams(window.location.search).get('admin') === '1';
document.querySelectorAll<HTMLElement>('[data-admin-only]').forEach((element) => {
  element.hidden = !adminMode;
});
```

代码中保留字面注释 `/moments/?admin=1`，使构建产物清楚记录管理入口。

- [ ] **Step 3: 动态卡片仅在管理模式添加删除按钮**

`buildMomentCard()` 继续渲染正文、图片、评论和表情互动；仅当 `adminMode` 为真时创建并附加 `.delete-moment-btn`。

- [ ] **Step 4: 构建并运行全部测试**

Run: `npm test`

Expected: 全部构建产物测试通过，无失败。

- [ ] **Step 5: 提交管理界面修复**

```bash
git add src/pages/moments.astro
git commit -m "fix: gate moments management controls"
```

### Task 5: 视觉回归、最终验证与发布

**Files:**
- Modify only if QA finds an in-scope regression.

**Interfaces:**
- Consumes: 完整分支构建和本地预览。
- Produces: 经过验证的 Draft PR。

- [ ] **Step 1: 运行静态质量检查**

Run: `npm run check`

Run: `npm test`

Run: `git diff --check main...HEAD`

Expected: 所有命令退出码为 0。

- [ ] **Step 2: 启动本地预览并检查桌面页面**

Run: `npm run dev -- --host 0.0.0.0`

检查首页、搜索页输入“光流”、目标文章和 `/moments/`；确认静态背景先显示、搜索返回文章、文章只有一个视觉标题、碎碎念正文与互动公开且不显示管理按钮。

- [ ] **Step 3: 检查管理模式和窄屏**

访问 `/moments/?admin=1`，确认发布和删除入口出现但写操作仍要求密钥；在约 390px 宽度检查上述四个页面无水平溢出。

- [ ] **Step 4: 检查提交范围**

Run: `git status -sb`

Run: `git log --oneline main..HEAD`

Run: `git diff --stat main...HEAD`

Expected: 仅包含设计、测试和本轮约定的源文件与优化图片。

- [ ] **Step 5: 推送分支并创建 Draft PR**

```bash
git push -u origin agent/fix-blog-speed
```

Draft PR 标题：`Fix blog reliability and improve first-load performance`

PR 正文说明搜索根因、最终域名元数据、文章排版、静态首屏、图片体积、碎碎念公开与管理模式，以及执行过的验证命令。
