# Cloudflare 碎碎念与站点体验优化设计

## 目标

将碎碎念发布从浏览器直连 GitHub API 迁移到 Cloudflare Worker + D1 + R2，同时修复碎碎念加载失败、视频背景封面黑屏和页面切换卡顿，并保持现有 Astro/GitHub Pages 部署方式。

## 约束与非目标

- 站点继续由 Astro 构建并部署到 GitHub Pages，不把整站迁移到 Cloudflare Pages。
- 不保存或传输 GitHub Token；管理员使用独立密码登录。
- 资源按个人博客低频使用设计，优先落在 Cloudflare 免费额度内，但不宣称额度无限。
- 保留现有 `src/data/moments.json` 数据，并提供可重复执行的一次性导入方案。
- 本次不重做整套视觉设计，不引入 React/Vue 等新 UI 框架。

## 推荐架构

```text
浏览器
  ├─ https://lidure.xyz                 Astro 静态站 / GitHub Pages
  └─ https://api.lidure.xyz             Cloudflare Worker
       ├─ D1                            碎碎念结构化数据
       └─ R2                            图片、视频和视频封面
```

Worker 使用自定义域 `api.lidure.xyz`。静态站请求公开数据时使用短缓存；管理请求使用 HttpOnly、Secure、SameSite=Lax 会话 Cookie，并通过 CORS 只允许 `https://lidure.xyz` 与本地开发源。

## 数据模型

### `moments`

- `id TEXT PRIMARY KEY`：UUID。
- `date TEXT NOT NULL`：ISO 日期时间。
- `category TEXT NOT NULL`：游戏、音乐、生活、吐槽。
- `text TEXT NOT NULL`。
- `link TEXT`。
- `created_at TEXT NOT NULL`。
- `updated_at TEXT NOT NULL`。

### `moment_media`

- `id TEXT PRIMARY KEY`。
- `moment_id TEXT NOT NULL`，外键关联 `moments.id`。
- `kind TEXT NOT NULL`：image、video、poster。
- `url TEXT NOT NULL`。
- `sort_order INTEGER NOT NULL`。
- `created_at TEXT NOT NULL`。

读取接口一次返回按日期倒序的碎碎念及其媒体数组，保持现有前端 `Moment` 数据形状，避免页面层感知存储迁移。

## API 与认证

### 公开接口

- `GET /api/health`：返回 Worker 与数据库可用性。
- `GET /api/moments`：返回分页或最近动态，并返回 `ETag`/缓存头。

### 管理接口

- `POST /api/auth/login`：校验密码，成功后设置短期 HttpOnly 会话 Cookie。
- `POST /api/auth/logout`：清除会话 Cookie。
- `GET /api/auth/session`：返回当前登录状态，不返回密码或哈希。
- `POST /api/media/upload`：校验会话后写入 R2，返回公开媒体 URL。
- `POST /api/moments`：校验会话、校验字段和媒体 URL 后写入 D1。
- `DELETE /api/moments/:id`：校验会话后删除动态及其关联记录；R2 清理由后续安全清理流程处理，避免误删共享资源。

密码通过 Cloudflare Secret 保存为 PBKDF2 哈希配置，Worker 不保存明文。会话使用签名 Token，包含过期时间和随机标识；Cookie 不暴露给脚本。发布、删除、上传统一限制请求体大小、字段长度和媒体类型，错误统一返回 JSON `{ error, code }`。

## 碎碎念页面改造

1. 页面首次渲染继续保留轻量骨架屏，但客户端请求设置超时和 AbortController。
2. 成功后更新时间线、分类统计和筛选状态；筛选只在内存中处理，不重复请求。
3. 请求失败时显示可理解的错误提示、重试按钮和接口状态，不再无限停留在加载状态。
4. 登录按钮打开独立登录面板；通过 `/api/auth/session` 恢复登录状态，不再显示 GitHub Token 或 localStorage 密钥提示。
5. 发布成功后用接口返回的完整动态插入列表，并刷新统计；失败时保留表单内容，避免重复输入。
6. 旧 `moments.json` 在部署前导入 D1；导入脚本使用稳定 ID/去重键，重复运行不会产生重复动态。

## 图片、视频与背景封面

