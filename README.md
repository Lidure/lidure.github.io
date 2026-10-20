# Lidure Blog

A Chinese personal blog built with Astro and published to GitHub Pages.

## Public domains

- Site: `https://lidure.xyz`
- Worker API base: `https://api.lidure.xyz/api`
- Media base: `https://media.lidure.xyz`

## Native gallery management and Cloud integration

The Blog's `/gallery/manage` page is a **native Astro workspace** maintained in this
repository (`src/components/GalleryManageWorkspace.astro` and
`src/lib/gallery-manage-controller.mjs`). It is not an iframe that automatically
loads Airi Gallery Cloud's UI from the plugin repository. Both sites share the
remote GitHub image data (`Lidure/airi-gallery-images/main`) and selected Cloud
image/upload endpoints, **not frontend feature releases**.

**Move images in the Blog:** connect GitHub with a token that can write to the
gallery repository; open a category and select the image's **移动** button, or
choose **批量移动** for up to 50 images across pages within one category.
Select an existing/new destination, inspect the thumbnail grid (tap to enlarge),
choose **预览迁移**, then **确认移动** within five minutes.

The transaction reuses existing Git Blob SHA identifiers and moves image paths
and the perceptual index in one non-force GitHub commit. It rejects stale branch
HEADs, invalid filenames, duplicate global image IDs, missing index entries and
target collisions. Read-only browsing and normal upload/delete are unaffected.

Updating the Airi Gallery Cloud code does not deploy the Blog frontend. Blog
releases are published by `.github/workflows/deploy.yml` after changes merge into
this repository's `main` branch. The Cloud Worker still handles shared images,
catalog and upload proxy operations separately.

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
