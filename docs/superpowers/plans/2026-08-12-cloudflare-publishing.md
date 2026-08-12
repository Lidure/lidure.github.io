# Cloudflare Publishing and Blog Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将碎碎念发布迁移到独立的 Cloudflare Worker + D1 + R2 后端，修复加载和视频封面问题，并降低 Astro 页面切换的重复初始化与媒体卡顿。

**Architecture:** 复用现有 `danmaku-api` Cloudflare Worker 作为统一 API Worker，新增碎碎念、认证和 R2 路由，与现有弹幕/评论/表情功能共享 D1。Astro 静态站通过 `https://api.lidure.xyz/api` 访问 Worker；管理员使用独立密码换取 HttpOnly 会话 Cookie，不再把管理凭证放进 localStorage。

**Tech Stack:** Astro 6.4、TypeScript 5.8、Cloudflare Workers、D1、R2、Wrangler、Vitest、Node.js 内置脚本测试、GitHub Pages。

## Global Constraints

- 站点继续由 Astro 构建并部署到 GitHub Pages，不迁移整站到 Cloudflare Pages。
- 不保存或传输 GitHub Token；管理员使用独立密码登录。
- 现有 `src/data/moments.json` 数据必须保留，并通过幂等脚本导入 D1。
- 不引入 React、Vue 或 Svelte；页面交互继续使用 Astro 内联脚本和 TypeScript。
- 公开接口只允许读取；发布、删除、媒体上传和评论删除必须经过会话认证。
- 所有公开接口失败都要显示明确错误，不允许永久停留在骨架屏或静默空列表。
- 公开 API 响应不得记录密码、Cookie 原文或媒体内容。
- 目标域名统一为 `https://lidure.xyz`；本地开发允许 `http://localhost:4321` 和 `http://127.0.0.1:4321`。
- 每个任务先写失败测试或回归检查，再实现最小改动，最后单独提交。

## File Map

- `danmaku-api/src/index.ts`: Worker 路由、CORS、公开/管理接口。
- `danmaku-api/src/auth.ts`: PBKDF2 密码校验、HMAC 会话 Cookie、认证辅助函数。
- `danmaku-api/src/moments.ts`: D1 碎碎念查询、写入、删除、媒体校验。
- `danmaku-api/src/media.ts`: multipart 上传、R2 对象命名、公开媒体 URL。
- `danmaku-api/migrations/0005_create_moments.sql`: 碎碎念、媒体和索引表。
- `danmaku-api/wrangler.jsonc`: R2 绑定、D1 绑定、自定义域和允许来源。
- `danmaku-api/tests/*.test.ts`: Worker 纯函数和接口契约测试。
- `scripts/hash-admin-password.mjs`: 本地生成 PBKDF2 Secret 字符串，不写入仓库。
- `scripts/import-moments.mjs`: 从 `src/data/moments.json` 生成幂等 SQL。
- `src/lib/moments-api.ts`: 浏览器 API 客户端、超时、错误映射和会话方法。
- `src/lib/r2-upload.ts`: 删除旧的浏览器直连 R2 凭证逻辑，改为调用 Worker 上传接口；保留兼容导出名。
- `src/pages/moments.astro`: 登录、读取、发布、删除、图片/视频上传和错误 UI。
- `src/components/HeroSlideshow.astro`: 视频封面捕获、跨域失败兜底、页面切换清理。
- `src/layouts/BaseLayout.astro`: 页面切换生命周期和媒体清理入口。
- `src/lib/public-interactions.ts`: 评论删除改为会话 Cookie，移除管理 Token 读取。
- `astro.config.mjs`, `.env.example`, `AGENTS.md`, `danmaku-api/README.md`: 域名、环境变量、部署和架构说明。
- `tests/site-build.test.mjs`: 静态站构建回归测试。

---

### Task 1: 建立 API 回归基线和本地测试入口

**Files:**
- Modify: `package.json`
- Modify: `danmaku-api/package.json`
- Create: `danmaku-api/tests/contracts.test.ts`
- Modify: `tests/site-build.test.mjs`

**Interfaces:**
- Consumes: 当前 Astro 构建产物、Worker 的 HTTP 路由约定。
- Produces: 根目录 `npm test` 和 `danmaku-api` 测试命令；后续任务依赖的接口契约断言。

- [ ] **Step 1: 写入当前故障的失败回归断言**

在 `tests/site-build.test.mjs` 增加：

