# Airi Gallery Blog Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class native `/gallery` page to `Lidure/lidure.github.io` for public browsing, while keeping upload/delete/deduplication management inside Airi Gallery Cloud and exposing that management UI only through an explicitly opened cross-origin iframe.

**Architecture:** The integration is delivered in two sequential repository changes. First, `Lidure/astrbot_plugin_airi_gallery` relaxes only its frame policy so `https://lidure22.xyz` may embed Cloud while all existing write/auth behavior stays unchanged. Second, `Lidure/lidure.github.io` adds a native read-only gallery that loads the public manifest at runtime, renders images through the Cloud image proxy, and lazily creates the Cloud iframe only for `?manage=1` or `Ctrl+Alt+G`.

**Tech Stack:** Astro 6, browser DOM APIs, sessionStorage, native lazy loading, Node.js `node:test`, Python/pytest, Cloudflare Pages/Workers headers, GitHub-hosted gallery manifest.

**Spec:** `docs/superpowers/specs/2026-09-22-airi-gallery-blog-integration-design.md`

## Global Constraints

- Public gallery repository remains `Lidure/airi-gallery-images`, branch `main`.
- Public manifest URL is `https://raw.githubusercontent.com/Lidure/airi-gallery-images/main/gallery/gallery_index.json`.
- Public image delivery uses `https://airigallery.lidure22.xyz/__gallery-image/<encoded-gallery-path>`.
- Blog code must never read, store, forward, persist, or transmit a GitHub/Gitee token.
- Blog code must never perform gallery write operations.
- Cloud management iframe must not exist on an ordinary `/gallery` load.
- Management mode is entered only by `/gallery?manage=1` or `Ctrl + Alt + G`.
- Closing management mode removes the iframe node.
- Cloud framing may be allowed only from `https://lidure22.xyz`; no wildcard frame ancestor is allowed.
- Keep all existing Cloud upload/delete/sync/deduplication behavior unchanged.
- Manifest cache freshness is 5 minutes; validated stale fallback is allowed for at most 24 hours.
- Default page size is 24 images.
- Only the first public thumbnail is eager; all remaining public thumbnails are lazy with async decoding.
- Idle next-page prefetch is capped at 2 non-GIF images.
- Lightbox prefetch is limited to the immediate previous and next image.
- Management iframe load fallback appears after 12 seconds if no load event has completed.
- Gallery UI must remain safe across Astro ClientRouter navigation and must not duplicate global listeners.

## Review Focus

1. **Malformed or hostile manifest paths:** traversal-like, nested, unsupported-extension, or non-string entries must never become image URLs. Task 3 adds parser tests for all of these cases.
2. **Stale/outage behavior:** a 5-minute-fresh cache renders without network dependence, a validated cache up to 24 hours old is usable only as stale fallback after network failure, and older cache is rejected. Task 5 tests these boundaries.
3. **Repeated Astro navigation:** entering/leaving `/gallery` repeatedly must not duplicate hotkeys, lightbox listeners, or management overlays. Tasks 6 and 7 add lifecycle guards and source-contract tests.
4. **Management security regression:** normal public page source must not contain a live iframe or token channel, and Cloud must not accept arbitrary frame ancestors. Tasks 1 and 7 pin both sides.
5. **Large GIF bandwidth:** next-page idle prefetch must skip GIFs and stop after two static images. Task 5 tests the selection helper and Task 6 wires only that bounded list.

---

## File Structure

### `Lidure/astrbot_plugin_airi_gallery`

- Modify `pages/zz_cloud/_headers` — allow only the Blog origin to frame Cloud and remove the contradictory `X-Frame-Options: DENY` header.
- Create `tests/test_cloud_frame_policy.py` — regression contract for CSP/frame headers.

### `Lidure/lidure.github.io`

- Modify `src/components/SiteHeader.astro` — add `/gallery` to the primary navigation.
- Create `src/pages/gallery.astro` — page composition and page-specific CSS import.
- Create `src/lib/gallery-data.mjs` — manifest parsing, safe path validation, grouping, sorting, pagination, proxy URL generation, and bounded prefetch selection.
- Create `src/lib/gallery-cache.mjs` — session cache parsing/freshness/stale fallback policy.
- Create `src/components/GalleryBrowser.astro` — runtime manifest loading, categories, pagination, refresh/retry, thumbnail rendering, bounded idle prefetch.
- Create `src/components/GalleryLightbox.astro` — modal shell plus mouse/keyboard/touch lightbox behavior and adjacent-image prefetch.
- Create `src/components/GalleryManager.astro` — hidden `?manage=1`/hotkey management overlay and lazy iframe lifecycle.
- Create `src/styles/gallery.css` — gallery-only layout, grid, tabs, skeleton/error states, lightbox, management overlay, and responsive rules.
- Create `tests/gallery-data.test.mjs` — pure utility tests.
- Create `tests/gallery-cache.test.mjs` — cache policy tests.
- Create `tests/gallery-page.test.mjs` — source/integration contracts for navigation, components, lazy iframe, accessibility hooks, and loading behavior.
- Modify `package.json` — include the three new Blog tests in `test:site`.

---

### Task 1: Allow the Blog origin to frame Airi Gallery Cloud

**Repository:** `Lidure/astrbot_plugin_airi_gallery`

**Files:**
- Create: `tests/test_cloud_frame_policy.py`
- Modify: `pages/zz_cloud/_headers`

**Interfaces:**
- Consumes: existing static header file `pages/zz_cloud/_headers`.
- Produces: a Cloud response policy where only `https://lidure22.xyz` is an allowed external frame ancestor; all existing unrelated security headers remain present.

- [ ] **Step 1: Create the failing framing-policy test**

Create `tests/test_cloud_frame_policy.py`:

