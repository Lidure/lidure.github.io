# Airi Gallery Blog Integration Design

Date: 2026-09-22

## Goal

Integrate the public Airi Gallery experience into `Lidure/lidure.github.io` as a first-class Blog page while preserving `Airi Gallery Cloud` as the single management surface for uploads, deletion, duplicate review, repository configuration, and write credentials.

The result has two modes:

1. A native public `/gallery` page styled and loaded like the rest of the Blog.
2. A hidden management mode that lazily embeds `https://airigallery.lidure22.xyz/` only when explicitly requested.

This design spans two repositories:

- Blog: `Lidure/lidure.github.io`
- Gallery Cloud/plugin: `Lidure/astrbot_plugin_airi_gallery`

The public image repository remains `Lidure/airi-gallery-images`, branch `main`.

## Non-goals

- Do not copy Airi Gallery Cloud's upload/delete/deduplication implementation into the Blog.
- Do not store, read, forward, or persist a GitHub/Gitee token in Blog code.
- Do not expose repository configuration controls to normal Blog visitors.
- Do not replace the existing Airi Gallery Cloud deployment.
- Do not refactor unrelated Blog pages or unrelated Airi Gallery plugin code.

## Current Constraints

The Blog uses `BaseLayout.astro`, `SiteHeader.astro`, Astro ClientRouter navigation, shared theme variables, and multiple page-specific style layers.

Airi Gallery Cloud currently:

- provides anonymous read access to the built-in public gallery;
- keeps the token out of persisted `localStorage` configuration;
- handles upload, delete, duplicate review, manifest updates, and synchronization;
- exposes a same-origin image proxy at `/__gallery-image/<gallery-path>` backed by `Lidure/airi-gallery-images/main` with Cloudflare caching;
- blocks all framing through both CSP `frame-ancestors 'none'` and `X-Frame-Options: DENY`.

The public gallery index is `gallery/gallery_index.json`. The Cloud viewer already prefers this manifest for anonymous reads and falls back to GitHub's tree API only when necessary. The Blog viewer will use the manifest directly and will not depend on unauthenticated GitHub API quota for its normal path.

## Architecture

### Public mode

`/gallery` is a native Astro page inside the Blog. It uses the existing Blog layout and navigation, but its gallery browser is purpose-built for public read-only use.

The page loads metadata from:

`https://raw.githubusercontent.com/Lidure/airi-gallery-images/main/gallery/gallery_index.json`

Only safe image paths with exactly this shape are accepted:

`gallery/<category>/<filename>.<supported-image-extension>`

Supported extensions match the current Cloud manifest reader: BMP, GIF, JPEG/JPG/JFIF, PNG, TIFF/TIF, and WebP.

Images are rendered through the existing Cloud image proxy:

`https://airigallery.lidure22.xyz/__gallery-image/<encoded-gallery-path>`

This keeps image delivery behind the existing Cloudflare cache instead of making each visitor fetch image data through GitHub API calls.

### Management mode

Management mode is not rendered or fetched during a normal `/gallery` visit.

It can be entered by either:

- opening `/gallery?manage=1`; or
- pressing `Ctrl + Alt + G` while on `/gallery`.

There is no visible management button in the public gallery UI.

Entering management mode creates a full-screen Blog-owned overlay and then creates an iframe whose source is:

`https://airigallery.lidure22.xyz/`

The Blog only owns the overlay shell and close/return control. The iframe owns all repository settings, token input, synchronization, uploads, deletion, duplicate review, confirmations, and write errors.

Closing management mode removes the iframe node rather than merely hiding it. This ends the embedded Cloud runtime and discards any in-memory token held by that frame.

The hidden entry is a convenience mechanism, not an authorization boundary. Anyone who knows the URL can open the management interface, but write access still requires a valid token inside Airi Gallery Cloud.

## Security Boundary

The Blog must never receive the management token.

Specifically:

- no token field is added to Blog UI;
- no token is written to Blog `localStorage`, `sessionStorage`, cookies, URL parameters, or source code;
- no `postMessage` protocol transports credentials between parent and iframe;
- the Blog does not call Gallery write APIs;
- the iframe remains cross-origin and isolated by the browser.

Airi Gallery Cloud's `_headers` must be changed so that framing is permitted only from the canonical Blog origin:

`Content-Security-Policy: ...; frame-ancestors https://lidure22.xyz; ...`

`X-Frame-Options: DENY` must be removed because it would continue to block the allowed frame and modern `X-Frame-Options` cannot express a single external allowed origin safely.

No wildcard frame ancestor is allowed. Preview domains, arbitrary third-party origins, and HTTP origins remain unable to embed Cloud.

All existing Cloud restrictions unrelated to framing remain intact, including same-origin checks on the large GitHub blob upload proxy.