```js
test('site points to the final domain and moments no longer exposes GitHub/R2 secrets', () => {
  const home = read('index.html');
  const moments = read('moments/index.html');
  assert.match(home, /https:\/\/lidure\.xyz/);
  assert.doesNotMatch(moments, /PUBLIC_R2_SECRET_ACCESS_KEY|AWS_SECRET|moments_admin_token/);
  assert.match(moments, /data-moments-api/);
});

test('moments page has retry and session controls', () => {
  const moments = read('moments/index.html');
  assert.match(moments, /id="moments-retry"/);
  assert.match(moments, /id="moments-login"/);
  assert.match(moments, /id="video-poster-range"/);
});
```

在 `danmaku-api/tests/contracts.test.ts` 先固定返回结构：公开成功响应必须有 `{ items, nextCursor }`，错误响应必须有 `{ error, code }`，管理接口必须允许 `credentials: include`。

- [ ] **Step 2: 运行失败测试确认基线**

Run: `npm ci; npm run build; npm run test:site`

Expected: 新增域名、会话、重试和视频帧断言失败，失败原因是功能尚未实现；现有构建不因测试文件语法错误失败。

- [ ] **Step 3: 增加测试命令，不修改功能代码**

根目录 `package.json` 增加：

```json
"test:site": "node --test tests/site-build.test.mjs",
"test": "npm run build && npm run test:site"
```

`danmaku-api/package.json` 增加：

```json
"test": "vitest run",
"check": "tsc --noEmit"
```

使用已存在的 `wrangler`/TypeScript 依赖；只有在 `vitest` 不在锁文件中时才安装 `vitest`，并更新 `danmaku-api/package-lock.json`。

- [ ] **Step 4: 运行测试入口确认可重复执行**

Run: `npm run check`

Run: `npm --prefix danmaku-api run check`

Expected: 根项目保持现有检查结果；Worker 测试暂时可以因未实现的导出而失败，但命令和 TypeScript 配置可执行。

- [ ] **Step 5: Commit**

```bash
git add package.json danmaku-api/package.json danmaku-api/package-lock.json danmaku-api/tests tests/site-build.test.mjs
git commit -m "test: add Cloudflare publishing regression contracts"
```

### Task 2: 建立 D1 碎碎念/媒体表并扩展 Worker 配置

**Files:**
- Create: `danmaku-api/migrations/0005_create_moments.sql`
- Modify: `danmaku-api/wrangler.jsonc`
- Modify: `danmaku-api/src/index.ts`
- Create: `danmaku-api/src/moments.ts`
- Create: `danmaku-api/src/media.ts`
- Test: `danmaku-api/tests/moments.test.ts`

**Interfaces:**
- Consumes: `Env.DB`, `Env.MEDIA`, `Env.ALLOWED_ORIGINS`。
- Produces: `GET /api/moments`、`POST /api/moments`、`DELETE /api/moments/:id` 的数据访问函数；返回 `MomentApiItem`。

- [ ] **Step 1: 写 D1 migration 和数据访问失败测试**

`0005_create_moments.sql` 必须创建：

```sql
CREATE TABLE IF NOT EXISTS moments (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('游戏', '音乐', '生活', '吐槽')),
  text TEXT NOT NULL,
  link TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS moment_media (
  id TEXT PRIMARY KEY,
  moment_id TEXT NOT NULL REFERENCES moments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'video', 'poster')),
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_moments_date ON moments(date DESC);
CREATE INDEX IF NOT EXISTS idx_moment_media_moment_order ON moment_media(moment_id, sort_order);
```

测试 `normalizeMomentInput()`：空文本、未知分类、超过 2,000 字、非法 URL、超过 9 个媒体项必须返回明确错误码；合法请求返回规范化字段。

- [ ] **Step 2: 实现规范化、查询和写入函数**

在 `danmaku-api/src/moments.ts` 导出：

```ts
export type MomentApiItem = {
  id: string;
  date: string;
  category: '游戏' | '音乐' | '生活' | '吐槽';
  text: string;
  link?: string;
  images: string[];
  media: Array<{ kind: 'image' | 'video' | 'poster'; url: string }>;
};

export async function listMoments(db: D1Database, limit: number, cursor?: string): Promise<{ items: MomentApiItem[]; nextCursor: string | null }>;
export async function createMoment(db: D1Database, input: CreateMomentInput): Promise<MomentApiItem>;
export async function deleteMoment(db: D1Database, id: string): Promise<void>;
```

`listMoments()` 按 `date DESC, id DESC` 排序，默认 50 条、最大 200 条；`images` 只包含 image URL，`media` 保留 video/poster 信息以兼容旧页面。

- [ ] **Step 3: 加入 Worker 路由但暂不接入认证**

