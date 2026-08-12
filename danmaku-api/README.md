# Lidure Worker API

This Cloudflare Worker serves the public API for danmaku, comments, reactions, guestbook messages, moments, admin sessions, and media upload.

Final endpoints:

- Worker custom domain: `https://api.lidure.xyz`
- API base used by the Astro site: `https://api.lidure.xyz/api`
- Public media domain: `https://media.lidure.xyz`

## 1. Install and log in

```bash
cd danmaku-api
npm ci
npx wrangler login
```

## 2. Resource configuration

`wrangler.jsonc` is the source of truth for bindings and should preserve the existing D1 database id and R2 bucket name:

- D1 binding: `DB`
- D1 database name: `lidure-danmaku`
- D1 migrations directory: `./migrations`
- R2 binding: `MEDIA`
- R2 bucket name: `lidure-media`
- Worker custom domain route: `api.lidure.xyz`

The Worker variables are public/non-secret configuration:

```jsonc
"vars": {
  "ALLOWED_ORIGINS": "https://lidure.xyz,https://www.lidure.xyz,http://localhost:4321,http://127.0.0.1:4321",
  "PUBLIC_MEDIA_BASE_URL": "https://media.lidure.xyz"
}
```

## 3. Apply D1 migrations

Run migrations after reviewing the target account/project:

```bash
cd danmaku-api
npx wrangler d1 migrations apply lidure-danmaku --remote
```

## 4. Configure admin secrets

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

- Paste the generated `pbkdf2$sha256$310000$...` string into `ADMIN_PASSWORD_HASH`.
- Use a new high-entropy random string for `SESSION_SECRET`.
- Never commit or paste real passwords, password hashes, session secrets, cookies, or access keys into docs, source files, `.env`, screenshots, or build logs.

## 5. Configure R2 public media

Configure `media.lidure.xyz` as the public custom domain for the R2 media bucket.

R2 CORS should allow only the final site and local development origins. Use GET/HEAD for public reads and include POST only if the dashboard requires it for the chosen upload flow:

```json
[
  {
    "AllowedOrigins": [
      "https://lidure.xyz",
      "https://www.lidure.xyz",
      "http://localhost:4321",
      "http://127.0.0.1:4321"
    ],
    "AllowedMethods": ["GET", "HEAD", "POST"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Frontend builds do not use R2 account ids, access keys, secret keys, or bucket credentials.

## 6. Deploy the Worker

This repository task does not deploy automatically. When ready, deploy manually:

```bash
cd danmaku-api
npm run deploy
```

Confirm in Cloudflare that `api.lidure.xyz` is active for the Worker custom domain and that `media.lidure.xyz` serves the R2 bucket.

## 7. Import legacy moments

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

## 8. Local development

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
PUBLIC_MEDIA_BASE_URL=https://media.lidure.xyz
```

## 9. Checks

```bash
npm --prefix danmaku-api run check
npm --prefix danmaku-api test
```