## Blog Components

### `src/pages/gallery.astro`

Responsibilities:

- render the gallery page through `BaseLayout`;
- supply page title and description;
- compose the browser, lightbox, and manager components;
- avoid embedding remote gallery data at build time.

### `src/components/GalleryBrowser.astro`

Responsibilities:

- load and validate the public manifest;
- derive categories and naturally sorted image lists;
- render category tabs, pagination, loading state, error state, and refresh action;
- request only images needed by the current page;
- prefetch at most two non-GIF images from the next page during idle time.

This component has no management/write behavior.

### `src/components/GalleryLightbox.astro`

Responsibilities:

- display the selected image in a Blog-style full-screen viewer;
- support previous/next navigation;
- close on `Escape`;
- support keyboard arrow navigation;
- support touch swipe on mobile;
- preserve GIF animation;
- preload only the immediate previous and next image.

### `src/components/GalleryManager.astro`

Responsibilities:

- install the `Ctrl + Alt + G` handler while `/gallery` is active;
- detect initial `?manage=1`;
- create the management iframe only when management mode opens;
- provide a Blog-owned header with close and direct-open controls;
- remove iframe and listeners during close and Astro navigation cleanup.

The hotkey path does not mutate the URL. Closing a query-parameter-launched manager removes `manage=1` from the current URL with `history.replaceState` so refresh returns to public mode.

### `src/lib/gallery-*.mjs`

Pure utilities should own logic that can be unit tested without DOM:

- manifest validation and safe path classification;
- category grouping;
- natural sorting;
- pagination calculations;
- image proxy URL generation.

### `src/styles/gallery.css`

Gallery-specific layout, skeletons, modal, responsive grid, and management overlay styles live here rather than expanding the global Firefly style files.

## Navigation

`SiteHeader.astro` adds `画廊` to the primary navigation, alongside 首页 / 文章 / 碎碎念 / 留言.

The active state follows the existing `currentPath.startsWith(href)` convention.

## Public Gallery UX

The page follows the Blog's existing translucent cards, theme hue, border, radius, and dark/light variables rather than copying the Cloud administration visual style.

### Layout

- Desktop: responsive 4-5 column grid depending on available width.
- Tablet: 3 columns.
- Mobile: 2 columns.
- Default page size: 24 images.
- Thumbnails use a consistent card box with `object-fit: contain` so source images are not cropped.
- GIFs remain animated.
- Category names use compact pill tabs.
- Category names and filenames use natural/numeric sorting for deterministic order.

### Motion and accessibility

- Hover uses only subtle scale/shadow treatment.
- `prefers-reduced-motion` disables nonessential transitions.
- Interactive elements are keyboard reachable and have accessible labels.
- Lightbox focus remains within its controls while open and returns to the triggering item on close.
- The management overlay has an explicit accessible close control.

## Data Loading and Cache Policy

### Manifest

Normal public loading first checks a `sessionStorage` cache keyed to the fixed manifest URL. The cache stores both the validated manifest-derived path list and its fetch timestamp.

- Freshness window: 5 minutes.
- Maximum stale fallback age: 24 hours.
- A valid fresh cache can render immediately without a network request.
- The explicit `刷新图库` action invalidates that entry and performs a `cache: 'no-store'` fetch.
- When the network fetch succeeds, the cache is replaced with newly validated data and a new timestamp.
- When the network fails but a previously validated cache is between 5 minutes and 24 hours old, stale data remains usable and the page shows a non-blocking stale/offline notice.
- Cache entries older than 24 hours are discarded rather than shown as gallery truth.
- When neither network nor acceptable cached data is available, the Blog shell remains visible and the gallery shows a retryable error state.

This gives newly uploaded images a manual refresh path without requiring a Blog rebuild.

### Images

- Only the current page's `<img>` elements are created.
- The first image is `loading="eager"` with high fetch priority so the page gets a prompt visual anchor.
- Every remaining grid image uses native lazy loading and asynchronous decoding.
- Idle prefetch is limited to the first two non-GIF images from the next page.
- GIFs are never next-page-prefetched.
- Lightbox prefetch is limited to the immediate previous and next image selected by navigation order.

The image proxy already supplies public cache headers and Cloudflare edge caching, so the Blog does not add a second image-fetch/cache subsystem.

## Astro ClientRouter Lifecycle

All page-global listeners and temporary resources must be safe across Astro transitions.

On initialization:

- bind gallery keyboard handlers once for the current page instance;
- create AbortControllers for manifest and prefetch work where appropriate.

On `astro:before-swap` or component teardown:

- remove gallery hotkey and lightbox keyboard listeners;
- abort outstanding gallery metadata requests;
- cancel pending idle prefetch callbacks where supported;
- remove the management iframe;
- release temporary object references.