在 `src/index.ts` 保留现有 `/api/danmaku` 路由，并增加：

```ts
if (url.pathname === '/api/moments' && request.method === 'GET') return handleListMoments(...);
if (url.pathname === '/api/moments' && request.method === 'POST') return requireSession(...);
if (url.pathname.startsWith('/api/moments/') && request.method === 'DELETE') return requireSession(...);
```

所有新响应统一设置 `Content-Type: application/json; charset=utf-8`、`Vary: Origin`；GET 成功设置 `Cache-Control: public, max-age=30, stale-while-revalidate=120`，写操作设置 `Cache-Control: no-store`。

- [ ] **Step 4: 配置 R2 binding 和域名变量**

在 `wrangler.jsonc` 增加：

```jsonc
"r2_buckets": [{
  "binding": "MEDIA",
  "bucket_name": "lidure-media"
}],
"vars": {
  "ALLOWED_ORIGINS": "https://lidure.xyz,https://www.lidure.xyz,http://localhost:4321,http://127.0.0.1:4321",
  "PUBLIC_MEDIA_BASE_URL": "https://media.lidure.xyz"
}
```

不把 `database_id`、bucket 名称和现有部署信息替换成占位字符串；保留当前 D1 ID，部署前通过 `wrangler r2 bucket list` 确认 bucket 名称。

- [ ] **Step 5: 运行局部测试和静态检查**

Run: `npm --prefix danmaku-api run check`

Run: `npm --prefix danmaku-api test -- --runInBand`

Expected: D1 schema 和纯函数测试通过；认证相关断言仍失败，不能忽略失败。

- [ ] **Step 6: Commit**

```bash
git add danmaku-api/migrations/0005_create_moments.sql danmaku-api/src/index.ts danmaku-api/src/moments.ts danmaku-api/src/media.ts danmaku-api/wrangler.jsonc danmaku-api/tests/moments.test.ts
git commit -m "feat: add D1 moments and media model"
```

### Task 3: 实现独立密码登录和 HttpOnly 会话

**Files:**
- Create: `danmaku-api/src/auth.ts`
- Create: `scripts/hash-admin-password.mjs`
- Modify: `danmaku-api/src/index.ts`
- Create: `danmaku-api/tests/auth.test.ts`
- Modify: `danmaku-api/README.md`

**Interfaces:**
- Consumes: `ADMIN_PASSWORD_HASH` 和 `SESSION_SECRET` Worker Secrets。
- Produces: `POST /api/auth/login`、`POST /api/auth/logout`、`GET /api/auth/session`，以及 `requireSession(request, env)`。

- [ ] **Step 1: 写密码格式、Cookie 和过期行为测试**

固定 Secret 格式：`pbkdf2$sha256$310000$<base64url-salt>$<base64url-hash>`；测试正确密码返回 true、错误密码返回 false、过期会话返回 false、签名被修改返回 false。

```ts
expect(await verifyPassword('correct horse', makeHash('correct horse'))).toBe(true);
expect(await verifyPassword('wrong', makeHash('correct horse'))).toBe(false);
expect(await verifySession(cookieFor(expiredPayload), 'secret')).toBe(null);
```

- [ ] **Step 2: 实现 PBKDF2 哈希生成脚本**

`scripts/hash-admin-password.mjs` 从命令行读取密码，不接受环境变量明文，不写文件：

```js
import { pbkdf2Sync, randomBytes } from 'node:crypto';
const password = process.argv[2];
if (!password) throw new Error('Usage: node scripts/hash-admin-password.mjs "password"');
const salt = randomBytes(16);
const hash = pbkdf2Sync(password, salt, 310000, 32, 'sha256');
console.log(`pbkdf2$sha256$310000$${salt.toString('base64url')}$${hash.toString('base64url')}`);
```

- [ ] **Step 3: 实现 Worker WebCrypto 校验和签名会话**

`auth.ts` 导出：

```ts
export async function verifyPassword(password: string, encodedHash: string): Promise<boolean>;
export async function createSession(secret: string, nowMs?: number): Promise<string>;
export async function verifySession(cookieValue: string, secret: string, nowMs?: number): Promise<{ exp: number } | null>;
export function sessionCookie(value: string, maxAgeSeconds: number): string;
export function clearSessionCookie(): string;
```

会话有效期 7 天，签名使用 HMAC-SHA256；Cookie 属性为 `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`。登录和会话响应禁止设置缓存。

- [ ] **Step 4: 接入认证路由和 CORS credentials**

当请求有合法 Origin 时返回该 Origin，并设置 `Access-Control-Allow-Credentials: true`；不允许 `*` 与 credentials 同时出现。OPTIONS 允许 `Content-Type`，不允许前端读取 `Set-Cookie`。