```python
from pathlib import Path

HEADERS = Path("pages/zz_cloud/_headers").read_text(encoding="utf-8")


def csp_line() -> str:
    for line in HEADERS.splitlines():
        if line.strip().startswith("Content-Security-Policy:"):
            return line.strip()
    raise AssertionError("Content-Security-Policy header missing")


def test_cloud_allows_only_canonical_blog_origin_to_frame():
    csp = csp_line()
    assert "frame-ancestors https://lidure22.xyz" in csp
    assert "frame-ancestors 'none'" not in csp
    assert "frame-ancestors *" not in csp
    assert "*.lidure22.xyz" not in csp


def test_legacy_x_frame_options_does_not_override_csp_allowlist():
    assert "X-Frame-Options: DENY" not in HEADERS
    assert "X-Frame-Options: SAMEORIGIN" not in HEADERS


def test_existing_cloud_security_headers_are_preserved():
    assert "X-Content-Type-Options: nosniff" in HEADERS
    assert "Referrer-Policy: strict-origin-when-cross-origin" in HEADERS
    assert "Permissions-Policy: camera=(), microphone=(), geolocation=()" in HEADERS
    assert "object-src 'none'" in csp_line()
    assert "base-uri 'none'" in csp_line()
    assert "form-action 'none'" in csp_line()
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
python -m pytest tests/test_cloud_frame_policy.py -q
```

Expected: FAIL because the current CSP contains `frame-ancestors 'none'` and `_headers` contains `X-Frame-Options: DENY`.

- [ ] **Step 3: Make the minimal header change**

Change only the frame-related pieces in `pages/zz_cloud/_headers`:

```text
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' https://api.github.com https://gitee.com https://raw.githubusercontent.com; object-src 'none'; base-uri 'none'; frame-ancestors https://lidure22.xyz; form-action 'none'
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Cache-Control: public, max-age=3600
```

Do not modify `worker.js`, upload transaction code, auth helpers, manifest behavior, or any write path.

- [ ] **Step 4: Run focused and full regression tests**

Run:

```bash
python -m pytest tests/test_cloud_frame_policy.py -q
python -m pytest tests -q
```

Expected: framing test PASS; full suite PASS.

- [ ] **Step 5: Commit the Cloud policy change**

```bash
git add pages/zz_cloud/_headers tests/test_cloud_frame_policy.py
git commit -m "feat: allow blog to embed gallery cloud"
```

---

### Task 2: Ship and verify the Cloud framing change before Blog work depends on it

**Repository:** `Lidure/astrbot_plugin_airi_gallery`

**Files:**
- No product file changes expected.

**Interfaces:**
- Consumes: Task 1 branch/PR.
- Produces: production `https://airigallery.lidure22.xyz/` response headers compatible with a frame whose parent origin is exactly `https://lidure22.xyz`.

- [ ] **Step 1: Open a focused PR for Task 1**

PR title:

```text
feat: allow blog to embed gallery cloud
```

PR body must state that only frame policy changes, and that upload/delete/sync/deduplication code is untouched.

- [ ] **Step 2: Verify CI is green before merge**

Required evidence:

```text
python -m pytest tests -q  -> PASS
```

Also confirm the PR diff contains only `pages/zz_cloud/_headers` and `tests/test_cloud_frame_policy.py`.

- [ ] **Step 3: Merge and deploy Cloud**

Merge the PR using the repository's normal merge convention, then let the existing Cloud deployment workflow publish the updated static assets/headers.

- [ ] **Step 4: Verify production response headers**

Run from a shell with network access:

```bash
curl -I https://airigallery.lidure22.xyz/
```

Expected response contains a CSP with:

```text
frame-ancestors https://lidure22.xyz
```

Expected response does not contain:

```text
X-Frame-Options: DENY
```

- [ ] **Step 5: Verify direct Cloud management still loads**

Open `https://airigallery.lidure22.xyz/` directly and confirm the page reaches its normal Cloud UI. Do not enter or expose a token in test logs/screenshots.

No commit is required for this deployment-verification task.

---

### Task 3: Build pure gallery data utilities in the Blog

**Repository:** `Lidure/lidure.github.io`

**Files:**
- Create: `src/lib/gallery-data.mjs`
- Create: `tests/gallery-data.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `GALLERY_MANIFEST_URL: string`
  - `GALLERY_PROXY_ORIGIN: string`
  - `DEFAULT_PAGE_SIZE: number`
  - `parseGalleryManifest(payload): GalleryEntry[]`
  - `groupGalleryEntries(entries): GalleryCategory[]`
  - `paginateGallery(entries, page, pageSize): { page, pageSize, totalPages, items }`
  - `buildGalleryImageUrl(path): string`
  - `selectNextPagePrefetch(entries, currentPage, pageSize, limit): GalleryEntry[]`
- `GalleryEntry` shape: `{ path: string, category: string, filename: string, extension: string }`.
- `GalleryCategory` shape: `{ name: string, items: GalleryEntry[] }`.

- [ ] **Step 1: Add the new tests to `test:site` and write failing utility tests**

Append these files to the existing `node --test` command in `package.json`:

```text
tests/gallery-data.test.mjs tests/gallery-cache.test.mjs tests/gallery-page.test.mjs
```

Create `tests/gallery-data.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PAGE_SIZE,
  buildGalleryImageUrl,
  groupGalleryEntries,
  paginateGallery,
  parseGalleryManifest,
  selectNextPagePrefetch,
} from '../src/lib/gallery-data.mjs';

test('manifest parser accepts only safe one-level gallery image paths', () => {
  const payload = {
    files: {
      'gallery/Airi/1.png': { perceptual_hash: '0'.repeat(16) },
      'gallery/Airi/2.GIF': { perceptual_hash: '1'.repeat(16) },
      'gallery/Airi/nested/3.jpg': {},
      'gallery/../escape.png': {},
      'gallery/Airi/readme.txt': {},
      '../gallery/Airi/4.webp': {},
      'gallery//5.png': {},
    },
  };
  assert.deepEqual(
    parseGalleryManifest(payload).map((entry) => entry.path),
    ['gallery/Airi/1.png', 'gallery/Airi/2.GIF'],
  );
});

test('manifest parser rejects invalid payload shapes', () => {
  for (const payload of [null, {}, { files: [] }, { files: null }]) {
    assert.throws(() => parseGalleryManifest(payload), /图库索引格式无效/);
  }
});

