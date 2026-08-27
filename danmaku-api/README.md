# Lidure Worker API

This Cloudflare Worker serves the public API for danmaku, comments, reactions, guestbook sticky notes, moments, admin sessions, and media upload.

Current production endpoints:

- Site: `https://lidure22.xyz`
- Worker custom domain: `https://api.lidure22.xyz`
- API base used by the Astro site: `https://api.lidure22.xyz/api`
- Public media base: `https://api.lidure22.xyz/media`

## 1. Install and log in

```bash
cd danmaku-api
npm ci
npx wrangler login
```

## 2. Resource configuration

`wrangler.jsonc` is the source of truth for bindings and domains. Preserve the existing D1 database id and R2 bucket name:

- D1 binding: `DB`
- D1 database name: `lidure-danmaku`
- D1 migrations directory: `./migrations`
- R2 binding: `MEDIA`
- R2 bucket name: `lidure-media`
- Worker custom domain route: `api.lidure22.xyz`

The Worker variables are public/non-secret configuration:

```jsonc
"vars": {
  "ALLOWED_ORIGINS": "https://lidure22.xyz,https://www.lidure22.xyz,http://localhost:4321,http://127.0.0.1:4321",
  "PUBLIC_MEDIA_BASE_URL": "https://api.lidure22.xyz/media"
}
```

## 3. Configure admin secrets

Generate an admin password hash from the repository root:

```bash
node scripts/hash-admin-password.mjs "你的后台密码"
```

Then set the Worker secrets interactively:

```bash
cd danmaku-api
npx wrangler secret put ADMIN_PASSWORD_HASH
npx wrangler secret put SESSION_SECRET
```

Never commit or paste real passwords, password hashes, session secrets, cookies, or access keys into docs, source files, `.env`, screenshots, or build logs.

## 4. Sticky message board migration

The sticky message board requires migration `0008_sticky_message_board.sql`. It adds note layout/ownership metadata and message reactions while preserving existing message ids, author ids, text, timestamps, and comments.

Apply migrations **before** deploying frontend code that expects sticky-note fields or the PATCH/message-reaction routes:

```bash
cd danmaku-api
npm ci
npm run check
npm test
npx wrangler d1 migrations apply lidure-danmaku --remote
npm run deploy
```

Production activation order:

1. Run the Worker checks and tests.
2. Apply D1 migration `0008_sticky_message_board.sql` remotely.
3. Deploy the Worker.
4. Smoke-test the message API and CORS/PATCH capability.
5. Only then deploy/merge the frontend.

Smoke checks:

```bash
curl -sS 'https://api.lidure22.xyz/api/messages?limit=1'
curl -i -X OPTIONS 'https://api.lidure22.xyz/api/messages' \
  -H 'Origin: https://lidure22.xyz'
```

The GET response must contain `items`, `now`, and `nextCursor`. Each returned item must preserve `id`, `userId`, `text`, and `createdAt`, and include `note`. OPTIONS must allow `GET,POST,PATCH,DELETE,OPTIONS` for the production origin.

### Sticky message routes

- `GET /api/messages?limit=100` — newest notes, with stable note metadata and pagination cursors.
- `GET /api/messages?since=<cursor>&limit=100` — incremental synchronization used by the live board.
- `POST /api/messages` — create a note; returns the public item plus a one-time anonymous `authorToken` for the creating browser.
- `PATCH /api/messages` — edit/reposition a note using its anonymous author token, or an authenticated admin session.
- `DELETE /api/messages` — delete using the author token, or an authenticated admin session.
- `POST /api/message-reactions` — toggle one of the approved message Emoji reactions.

Anonymous author tokens belong only in browser local storage. Do not put them in DOM attributes, URLs, logs, documentation examples, or analytics.

## 5. Media

The R2 bucket is exposed through the Worker media route configured by `PUBLIC_MEDIA_BASE_URL`. Frontend builds do not use R2 account ids, access keys, secret keys, or bucket credentials.

## 6. Import legacy moments

Generate an idempotent SQL import from the repository root:

```bash
node scripts/import-moments.mjs --input src/data/moments.json --output .tmp/moments-import.sql
```

Review the generated SQL, then apply it:

```bash
cd danmaku-api
npx wrangler d1 execute lidure-danmaku --remote --file ../.tmp/moments-import.sql
```

The import script uses stable ids and `INSERT OR IGNORE`, so rerunning the same import should not duplicate existing moments.

## 7. Local development

Run the Worker and the Astro site in two terminals:

```bash
cd danmaku-api
npm run dev
```

```bash
npm run dev
```

Use a private root `.env` for local integration:

```text
PUBLIC_MOMENTS_API=http://localhost:8787/api
PUBLIC_MEDIA_BASE_URL=http://localhost:8787/media
```

## 8. Verification

From the repository root:

```bash
npm --prefix danmaku-api run check
npm --prefix danmaku-api test
npm run check
npm run test:site
npm run build
npm test
```

All commands must pass before production activation.