错误码固定为 `AUTH_INVALID`, `AUTH_REQUIRED`, `AUTH_EXPIRED`, `BAD_JSON`，响应形状为：

```json
{"error":"登录失败，请检查密码","code":"AUTH_INVALID"}
```

- [ ] **Step 5: 在 README 写入一次性配置流程**

包含以下命令：

```bash
node scripts/hash-admin-password.mjs "你的后台密码"
cd danmaku-api
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put SESSION_SECRET
npx wrangler d1 migrations apply lidure-danmaku --remote
```

密码哈希和会话密钥只能通过交互输入；README 不写真实密码、哈希或密钥。

- [ ] **Step 6: 运行认证测试和提交**

Run: `npm --prefix danmaku-api test -- auth.test.ts`

Run: `npm --prefix danmaku-api run check`

Expected: 正确/错误密码、篡改 Cookie、过期 Cookie、CORS credentials 和错误码测试通过。

```bash
git add danmaku-api/src/auth.ts danmaku-api/src/index.ts danmaku-api/tests/auth.test.ts scripts/hash-admin-password.mjs danmaku-api/README.md
git commit -m "feat: add password sessions for admin publishing"
```

### Task 4: 完成 R2 媒体上传和幂等数据迁移

**Files:**
- Modify: `danmaku-api/src/media.ts`
- Modify: `danmaku-api/src/index.ts`
- Create: `scripts/import-moments.mjs`
- Create: `scripts/README.md`
- Modify: `.gitignore`
- Test: `danmaku-api/tests/media.test.ts`

**Interfaces:**
- Consumes: 已认证 multipart 请求、D1 moments、R2 `MEDIA` binding。
- Produces: `POST /api/media/upload` 返回 `{ url, key, kind }`；导入脚本生成可重复执行的 SQL 文件。

- [ ] **Step 1: 写媒体校验失败测试**

覆盖：未登录 401、非 multipart 415、空文件 400、未知 MIME 415、图片大于 8 MB 413、视频大于 100 MB 413、合法 image/video 返回 normalized metadata。

```ts
expect(validateUpload({ type: 'image/png', size: 10 })).toEqual({ kind: 'image', extension: 'png' });
expect(() => validateUpload({ type: 'application/x-msdownload', size: 10 })).toThrow('MEDIA_TYPE_NOT_ALLOWED');
```

- [ ] **Step 2: 实现 R2 上传路由**

对象 key 格式固定为 `moments/{YYYY}/{MM}/{uuid}.{ext}`；上传时设置 `httpMetadata.contentType`，返回 `${PUBLIC_MEDIA_BASE_URL}/${key}`。只接受 `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`。

poster 作为 `image/jpeg` 上传，kind 返回 `poster`；Worker 不从视频中抽帧，抽帧职责留在浏览器，避免 Worker CPU 和解码限制。

- [ ] **Step 3: 将 `/api/moments` 写操作绑定到已上传 URL**

创建动态时只接受 `PUBLIC_MEDIA_BASE_URL` 下的 URL，或接受当前 bucket 的 key 并由 Worker 生成 URL；拒绝任意外链，避免借接口做开放代理。D1 写入 moments 和 moment_media 使用 batch/transaction 语义；媒体顺序保持表单顺序。

- [ ] **Step 4: 实现幂等导入脚本**

`node scripts/import-moments.mjs --input src/data/moments.json --output .tmp/moments-import.sql`：

1. 读取数组并检查日期、分类、文本。
2. 以 `sha256(date + '\\0' + category + '\\0' + text + '\\0' + link)` 的前 32 个十六进制字符作为稳定 ID。
3. 输出 `INSERT OR IGNORE INTO moments` 和对应媒体的 `INSERT OR IGNORE`。
4. 输出行数摘要，不打印媒体 Secret 或 Cookie。

运行方式固定为：

```bash
node scripts/import-moments.mjs --input src/data/moments.json --output .tmp/moments-import.sql
cd danmaku-api
npx wrangler d1 execute lidure-danmaku --remote --file ../.tmp/moments-import.sql
```

- [ ] **Step 5: 本地验证重复导入**

Run: `node scripts/import-moments.mjs --input src/data/moments.json --output .tmp/moments-import.sql`

Run twice against a local D1 database and assert `SELECT COUNT(*)` 不增长；检查输出 SQL 只包含已有 15 条 JSON 动态和其图片。

- [ ] **Step 6: Commit**

