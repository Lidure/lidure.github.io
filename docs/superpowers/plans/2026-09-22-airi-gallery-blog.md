# Airi Gallery Blog Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a native, read-only `/gallery` experience to the Blog with hidden Cloud management mode entered via `/gallery?manage=1` or `Ctrl + Alt + G`, while keeping all write credentials and mutations inside Airi Gallery Cloud.

**Architecture:** The Blog reads `gallery/gallery_index.json` at runtime, validates and groups safe image paths, renders only the active page through a native Astro/DOM gallery, and delivers images through the existing `airigallery.lidure22.xyz` image proxy. Management is isolated in a lazily created cross-origin iframe; normal visitors never load Cloud management HTML/JS. Pure data logic lives in a small testable library, DOM lifecycle logic in focused components/controllers, and gallery-specific styles stay out of the existing Firefly global bundles.

**Tech Stack:** Astro 6, TypeScript/ES modules, Node built-in test runner, native browser APIs (`fetch`, `sessionStorage`, `requestIdleCallback`, `AbortController`, keyboard/touch events), existing Blog theme variables.

**Spec:** `docs/superpowers/specs/2026-09-22-airi-gallery-blog-integration-design.md`

## Global Constraints

- Cloud framing support must already be deployed and verified from the companion plan `docs/superpowers/plans/2026-09-22-airi-gallery-cloud-framing.md` before Blog merge.
- Public data source is fixed to `https://raw.githubusercontent.com/Lidure/airi-gallery-images/main/gallery/gallery_index.json`.
- Public image delivery uses `https://airigallery.lidure22.xyz/__gallery-image/<encoded-gallery-path>`.
- A valid image path must be exactly `gallery/<category>/<filename>.<supported-image-extension>` with no empty, dot, dot-dot, or backslash path segments.
- Supported extensions: BMP, GIF, JPEG/JPG/JFIF, PNG, TIFF/TIF, WebP.
- Default page size: 24 images.
- Manifest cache freshness: 5 minutes.
- Stale fallback maximum age: 24 hours.
- Only the first rendered thumbnail may be eager; all other thumbnails use native lazy loading and async decoding.
- Next-page idle prefetch is capped at 2 non-GIF images.
- Lightbox prefetch is capped at the immediate previous and next image.
- Management iframe is created only when management mode opens and removed on close/navigation.
- Management iframe load fallback appears after 12 seconds if the frame has not completed loading.
- Blog code must never read, save, forward, or transmit a GitHub/Gitee token and must never perform write operations.
- Do not use `postMessage` for credentials.
- Do not refactor unrelated Blog pages.

## Review Focus

- Malformed or traversal-like manifest keys must be ignored without breaking valid categories; tests belong to Task 1.
- A stale cache older than 24 hours must not silently replace a failed network fetch; tests belong to Task 2.
- Astro ClientRouter re-entry must not accumulate hotkey/lightbox listeners or multiple iframes; tests belong to Task 5.
- Large GIF-heavy categories must not be bulk-prefetched; tests belong to Task 3.
- Management iframe failure must surface retry/close/direct-open controls instead of a permanent blank overlay; tests belong to Task 5.

---

### Task 1: Build and test pure gallery data utilities