test('categories and filenames sort naturally', () => {
  const entries = parseGalleryManifest({ files: {
    'gallery/Cat10/10.png': {},
    'gallery/Cat2/2.png': {},
    'gallery/Cat2/11.png': {},
    'gallery/Cat2/3.png': {},
  }});
  const groups = groupGalleryEntries(entries);
  assert.deepEqual(groups.map((group) => group.name), ['Cat2', 'Cat10']);
  assert.deepEqual(groups[0].items.map((item) => item.filename), ['2.png', '3.png', '11.png']);
});

test('pagination clamps pages and defaults to 24 images', () => {
  const entries = Array.from({ length: 50 }, (_, i) => ({ path: String(i) }));
  assert.equal(DEFAULT_PAGE_SIZE, 24);
  assert.deepEqual(paginateGallery(entries, 99, 24), {
    page: 3,
    pageSize: 24,
    totalPages: 3,
    items: entries.slice(48, 50),
  });
});

test('proxy URL encodes each path segment without allowing path injection', () => {
  assert.equal(
    buildGalleryImageUrl('gallery/猫 羽/1 #.png'),
    'https://airigallery.lidure22.xyz/__gallery-image/gallery/%E7%8C%AB%20%E7%BE%BD/1%20%23.png',
  );
});

test('next-page prefetch is capped and skips GIFs', () => {
  const entries = [
    { path: 'gallery/a/1.jpg', extension: '.jpg' },
    { path: 'gallery/a/2.jpg', extension: '.jpg' },
    { path: 'gallery/a/3.gif', extension: '.gif' },
    { path: 'gallery/a/4.png', extension: '.png' },
    { path: 'gallery/a/5.webp', extension: '.webp' },
  ];
  assert.deepEqual(
    selectNextPagePrefetch(entries, 1, 2, 2).map((entry) => entry.path),
    ['gallery/a/4.png', 'gallery/a/5.webp'],
  );
});
```

- [ ] **Step 2: Run utility tests and verify RED**

Run:

```bash
node --test tests/gallery-data.test.mjs
```

Expected: FAIL because `src/lib/gallery-data.mjs` does not exist.

- [ ] **Step 3: Implement `src/lib/gallery-data.mjs`**

Use these exact exported constants and core rules:

```js
export const GALLERY_MANIFEST_URL =
  'https://raw.githubusercontent.com/Lidure/airi-gallery-images/main/gallery/gallery_index.json';
export const GALLERY_PROXY_ORIGIN = 'https://airigallery.lidure22.xyz';
export const DEFAULT_PAGE_SIZE = 24;

const IMAGE_EXTENSIONS = new Set([
  '.bmp', '.gif', '.jpeg', '.jpg', '.jfif', '.png', '.tif', '.tiff', '.webp',
]);
const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

function pathToEntry(path) {
  if (typeof path !== 'string' || path.includes('\\')) return null;
  const parts = path.split('/');
  if (parts.length !== 3 || parts[0] !== 'gallery') return null;
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  const filename = parts[2];
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return null;
  const extension = filename.slice(dot).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return null;
  return { path, category: parts[1], filename, extension };
}

export function parseGalleryManifest(payload) {
  const files = payload?.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new Error('图库索引格式无效');
  }
  return Object.keys(files)
    .map(pathToEntry)
    .filter(Boolean)
    .sort((a, b) => collator.compare(a.category, b.category) || collator.compare(a.filename, b.filename));
}

export function groupGalleryEntries(entries) {
  const groups = new Map();
  for (const entry of entries) {
    if (!groups.has(entry.category)) groups.set(entry.category, []);
    groups.get(entry.category).push(entry);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([name, items]) => ({ name, items: [...items].sort((a, b) => collator.compare(a.filename, b.filename)) }));
}

export function paginateGallery(entries, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const safePageSize = Math.max(1, Number.isFinite(Number(pageSize)) ? Math.floor(Number(pageSize)) : DEFAULT_PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(entries.length / safePageSize));
  const safePage = Math.min(totalPages, Math.max(1, Math.floor(Number(page) || 1)));
  const start = (safePage - 1) * safePageSize;
  return { page: safePage, pageSize: safePageSize, totalPages, items: entries.slice(start, start + safePageSize) };
}

export function buildGalleryImageUrl(path) {
  const safe = pathToEntry(path);
  if (!safe) throw new Error('图库图片路径无效');
  const encoded = path.split('/').map(encodeURIComponent).join('/');
  return `${GALLERY_PROXY_ORIGIN}/__gallery-image/${encoded}`;
}

export function selectNextPagePrefetch(entries, currentPage, pageSize = DEFAULT_PAGE_SIZE, limit = 2) {
  const nextStart = Math.max(0, Math.floor(Number(currentPage) || 1) * pageSize);
  return entries.slice(nextStart, nextStart + pageSize)
    .filter((entry) => entry.extension !== '.gif')
    .slice(0, Math.max(0, limit));
}
```

- [ ] **Step 4: Run utility tests and verify GREEN**

Run:

```bash
node --test tests/gallery-data.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit the data layer**

```bash
git add package.json src/lib/gallery-data.mjs tests/gallery-data.test.mjs
git commit -m "feat: add gallery data utilities"
```

---

### Task 4: Implement the session cache policy

**Repository:** `Lidure/lidure.github.io`

**Files:**
- Create: `src/lib/gallery-cache.mjs`
- Create: `tests/gallery-cache.test.mjs`

**Interfaces:**
- Consumes: raw manifest JSON serializable payloads.
- Produces:
  - `GALLERY_CACHE_KEY: string`
  - `CACHE_FRESH_MS = 300000`
  - `CACHE_STALE_MAX_MS = 86400000`
  - `readGalleryCache(storage, now): { payload, ageMs, fresh, staleUsable } | null`
  - `writeGalleryCache(storage, payload, now): void`
  - `clearGalleryCache(storage): void`

- [ ] **Step 1: Write failing cache tests**