```bash
git add danmaku-api/src/media.ts danmaku-api/src/index.ts danmaku-api/tests/media.test.ts scripts/import-moments.mjs scripts/README.md .gitignore
git commit -m "feat: upload moment media through R2 and import legacy data"
```

### Task 5: 替换碎碎念前端 API、登录和发布流程

**Files:**
- Create: `src/lib/moments-api.ts`
- Modify: `src/lib/r2-upload.ts`
- Modify: `src/pages/moments.astro`
- Modify: `src/lib/public-interactions.ts`
- Modify: `tests/site-build.test.mjs`

**Interfaces:**
- Consumes: Worker API at `PUBLIC_MOMENTS_API`，会话 Cookie。
- Produces: `fetchMoments()`、`login()`、`logout()`、`getSession()`、`uploadMomentMedia()`、`createMoment()`、`deleteMoment()`。

- [ ] **Step 1: 写客户端 API 错误映射测试**

在 `src/lib/moments-api.ts` 设计统一错误：

```ts
export type ApiErrorCode = 'TIMEOUT' | 'AUTH_REQUIRED' | 'AUTH_INVALID' | 'FORBIDDEN' | 'PAYLOAD_TOO_LARGE' | 'RATE_LIMITED' | 'SERVER_ERROR' | 'NETWORK';
export class MomentsApiError extends Error { code: ApiErrorCode; status?: number; }
export async function fetchMoments(signal?: AbortSignal): Promise<MomentApiItem[]>;
```

测试 401、403、413、429、500、超时都得到对应 code；所有 fetch 管理请求带 `credentials: 'include'`。

- [ ] **Step 2: 替换旧 Token 和浏览器直连 R2**

从 `moments.astro` 删除 `ADMIN_TOKEN_KEY`、token 输入框、保存/清除 localStorage 逻辑和 `Authorization: Bearer`。发布面板改为：

```astro
<button id="moments-login" type="button" data-admin-only hidden>管理员登录</button>
<div id="moments-session" hidden></div>
```

`r2-upload.ts` 保留 `uploadToR2(file, { apiBase })` 导出名，但内部改成 `uploadMomentMedia(file, { apiBase })`，不读取任何 R2 Account ID、Access Key 或 Secret。

- [ ] **Step 3: 实现登录/退出和会话恢复**

进入 `/moments` 后先调用 `GET /auth/session`；未登录只显示“管理员登录”，登录成功由 Worker 设置 Cookie，前端只保留 `isAuthenticated` 布尔状态。退出调用 `/auth/logout` 并立即隐藏发布/删除控件。

- [ ] **Step 4: 增加超时、AbortController、重试和明确状态**

`fetchMoments()` 使用 8 秒超时；页面切换触发 AbortController。失败状态必须包含：

```text
碎碎念暂时加载失败（网络或接口不可用）。[重新加载]
```

重试只重新读取数据，不刷新整页，不重置当前分类筛选。

- [ ] **Step 5: 接入发布和删除**

发布顺序：先上传媒体，全部成功后调用 `POST /moments`；成功使用 API 返回的完整 item 更新 `currentMoments`，不再 2 秒后依赖猜测刷新。上传失败保留文本和未完成媒体；401 时打开登录面板；413/415 显示具体限制。

删除调用 `DELETE /moments/:id`，成功后从内存列表移除并更新统计；删除失败恢复按钮状态。

- [ ] **Step 6: 保留公开评论/表情并改用 Cookie**

`src/lib/public-interactions.ts` 删除 `PUBLIC_ADMIN_TOKEN_KEY`、`getAdminToken()`、`setAdminToken()`、`clearAdminToken()`；评论删除调用 `deleteComment(commentId)`，请求带 `credentials: 'include'`，401 时提示“请先在碎碎念后台登录”。公开评论和表情 POST 不需要 Cookie。

- [ ] **Step 7: 构建和测试**

Run: `npm run check`

Run: `npm test`

Expected: 根构建通过；旧 GitHub Token/R2 Secret 文本不再出现在构建产物；接口异常和重试断言通过。

- [ ] **Step 8: Commit**

```bash
git add src/lib/moments-api.ts src/lib/r2-upload.ts src/pages/moments.astro src/lib/public-interactions.ts tests/site-build.test.mjs
git commit -m "feat: replace token publishing with session-based moments API"
```

### Task 6: 实现视频上传、帧选择和非黑色封面

**Files:**
- Modify: `src/pages/moments.astro`
- Modify: `src/components/HeroSlideshow.astro`
- Create: `src/lib/video-poster.ts`
- Modify: `tests/site-build.test.mjs`

