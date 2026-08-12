# AGENTS.md

## Project

Astro 6 Chinese-language blog deployed to GitHub Pages via GitHub Actions.

Final public domains:

- Site: `https://lidure.xyz`
- Worker API base: `https://api.lidure.xyz/api`
- Public media base: `https://media.lidure.xyz`

## Commands

- `npm run dev` — local dev server
- `npm run build` — runs `astro check && astro build` (type-checks before building)
- `npm run check` — type-check only (no build)
- `npm run test:site` — checks built-site contracts
- `npm test` — builds the site and runs site contracts
- `npm --prefix danmaku-api run check` — Worker TypeScript check
- `npm --prefix danmaku-api test` — Worker Vitest suite

No linter or formatter is configured.

## Architecture

- **Content**: Markdown blog posts in `src/content/blog/` — schema defined in `src/content.config.ts` (title, description, pubDate, tags, featured, draft)
- **Moments**: Legacy microblog data remains in `src/data/moments.json` and is imported to Cloudflare D1 with `scripts/import-moments.mjs`. Runtime moments publishing reads/writes through the `danmaku-api` Worker, stores records in D1, and stores uploaded media in the `MEDIA` R2 bucket.
- **Public API**: `danmaku-api` carries the shared API for danmaku, comments, reactions, guestbook messages, moments, auth, and media upload.
- **Admin publishing**: The moments publishing UI uses `PUBLIC_MOMENTS_API` and HttpOnly session cookies from the Worker. It does not store admin tokens or R2 credentials in `localStorage`.
- **Search**: Client-side Fuse.js over post metadata, no server
- **Math**: KaTeX via remark-math + rehype-katex (configured in `astro.config.mjs`)
- **Layout**: Single layout at `src/layouts/BaseLayout.astro`, all pages use it
- **Components**: All in `src/components/` — Astro-only (no React/Vue/Svelte)
- **Deployment**: Push to `main` triggers GitHub Actions → builds with repository Variables → deploys `dist/` to Pages

## Gotchas

- `.npmrc` sets `legacy-peer-deps=true` — dependency resolution is non-standard
- `npm run build` includes `astro check` — type errors block the build
- Path alias: `@/*` maps to `src/*` (defined in `tsconfig.json`)
- Content collection uses `glob` loader (not legacy `content/` directory convention)
- `public/moments/` is legacy/static data only; new moment media is served from `https://media.lidure.xyz`
- No Astro API routes exist (`src/pages/api/` is empty); runtime APIs live in `danmaku-api`
- Preserve the existing D1 database id and R2 bucket binding in `danmaku-api/wrangler.jsonc` unless explicitly asked to rotate resources