**Files:**
- Create: `src/lib/gallery-data.mjs`
- Create: `tests/gallery-data.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: raw JSON payload from `gallery/gallery_index.json`.
- Produces:
  - `parseGalleryManifest(payload) -> Array<{ category: string, images: GalleryImage[] }>`
  - `paginate(items, page, pageSize) -> { page, pageSize, totalPages, totalItems, items }`
  - `galleryProxyUrl(path) -> string`
  - `isGifPath(path) -> boolean`
  - `nextPagePrefetchCandidates(allItems, page, pageSize, limit = 2) -> GalleryImage[]`

Use this normalized image shape:

```js
{
  path: 'gallery/airi/42.png',
  category: 'airi',
  filename: '42.png',
  extension: '.png',
}
```

- [ ] **Step 1: Add the new test file to `test:site` before implementation**

In `package.json`, append:

```text
tests/gallery-data.test.mjs
```

to the existing `node --test ...` list in `test:site`.

- [ ] **Step 2: Write failing parser/path tests**

Create `tests/gallery-data.test.mjs` with:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  galleryProxyUrl,
  isGifPath,
  nextPagePrefetchCandidates,
  paginate,
  parseGalleryManifest,
} from '../src/lib/gallery-data.mjs';

test('manifest parser accepts only safe one-level gallery image paths', () => {
  const payload = {
    files: {
      'gallery/airi/10.png': { perceptual_hash: '0'.repeat(16) },
      'gallery/airi/2.gif': { perceptual_hash: '1'.repeat(16) },
      'gallery/cat/a.webp': { perceptual_hash: '2'.repeat(16) },
      'gallery/airi/nested/b.png': {},
      'gallery/../secret.png': {},
      'gallery//empty.jpg': {},
      'gallery\\evil\\x.png': {},
      'gallery/airi/readme.txt': {},
      'README.md': {},
    },
  };

  assert.deepEqual(parseGalleryManifest(payload), [
    {
      category: 'airi',
      images: [
        { path: 'gallery/airi/2.gif', category: 'airi', filename: '2.gif', extension: '.gif' },
        { path: 'gallery/airi/10.png', category: 'airi', filename: '10.png', extension: '.png' },
      ],
    },
    {
      category: 'cat',
      images: [
        { path: 'gallery/cat/a.webp', category: 'cat', filename: 'a.webp', extension: '.webp' },
      ],
    },
  ]);
});

test('manifest parser rejects invalid payload shapes', () => {
  for (const payload of [null, {}, { files: [] }, { files: null }]) {
    assert.throws(() => parseGalleryManifest(payload), /图库索引格式无效/);
  }
});

test('pagination clamps invalid page numbers and reports totals', () => {
  const items = Array.from({ length: 50 }, (_, i) => i + 1);
  assert.deepEqual(paginate(items, 99, 24), {
    page: 3,
    pageSize: 24,
    totalPages: 3,
    totalItems: 50,
    items: [49, 50],
  });
  assert.equal(paginate([], 1, 24).totalPages, 1);
});

test('proxy URL encodes each path segment safely', () => {
  assert.equal(
    galleryProxyUrl('gallery/猫 羽/1 #.png'),
    'https://airigallery.lidure22.xyz/__gallery-image/gallery/%E7%8C%AB%20%E7%BE%BD/1%20%23.png',
  );
});

test('next page prefetch is bounded to two non-GIF images', () => {
  const images = [
    'gallery/a/1.png', 'gallery/a/2.png', 'gallery/a/3.png', 'gallery/a/4.png',
    'gallery/a/5.gif', 'gallery/a/6.webp', 'gallery/a/7.jpg', 'gallery/a/8.png',
  ].map((path) => ({
    path,
    category: 'a',
    filename: path.split('/').at(-1),
    extension: path.slice(path.lastIndexOf('.')).toLowerCase(),
  }));

  assert.deepEqual(
    nextPagePrefetchCandidates(images, 1, 4).map((item) => item.path),
    ['gallery/a/6.webp', 'gallery/a/7.jpg'],
  );
  assert.equal(isGifPath('gallery/a/5.GIF'), true);
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
node --test tests/gallery-data.test.mjs
```

Expected: FAIL because `src/lib/gallery-data.mjs` does not exist.

- [ ] **Step 4: Implement the pure data helpers**

Create `src/lib/gallery-data.mjs` with constants and functions equivalent to:

```js
const IMAGE_EXTENSIONS = new Set([
  '.bmp', '.gif', '.jpeg', '.jpg', '.jfif', '.png', '.tif', '.tiff', '.webp',
]);

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

function normalizeGalleryImagePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\\')) return null;
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

  const grouped = new Map();
  for (const path of Object.keys(files)) {
    const image = normalizeGalleryImagePath(path);
    if (!image) continue;
    if (!grouped.has(image.category)) grouped.set(image.category, []);
    grouped.get(image.category).push(image);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([category, images]) => ({
      category,
      images: images.sort((a, b) => collator.compare(a.filename, b.filename)),
    }));
}

export function paginate(items, page, pageSize) {
  const size = Number.isFinite(Number(pageSize)) ? Math.max(1, Math.trunc(pageSize)) : 24;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  const current = Math.min(totalPages, Math.max(1, Math.trunc(Number(page) || 1)));
  const start = (current - 1) * size;
  return { page: current, pageSize: size, totalPages, totalItems, items: items.slice(start, start + size) };
}

export function galleryProxyUrl(path) {
  return 'https://airigallery.lidure22.xyz/__gallery-image/'
    + path.split('/').map(encodeURIComponent).join('/');
}

export function isGifPath(path) {
  return /\.gif$/i.test(path);
}

export function nextPagePrefetchCandidates(allItems, page, pageSize, limit = 2) {
  const next = paginate(allItems, Number(page) + 1, pageSize);
  if (next.page <= Number(page)) return [];
  return next.items.filter((item) => !isGifPath(item.path)).slice(0, Math.max(0, limit));
}
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/gallery-data.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 6: Commit the pure data layer**

```bash
git add package.json src/lib/gallery-data.mjs tests/gallery-data.test.mjs
git commit -m "feat: add gallery manifest data model"
```

---

### Task 2: Add runtime manifest loading with bounded session cache and stale fallback

**Files:**
- Create: `src/lib/gallery-manifest-client.mjs`
- Create: `tests/gallery-manifest-client.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `parseGalleryManifest(payload)` from Task 1.
- Produces:
  - `loadGalleryManifest({ fetchImpl, storage, now, forceRefresh, signal }) -> Promise<{ categories, source, stale }>`
  - `clearGalleryManifestCache(storage) -> void`