**Interfaces:**
- Consumes: 本地 `File`、可跨域的 R2 video URL、Worker media upload。
- Produces: `captureVideoPoster(fileOrUrl, time)`、用户选择的 `poster` 媒体项、背景管理的有效缩略图。

- [ ] **Step 1: 写视频帧捕获单元测试和构建断言**

测试 `choosePosterTime(duration, requested)`：duration 无效时返回 0.1 秒，正常时限制在 `[0.1, duration - 0.1]`；测试 `video` 输入包含 `poster` 选择控件、`loadedmetadata` 和 `seeked` 事件字样。

- [ ] **Step 2: 实现可靠的浏览器帧捕获**

`src/lib/video-poster.ts` 使用以下生命周期：

```ts
export async function captureVideoPoster(source: string | File, requestedTime = 0.1): Promise<Blob> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'metadata';
  video.crossOrigin = 'anonymous';
  await waitFor(video, 'loadedmetadata', 10_000);
  video.currentTime = choosePosterTime(video.duration, requestedTime);
  await waitFor(video, 'seeked', 10_000);
  if (!video.videoWidth || !video.videoHeight) throw new Error('VIDEO_FRAME_UNAVAILABLE');
  const canvas = document.createElement('canvas');
  const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return await canvasToJpeg(canvas, 0.86);
}
```

在 `finally` 中暂停视频、清除 `src`、调用 `load()` 并释放 Object URL；Canvas `SecurityError` 映射为 `VIDEO_CORS_REQUIRED`。

- [ ] **Step 3: 增加碎碎念视频媒体 UI**

文件选择 `accept="image/*,video/mp4,video/webm"`；每个视频显示预览、时间滑块、当前时间、`使用当前帧` 和 `重新选择`。发布前必须有 poster；若跨域捕获失败，允许上传用户手动选择的 JPEG poster，并提示“此视频源不允许浏览器取帧，请上传封面”。

- [ ] **Step 4: 更新卡片和灯箱渲染**

`normalizeMoment()` 把旧 `images` 转为 image media；视频卡片渲染 `<video poster="..." muted playsinline preload="metadata" controls>`，图片继续使用 lightbox。poster 缺失时显示明确的“封面生成失败”状态，不显示纯黑矩形。

- [ ] **Step 5: 修复背景管理缩略图和跨域兜底**

在 `HeroSlideshow.astro` 的 `drawVideoThumbnail()` 和 `captureVideoPoster()` 中：

1. 创建 video 后先设置 `crossOrigin = 'anonymous'`。
2. 等待 `loadedmetadata`，把目标时间设为 `Math.min(Math.max(duration * 0.12, 0.1), Math.max(duration - 0.1, 0.1))`。
3. 只在 `seeked` 后 `requestAnimationFrame(drawFrame)`。
4. Canvas 绘制抛出 `SecurityError` 时不再使用黑 Canvas，改为显示“需上传封面”的占位并提供封面上传按钮。
5. 设置/读取 `hero_settings.posters`，按视频 URL 保存 poster URL；已有静态图片和本地视频继续兼容。

- [ ] **Step 6: 构建并运行视频回归检查**

Run: `npm run check; npm test`

Expected: 构建产物包含 `loadedmetadata`、`seeked`、`video-poster-range` 和 `poster`；不存在旧的 R2 Secret 读取。

- [ ] **Step 7: Commit**

```bash
git add src/lib/video-poster.ts src/pages/moments.astro src/components/HeroSlideshow.astro tests/site-build.test.mjs
git commit -m "fix: capture selectable video posters instead of black thumbnails"
```

### Task 7: 统一 Astro 页面切换生命周期并降低媒体卡顿

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/HeroSlideshow.astro`
- Modify: `src/components/SekaiPlayer.astro`
- Modify: `src/components/Greeting.astro`
- Modify: `src/pages/moments.astro`
- Modify: `src/styles/global.css`
- Modify: `tests/site-build.test.mjs`

**Interfaces:**
- Consumes: Astro `ClientRouter` lifecycle events。
- Produces: 每次 `astro:page-load` 恰好初始化一次、离开页面停止非必要媒体、支持 `prefers-reduced-motion` 的站点行为。

- [ ] **Step 1: 写生命周期回归断言**

断言每个页面级脚本包含 `astro:page-load` 和 `AbortController` 或等价清理标记；背景视频包含 `visibilitychange`、`pause()` 和 `preload="metadata"`。

- [ ] **Step 2: 在 BaseLayout 建立全局媒体清理事件**

在 `BaseLayout.astro` 的 inline script 增加一次性绑定：

```ts
document.addEventListener('astro:before-swap', () => {
  document.querySelectorAll<HTMLMediaElement>('video[data-page-media], audio[data-page-media]').forEach((media) => {
    media.pause();
    media.removeAttribute('src');
    media.load();
  });
}, { once: true });
```

背景 slideshow video 标记 `data-persistent-media`，由组件自身暂停/复用，不被全局清理误删；播放器音频在离开沉浸页时保留当前播放状态，但不创建第二个 audio 元素。

- [ ] **Step 3: 统一组件初始化和清理**

将 `Greeting`、`HeroSlideshow`、`SekaiPlayer`、`moments` 的初始化都放入可重复安全的 `astro:page-load` handler；每个 handler 使用 `data-*initialized` 或 AbortController，旧页面在 `astro:before-swap` 中 abort。禁止同一脚本同时无条件绑定 `DOMContentLoaded` 和 page-load 两次。

- [ ] **Step 4: 降低全屏效果成本**

在 `global.css` 增加：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}
```

