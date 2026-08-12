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

## 4. 一次性配置管理员密码和会话密钥

先在仓库根目录生成密码哈希，再进入 Worker 目录交互式写入 Secret：

```bash
node scripts/hash-admin-password.mjs "你的后台密码"
cd danmaku-api
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put SESSION_SECRET
```

- `ADMIN_PASSWORD_HASH` 粘贴上一步生成的整条 `pbkdf2$sha256$310000$...` 字符串
- `SESSION_SECRET` 输入一条新的高强度随机字符串，只使用一次，不要提交到仓库
- 不要把明文密码、哈希值或会话密钥写进 README、`.env`、代码或截图

## 5. 部署 Worker

```bash
npm run deploy
```

部署后会得到类似这样的地址：

```text
https://lidure-danmaku-api.<你的账号>.workers.dev
```

## 6. 配置主站

在 GitHub Pages 的构建环境里添加：

```text
PUBLIC_DANMAKU_API=https://lidure-danmaku-api.<你的账号>.workers.dev/api/danmaku
```

如果只在本地测试，可以在仓库根目录的 `.env` 里加同样一行。

## 7. 本地联调

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