- Cache key: `lidure_gallery_manifest_v1`.

- [ ] **Step 1: Register the new test in `test:site`**

Append `tests/gallery-manifest-client.test.mjs` to `package.json`'s existing Node test list.

- [ ] **Step 2: Write failing cache/network tests**

Create tests that use a tiny in-memory storage double:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GALLERY_MANIFEST_URL,
  clearGalleryManifestCache,
  loadGalleryManifest,
} from '../src/lib/gallery-manifest-client.mjs';

function memoryStorage(seed = {}) {
  const map = new Map(Object.entries(seed));
  return {
    getItem: (key) => map.has(key) ? map.get(key) : null,
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

const payload = { files: { 'gallery/airi/1.png': {} } };

test('fresh cache renders without network', async () => {
  const storage = memoryStorage({
    lidure_gallery_manifest_v1: JSON.stringify({ savedAt: 1_000_000, payload }),
  });
  let calls = 0;
  const result = await loadGalleryManifest({
    storage,
    now: () => 1_000_000 + 60_000,
    fetchImpl: async () => { calls += 1; throw new Error('should not fetch'); },
  });
  assert.equal(calls, 0);
  assert.equal(result.source, 'cache');
  assert.equal(result.stale, false);
});

test('force refresh bypasses fresh cache and uses no-store network fetch', async () => {
  const storage = memoryStorage();
  let options;
  const result = await loadGalleryManifest({
    storage,
    forceRefresh: true,
    now: () => 2_000_000,
    fetchImpl: async (url, init) => {
      assert.equal(url, GALLERY_MANIFEST_URL);
      options = init;
      return { ok: true, json: async () => payload };
    },
  });
  assert.equal(options.cache, 'no-store');
  assert.equal(result.source, 'network');
});

test('network failure may use validated stale cache up to 24 hours', async () => {
  const savedAt = 3_000_000;
  const storage = memoryStorage({
    lidure_gallery_manifest_v1: JSON.stringify({ savedAt, payload }),
  });
  const result = await loadGalleryManifest({
    storage,
    now: () => savedAt + 6 * 60 * 60 * 1000,
    fetchImpl: async () => { throw new Error('offline'); },
  });
  assert.equal(result.source, 'stale-cache');
  assert.equal(result.stale, true);
});

test('stale cache older than 24 hours does not mask network failure', async () => {
  const savedAt = 4_000_000;
  const storage = memoryStorage({
    lidure_gallery_manifest_v1: JSON.stringify({ savedAt, payload }),
  });
  await assert.rejects(
    loadGalleryManifest({
      storage,
      now: () => savedAt + 25 * 60 * 60 * 1000,
      fetchImpl: async () => { throw new Error('offline'); },
    }),
    /offline/,
  );
});

test('cache clearing removes only the gallery manifest entry', () => {
  const storage = memoryStorage({ lidure_gallery_manifest_v1: 'x' });
  clearGalleryManifestCache(storage);
  assert.equal(storage.getItem('lidure_gallery_manifest_v1'), null);
});
```

- [ ] **Step 3: Run the test and verify RED**

Run:

```bash
node --test tests/gallery-manifest-client.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 4: Implement the manifest client**

Create `src/lib/gallery-manifest-client.mjs` with:

```js
import { parseGalleryManifest } from './gallery-data.mjs';

export const GALLERY_MANIFEST_URL =
  'https://raw.githubusercontent.com/Lidure/airi-gallery-images/main/gallery/gallery_index.json';

const CACHE_KEY = 'lidure_gallery_manifest_v1';
const FRESH_MS = 5 * 60 * 1000;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;

function readCache(storage) {
  try {
    const raw = storage?.getItem?.(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.savedAt)) return null;
    parseGalleryManifest(parsed.payload);
    return parsed;
  } catch {
    return null;
  }
}

export function clearGalleryManifestCache(storage) {
  try { storage?.removeItem?.(CACHE_KEY); } catch {}
}

export async function loadGalleryManifest({
  fetchImpl = fetch,
  storage = sessionStorage,
  now = Date.now,
  forceRefresh = false,
  signal = null,
} = {}) {
  const cached = readCache(storage);
  const age = cached ? now() - cached.savedAt : Infinity;

  if (!forceRefresh && cached && age <= FRESH_MS) {
    return { categories: parseGalleryManifest(cached.payload), source: 'cache', stale: false };
  }

  try {
    const response = await fetchImpl(GALLERY_MANIFEST_URL, {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`图库索引请求失败：HTTP ${response.status}`);
    const payload = await response.json();
    const categories = parseGalleryManifest(payload);
    try { storage?.setItem?.(CACHE_KEY, JSON.stringify({ savedAt: now(), payload })); } catch {}
    return { categories, source: 'network', stale: false };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (cached && age <= MAX_STALE_MS) {
      return { categories: parseGalleryManifest(cached.payload), source: 'stale-cache', stale: true };
    }
    throw error;
  }
}
```

- [ ] **Step 5: Run Task 1 + Task 2 tests**

Run:

```bash
node --test tests/gallery-data.test.mjs tests/gallery-manifest-client.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit runtime data loading**

```bash
git add package.json src/lib/gallery-manifest-client.mjs tests/gallery-manifest-client.test.mjs
git commit -m "feat: load gallery manifest at runtime"
```

---

### Task 3: Build the public gallery browser and bounded thumbnail prefetch

**Files:**
- Create: `src/components/GalleryBrowser.astro`
- Create: `src/lib/gallery-browser-controller.mjs`
- Create: `tests/gallery-browser.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 data helpers and Task 2 manifest client.
- Produces: `initGalleryBrowser(root, options?) -> cleanupFn` and DOM events:
  - `gallery:image-open` with `{ index, images }`
  - browser rendering for categories, page controls, refresh, stale/error state.

- [ ] **Step 1: Register `tests/gallery-browser.test.mjs` in `test:site`**

Append the test path to the existing Node test command.

- [ ] **Step 2: Write failing structural contracts**

The test should read `GalleryBrowser.astro` and `gallery-browser-controller.mjs` and assert:

```js
assert.match(component, /id="gallery-browser-root"/);
assert.match(component, /id="gallery-category-tabs"/);
assert.match(component, /id="gallery-grid"/);
assert.match(component, /id="gallery-refresh"/);
assert.match(component, /id="gallery-pager"/);
assert.match(controller, /loadGalleryManifest/);
assert.match(controller, /nextPagePrefetchCandidates/);
assert.match(controller, /requestIdleCallback/);
assert.match(controller, /loading\s*=\s*index\s*===\s*0\s*\?\s*['"]eager['"]\s*:\s*['"]lazy['"]/);
assert.match(controller, /decoding\s*=\s*['"]async['"]/);
assert.match(controller, /gallery:image-open/);
```

Add a focused source-level assertion that the prefetch limit is `2` and candidate selection excludes GIFs through `nextPagePrefetchCandidates`.

- [ ] **Step 3: Run the test and verify RED**

```bash
node --test tests/gallery-browser.test.mjs
```

Expected: FAIL because component/controller do not exist.

- [ ] **Step 4: Create the Astro browser shell**

`src/components/GalleryBrowser.astro` should contain semantic placeholders only, for example:

```astro
<section class="gallery-browser" id="gallery-browser-root" aria-labelledby="gallery-title">
  <header class="gallery-browser-head">
    <div>
      <p class="gallery-eyebrow">Airi Gallery</p>
      <h1 id="gallery-title">画廊</h1>
      <p class="gallery-summary">收集喜欢的画面、角色与瞬间。</p>
    </div>
    <button id="gallery-refresh" type="button">刷新图库</button>
  </header>
  <div id="gallery-notice" role="status" aria-live="polite"></div>
  <nav id="gallery-category-tabs" aria-label="图库分类"></nav>
  <div id="gallery-grid" class="gallery-grid" aria-live="polite"></div>
  <nav id="gallery-pager" class="gallery-pager" aria-label="图库分页"></nav>
</section>
```

Import and initialize the controller in a client script. Ensure cleanup runs on `astro:before-swap` and does not double-bind on re-entry.

- [ ] **Step 5: Implement `gallery-browser-controller.mjs`**

The controller must:

```text
1. load the manifest via loadGalleryManifest()
2. keep current category and page in controller-local state
3. render category buttons with counts
4. render exactly the current 24-image page
5. set only image index 0 to loading=eager; all later images loading=lazy
6. set decoding=async on every image
7. set each src with galleryProxyUrl(path)
8. replace a failed tile with a retryable placeholder, not a whole-page failure
9. emit gallery:image-open when a tile is activated
10. render first/prev/page/next/last controls
11. refresh by clearGalleryManifestCache + forceRefresh
12. show a non-blocking stale notice when result.stale === true
13. schedule at most 2 non-GIF next-page Image() preloads during idle time
14. cancel timeout/idle callbacks and abort metadata fetch on cleanup
```

Use `requestIdleCallback` where available and a `setTimeout(..., 1500)` fallback. Keep an explicit collection of created prefetch `Image` objects only until load/error so cleanup can release references.

- [ ] **Step 6: Run the focused gallery browser contracts**

```bash
node --test tests/gallery-data.test.mjs tests/gallery-manifest-client.test.mjs tests/gallery-browser.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit the public browser**

```bash
git add package.json src/components/GalleryBrowser.astro src/lib/gallery-browser-controller.mjs tests/gallery-browser.test.mjs
git commit -m "feat: add native public gallery browser"
```

---

### Task 4: Add the accessible lightbox with adjacent-only prefetch

**Files:**
- Create: `src/components/GalleryLightbox.astro`
- Create: `src/lib/gallery-lightbox-controller.mjs`
- Create: `tests/gallery-lightbox.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `gallery:image-open` event from Task 3 and `galleryProxyUrl()` from Task 1.
- Produces: accessible modal/lightbox with keyboard and touch navigation and cleanup.

- [ ] **Step 1: Register `tests/gallery-lightbox.test.mjs`**

Append it to `test:site`.

- [ ] **Step 2: Write failing contracts for accessibility and navigation**

Assert source contains:

```text
role="dialog"
aria-modal="true"
gallery-lightbox-close
gallery-lightbox-prev
gallery-lightbox-next
Escape
ArrowLeft
ArrowRight
touchstart
touchend
previouslyFocused
```

Also assert the controller constructs at most two adjacent prefetch `Image` instances based on previous/next index, rather than iterating every image.

- [ ] **Step 3: Run RED**

```bash
node --test tests/gallery-lightbox.test.mjs
```

Expected: FAIL because lightbox files do not exist.

- [ ] **Step 4: Implement the lightbox shell and controller**

Required behavior:

```text
- hidden until gallery:image-open arrives
- save triggering element/document.activeElement before open
- render selected image with object-fit: contain and descriptive alt fallback
- Escape closes
- ArrowLeft/ArrowRight navigate
- close button closes
- prev/next buttons disable or wrap consistently; choose wrap-around for parity with gallery browsing
- horizontal touch delta >= 48px navigates
- focus enters the close button when opened
- Tab/Shift+Tab stay within close/prev/next controls while open
- close returns focus to the triggering tile when still connected
- preload only previous and next images
- cleanup removes document/window listeners on Astro navigation
```

- [ ] **Step 5: Run gallery/lightbox tests**

```bash
node --test tests/gallery-data.test.mjs tests/gallery-browser.test.mjs tests/gallery-lightbox.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the lightbox**

```bash
git add package.json src/components/GalleryLightbox.astro src/lib/gallery-lightbox-controller.mjs tests/gallery-lightbox.test.mjs
git commit -m "feat: add gallery lightbox navigation"
```

---

### Task 5: Add hidden management mode with iframe lifecycle and failure fallback

**Files:**
- Create: `src/components/GalleryManager.astro`
- Create: `src/lib/gallery-manager-controller.mjs`
- Create: `tests/gallery-manager.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Cloud URL `https://airigallery.lidure22.xyz/` and browser URL state.
- Produces: `initGalleryManager(root, options?) -> cleanupFn` with two entry paths: initial `?manage=1` and `Ctrl + Alt + G`.

- [ ] **Step 1: Register the manager test**

Append `tests/gallery-manager.test.mjs` to `test:site`.

- [ ] **Step 2: Write failing management contracts**

The test should assert:

```js
assert.match(component, /gallery-manager-overlay/);
assert.match(component, /gallery-manager-frame-host/);
assert.doesNotMatch(component, /<iframe/); // normal server HTML must not eagerly embed Cloud
assert.match(controller, /searchParams\.get\(['"]manage['"]\)\s*===\s*['"]1['"]/);
assert.match(controller, /event\.ctrlKey\s*&&\s*event\.altKey/);
assert.match(controller, /event\.key\.toLowerCase\(\)\s*===\s*['"]g['"]/);
assert.match(controller, /document\.createElement\(['"]iframe['"]\)/);
assert.match(controller, /https:\/\/airigallery\.lidure22\.xyz\//);
assert.match(controller, /12_000|12000/);
assert.match(controller, /frame\.remove\(\)|replaceChildren\(\)/);
assert.match(controller, /history\.replaceState/);
assert.doesNotMatch(controller, /postMessage\([^)]*token/i);
```

Add source assertions for visible fallback controls with IDs or data attributes for retry, close, and direct-open.

- [ ] **Step 3: Run RED**

```bash
node --test tests/gallery-manager.test.mjs
```

Expected: FAIL because files do not exist.

- [ ] **Step 4: Implement the manager shell without an iframe**

`GalleryManager.astro` renders a hidden full-screen overlay shell containing:

```text
Blog-owned title/header
close button
frame host div
loading status
failure panel
retry button
direct link target=_blank rel=noopener noreferrer
```

The Astro server output must contain no `<iframe>`.

- [ ] **Step 5: Implement the manager controller**

Required behavior:

```text
- initialize only while the GalleryManager root exists
- open immediately when URLSearchParams(location.search).get('manage') === '1'
- listen for Ctrl+Alt+G, preventDefault only when the exact chord opens manager
- on open: unhide overlay, create one iframe dynamically, set src to Cloud URL, title, referrerPolicy='strict-origin-when-cross-origin'
- start 12-second timer; if load event has not fired, show failure panel while keeping retry/close/direct-open available
- on load: clear timer and hide loading/failure state
- retry: remove old iframe and create a new one
- close: remove iframe, clear timer, hide overlay, and remove manage=1 from current URL with history.replaceState
- cleanup: remove hotkey listener, remove iframe, clear timer, leave no page-global references
- never inspect iframe contentWindow/document because it is intentionally cross-origin
- never use postMessage for credentials or token data
```

- [ ] **Step 6: Add an idempotence guard for Astro re-entry**

Use a page-instance cleanup function rather than a permanent global listener. The component's script should assign cleanup to a root-scoped property or module-local lifecycle hook, run prior cleanup before reinitializing, and invoke cleanup on `astro:before-swap`.

- [ ] **Step 7: Run manager tests and the Blog's existing ClientRouter contracts**

```bash
node --test tests/gallery-manager.test.mjs tests/firefly-ui-refresh.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit management mode**

```bash
git add package.json src/components/GalleryManager.astro src/lib/gallery-manager-controller.mjs tests/gallery-manager.test.mjs
git commit -m "feat: add hidden gallery management mode"
```

---

### Task 6: Compose `/gallery`, add navigation, and add page-specific styling

**Files:**
- Create: `src/pages/gallery.astro`
- Create: `src/styles/gallery.css`
- Modify: `src/components/SiteHeader.astro`
- Create: `tests/gallery-page.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Tasks 3–5 components.
- Produces: first-class Blog route `/gallery` and primary navigation link `画廊`.

- [ ] **Step 1: Register `tests/gallery-page.test.mjs` in `test:site`**

- [ ] **Step 2: Write failing page/navigation/style contracts**

Assert:

```js
const page = read('src/pages/gallery.astro');
const header = read('src/components/SiteHeader.astro');
const css = read('src/styles/gallery.css');

assert.match(header, /href:\s*['"]\/gallery['"][^}]*label:\s*['"]画廊['"]/);
assert.match(page, /BaseLayout/);
assert.match(page, /GalleryBrowser/);
assert.match(page, /GalleryLightbox/);
assert.match(page, /GalleryManager/);
assert.match(page, /gallery\.css/);
assert.match(css, /\.gallery-grid/);
assert.match(css, /grid-template-columns/);
assert.match(css, /@media \(max-width:\s*720px\)/);
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
assert.match(css, /\.gallery-manager-overlay/);
assert.match(css, /\.gallery-lightbox/);
```

Add assertions that desktop/tablet/mobile breakpoints express 4–5 / 3 / 2 columns respectively without fixed-width overflow.

- [ ] **Step 3: Run RED**

```bash
node --test tests/gallery-page.test.mjs
```

Expected: FAIL because page/styles/nav link are absent.

- [ ] **Step 4: Create the route**

`src/pages/gallery.astro` should be minimal composition:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import GalleryBrowser from '../components/GalleryBrowser.astro';
import GalleryLightbox from '../components/GalleryLightbox.astro';
import GalleryManager from '../components/GalleryManager.astro';
import '../styles/gallery.css';
---

<BaseLayout
  title="画廊 | 搁浅 的小窝"
  description="Airi Gallery：收藏喜欢的画面、角色与瞬间。"
  bannerTitle="Airi Gallery"
  bannerSubtitle="收藏喜欢的画面、角色与瞬间"
>
  <main class="gallery-page-shell">
    <GalleryBrowser />
  </main>
  <GalleryLightbox />
  <GalleryManager />
</BaseLayout>
```

Use the actual `BaseLayout` slot conventions found in the repository; keep the route composition-only.

- [ ] **Step 5: Add `画廊` to primary navigation**

Insert in `primaryLinks` near other content surfaces:

```js
{ href: '/gallery', label: '画廊' },
```

Do not add a separate visible management link.

- [ ] **Step 6: Implement `gallery.css`**

Use existing theme variables rather than fixed brand colors where possible. Required style behavior:

```text
- page content constrained to Blog content width with mobile-safe padding
- translucent gallery browser card aligned with existing card tokens
- category pills horizontally scroll on narrow viewports instead of wrapping into overflow
- desktop grid: repeat(auto-fill, minmax(...)) capped visually around 4–5 columns
- tablet breakpoint: 3 columns
- mobile <=720px: 2 columns
- thumbnail tile uses aspect-ratio with object-fit: contain; source is never cropped
- hover scale/shadow is subtle
- reduced-motion removes scale/transitions
- skeletons and image error placeholders preserve tile dimensions
- lightbox uses fixed inset 0 and high overlay z-index without covering its own controls
- manager overlay uses fixed inset 0; frame host fills remaining viewport below its header
- body/page should not horizontally overflow on 320px viewport
```

- [ ] **Step 7: Run page/navigation contracts**

```bash
node --test tests/gallery-page.test.mjs tests/gallery-browser.test.mjs tests/gallery-lightbox.test.mjs tests/gallery-manager.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Run Astro type/build checks**

```bash
npm run build
```

Expected: `astro check` reports 0 errors and the static build includes `/gallery/index.html`.

- [ ] **Step 9: Commit route and styling**

```bash
git add package.json src/pages/gallery.astro src/styles/gallery.css src/components/SiteHeader.astro tests/gallery-page.test.mjs
git commit -m "feat: integrate Airi Gallery into Blog navigation"
```

---

### Task 7: Add integration regressions for loading, lifecycle, and token boundary

**Files:**
- Create: `tests/gallery-integration.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: all Blog gallery implementation files.
- Produces: final source-level contract preventing accidental eager Cloud loads, token handling, over-prefetch, and lifecycle regressions.

- [ ] **Step 1: Register the integration test**

Append `tests/gallery-integration.test.mjs` to `test:site`.

- [ ] **Step 2: Add token/security boundary assertions**

Test concatenated gallery source files and assert:

```js
assert.doesNotMatch(source, /ghp_[A-Za-z0-9]/);
assert.doesNotMatch(source, /access[_-]?token/i);
assert.doesNotMatch(source, /Authorization\s*:/i);
assert.doesNotMatch(source, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
assert.doesNotMatch(pageSource, /<iframe/i);
```

Allow user-facing wording such as “管理模式” but no token input field or write API implementation.

- [ ] **Step 3: Add loading/lifecycle assertions**

Assert:

```text
manifest URL is runtime code, not fetched at Astro build frontmatter
only one eager thumbnail path exists
the controller uses cleanup on astro:before-swap
manager removes iframe on cleanup
browser aborts metadata request on cleanup
prefetch candidate limit is 2 and GIFs are excluded
lightbox only references adjacent prefetch logic
```

- [ ] **Step 4: Run all gallery tests**

```bash
node --test \
  tests/gallery-data.test.mjs \
  tests/gallery-manifest-client.test.mjs \
  tests/gallery-browser.test.mjs \
  tests/gallery-lightbox.test.mjs \
  tests/gallery-manager.test.mjs \
  tests/gallery-page.test.mjs \
  tests/gallery-integration.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit integration contracts**

```bash
git add package.json tests/gallery-integration.test.mjs
git commit -m "test: lock gallery integration boundaries"
```

---

### Task 8: Run full Blog verification and perform responsive/manual smoke checks

**Files:**
- No new files unless a real defect is found.

**Interfaces:**
- Consumes: completed branch.
- Produces: verified PR candidate.

- [ ] **Step 1: Run the full test suite**

```bash
npm ci
npm test
```

Expected:

```text
wallpaper variant generation succeeds
astro check: 0 errors
astro build succeeds
all existing site tests + all gallery tests pass
```

- [ ] **Step 2: Start the local site**

```bash
npm run dev -- --host 0.0.0.0
```

- [ ] **Step 3: Smoke-test public gallery at desktop width**

Verify:

```text
/gallery loads without management iframe request
画廊 nav item is active
categories appear
first image may load eagerly; remaining image requests occur lazily as viewport advances
pagination changes only the current page DOM
refresh action reloads metadata
lightbox opens and keyboard navigation works
```

- [ ] **Step 4: Smoke-test at 768px and 320–390px widths**

Verify:

```text
3-column tablet layout
2-column phone layout
no horizontal page overflow
category pills remain usable
lightbox controls remain reachable
manager overlay header and close action remain visible
```

- [ ] **Step 5: Test Astro navigation lifecycle**

Navigate repeatedly:

```text
/ -> /gallery -> /posts -> /gallery
```

Then press `Ctrl + Alt + G` once.

Expected: exactly one management overlay and exactly one iframe appear. Closing removes the iframe. Repeat the cycle and confirm behavior remains one-to-one.

- [ ] **Step 6: Test query-parameter management entry**

Open:

```text
/gallery?manage=1
```

Expected: manager opens on page initialization. Closing changes the current URL back to `/gallery` via `history.replaceState` without a full reload.

- [ ] **Step 7: Test iframe fallback state**

Temporarily block the Cloud hostname in browser devtools or use an invalid injected Cloud URL in a local test-only override.

Expected after 12 seconds: failure state is visible with Retry, Close, and direct-open controls; public gallery remains intact after close.

- [ ] **Step 8: Verify production Cloud prerequisite before PR merge**

Run:

```bash
curl -sSI https://airigallery.lidure22.xyz/ | tr -d '\r'
```

Expected: CSP contains `frame-ancestors https://lidure22.xyz` and no `X-Frame-Options: DENY`.

If this prerequisite is not yet deployed, do not merge the Blog PR.

---

### Task 9: Open, review, and merge the Blog PR

**Files:**
- No product changes unless review finds an issue.

**Interfaces:**
- Consumes: fully verified Blog branch and deployed Cloud framing prerequisite.
- Produces: merged `/gallery` integration on `main`.

- [ ] **Step 1: Open the PR**

Use title:

```text
feat: integrate Airi Gallery into Blog
```

PR body:

```markdown
## Summary
- add a native read-only `/gallery` page backed by the public Airi Gallery manifest
- add categorized/paginated lazy image browsing and an accessible lightbox
- add hidden management mode via `?manage=1` and `Ctrl+Alt+G`
- lazily embed Airi Gallery Cloud only when management mode opens
- keep all write credentials and mutations outside Blog code

## Performance
- 5-minute session manifest cache, 24-hour stale fallback
- first thumbnail eager, remaining thumbnails lazy
- at most 2 non-GIF next-page idle prefetches
- adjacent-only lightbox prefetch

## Verification
- full `npm test` passes
- responsive smoke checks completed
- Astro navigation lifecycle checked
- production Cloud framing prerequisite verified
```

- [ ] **Step 2: Review the changed-file list**

Expected changes are limited to:

```text
src/pages/gallery.astro
src/components/GalleryBrowser.astro
src/components/GalleryLightbox.astro
src/components/GalleryManager.astro
src/lib/gallery-data.mjs
src/lib/gallery-manifest-client.mjs
src/lib/gallery-browser-controller.mjs
src/lib/gallery-lightbox-controller.mjs
src/lib/gallery-manager-controller.mjs
src/styles/gallery.css
src/components/SiteHeader.astro
package.json
tests/gallery-*.test.mjs
```

Any unrelated Firefly/article/message-board changes require explicit justification or removal.

- [ ] **Step 3: Confirm CI and whole-branch review are green**

Review focus:

```text
no token handling in Blog
no eager iframe
no unbounded GIF/image prefetch
safe manifest path parsing
idempotent Astro lifecycle
mobile overflow and modal focus behavior
```

- [ ] **Step 4: Merge with squash after approval**

Expected squash title:

```text
feat: integrate Airi Gallery into Blog
```

- [ ] **Step 5: Verify deployed Blog**

After deployment, check:

```text
https://lidure22.xyz/gallery
https://lidure22.xyz/gallery?manage=1
```

Confirm public browsing, lightbox, navigation, shortcut entry, iframe management, close cleanup, and direct Cloud fallback all work against production origins.