为非首屏图片增加 `loading="lazy" decoding="async"`，对头像/图标保留 width/height；背景视频只在页面可见且非 reduced-motion 时播放。

- [ ] **Step 5: 运行页面切换静态检查和构建**

Run: `npm run check; npm test`

Expected: 静态检查通过；页面脚本没有重复的无清理 document listener；管理和媒体回归断言通过。

- [ ] **Step 6: Commit**

```bash
git add src/layouts/BaseLayout.astro src/components/HeroSlideshow.astro src/components/SekaiPlayer.astro src/components/Greeting.astro src/pages/moments.astro src/styles/global.css tests/site-build.test.mjs
git commit -m "perf: make Astro page transitions media-safe"
```

### Task 8: 统一最终域名、环境变量和部署文档

**Files:**
- Modify: `astro.config.mjs`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/lib/public-interactions.ts`
- Modify: `.env.example`
- Modify: `danmaku-api/wrangler.jsonc`
- Modify: `.github/workflows/deploy.yml`
- Modify: `AGENTS.md`
- Modify: `danmaku-api/README.md`
- Modify: `README.md`
- Modify: `tests/site-build.test.mjs`

**Interfaces:**
- Consumes: `PUBLIC_MOMENTS_API`, `PUBLIC_MEDIA_BASE_URL` 和 Cloudflare custom domain。
- Produces: 构建产物 canonical、sitemap、OG、API CORS 和部署说明均使用 `lidure.xyz`。

- [ ] **Step 1: 把 Astro site 和 fallback 全部切到 `https://lidure.xyz`**

修改 `astro.config.mjs` 的 `site`、BaseLayout 的 fallback、RSS fallback 和所有 `danmaku.lidure22.xyz` 的前端默认地址；保留 Cloudflare Worker 真实 API 地址只在 `.env.example` 中作为可替换配置，不在页面构建中写旧域名。

- [ ] **Step 2: 更新环境变量模板**

`.env.example` 最终只包含：

```text
PUBLIC_MOMENTS_API=https://api.lidure.xyz/api
PUBLIC_MEDIA_BASE_URL=https://media.lidure.xyz
```

删除 `PUBLIC_R2_ACCOUNT_ID`、`PUBLIC_R2_ACCESS_KEY_ID`、`PUBLIC_R2_SECRET_ACCESS_KEY`、`PUBLIC_R2_BUCKET_NAME`。GitHub Actions 使用仓库 Variables 设置 `PUBLIC_MOMENTS_API` 和 `PUBLIC_MEDIA_BASE_URL`，不设置 Secret 到静态页面。

- [ ] **Step 3: 配置 CORS、R2 public custom domain 和 Worker route 文档**

README 写明：`api.lidure.xyz` 指向 Worker，`media.lidure.xyz` 指向 R2 public bucket/custom domain，R2 CORS 允许 GET/HEAD/POST 来源仅为最终站点和本地开发源。文档包含 `wrangler deploy`、D1 migration、R2 binding、两个 secret 设置和一次性 import 顺序。

- [ ] **Step 4: 更新现有架构说明**

`AGENTS.md` 将 Moments 描述改为 D1/R2/Worker；注明 `danmaku-api` 同时承载弹幕、评论、表情和碎碎念 API；注明发布页面不再使用 localStorage Token。

- [ ] **Step 5: 构建和验证最终域名**

Run: `npm run check; npm test`

Expected: sitemap、canonical、OG、Worker 默认 CORS 只出现 `lidure.xyz`；构建产物不出现旧的 R2 access key 名称。

- [ ] **Step 6: Commit**