Create `tests/gallery-cache.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CACHE_FRESH_MS,
  CACHE_STALE_MAX_MS,
  clearGalleryCache,
  readGalleryCache,
  writeGalleryCache,
} from '../src/lib/gallery-cache.mjs';

function storage() {
  const data = new Map();
  return {
    getItem: (key) => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

test('cache is fresh for five minutes inclusive', () => {
  const s = storage();
  writeGalleryCache(s, { files: { 'gallery/a/1.png': {} } }, 1000);
  const cached = readGalleryCache(s, 1000 + CACHE_FRESH_MS);
  assert.equal(cached.fresh, true);
  assert.equal(cached.staleUsable, true);
});

test('cache is stale-but-usable through 24 hours', () => {
  const s = storage();
  writeGalleryCache(s, { files: {} }, 1000);
  const cached = readGalleryCache(s, 1000 + CACHE_FRESH_MS + 1);
  assert.equal(cached.fresh, false);
  assert.equal(cached.staleUsable, true);
  assert.equal(readGalleryCache(s, 1000 + CACHE_STALE_MAX_MS).staleUsable, true);
});

test('cache older than 24 hours is not usable', () => {
  const s = storage();
  writeGalleryCache(s, { files: {} }, 1000);
  assert.equal(readGalleryCache(s, 1000 + CACHE_STALE_MAX_MS + 1), null);
});

test('corrupt cache is deleted instead of trusted', () => {
  const s = storage();
  s.setItem('lidure_gallery_manifest_v1', '{bad json');
  assert.equal(readGalleryCache(s, 2000), null);
  assert.equal(s.getItem('lidure_gallery_manifest_v1'), null);
});

test('clear removes the cached manifest', () => {
  const s = storage();
  writeGalleryCache(s, { files: {} }, 1000);
  clearGalleryCache(s);
  assert.equal(readGalleryCache(s, 1000), null);
});
```

- [ ] **Step 2: Run tests and verify RED**

```bash
node --test tests/gallery-cache.test.mjs
```

Expected: FAIL because `src/lib/gallery-cache.mjs` does not exist.

- [ ] **Step 3: Implement the cache helper**

Create `src/lib/gallery-cache.mjs`:

```js
export const GALLERY_CACHE_KEY = 'lidure_gallery_manifest_v1';
export const CACHE_FRESH_MS = 5 * 60 * 1000;
export const CACHE_STALE_MAX_MS = 24 * 60 * 60 * 1000;

export function readGalleryCache(storage, now = Date.now()) {
  let raw;
  try { raw = storage?.getItem?.(GALLERY_CACHE_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed?.savedAt);
    if (!Number.isFinite(savedAt) || !parsed?.payload || typeof parsed.payload !== 'object') throw new Error('invalid');
    const ageMs = Math.max(0, now - savedAt);
    if (ageMs > CACHE_STALE_MAX_MS) {
      storage.removeItem(GALLERY_CACHE_KEY);
      return null;
    }
    return {
      payload: parsed.payload,
      ageMs,
      fresh: ageMs <= CACHE_FRESH_MS,
      staleUsable: ageMs <= CACHE_STALE_MAX_MS,
    };
  } catch {
    try { storage?.removeItem?.(GALLERY_CACHE_KEY); } catch {}
    return null;
  }
}

export function writeGalleryCache(storage, payload, now = Date.now()) {
  storage?.setItem?.(GALLERY_CACHE_KEY, JSON.stringify({ savedAt: now, payload }));
}

export function clearGalleryCache(storage) {
  try { storage?.removeItem?.(GALLERY_CACHE_KEY); } catch {}
}
```

- [ ] **Step 4: Run cache and data tests**

```bash
node --test tests/gallery-cache.test.mjs tests/gallery-data.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit the cache layer**

```bash
git add src/lib/gallery-cache.mjs tests/gallery-cache.test.mjs
git commit -m "feat: add gallery manifest cache policy"
```

---

### Task 5: Add the native gallery page shell, navigation, and visual system

**Repository:** `Lidure/lidure.github.io`

**Files:**
- Modify: `src/components/SiteHeader.astro`
- Create: `src/pages/gallery.astro`
- Create: `src/styles/gallery.css`
- Create: `tests/gallery-page.test.mjs`

**Interfaces:**
- Consumes: existing `BaseLayout`, `SiteHeader` primary navigation conventions.
- Produces: route `/gallery`, primary nav entry `{ href: '/gallery', label: '画廊' }`, and DOM mounts `#gallery-browser`, `#gallery-lightbox`, `#gallery-manager` for later tasks.

- [ ] **Step 1: Write failing page-shell source contracts**

Create the first section of `tests/gallery-page.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');

test('primary navigation exposes the native gallery route', () => {
  const header = read('src/components/SiteHeader.astro');
  assert.match(header, /href:\s*['"]\/gallery['"],\s*label:\s*['"]画廊['"]/);
});

test('gallery page uses BaseLayout and composes dedicated components', () => {
  const page = read('src/pages/gallery.astro');
  assert.match(page, /BaseLayout/);
  assert.match(page, /GalleryBrowser/);
  assert.match(page, /GalleryLightbox/);
  assert.match(page, /GalleryManager/);
  assert.match(page, /gallery\.css/);
});

test('gallery styles include responsive 5-3-2 column targets and reduced motion', () => {
  const css = read('src/styles/gallery.css');
  assert.match(css, /grid-template-columns:\s*repeat\(5,/);
  assert.match(css, /repeat\(3,/);
  assert.match(css, /repeat\(2,/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
```

- [ ] **Step 2: Run the page test and verify RED**

```bash
node --test tests/gallery-page.test.mjs
```

Expected: FAIL because `/gallery` page/components/styles do not exist and navigation lacks `画廊`.

- [ ] **Step 3: Add the navigation entry**

In `src/components/SiteHeader.astro`, change the primary links to include:

```astro
const primaryLinks = [
  { href: '/', label: '首页' },
  { href: '/posts', label: '文章' },
  { href: '/moments', label: '碎碎念' },
  { href: '/gallery', label: '画廊' },
  { href: '/messages', label: '留言' },
];
```

Do not alter the existing active-state function.

- [ ] **Step 4: Create the page composition**

Create `src/pages/gallery.astro`:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import GalleryBrowser from '../components/GalleryBrowser.astro';
import GalleryLightbox from '../components/GalleryLightbox.astro';
import GalleryManager from '../components/GalleryManager.astro';
import '../styles/gallery.css';
---

<BaseLayout
  title="Airi Gallery | 搁浅的小窝"
  description="Airi Gallery 图库，按分类浏览收藏的图片与动图。"
  bannerTitle="Airi Gallery"
  bannerSubtitle="把喜欢的瞬间好好收进这里"