- 图片仍通过 Worker 上传到 R2，前端只提交上传返回的 URL。
- 视频上传表单使用 `video` 元素加载元数据；在 `loadedmetadata` 后设置默认时间点，在 `seeked` 后绘制 Canvas 获取真实帧。
- 提供时间滑块和“使用当前帧”按钮，用户可以明确选择任意展示图。
- Canvas 生成的封面与视频一起上传为 R2 poster；视频卡片始终优先使用 poster，poster 生成失败时显示可重试提示，而不是黑色占位。
- Worker/R2 CORS 允许站点 Origin 的 GET/HEAD，媒体元素使用 `muted playsinline preload="metadata"`，页面切换时暂停并释放非当前页面媒体。
- 上传前校验 MIME、大小和扩展名；视频封面限制分辨率，避免生成过大的图片。

## 页面切换与性能优化

- 保留 Astro `ClientRouter`，把页面级初始化统一放到 `astro:page-load`，避免只在首次加载时绑定的脚本失效。
- 所有全局监听器使用可追踪的初始化标记或 AbortController，页面切换时清理旧监听器。
- 背景视频不在每个页面重复创建；切换时只更新必要状态，离开页面暂停不必要的媒体和动画。
- 非首屏图片增加尺寸、懒加载和异步解码；首屏头像和站点图标保留明确尺寸防止布局抖动。
- 将高开销的 `backdrop-filter`、持续动画和全屏视频降级到 `prefers-reduced-motion` 或低性能设备策略。
- 修正站点配置、canonical、sitemap 与 Open Graph 地址为 `https://lidure.xyz`，并检查自定义域名重定向。

## 错误处理与兼容性

- API 超时、401、403、413、429、5xx 分别转成前端可操作提示。
- 旧数据读取失败时不回退到静默空列表；只在迁移完成前提供本地 JSON 的开发回退。
- Worker 端记录最小必要请求日志，不记录密码、Cookie 原文或上传内容。
- 公开读取接口可缓存，管理接口禁止缓存。
- 账号初次部署需要用户在 Cloudflare Dashboard/命令行设置 D1、R2、Worker Secret 与自定义域；不会把账户凭证写入仓库。

## 文件边界

- `workers/moments-api/`：Worker 路由、认证、D1 查询、R2 上传与配置。
- `workers/moments-api/migrations/`：D1 schema 与索引。
- `scripts/import-moments.*`：从现有 JSON 导入 D1 的脚本。
- `src/lib/moments-api.ts`：浏览器端 API 客户端和统一错误处理。
- `src/pages/moments.astro`：碎碎念展示、登录和发布交互。
- 现有背景管理组件：视频帧选择、封面上传、页面切换清理。
- `astro.config.mjs`、部署文档和环境示例：域名与 Worker 配置。

## 验证标准

### 自动验证

- `npm run check` 与 `npm run build` 通过。
- 站点静态测试覆盖 `/moments`、canonical、sitemap 和无接口时的错误状态。
- Worker 单元测试覆盖认证、CORS、字段校验、D1 写入/读取、R2 上传错误和重复导入。
- 使用本地 D1/R2 模拟环境验证迁移脚本可重复执行。

### 手动验证

- 未登录用户只能查看，不能发布、删除或上传。
- 错误密码、过期 Cookie、超大媒体和网络断开都有明确提示。
- 发布带图片、带视频、无媒体的碎碎念，刷新和重新进入页面后仍能显示。
- 视频选择首帧、中间帧、末帧作为封面，确认展示图不是黑帧。
- 在首页、碎碎念、文章、沉浸页面之间往返切换，确认无重复音频、无重复背景视频、无明显卡顿。
- 通过 `https://lidure.xyz` 和本地开发地址分别验证 CORS、Cookie、媒体加载和缓存行为。

## 交付顺序

1. 建立 Worker、D1 schema、R2 绑定和认证基础。
2. 导入并验证现有碎碎念数据。
3. 改造碎碎念读取、登录、发布和媒体上传。
4. 修复视频帧封面与背景管理。
5. 统一页面切换生命周期和性能优化。
6. 执行构建、Worker 测试、浏览器手动验证，并补充 Cloudflare 部署步骤。
