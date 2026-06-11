# AGENTS.md

## Project

Astro 6 blog deployed to GitHub Pages via GitHub Actions. Chinese language site.

## Commands

- `npm run dev` — local dev server
- `npm run build` — runs `astro check && astro build` (type-checks before building)
- `npm run check` — type-check only (no build)

No test suite, no linter, no formatter configured.

## Architecture

- **Content**: Markdown blog posts in `src/content/blog/` — schema defined in `src/content.config.ts` (title, description, pubDate, tags, featured, draft)
- **Moments**: Microblog data in `src/data/moments.json`, typed in `src/data/moments.ts`. Categories: 游戏/音乐/生活. Images uploaded to Cloudflare R2 via client-side S3 API (`src/lib/r2-upload.ts`). R2 credentials stored in localStorage.
- **Search**: Client-side Fuse.js over post metadata, no server
- **Math**: KaTeX via remark-math + rehype-katex (configured in `astro.config.mjs`)
- **Layout**: Single layout at `src/layouts/BaseLayout.astro`, all pages use it
- **Components**: All in `src/components/` — Astro-only (no React/Vue/Svelte)
- **Deployment**: Push to `main` triggers GitHub Actions → builds → deploys `dist/` to Pages

## Gotchas

- `.npmrc` sets `legacy-peer-deps=true` — dependency resolution is non-standard
- `npm run build` includes `astro check` — type errors block the build
- Path alias: `@/*` maps to `src/*` (defined in `tsconfig.json`)
- Content collection uses `glob` loader (not legacy `content/` directory convention)
- `public/moments/` directory is gitignored — moment images are uploaded via GitHub API at runtime
- No API routes exist (`src/pages/api/` is empty)