>
  <main class="gallery-page" aria-labelledby="gallery-page-title">
    <header class="gallery-intro">
      <p class="gallery-kicker">Airi Gallery</p>
      <h1 id="gallery-page-title">图库</h1>
      <p>慢慢翻，喜欢的图片总会在某一页等你。</p>
    </header>
    <GalleryBrowser />
    <GalleryLightbox />
    <GalleryManager />
  </main>
</BaseLayout>
```

Create temporary component shells with their final root IDs so the page can build before later tasks:

```astro
<!-- src/components/GalleryBrowser.astro -->
<section id="gallery-browser" class="gallery-browser" aria-live="polite"></section>
```

```astro
<!-- src/components/GalleryLightbox.astro -->
<div id="gallery-lightbox" class="gallery-lightbox" hidden></div>
```

```astro
<!-- src/components/GalleryManager.astro -->
<div id="gallery-manager" class="gallery-manager" hidden></div>
```

- [ ] **Step 5: Add focused gallery CSS**

Create `src/styles/gallery.css` with the Blog theme variables rather than hard-coded Cloud admin styling. The minimum structure must include:

```css
.gallery-page { width: min(1480px, calc(100% - 32px)); margin: 0 auto 72px; }
.gallery-intro, .gallery-browser {
  background: color-mix(in srgb, var(--card-bg, #151821) calc(var(--card-opacity-percent, 92%)), transparent);
  border: 1px solid var(--line-color, rgba(255,255,255,.12));
  border-radius: 24px;
}
.gallery-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 14px; }
.gallery-tile img { width: 100%; height: 100%; object-fit: contain; display: block; }
@media (max-width: 1100px) { .gallery-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@media (max-width: 640px) { .gallery-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; } }
@media (prefers-reduced-motion: reduce) {
  .gallery-page *, .gallery-page *::before, .gallery-page *::after { transition: none !important; animation: none !important; }
}
```

Add styles for `.gallery-tabs`, `.gallery-status`, `.gallery-pager`, `.gallery-lightbox`, `.gallery-manager`, skeleton tiles, failed-image tiles, and focus-visible outlines in the same file. Keep all selectors scoped under gallery-specific classes/IDs.

- [ ] **Step 6: Run page contracts and Astro build**

```bash
node --test tests/gallery-page.test.mjs
npm run build
```

Expected: page contracts PASS; Astro check/build PASS.

- [ ] **Step 7: Commit the page shell**

```bash
git add src/components/SiteHeader.astro src/pages/gallery.astro src/components/GalleryBrowser.astro src/components/GalleryLightbox.astro src/components/GalleryManager.astro src/styles/gallery.css tests/gallery-page.test.mjs
git commit -m "feat: add native gallery page shell"
```

---

### Task 6: Implement runtime public browsing, cache fallback, pagination, and bounded prefetch

**Repository:** `Lidure/lidure.github.io`

**Files:**
- Modify: `src/components/GalleryBrowser.astro`
- Modify: `tests/gallery-page.test.mjs`

**Interfaces:**
- Consumes: Task 3 `gallery-data.mjs` functions and Task 4 cache functions.
- Produces browser events:
  - `window.dispatchEvent(new CustomEvent('lidure:gallery-items', { detail: { items, activeIndex } }))`
  - tile click dispatches `lidure:gallery-open` with `{ items, index }`.
- Browser root stores no token and performs only `GET` requests.

- [ ] **Step 1: Extend source contracts for loading policy**

Append to `tests/gallery-page.test.mjs`:

```js
test('gallery browser uses manifest runtime fetch, cache fallback, lazy images, and bounded prefetch', () => {
  const browser = read('src/components/GalleryBrowser.astro');
  assert.match(browser, /GALLERY_MANIFEST_URL/);
  assert.match(browser, /readGalleryCache/);
  assert.match(browser, /writeGalleryCache/);
  assert.match(browser, /cache:\s*['"]no-store['"]/);
  assert.match(browser, /loading\s*=\s*index\s*===\s*0\s*\?\s*['"]eager['"]\s*:\s*['"]lazy['"]/);
  assert.match(browser, /decoding\s*=\s*['"]async['"]/);
  assert.match(browser, /selectNextPagePrefetch/);
  assert.match(browser, /requestIdleCallback/);
  assert.match(browser, /cancelIdleCallback/);
});

test('gallery browser exposes refresh retry and image failure recovery', () => {
  const browser = read('src/components/GalleryBrowser.astro');
  assert.match(browser, /刷新图库/);
  assert.match(browser, /重新加载/);
  assert.match(browser, /重试/);
});
```

- [ ] **Step 2: Run page tests and verify RED**

```bash
node --test tests/gallery-page.test.mjs
```

Expected: the new loading-policy assertions FAIL against the shell component.

- [ ] **Step 3: Replace `GalleryBrowser.astro` shell with semantic markup**

Use this root structure:

```astro
<section id="gallery-browser" class="gallery-browser" aria-live="polite">
  <div class="gallery-browser-toolbar">
    <div id="gallery-tabs" class="gallery-tabs" role="tablist" aria-label="图库分类"></div>
    <button id="gallery-refresh" class="gallery-refresh" type="button">刷新图库</button>
  </div>
  <div id="gallery-notice" class="gallery-status" hidden></div>
  <div id="gallery-grid" class="gallery-grid" aria-busy="true"></div>
  <nav id="gallery-pager" class="gallery-pager" aria-label="图库分页" hidden>
    <button type="button" data-page-action="first" aria-label="第一页">⟨⟨</button>
    <button type="button" data-page-action="prev" aria-label="上一页">⟨</button>
    <span id="gallery-page-indicator"></span>
    <button type="button" data-page-action="next" aria-label="下一页">⟩</button>
    <button type="button" data-page-action="last" aria-label="最后一页">⟩⟩</button>
  </nav>
</section>
```

- [ ] **Step 4: Implement the browser controller using the pure utilities**

The component script must import:

```js
import {
  GALLERY_MANIFEST_URL,
  DEFAULT_PAGE_SIZE,
  buildGalleryImageUrl,
  groupGalleryEntries,
  paginateGallery,
  parseGalleryManifest,
  selectNextPagePrefetch,
} from '../lib/gallery-data.mjs';
import {
  clearGalleryCache,
  readGalleryCache,
  writeGalleryCache,
} from '../lib/gallery-cache.mjs';
```

Implement these controller rules exactly:

```js
const controller = {
  abortController: null,
  idleHandles: new Set(),
  categories: [],
  currentCategory: '',
  currentPage: 1,
};
```

Loading algorithm:

```text
1. Read sessionStorage cache.
2. If cache is fresh, validate it with parseGalleryManifest and render immediately without blocking on a network request.
3. If cache is absent/stale, fetch manifest with `{ cache: 'no-store', signal }`.
4. On successful fetch, parse first; only after parse succeeds write it to cache and render.
5. On network failure, use stale cache only when readGalleryCache returned `staleUsable: true` and parse succeeds; show a non-blocking "当前显示缓存内容" notice.
6. With no valid network/cache payload, render retryable error state instead of throwing out of the component.
7. Refresh button clears the cache, resets page to 1, and forces a no-store fetch.
```

Thumbnail creation must use DOM properties, not HTML string interpolation:

```js
const img = document.createElement('img');
img.src = buildGalleryImageUrl(entry.path);
img.alt = `${entry.category} · ${entry.filename}`;
img.decoding = 'async';
img.loading = index === 0 ? 'eager' : 'lazy';
```

On `img.onerror`, replace only that tile's visual content with a retry button labeled `重新加载`; retry must assign the same proxy URL again with a cache-busting `?retry=${Date.now()}` query appended by `new URL(...)`.

Category tab click sets `currentCategory`, resets `currentPage = 1`, and rerenders. Pagination uses `paginateGallery` and disables impossible directions.

Tile click dispatches:

```js
window.dispatchEvent(new CustomEvent('lidure:gallery-open', {
  detail: { items: page.items, index },
}));
```

After each page render, select at most two next-page static images:

```js
const targets = selectNextPagePrefetch(activeItems, page.page, page.pageSize, 2);
```

Schedule each target during idle time. Use `new Image()` with `src = buildGalleryImageUrl(target.path)`. GIF targets never reach this list by utility contract.

Track every idle callback handle in `controller.idleHandles` and cancel them during cleanup. Use `setTimeout(..., 1500)` only as the fallback when `requestIdleCallback` is unavailable.

Bind cleanup to `astro:before-swap` and remove the handler/release controller resources before the page leaves.

- [ ] **Step 5: Run focused tests and build**

```bash
node --test tests/gallery-data.test.mjs tests/gallery-cache.test.mjs tests/gallery-page.test.mjs
npm run build
```

Expected: all focused tests PASS; Astro build PASS.

- [ ] **Step 6: Commit public browsing**

```bash
git add src/components/GalleryBrowser.astro tests/gallery-page.test.mjs
git commit -m "feat: add runtime gallery browsing"
```

---

### Task 7: Implement accessible lightbox navigation and lifecycle cleanup

**Repository:** `Lidure/lidure.github.io`

**Files:**
- Modify: `src/components/GalleryLightbox.astro`
- Modify: `src/styles/gallery.css`
- Modify: `tests/gallery-page.test.mjs`

**Interfaces:**
- Consumes: `lidure:gallery-open` event with `detail: { items: GalleryEntry[], index: number }`.
- Produces: no cross-component data; it owns its own open/close state and adjacent image preloads.

- [ ] **Step 1: Add failing lightbox contracts**

Append:

```js
test('lightbox supports keyboard touch focus return and adjacent-only prefetch', () => {
  const lightbox = read('src/components/GalleryLightbox.astro');
  assert.match(lightbox, /lidure:gallery-open/);
  assert.match(lightbox, /Escape/);
  assert.match(lightbox, /ArrowLeft/);
  assert.match(lightbox, /ArrowRight/);
  assert.match(lightbox, /touchstart/);
  assert.match(lightbox, /touchend/);
  assert.match(lightbox, /previousTrigger\.focus/);
  assert.match(lightbox, /Math\.abs\(deltaX\)/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/gallery-page.test.mjs
```

Expected: new lightbox contract FAILS.

- [ ] **Step 3: Build the accessible lightbox shell**

Use markup with explicit roles and controls:

```astro
<div id="gallery-lightbox" class="gallery-lightbox" role="dialog" aria-modal="true" aria-label="图片预览" hidden>
  <button class="gallery-lightbox-close" type="button" aria-label="关闭预览">×</button>
  <button class="gallery-lightbox-prev" type="button" aria-label="上一张">‹</button>
  <figure class="gallery-lightbox-stage">
    <img id="gallery-lightbox-image" alt="" />
    <figcaption id="gallery-lightbox-caption"></figcaption>
  </figure>
  <button class="gallery-lightbox-next" type="button" aria-label="下一张">›</button>
</div>
```

- [ ] **Step 4: Implement lightbox state and input behavior**

Controller requirements:

```js
let items = [];
let index = 0;
let previousTrigger = null;
let touchStartX = null;
```

When `lidure:gallery-open` fires:

- keep `document.activeElement` as `previousTrigger` when it is an `HTMLElement`;
- validate `detail.items` is an array and clamp the index;
- unhide the dialog;
- render current image with `buildGalleryImageUrl`;
- focus the close button;
- preload exactly previous and next image with `new Image()`; no category-wide prefetch.

Keyboard rules:

```text
Escape -> close
ArrowLeft -> previous
ArrowRight -> next
Tab / Shift+Tab -> keep focus cycling among close, previous, next controls
```

Touch rules:

```text
record clientX on touchstart
on touchend, deltaX <= -50 -> next
deltaX >= 50 -> previous
ignore smaller gestures and primarily vertical gestures
```

Close must hide the dialog, clear the current image `src`, and call `previousTrigger.focus()` when still connected.

Register a single `astro:before-swap` cleanup that closes the lightbox and removes window/document listeners.

- [ ] **Step 5: Finish lightbox CSS**

Add full viewport fixed positioning, dark translucent backdrop, centered `object-fit: contain` image, touch-safe controls, and mobile spacing. Ensure controls retain visible `:focus-visible` outlines.

- [ ] **Step 6: Run focused tests and build**

```bash
node --test tests/gallery-page.test.mjs tests/gallery-data.test.mjs
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit lightbox behavior**

```bash
git add src/components/GalleryLightbox.astro src/styles/gallery.css tests/gallery-page.test.mjs
git commit -m "feat: add gallery lightbox navigation"
```

---

### Task 8: Implement hidden management mode with lazy Cloud iframe

**Repository:** `Lidure/lidure.github.io`

**Files:**
- Modify: `src/components/GalleryManager.astro`
- Modify: `src/styles/gallery.css`
- Modify: `tests/gallery-page.test.mjs`

**Interfaces:**
- Consumes: current location query string and global `keydown` events.
- Produces: dynamically created `<iframe src="https://airigallery.lidure22.xyz/">` only after explicit management activation.
- No token, `postMessage`, write API, or iframe credential extraction interface exists.

- [ ] **Step 1: Add failing management-mode security/lifecycle contracts**

Append:

```js
test('management iframe is lazy and reachable through query or Ctrl Alt G', () => {
  const manager = read('src/components/GalleryManager.astro');
  assert.doesNotMatch(manager, /<iframe[^>]+src=/i);
  assert.match(manager, /searchParams\.get\(['"]manage['"]\)\s*===\s*['"]1['"]/);
  assert.match(manager, /event\.ctrlKey/);
  assert.match(manager, /event\.altKey/);
  assert.match(manager, /event\.key\.toLowerCase\(\)\s*===\s*['"]g['"]/);
  assert.match(manager, /document\.createElement\(['"]iframe['"]\)/);
  assert.match(manager, /https:\/\/airigallery\.lidure22\.xyz\//);
});

test('management mode has no token bridge and removes iframe on close or navigation', () => {
  const manager = read('src/components/GalleryManager.astro');
  assert.doesNotMatch(manager, /postMessage\s*\(/);
  assert.doesNotMatch(manager, /token\s*=/i);
  assert.match(manager, /iframe\.remove\(\)/);
  assert.match(manager, /astro:before-swap/);
  assert.match(manager, /replaceState/);
  assert.match(manager, /12000/);
  assert.match(manager, /直接打开 Airi Gallery Cloud/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/gallery-page.test.mjs
```

Expected: management assertions FAIL.

- [ ] **Step 3: Build the Blog-owned management overlay shell**

Use static markup without a static iframe:

```astro
<div id="gallery-manager" class="gallery-manager" role="dialog" aria-modal="true" aria-label="Airi Gallery 管理" hidden>
  <header class="gallery-manager-bar">
    <strong>管理 Airi Gallery</strong>
    <div class="gallery-manager-actions">
      <a href="https://airigallery.lidure22.xyz/" target="_blank" rel="noopener noreferrer">直接打开 Airi Gallery Cloud</a>
      <button type="button" id="gallery-manager-close">返回图库</button>
    </div>
  </header>
  <div id="gallery-manager-stage" class="gallery-manager-stage">
    <div id="gallery-manager-loading" class="gallery-manager-loading">正在打开管理界面…</div>
  </div>
</div>
```

- [ ] **Step 4: Implement explicit activation and lazy iframe creation**

Use constants:

```js
const CLOUD_URL = 'https://airigallery.lidure22.xyz/';
const IFRAME_TIMEOUT_MS = 12000;
```

`openManager()` must:

1. Return immediately if the overlay is already open.
2. Unhide the overlay and lock document body scrolling with a gallery-specific class.
3. Create the iframe with `document.createElement('iframe')`.
4. Set `iframe.src = CLOUD_URL`, `iframe.title = 'Airi Gallery Cloud 管理界面'`, and `iframe.referrerPolicy = 'strict-origin-when-cross-origin'`.
5. Do not add `sandbox`, because Cloud management requires its own scripts/forms/storage/origin behavior and remains isolated by cross-origin policy.
6. Append the iframe to `#gallery-manager-stage` only after explicit activation.
7. Start a `setTimeout(..., 12000)` fallback that changes the loading notice to `管理界面加载超时，可重试或直接打开 Airi Gallery Cloud` unless the iframe `load` event fires first.
8. On iframe `load`, clear the timeout and hide the loading notice.

Hotkey handler:

```js
if (event.ctrlKey && event.altKey && event.key.toLowerCase() === 'g') {
  event.preventDefault();
  openManager();
}
```

Initial query activation:

```js
if (new URL(window.location.href).searchParams.get('manage') === '1') openManager();
```

`closeManager()` must:

- clear timeout;
- find the runtime iframe and call `iframe.remove()`;
- hide overlay;
- restore body scrolling;
- if `manage=1` is present, delete only that parameter and call `history.replaceState(history.state, '', url)` while preserving all other query/hash state.

Bind one `astro:before-swap` cleanup that calls close, removes the keydown listener, and clears initialization markers so a future `/gallery` visit can initialize exactly once.

- [ ] **Step 5: Finish management overlay CSS**

Style `.gallery-manager` as fixed full viewport with a high z-index above normal Blog content. The top bar remains Blog-styled while `.gallery-manager-stage iframe` fills the rest of the viewport. Add a clear timeout/error state and mobile-safe top-bar wrapping.

- [ ] **Step 6: Run focused tests and build**

```bash
node --test tests/gallery-page.test.mjs
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit management mode**

```bash
git add src/components/GalleryManager.astro src/styles/gallery.css tests/gallery-page.test.mjs
git commit -m "feat: add hidden gallery management mode"
```

---

### Task 9: Finish integration contracts and run full Blog regression

**Repository:** `Lidure/lidure.github.io`

**Files:**
- Modify: `tests/gallery-page.test.mjs`
- Modify if needed: `src/components/GalleryBrowser.astro`
- Modify if needed: `src/components/GalleryLightbox.astro`
- Modify if needed: `src/components/GalleryManager.astro`
- Modify if needed: `src/styles/gallery.css`

**Interfaces:**
- Consumes: all Blog gallery components from Tasks 3-8.
- Produces: a branch ready for PR with all acceptance criteria pinned by tests.

- [ ] **Step 1: Add final regression assertions for no eager Cloud management load and component isolation**

Append:

```js
test('ordinary gallery page does not embed Cloud management document in markup', () => {
  const page = read('src/pages/gallery.astro');
  const manager = read('src/components/GalleryManager.astro');
  assert.doesNotMatch(page, /airigallery\.lidure22\.xyz/);
  assert.doesNotMatch(manager, /<iframe/i);
});

test('gallery styling stays in its dedicated stylesheet', () => {
  const base = read('src/layouts/BaseLayout.astro');
  assert.doesNotMatch(base, /gallery\.css/);
  const page = read('src/pages/gallery.astro');
  assert.match(page, /\.\.\/styles\/gallery\.css/);
});

test('gallery runtime never declares credential transport', () => {
  const sources = [
    read('src/components/GalleryBrowser.astro'),
    read('src/components/GalleryLightbox.astro'),
    read('src/components/GalleryManager.astro'),
  ].join('\n');
  assert.doesNotMatch(sources, /Authorization\s*:/);
  assert.doesNotMatch(sources, /postMessage\s*\(/);
  assert.doesNotMatch(sources, /localStorage.*token|sessionStorage.*token/i);
});
```

- [ ] **Step 2: Run the three focused gallery test files**

```bash
node --test tests/gallery-data.test.mjs tests/gallery-cache.test.mjs tests/gallery-page.test.mjs
```

Expected: all PASS.

- [ ] **Step 3: Run the complete Blog test suite**

```bash
npm test
```

Expected:

```text
astro check: 0 errors
astro build: success
all node:test site contracts: pass
```

Do not accept unrelated test failures as “pre-existing” without verifying against `main`.

- [ ] **Step 4: Inspect the final Blog diff for scope**

Expected product diff is limited to:

```text
src/components/SiteHeader.astro
src/pages/gallery.astro
src/components/GalleryBrowser.astro
src/components/GalleryLightbox.astro
src/components/GalleryManager.astro
src/lib/gallery-data.mjs
src/lib/gallery-cache.mjs
src/styles/gallery.css
package.json
tests/gallery-data.test.mjs
tests/gallery-cache.test.mjs
tests/gallery-page.test.mjs
```

The implementation should not modify article, moments, message-board, wallpaper, player, or unrelated global style files.

- [ ] **Step 5: Commit any final integration-only corrections**

If Task 9 required corrections, commit them as:

```bash
git add src tests package.json
git commit -m "test: finalize gallery integration contracts"
```

If no corrections were required, make no empty commit.

---

### Task 10: Production smoke test and Blog PR

**Repository:** `Lidure/lidure.github.io`

**Files:**
- No planned product changes after verified tests.

**Interfaces:**
- Consumes: already deployed Cloud frame policy from Task 2 and verified Blog branch from Task 9.
- Produces: Blog PR ready to merge.

- [ ] **Step 1: Open the Blog PR**

PR title:

```text
feat: integrate Airi Gallery into blog
```

PR body must summarize:

```text
- native /gallery public browsing
- runtime manifest loading with 5-minute session cache and <=24h stale fallback
- Cloudflare-backed image proxy URLs
- Blog-style lightbox and responsive gallery layout
- hidden ?manage=1 / Ctrl+Alt+G management overlay
- lazy cross-origin Cloud iframe; Blog never handles tokens or writes
- full npm test result
- dependency on already-deployed Cloud framing policy
```

- [ ] **Step 2: Verify PR CI and changed-file scope**

Require all Blog CI checks to pass. Confirm there is no static iframe in page markup and no credential-related code in Blog sources.

- [ ] **Step 3: Preview public gallery behavior**

On the deploy preview or local production build, verify:

```text
/gallery loads with no token
categories appear
first page renders
only first thumbnail is eager
category change resets to page 1
pagination works
refresh forces current manifest
GIFs animate
failed individual image does not break the grid
lightbox Escape / arrows work
mobile viewport has 2 columns and no horizontal overflow
```

- [ ] **Step 4: Preview management mode against production Cloud**

Verify both:

```text
/gallery?manage=1
Ctrl+Alt+G on /gallery
```

Expected: Cloud management UI appears inside the Blog-owned overlay because Task 2 already deployed `frame-ancestors https://lidure22.xyz`.

Verify closing removes the iframe in DevTools DOM and removes only `manage=1` from the URL.

- [ ] **Step 5: Verify the normal public path does not fetch management HTML**

Open a clean `/gallery` visit in browser DevTools Network. Before using the hotkey/query mode, there must be no document request to:

```text
https://airigallery.lidure22.xyz/
```

Image requests to `https://airigallery.lidure22.xyz/__gallery-image/...` are expected and are not management-page loads.

- [ ] **Step 6: Merge only after smoke checks pass**

Merge using the Blog repository's normal convention. After deployment, repeat `/gallery` public load and one management-mode open/close smoke check on `https://lidure22.xyz`.

No additional product commit is expected in this task.

---

## Final Verification Matrix

Before declaring the integration complete, capture evidence for all of the following:

```text
Airi Gallery Cloud
[ ] python -m pytest tests/test_cloud_frame_policy.py -q -> PASS
[ ] python -m pytest tests -q -> PASS
[ ] production CSP contains frame-ancestors https://lidure22.xyz
[ ] production response has no X-Frame-Options: DENY
[ ] direct Cloud page still loads normally

Blog
[ ] node --test tests/gallery-data.test.mjs tests/gallery-cache.test.mjs tests/gallery-page.test.mjs -> PASS
[ ] npm test -> PASS
[ ] /gallery public browse works without token
[ ] new Cloud-uploaded image appears after refresh without Blog rebuild
[ ] static images and GIFs render
[ ] only first public thumbnail is eager; remaining thumbnails are lazy
[ ] next-page idle prefetch is <=2 and excludes GIFs
[ ] lightbox mouse/keyboard/touch controls work
[ ] /gallery?manage=1 opens management mode
[ ] Ctrl+Alt+G opens management mode
[ ] ordinary /gallery does not request Cloud management document
[ ] closing management removes iframe
[ ] Blog source never handles token/write APIs
[ ] mobile 2-column layout has no horizontal overflow
[ ] existing Blog pages remain unaffected
```