Re-entering `/gallery` must not duplicate listeners or cause one shortcut press to open multiple overlays.

## Cloud Repository Change

In `Lidure/astrbot_plugin_airi_gallery`, only the Cloud framing policy is changed for this integration.

`pages/zz_cloud/_headers` changes from blocking all frame ancestors to allowing only `https://lidure22.xyz`, and removes `X-Frame-Options: DENY`.

Upload, delete, synchronization, manifest, perceptual duplicate detection, GitHub/Gitee configuration, and Worker upload proxy behavior remain unchanged.

A regression test must assert:

- CSP contains `frame-ancestors https://lidure22.xyz`;
- CSP does not contain wildcard frame ancestors;
- `X-Frame-Options: DENY` is absent;
- existing restrictive headers remain present.

## Error Handling

### Manifest unavailable

Show a compact in-page error card with retry. Do not fail the whole Astro page.

### Individual image unavailable

Replace only that tile with an image-failed placeholder and retry control. Other tiles continue rendering.

### Management iframe unavailable

The management overlay header always includes a direct-open link to `https://airigallery.lidure22.xyz/`, independent of iframe state.

After the iframe is created:

- show a loading state until its `load` event;
- if no `load` event is observed within 12 seconds, show a non-destructive warning with retry, direct-open, and close controls;
- keep the iframe mounted so a slow load can still complete unless the user retries or closes.

Because the iframe is cross-origin, the parent cannot reliably inspect the rendered Cloud document or distinguish every browser-level CSP/frame error from a successful navigation. The Cloud framing contract test and production smoke test are therefore the primary protection against framing regressions; the 12-second warning is a best-effort usability fallback, not a security check.

### Cross-origin framing regression

If future Cloud headers accidentally forbid embedding, Blog public browsing remains unaffected. The always-visible direct-open control ensures management is still reachable even if the embedded surface fails.

## Testing Strategy

### Blog repository

Add tests for:

- primary navigation includes `/gallery`;
- manifest parser accepts only safe `gallery/<category>/<image>` paths;
- unsupported, nested, traversal-like, or malformed paths are rejected;
- category and image sorting is deterministic;
- pagination boundaries are correct;
- image proxy URLs are encoded safely;
- cache freshness uses 5 minutes and stale fallback is capped at 24 hours;
- normal source does not eagerly include/create the Cloud iframe;
- `?manage=1` and `Ctrl + Alt + G` are both supported;
- close/ClientRouter teardown removes the management iframe and listeners;
- only the first grid image is eager and remaining thumbnails are lazy/async;
- next-page prefetch is capped at two non-GIF images;
- management overlay always provides the direct-open fallback.

Run the existing full Blog test/build suite after the new tests pass.

### Airi Gallery repository

Add a framing-header contract test and run the existing Cloud/plugin test suite relevant to `pages/zz_cloud` plus the repository's normal regression suite.

## Deployment and Integration Order

Because the production Cloud deployment currently refuses framing, integration is delivered in this order:

1. Implement and verify the Airi Gallery Cloud header change on its own branch/PR.
2. Merge and deploy the Cloud header change first.
3. Verify production `airigallery.lidure22.xyz` now permits framing only from `https://lidure22.xyz` while direct Cloud management still works.
4. Implement the Blog `/gallery` feature on its own branch/PR.
5. Run the Blog full regression suite and verify public gallery behavior.
6. Verify the production Blog management iframe against the already-updated Cloud deployment.
7. Merge the Blog PR.

This ordering prevents a merged Blog page from advertising a management mode that production Cloud still blocks.

## Acceptance Criteria

The integration is complete when all of the following are true:

1. The Blog primary navigation contains `画廊` and `/gallery` looks native to the Blog.
2. A visitor with no token can browse all valid manifest categories and images.
3. Uploading a new image through Airi Gallery Cloud does not require rebuilding the Blog; `刷新图库` makes it visible after the manifest update is available.
4. Static images and GIFs display correctly without loading the entire repository at page entry.
5. Lightbox navigation works with mouse/touch and keyboard, and closes with `Escape`.
6. `/gallery?manage=1` opens management mode.
7. `Ctrl + Alt + G` opens management mode while on `/gallery`.
8. A normal `/gallery` load does not request Airi Gallery Cloud's management document or management JavaScript.
9. Closing management mode removes the iframe and therefore destroys its in-memory token state.
10. Blog code never handles a repository token or performs a write operation.
11. Airi Gallery Cloud can be framed by `https://lidure22.xyz` and not by arbitrary origins.
12. Existing Airi Gallery write, upload, delete, synchronization, and deduplication behavior is unchanged.
13. Existing Blog pages remain visually and behaviorally unaffected.
14. New tests and both repositories' relevant existing regression suites pass.
