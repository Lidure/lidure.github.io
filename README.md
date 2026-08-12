# Lidure Blog

A Chinese personal blog built with Astro and published to GitHub Pages.

## Public domains

- Site: `https://lidure.xyz`
- Worker API base: `https://api.lidure.xyz/api`
- Media base: `https://media.lidure.xyz`

## Development

```bash
npm install
npm run dev
```

For local Worker integration, create a private `.env` file in the repo root:

```text
PUBLIC_MOMENTS_API=http://localhost:8787/api
PUBLIC_MEDIA_BASE_URL=https://media.lidure.xyz
```

Do not put Worker secrets, R2 access keys, cookies, or admin passwords in frontend environment variables.

## Build and checks

```bash
npm run check
npm run build
npm run test:site
npm test
```

Worker checks live in `danmaku-api`:

```bash
npm --prefix danmaku-api run check
npm --prefix danmaku-api test
```

## GitHub Pages deployment

Push to `main` and let GitHub Actions publish `dist/` to GitHub Pages.

Configure repository Variables (not Secrets) for the static build:

```text
PUBLIC_MOMENTS_API=https://api.lidure.xyz/api
PUBLIC_MEDIA_BASE_URL=https://media.lidure.xyz
```

The static site should only receive public values. Admin authentication is handled by the Worker with HttpOnly cookies.

## Cloudflare deployment summary

The `danmaku-api` Worker handles danmaku, comments, reactions, guestbook messages, moments, authentication, and media upload.

- `api.lidure.xyz` routes to the Worker custom domain.
- `media.lidure.xyz` serves the public R2 media bucket/custom domain.
- D1 stores API data and moments metadata.
- R2 stores uploaded image/video/poster objects.

See `danmaku-api/README.md` for the Worker setup, migrations, secrets, R2 CORS, deployment, and import sequence.