```bash
git add astro.config.mjs src/layouts/BaseLayout.astro src/lib/public-interactions.ts .env.example danmaku-api/wrangler.jsonc .github/workflows/deploy.yml AGENTS.md danmaku-api/README.md README.md tests/site-build.test.mjs
git commit -m "docs: configure final domain and Cloudflare deployment"
```

### Task 9: 完整验证、部署前检查和交付

**Files:**
- Modify only if a verification failure is within this scope.
- Create: `docs/superpowers/verification/2026-08-12-cloudflare-publishing.md`

**Interfaces:**
- Consumes: 完整源码、Worker 本地环境、Cloudflare 资源配置。
- Produces: 构建通过、Worker 测试通过、手动验收记录和部署命令清单。

- [ ] **Step 1: 安装并检查两套依赖**

Run: `npm ci`

Run: `npm --prefix danmaku-api ci`

Run: `npm run check`

Run: `npm --prefix danmaku-api run check`

Expected: 两个 TypeScript 检查退出码为 0。

- [ ] **Step 2: 运行自动化测试**

Run: `npm test`

Run: `npm --prefix danmaku-api test`

Expected: Astro 构建、站点测试、认证、媒体、D1 访问和接口契约测试全部通过。

- [ ] **Step 3: 启动本地 Worker 和站点进行手动验收**

Worker：`cd danmaku-api; npx wrangler dev --local --persist-to .wrangler/state`

站点：`npm run dev -- --host 127.0.0.1`

依次验证：

1. 未登录访问 `/moments` 能加载数据，接口断开时出现错误和重试按钮。
2. 正确密码登录后，发布无媒体、图片和视频动态；刷新后都保留。
3. 错误密码、过期 Cookie、超大文件、错误 MIME 都有对应提示。
4. 删除动态和评论需要会话；公开评论/表情仍可使用。
5. 视频选择首帧、中间帧、末帧，封面都显示有效画面；跨域失败时提示上传封面。
6. 首页、碎碎念、文章、沉浸页面往返切换 10 次，无重复 audio/video、无重复事件造成的重复请求。
7. Chrome DevTools 观察 `/api/moments` 公开 GET 使用缓存，管理 POST/DELETE/上传为 no-store。

- [ ] **Step 4: 执行部署前 Cloudflare 检查**

Run: `cd danmaku-api; npx wrangler d1 migrations list lidure-danmaku --remote`

Run: `npx wrangler r2 bucket list`

Run: `npx wrangler deploy`

Run: `npx wrangler d1 execute lidure-danmaku --remote --file ../.tmp/moments-import.sql`

Expected: migration 已应用、R2 bucket 存在、Worker 部署成功、重复导入不增加行数。用户需在 Cloudflare Dashboard 完成 `api.lidure.xyz` 和 `media.lidure.xyz` 的 custom domain/路由确认。

- [ ] **Step 5: 记录验证结果**

`docs/superpowers/verification/2026-08-12-cloudflare-publishing.md` 记录日期、命令、结果、Cloudflare 资源名称和仍需用户在 Dashboard 完成的步骤；不记录密码、哈希、Cookie、Access Key 或媒体内容。

- [ ] **Step 6: 检查工作区和提交范围**

Run: `git diff --check`

Run: `git status --short`

Run: `git log --oneline --decorate -12`

Expected: 没有构建产物、`.env`、R2 密钥、`.wrangler/state` 或临时 SQL 被提交；只有本计划覆盖的源文件、测试、迁移和文档发生变化。

- [ ] **Step 7: Commit verification record**

```bash
git add docs/superpowers/verification/2026-08-12-cloudflare-publishing.md
git commit -m "test: record Cloudflare publishing verification"
```

## Plan Self-Review

- Spec coverage: D1/R2 数据模型在 Task 2；认证和 Cookie 在 Task 3；上传和幂等迁移在 Task 4；碎碎念加载/发布/删除在 Task 5；视频帧封面在 Task 6；页面切换和性能在 Task 7；最终域名/CORS/部署在 Task 8；自动与手动验收在 Task 9。
- Placeholder scan: 计划不依赖 TBD、TODO 或“稍后实现”；所有 Cloudflare Secret 都有明确名称和设置命令。
- Type consistency: `MomentApiItem`、`fetchMoments()`、`uploadMomentMedia()`、`requireSession()` 和认证 Cookie 名称在相邻任务中保持一致；旧 `images` 字段作为兼容输出，不会与新 `media` 字段冲突。
- Scope check: 计划复用现有 `danmaku-api`，避免另起 Worker 破坏现有弹幕/评论/表情数据；不会迁移音乐播放器或改变站点视觉系统。
