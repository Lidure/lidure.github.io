# 弹幕 API 接入步骤

这是沉浸播放器的公共弹幕后端，运行在 Cloudflare Workers，数据存在 D1。

## 1. 登录 Cloudflare

```bash
cd danmaku-api
npx wrangler login
```

## 2. 创建 D1 数据库

```bash
npx wrangler d1 create lidure-danmaku
```

把输出里的 `database_id` 填到 `danmaku-api/wrangler.jsonc`：

```jsonc
"database_id": "这里填 Cloudflare 输出的 database_id"
```

## 3. 初始化数据库表

```bash
npx wrangler d1 migrations apply lidure-danmaku --remote
```

## 4. 部署 Worker

```bash
npm run deploy
```

部署后会得到类似这样的地址：

```text
https://lidure-danmaku-api.<你的账号>.workers.dev
```

## 5. 配置主站

在 GitHub Pages 的构建环境里添加：

```text
PUBLIC_DANMAKU_API=https://lidure-danmaku-api.<你的账号>.workers.dev/api/danmaku
```

如果只在本地测试，可以在仓库根目录的 `.env` 里加同样一行。

## 6. 本地联调

开两个终端：

```bash
cd danmaku-api
npm run dev
```

```bash
cd ..
npm run dev
```

本地联调时主站 `.env` 可以先填：

```text
PUBLIC_DANMAKU_API=http://localhost:8787/api/danmaku
```
