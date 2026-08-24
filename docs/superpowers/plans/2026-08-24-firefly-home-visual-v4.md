# Firefly Home / Visual v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved Firefly-inspired v4 homepage and visual refresh: layered water-wave banner transitions, a redesigned visual settings center, server-side pinned Moments, refined post/music cards, recent guestbook previews, and profile social icons.

**Architecture:** Keep v3's Astro layout, `hero_settings` storage, slideshow/media library, Sakura renderer, and SEKAI player as the foundation. Add waves as a small self-contained visual subsystem driven by normalized visual settings, extend Moments pinning through the existing Cloudflare Worker + D1 backend, and keep homepage activity widgets as thin clients over existing public APIs. Each task ends with its own RED → GREEN cycle and commit.

**Tech Stack:** Astro 6, TypeScript/JavaScript ES modules, Node built-in test runner, Canvas 2D + SVG, Cloudflare Workers, D1, Vitest, existing CSS architecture.

**Spec:** `docs/superpowers/specs/2026-08-24-firefly-home-visual-v4-design.md`

## Global Constraints

- Do not copy Firefly implementation code, assets, icons, or CSS verbatim; only reproduce the approved interaction and visual language with original implementation.
- `hero_settings` remains the only visual-settings storage key.
- Upgrade normalized visual settings to storage `version: 3` while preserving all existing values and unknown media-library keys.
- Visual settings writes remain merge-safe and visual reset must never delete media/library data.
- `/player` keeps its existing immersive wallpaper behavior and never renders banner waves.
- The existing SEKAI player/audio element remains the only playback source of truth.
- At most three Moments may be pinned; pinning a fourth automatically unpins the oldest pinned Moment.
- Re-pinning an already pinned Moment is a strict no-op and must preserve `pinnedAt`.
- Homepage Recent Moments remains capped at three visible entries.
- Homepage Recent Messages shows at most the latest three public guestbook messages and does not expose comments/admin/composer UI.
- GitHub social link is `https://github.com/Lidure`.
- QQ social link is exactly `https://qm.qq.com/q/ujOhar9jQQ`.
- Decorative continuous motion must respect both `prefers-reduced-motion: reduce` and the site's `reduceMotion` setting.
- Preserve current media-library/upload IDs/interfaces where practical so the settings-panel redesign does not rewrite slideshow/media business logic.

---

## File / Responsibility Map

### Visual settings and waves
- `src/lib/visual-settings.mjs` — normalize/read/write/apply v3 visual settings and root datasets.
- `src/lib/banner-waves.mjs` — pure wave presets/constants.
- `src/components/BannerWaves.astro` — static SVG first frame, Canvas runtime, lifecycle, reduced-motion handling.
- `src/layouts/BaseLayout.astro` — no-flash visual bootstrap and wave placement.
- `src/components/VisualSettingsPanel.astro` — redesigned Appearance / Background / Effects UI.
- `src/styles/firefly-refresh.css`, `src/styles/firefly-v2.css` — v4 banner/card/activity visual rules.

### Moments pinning
- `danmaku-api/migrations/0007_add_moment_pins.sql` — non-destructive D1 pin columns/index.
- `danmaku-api/src/moments.ts` — pin model, list ordering/pagination, pin mutation.
- `danmaku-api/src/index.ts` — authenticated `PATCH /api/moments/:id/pin` route.
- `src/lib/moments-api.ts` — frontend pin fields and `setMomentPinned()` client.
- `src/pages/moments.astro` — pin marker and admin controls.
- `src/components/RecentMomentsWidget.astro` — three-entry pin-priority preview.

### Homepage widgets/cards
- `src/components/HomeLeftSidebar.astro` — profile social icons.
- `src/components/RecentMessagesWidget.astro` — latest three guestbook messages.
- `src/components/HomeRightSidebar.astro` — activity rail ordering.
- `src/components/HomePostCard.astro` — inset-cover article card.
- `src/components/MusicStatusWidget.astro` — hover/focus play overlay + playing ring.

### Tests
- `tests/visual-settings.test.mjs`
- `tests/banner-waves.test.mjs`
- `tests/firefly-v4.test.mjs`
- `tests/site-build.test.mjs`
- `danmaku-api/tests/moments.test.ts`
- `package.json`

---

### Task 1: Upgrade visual settings storage to v3 wave-aware state

**Files:**
- Modify: `src/lib/visual-settings.mjs`
- Modify: `src/layouts/BaseLayout.astro` (early inline visual bootstrap)
- Modify: `tests/visual-settings.test.mjs`
- Create: `tests/firefly-v4.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `VISUAL_SETTINGS_KEY`, `normalizeVisualSettings`, `readVisualSettings`, `applyVisualSettingsToDocument`, `writeVisualSettings`.
- Produces: `version: 3`, `waveEnabled`, `waveStrength`, `waveSpeed`, `waveMobile`, plus root datasets `waveEnabled`, `waveStrength`, `waveSpeed`, `waveMobile`.

- [ ] **Step 1: Write failing v3 normalization tests**

Append to `tests/visual-settings.test.mjs`:

```js
test('v3 visual defaults add waves while preserving unknown legacy keys', () => {
  const value = normalizeVisualSettings({
    version: 2,
    images: ['legacy-image'],
    waveStrength: 'invalid',
    waveSpeed: 'invalid',
  });
  assert.equal(DEFAULT_VISUAL_SETTINGS.version, 3);
  assert.equal(value.version, 3);
  assert.equal(value.waveEnabled, true);
  assert.equal(value.waveStrength, 'standard');
  assert.equal(value.waveSpeed, 'normal');
  assert.equal(value.waveMobile, true);
  assert.deepEqual(value.images, ['legacy-image']);
});

test('v3 applies wave datasets to the root element', () => {
  const dataset = {};
  const root = {
    dataset,
    classList: { toggle() {} },
    style: { setProperty() {} },
  };
  applyVisualSettingsToDocument({
    waveEnabled: false,
    waveStrength: 'strong',
    waveSpeed: 'fast',
    waveMobile: false,
  }, { documentElement: root });
  assert.equal(dataset.waveEnabled, 'false');
  assert.equal(dataset.waveStrength, 'strong');
  assert.equal(dataset.waveSpeed, 'fast');
  assert.equal(dataset.waveMobile, 'false');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
node --test tests/visual-settings.test.mjs
```

Expected: FAIL because current normalized storage is version 2 and has no wave fields.

- [ ] **Step 3: Implement v3 defaults and normalization**

In `src/lib/visual-settings.mjs` add exactly:

```js
waveEnabled: true,
waveStrength: 'standard',
waveSpeed: 'normal',
waveMobile: true,
```

Set `version: 3`. Normalize using:

```js
const WAVE_STRENGTHS = ['soft', 'standard', 'strong'];
const WAVE_SPEEDS = ['slow', 'normal', 'fast'];

waveEnabled: merged.waveEnabled !== false,
waveStrength: WAVE_STRENGTHS.includes(merged.waveStrength) ? merged.waveStrength : 'standard',
waveSpeed: WAVE_SPEEDS.includes(merged.waveSpeed) ? merged.waveSpeed : 'normal',
waveMobile: merged.waveMobile !== false,
```

Keep the existing `{ ...merged }` pattern so `images`, `posters`, selection fields, and future unknown keys survive reads/writes.

- [ ] **Step 4: Apply wave root datasets**

Add:

```js
root.dataset.waveEnabled = String(normalized.waveEnabled);
root.dataset.waveStrength = normalized.waveStrength;
root.dataset.waveSpeed = normalized.waveSpeed;
root.dataset.waveMobile = String(normalized.waveMobile);
```

- [ ] **Step 5: Mirror critical defaults in BaseLayout's synchronous bootstrap**

Add to the existing inline `hero_settings` read:

```js
root.dataset.waveEnabled = String(raw.waveEnabled !== false);
root.dataset.waveStrength = ['soft', 'standard', 'strong'].includes(raw.waveStrength) ? raw.waveStrength : 'standard';
root.dataset.waveSpeed = ['slow', 'normal', 'fast'].includes(raw.waveSpeed) ? raw.waveSpeed : 'normal';
root.dataset.waveMobile = String(raw.waveMobile !== false);
```

Do not add another storage key or second localStorage read.

- [ ] **Step 6: Create initial v4 source-contract test and register it**

Create `tests/firefly-v4.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('v4 early bootstrap exposes wave settings before hydration', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /dataset\.waveEnabled/);
  assert.match(layout, /dataset\.waveStrength/);
  assert.match(layout, /dataset\.waveSpeed/);
  assert.match(layout, /dataset\.waveMobile/);
});
```

Add `tests/firefly-v4.test.mjs` to `test:site` in `package.json`.

- [ ] **Step 7: Run focused tests and verify GREEN**

```bash
node --test tests/visual-settings.test.mjs tests/firefly-v4.test.mjs
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/visual-settings.mjs src/layouts/BaseLayout.astro tests/visual-settings.test.mjs tests/firefly-v4.test.mjs package.json
git commit -m "feat: add v4 wave visual settings"
```

---

### Task 2: Build the layered banner wave subsystem

**Files:**
- Create: `src/lib/banner-waves.mjs`
- Create: `src/components/BannerWaves.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/styles/firefly-refresh.css`
- Create: `tests/banner-waves.test.mjs`
- Modify: `tests/firefly-v4.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1 root datasets and `lidure:visual-settings-change`.
- Produces: `resolveWavePreset(settings)` and a `BannerWaves` component with static SVG + Canvas handoff.

- [ ] **Step 1: Write failing pure preset tests**

Create `tests/banner-waves.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveWavePreset } from '../src/lib/banner-waves.mjs';

test('wave presets map strength and speed to bounded multipliers', () => {
  assert.deepEqual(resolveWavePreset({ waveStrength: 'soft', waveSpeed: 'slow' }), {
    amplitude: 0.72,
    alpha: 0.72,
    speed: 0.72,
  });
  assert.deepEqual(resolveWavePreset({ waveStrength: 'strong', waveSpeed: 'fast' }), {
    amplitude: 1.22,
    alpha: 1.12,
    speed: 1.32,
  });
});

test('invalid wave options fall back to standard normal', () => {
  assert.deepEqual(resolveWavePreset({ waveStrength: 'x', waveSpeed: 'y' }), {
    amplitude: 1,
    alpha: 1,
    speed: 1,
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/banner-waves.test.mjs
```

- [ ] **Step 3: Implement pure wave constants**

Create `src/lib/banner-waves.mjs`:

```js
export const WAVE_LAYERS = Object.freeze([
  { y: 0, alpha: 0.22, duration: 8.4, phase: 0 },
  { y: 3, alpha: 0.42, duration: 9.3, phase: 0.23 },
  { y: 5, alpha: 0.58, duration: 10.1, phase: 0.51 },
  { y: 7, alpha: 0.72, duration: 11.2, phase: 0.76 },
]);
const STRENGTH = {
  soft: { amplitude: 0.72, alpha: 0.72 },
  standard: { amplitude: 1, alpha: 1 },
  strong: { amplitude: 1.22, alpha: 1.12 },
};
const SPEED = { slow: 0.72, normal: 1, fast: 1.32 };
export function resolveWavePreset(settings = {}) {
  const strength = STRENGTH[settings.waveStrength] || STRENGTH.standard;
  return {
    amplitude: strength.amplitude,
    alpha: strength.alpha,
    speed: SPEED[settings.waveSpeed] || SPEED.normal,
  };
}
```

- [ ] **Step 4: Add failing component contract**

Append:

```js
test('v4 waves provide static SVG first paint and Canvas runtime', () => {
  const waves = readSource('src/components/BannerWaves.astro');
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(waves, /class="banner-waves-static"/);
  assert.match(waves, /<canvas[^>]*data-wave-canvas/);
  assert.match(waves, /getContext\(['"]2d['"]\)/);
  assert.match(waves, /prefers-reduced-motion/);
  assert.match(waves, /lidure:visual-settings-change/);
  assert.match(layout, /<BannerWaves/);
});
```

Run `node --test tests/firefly-v4.test.mjs` and verify RED.

- [ ] **Step 5: Implement the static first frame**

Create this original four-layer SVG structure in `BannerWaves.astro`:

```astro
<div class="banner-waves" id="banner-waves" aria-hidden="true">
  <svg class="banner-waves-static" viewBox="0 0 160 32" preserveAspectRatio="none">
    <path class="wave-layer wave-layer-1" d="M0 15 C20 7 40 23 60 15 S100 7 120 15 S145 22 160 14 V32 H0 Z" />
    <path class="wave-layer wave-layer-2" d="M0 18 C24 11 42 25 66 17 S108 10 132 18 S150 21 160 17 V32 H0 Z" />
    <path class="wave-layer wave-layer-3" d="M0 21 C18 16 38 27 62 20 S104 14 126 21 S148 24 160 20 V32 H0 Z" />
    <path class="wave-layer wave-layer-4" d="M0 24 C22 20 42 29 68 23 S112 18 136 24 S152 26 160 23 V32 H0 Z" />
  </svg>
  <canvas data-wave-canvas></canvas>
</div>
```

These paths are intentionally original and only encode the approved layered-wave visual strategy.

- [ ] **Step 6: Implement Canvas runtime and lifecycle**

Use:

```ts
import { WAVE_LAYERS, resolveWavePreset } from '../lib/banner-waves.mjs';
```

Runtime must:
- read normalized settings from `window.__lidureVisualSettings?.read()` with root-dataset fallback;
- hide when `waveEnabled === false`;
- hide on mobile when `waveMobile === false`;
- get the content fill color from `--standard-page-bg`, then `--bg` fallback;
- cap device pixel ratio at `2`;
- draw four filled bezier bands with Task 2 layer phases/durations and preset multipliers;
- keep static SVG visible until first successful Canvas frame, then add `.is-canvas-ready`;
- on `reduceMotion` or `prefers-reduced-motion`, cancel RAF and show static SVG;
- pause when `document.hidden`;
- listen for `lidure:visual-settings-change` and resize;
- remove RAF/ResizeObserver/listeners on `astro:before-swap`.

- [ ] **Step 7: Mount and style waves**

Import/mount `BannerWaves` between `<BlogBanner />` and `.standard-page-surface` in `BaseLayout.astro`.

In `firefly-refresh.css` implement:
- banner mode wave anchored to hero lower edge;
- fullscreen homepage wave anchored to the bottom of first `100vh`;
- fullscreen non-home `display:none`;
- desktop height `clamp(72px, 13vh, 150px)`;
- mobile height `clamp(48px, 9vh, 92px)`;
- `pointer-events:none`, `overflow:hidden`;
- no layout shift;
- static SVG remains visible when motion is reduced.

- [ ] **Step 8: Run tests and register wave test**

Add `tests/banner-waves.test.mjs` to `test:site`, then run:

```bash
node --test tests/banner-waves.test.mjs tests/firefly-v4.test.mjs
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/banner-waves.mjs src/components/BannerWaves.astro src/layouts/BaseLayout.astro src/styles/firefly-refresh.css tests/banner-waves.test.mjs tests/firefly-v4.test.mjs package.json
git commit -m "feat: add layered banner waves"
```

---

### Task 3: Redesign the Background & Appearance settings panel

**Files:**
- Modify: `src/components/VisualSettingsPanel.astro`
- Modify: `tests/firefly-v4.test.mjs`

**Interfaces:**
- Consumes: `window.__lidureVisualSettings.read/write`, existing media IDs, Task 1 wave keys.
- Produces: neutral three-tab desktop settings panel and mobile bottom sheet.

- [ ] **Step 1: Write failing panel structure test**

```js
test('v4 settings center groups wave controls under Background and uses mobile bottom sheet', () => {
  const panel = readSource('src/components/VisualSettingsPanel.astro');
  assert.match(panel, /id="toggle-wave-enabled"/);
  assert.match(panel, /id="wave-strength-soft"/);
  assert.match(panel, /id="wave-strength-standard"/);
  assert.match(panel, /id="wave-strength-strong"/);
  assert.match(panel, /id="wave-speed-slow"/);
  assert.match(panel, /id="wave-speed-normal"/);
  assert.match(panel, /id="wave-speed-fast"/);
  assert.match(panel, /id="toggle-wave-mobile"/);
  assert.match(panel, /Customize your space/);
  assert.match(panel, /max-height:\s*86dvh/);
});
```

Run `node --test tests/firefly-v4.test.mjs` and verify RED.

- [ ] **Step 2: Rebuild markup around three neutral groups**

Retain these critical IDs exactly:

```text
toggle-enabled
toggle-autoplay
toggle-sakura
interval-range
opacity-range
quality-select
file-input
upload-zone
url-input
url-add-btn
media-manage-btn
media-count
```

Use:
- Appearance: theme hue, card opacity, card border, card-follow-theme.
- Background / Wallpaper: mode, enabled, autoplay, interval, overlay, fullscreen blur/card opacity.
- Background / Banner effects: banner gradient/title + wave controls.
- Background / Media: quality + upload/URL + library.
- Effects: Sakura + reduce motion.

Add helper line `Customize your space` under `背景与外观`.

- [ ] **Step 3: Bind all wave controls to merge-safe writes**

Exact patches:

```js
write({ waveEnabled: checked });
write({ waveMobile: checked });
write({ waveStrength: 'soft' });
write({ waveStrength: 'standard' });
write({ waveStrength: 'strong' });
write({ waveSpeed: 'slow' });
write({ waveSpeed: 'normal' });
write({ waveSpeed: 'fast' });
```

Synchronize segmented buttons using `aria-pressed`. Background reset restores only Background-owned fields including all four wave keys and must not remove media/library keys.

- [ ] **Step 4: Apply one neutral panel color system**

Desktop shell:

```css
.hero-settings-panel {
  width: min(445px, calc(100vw - 40px));
  background: color-mix(in srgb, var(--panel-bg) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-radius: 22px;
  backdrop-filter: blur(24px) saturate(1.08);
}
```

Use theme hue only for active tabs, checked controls, range progress, and selected segmented options. Remove per-group saturated pink/cyan/purple/warm fills inside the panel.

- [ ] **Step 5: Implement mobile bottom sheet**

At `max-width: 720px`:

```css
.hero-settings-panel {
  left: 0;
  right: 0;
  top: auto;
  bottom: 0;
  width: 100%;
  max-height: 86dvh;
  border-radius: 24px 24px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}
```

Internal body scrolls; no horizontal overflow at 390px.

- [ ] **Step 6: Preserve accessibility behavior**

Keep dialog labels, `aria-expanded`, tab roles, ArrowLeft/ArrowRight navigation, Escape-close focus recovery, and visible `:focus-visible`. Wave segmented options remain normal buttons and keyboard reachable.

- [ ] **Step 7: Run compatibility tests**

```bash
node --test tests/firefly-v3.test.mjs tests/firefly-v4.test.mjs tests/visual-settings.test.mjs
```

- [ ] **Step 8: Commit**

```bash
git add src/components/VisualSettingsPanel.astro tests/firefly-v4.test.mjs
git commit -m "feat: redesign visual settings center"
```

---

### Task 4: Add server-side pinned Moments with deterministic pagination

**Files:**
- Create: `danmaku-api/migrations/0007_add_moment_pins.sql`
- Modify: `danmaku-api/src/moments.ts`
- Modify: `danmaku-api/src/index.ts`
- Modify: `danmaku-api/tests/moments.test.ts`

**Interfaces:**
- Consumes: current `moments` table and existing admin session middleware.
- Produces: optional API fields `pinned?: boolean`, `pinnedAt?: number`; `setMomentPinned()`; `PATCH /api/moments/:id/pin`.

- [ ] **Step 1: Write failing list tests for pin-first ordering**

Add fixtures with `pinned`/`pinned_at` and assert:

```ts
const result = await listMoments(db, 3);
expect(result.items.map((item) => item.id)).toEqual(['pinned-new', 'pinned-old', 'normal-new']);
expect(result.items[0]).toMatchObject({ pinned: true, pinnedAt: 3000 });
```

Add a cursor test that asserts the cursor SQL contains `pinned = 0` and no pinned item is returned on subsequent pages.

- [ ] **Step 2: Write failing mutation tests**

Import:

```ts
import { setMomentPinned } from '../src/moments';
```

Add these explicit cases using existing `makeDb` / `makeBatchDb`, captured SQL/args, and `now: () => 5000`:

```ts
it('re-pinning an already pinned moment is a no-op and preserves pinnedAt', async () => {
  // mock current item as pinned at 3000; assert no UPDATE statement is executed
});
it('pinning a fourth moment displaces the oldest pin in one batch', async () => {
  // mock three pins; assert batch contains oldest-unpin then target-pin with 5000
});
it('unpinning clears pinned and pinned_at', async () => {
  // assert UPDATE binds 0/null for target
});
```

The comments describe exact assertions, not deferred functionality; implement the test bodies with the repository's existing D1 mock helpers in the same step.

- [ ] **Step 3: Run backend test and verify RED**

```bash
cd danmaku-api
npm test -- tests/moments.test.ts
```

- [ ] **Step 4: Add non-destructive D1 migration**

```sql
ALTER TABLE moments ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE moments ADD COLUMN pinned_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_moments_pinned_at ON moments(pinned, pinned_at DESC);
```

- [ ] **Step 5: Extend backend types and both SELECT paths**

```ts
export type MomentApiItem = {
  id: string;
  date: string;
  category: MomentCategory;
  text: string;
  link?: string;
  images: string[];
  media: MomentMediaItem[];
  pinned?: boolean;
  pinnedAt?: number;
};
```

Extend `MomentListRow`:

```ts
pinned: number;
pinned_at: number | null;
```

Both list query and `getMomentById()` select `m.pinned, m.pinned_at`.

Aggregation:

```ts
...(row.pinned === 1 ? { pinned: true } : {}),
...(row.pinned_at != null ? { pinnedAt: row.pinned_at } : {}),
```

Missing `pinned` means false.

- [ ] **Step 6: Implement list pagination semantics exactly**

No cursor:
1. fetch up to three pinned Moments ordered `pinned_at DESC, id DESC`;
2. `normalLimit = Math.max(0, normalizedLimit - pinnedItems.length)`;
3. fetch unpinned Moments in existing `date DESC, id DESC` order, enough for `normalLimit + 1` distinct Moments;
4. return `pinnedItems.concat(normalItems.slice(0, normalLimit))`;
5. emit `nextCursor` only when an extra unpinned Moment exists, derived from the last returned unpinned item.

Cursor present:
- query only `pinned = 0 AND (date < ? OR (date = ? AND id < ?))`;
- never prepend pinned rows;
- keep `date|id` cursor format.

- [ ] **Step 7: Implement pin mutation**

```ts
export async function setMomentPinned(
  db: D1Database,
  id: string,
  pinned: boolean,
  options: { now?: () => number } = {},
): Promise<{ item: MomentApiItem; displacedId?: string }>
```

Rules:
- missing -> `MOMENT_NOT_FOUND`;
- already pinned + true -> no UPDATE, preserve old `pinnedAt`;
- unpin -> clear `pinned`/`pinned_at`;
- fewer than 3 pins -> pin with `now()`;
- three pins -> select oldest `pinned_at ASC, id ASC`, `db.batch()` unpin + target pin;
- return target from `getMomentById()` and `displacedId` only on displacement.

- [ ] **Step 8: Write failing route tests**

Cover:
- unauthenticated `PATCH /api/moments/moment-4/pin` -> 401;
- JSON `{ "pinned": "yes" }` -> 400;
- authenticated `{ "pinned": true }` -> 200 `{ item, displacedId? }`.

Reuse existing signed-session pattern used by Moment create/delete tests.

- [ ] **Step 9: Implement route before generic Moment DELETE matching**

```ts
const pinMatch = url.pathname.match(/^\/api\/moments\/([^/]+)\/pin$/);
if (pinMatch) {
  if (request.method === 'PATCH') {
    return handleSetMomentPinned(decodeURIComponent(pinMatch[1]), request, env);
  }
  return errorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405, request, env);
}
```

Handler uses `requireSession()`, JSON-only body, boolean `pinned`, `setMomentPinned()`, 404 for `MOMENT_NOT_FOUND`, 400 for invalid input.

- [ ] **Step 10: Run backend GREEN checks**

```bash
cd danmaku-api
npm test -- tests/moments.test.ts
npm run check
```

- [ ] **Step 11: Commit**

```bash
git add danmaku-api/migrations/0007_add_moment_pins.sql danmaku-api/src/moments.ts danmaku-api/src/index.ts danmaku-api/tests/moments.test.ts
git commit -m "feat: add pinned moments API"
```

---

### Task 5: Wire pinned Moments into frontend/admin UI

**Files:**
- Modify: `src/lib/moments-api.ts`
- Modify: `src/pages/moments.astro`
- Modify: `src/components/RecentMomentsWidget.astro`
- Modify: `tests/firefly-v4.test.mjs`

**Interfaces:**
- Consumes: Task 4 list fields and pin route.
- Produces: `setMomentPinned(momentId, pinned)`, full-page admin controls, three-entry homepage pin preview.

- [ ] **Step 1: Add failing frontend contracts**

```js
test('v4 moments frontend exposes pin API and admin controls', () => {
  const api = readSource('src/lib/moments-api.ts');
  const page = readSource('src/pages/moments.astro');
  const recent = readSource('src/components/RecentMomentsWidget.astro');
  assert.match(api, /setMomentPinned/);
  assert.match(api, /\/pin/);
  assert.match(page, /moment-pin/);
  assert.match(page, /取消置顶|置顶/);
  assert.match(recent, /pinned/);
});
```

- [ ] **Step 2: Extend frontend API**

Add optional fields:

```ts
pinned?: boolean;
pinnedAt?: number;
```

Add:

```ts
export async function setMomentPinned(momentId: string, pinned: boolean) {
  return requestJson<{ item: MomentApiItem; displacedId?: string }>(
    `/moments/${encodeURIComponent(momentId)}/pin`,
    {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ pinned }),
    },
  );
}
```

- [ ] **Step 3: Add full-page pin badge/admin control**

When `item.pinned`, render `.moment-pin-badge` with `置顶`. In admin mode append `.moment-pin` button with `取消置顶` or `置顶`.

If the page already has a first-page reload helper, reuse it. Otherwise extract current initial first-page load into:

```ts
async function refreshMomentsFromFirstPage() {
  // reset current cursor/list state using the same state variables the page already owns
  // fetchMoments() from the first page and rerender through the existing render path
}
```

The implementation of this helper must be the existing initial-load statements moved into one function, not a new parallel state store.

Pin click:

```ts
await setMomentPinned(item.id, !item.pinned);
await refreshMomentsFromFirstPage();
```

Do not locally guess which old pin was displaced.

- [ ] **Step 4: Preserve Recent Moments capacity**

Keep `fetchMoments({ limit: 3 })`, render `items.slice(0, 3)`, and prefix pinned meta:

```js
meta.textContent = `${item.pinned ? '📌 置顶 · ' : ''}${item.category || '日常'} · ${formatDate(item.date)}`;
```

No independent sorting.

- [ ] **Step 5: Run tests and commit**

```bash
node --test tests/firefly-v4.test.mjs tests/site-build.test.mjs
git add src/lib/moments-api.ts src/pages/moments.astro src/components/RecentMomentsWidget.astro tests/firefly-v4.test.mjs
git commit -m "feat: add pinned moments UI"
```

---

### Task 6: Add homepage social contacts and Recent Messages

**Files:**
- Modify: `src/components/HomeLeftSidebar.astro`
- Create: `src/components/RecentMessagesWidget.astro`
- Modify: `src/components/HomeRightSidebar.astro`
- Modify: `src/styles/firefly-v2.css`
- Modify: `tests/firefly-v4.test.mjs`

**Interfaces:**
- Consumes: `fetchGuestMessages()`, `formatPublicTime()`.
- Produces: icon-only GitHub/QQ contacts and latest-three guestbook preview.

- [ ] **Step 1: Add failing tests**

```js
test('v4 profile exposes approved GitHub and QQ contacts', () => {
  const left = readSource('src/components/HomeLeftSidebar.astro');
  assert.match(left, /https:\/\/github\.com\/Lidure/);
  assert.match(left, /https:\/\/qm\.qq\.com\/q\/ujOhar9jQQ/);
  assert.match(left, /aria-label="GitHub"/);
  assert.match(left, /aria-label="QQ"/);
});

test('v4 activity rail inserts Recent Messages between Moments and Music', () => {
  const right = readSource('src/components/HomeRightSidebar.astro');
  const messages = readSource('src/components/RecentMessagesWidget.astro');
  assert.match(right, /RecentMessagesWidget/);
  assert.ok(right.indexOf('RecentMomentsWidget') < right.indexOf('RecentMessagesWidget'));
  assert.ok(right.indexOf('RecentMessagesWidget') < right.indexOf('MusicStatusWidget'));
  assert.match(messages, /fetchGuestMessages/);
  assert.match(messages, /slice\(0,\s*3\)/);
});
```

- [ ] **Step 2: Add profile social row**

Use small icon-only controls. If the repository already contains suitable local GitHub/QQ brand SVG assets, reuse them. Otherwise use these dependency-free glyph icons, which satisfy the icon-only interaction without copying Firefly assets:

```ts
const socialLinks = [
  { type: 'github', href: 'https://github.com/Lidure', label: 'GitHub', glyph: 'GH' },
  { type: 'qq', href: 'https://qm.qq.com/q/ujOhar9jQQ', label: 'QQ', glyph: 'QQ' },
];
```

```astro
<nav class="profile-social-links" aria-label="联系方式">
  {socialLinks.map((link) => (
    <a href={link.href} target="_blank" rel="noreferrer" aria-label={link.label} title={link.label} class={`profile-social-link is-${link.type}`}>
      <span aria-hidden="true">{link.glyph}</span>
    </a>
  ))}
</nav>
```

The control shape/spacing/tooltip behavior is Firefly-like; the actual glyphs/assets remain local/original.

- [ ] **Step 3: Create RecentMessagesWidget**

```astro
<div class="recent-messages-widget" id="recent-messages-widget">
  <div class="recent-messages-list" data-message-list>
    <p class="sidebar-widget-placeholder">正在读取最近留言…</p>
  </div>
  <a class="sidebar-widget-more" href="/messages">查看全部留言 →</a>
</div>
```

Client imports:

```ts
import { fetchGuestMessages, formatPublicTime } from '../lib/public-interactions';
```

On init: fetch, render `messages.slice(0, 3)`, each entry links `/messages`, meta = nickname + formatted time, text clamps two lines, quiet empty/error state, lifecycle initialized guard. No comments/composer/admin UI.

- [ ] **Step 4: Insert right-rail order**

```astro
<SidebarWidget title="最近碎碎念" ...><RecentMomentsWidget /></SidebarWidget>
<SidebarWidget title="最近留言" ...><RecentMessagesWidget /></SidebarWidget>
<SidebarWidget title="音乐" ...><MusicStatusWidget /></SidebarWidget>
```

Statistics follows music; notice remains last if retained.

- [ ] **Step 5: Style and test**

Use neutral surfaces, subtle hover, visible `:focus-visible`, no saturated full-card fills.

```bash
node --test tests/firefly-v4.test.mjs tests/site-build.test.mjs
git add src/components/HomeLeftSidebar.astro src/components/RecentMessagesWidget.astro src/components/HomeRightSidebar.astro src/styles/firefly-v2.css tests/firefly-v4.test.mjs
git commit -m "feat: add homepage social and guestbook activity"
```

---

### Task 7: Rework homepage article cards

**Files:**
- Modify: `src/components/HomePostCard.astro`
- Modify: `src/styles/firefly-v2.css`
- Modify: `src/styles/firefly-refresh.css`
- Modify: `tests/firefly-v4.test.mjs`
- Preserve: `src/lib/post-cover.mjs`

**Interfaces:**
- Consumes: `resolvePostCover()`.
- Produces: desktop inset-cover list card and mobile top-cover card; no fake placeholders.

- [ ] **Step 1: Add failing contract**

```js
test('v4 posts use inset cover and mobile top-cover layout', () => {
  const card = readSource('src/components/HomePostCard.astro');
  const css = readSource('src/styles/firefly-v2.css') + readSource('src/styles/firefly-refresh.css');
  assert.match(card, /home-post-enter/);
  assert.match(card, /home-post-cover-overlay/);
  assert.match(css, /\.home-post-card\.has-cover/);
  assert.match(css, /width:\s*33%/);
  assert.match(css, /scale\(1\.05\)/);
  assert.match(css, /@media[^\{]*max-width[^\{]*760px[\s\S]*?\.home-post-card\.has-cover/);
});
```

- [ ] **Step 2: Refine markup without changing cover resolution**

Keep the current `resolvePostCover()` call unchanged:

```astro
<article class:list={['home-post-card', { 'has-cover': !!cover, 'no-cover': !cover }]}>
  <div class="home-post-copy">...</div>
  {cover ? (
    <a class="home-post-cover" href={href} aria-label={`阅读 ${post.data.title}`}>
      <img src={cover} alt="" loading="lazy" decoding="async" />
      <span class="home-post-cover-overlay" aria-hidden="true"></span>
      <span class="home-post-enter" aria-hidden="true">›</span>
    </a>
  ) : (
    <a class="home-post-enter home-post-enter-text" href={href} aria-label={`阅读 ${post.data.title}`}>›</a>
  )}
</article>
```

- [ ] **Step 3: Desktop geometry**

Covered copy ~67%; right cover `width:33%`; ~15px inset; 15px radius; card hover max `translateY(-2px)`; image `scale(1.05)`; subtle dark overlay + chevron; no heavy glow. No-cover card uses only a right enter affordance.

- [ ] **Step 4: Mobile geometry**

At `max-width:760px`: one column, cover in normal flow above copy, `width:100%`, about `16/9`, desktop offsets removed.

- [ ] **Step 5: Run and commit**

```bash
node --test tests/post-cover.test.mjs tests/firefly-v4.test.mjs tests/site-build.test.mjs
git add src/components/HomePostCard.astro src/styles/firefly-v2.css src/styles/firefly-refresh.css tests/firefly-v4.test.mjs
git commit -m "feat: refine homepage article cards"
```

---

### Task 8: Refine homepage music hover control and playing ring

**Files:**
- Modify: `src/components/MusicStatusWidget.astro`
- Modify: `tests/firefly-v4.test.mjs`

**Interfaces:**
- Consumes: existing SEKAI proxy IDs/audio/open function.
- Produces: desktop hover/focus-only play overlay, coarse-pointer low-opacity overlay, `.is-playing` animated ring.

- [ ] **Step 1: Add failing contract**

```js
test('v4 music overlay is hover/focus driven and playing state owns a restrained color ring', () => {
  const music = readSource('src/components/MusicStatusWidget.astro');
  assert.match(music, /opacity:\s*0/);
  assert.match(music, /music-status-art:hover[\s\S]*music-status-play-overlay|music-status-art:focus-within/);
  assert.match(music, /hover:\s*none|pointer:\s*coarse/);
  assert.match(music, /is-playing[\s\S]*conic-gradient/);
  assert.match(music, /prefers-reduced-motion/);
  assert.match(music, /id="sekaiPlayPauseBtn"/);
});
```

- [ ] **Step 2: Desktop overlay hidden at rest**

```css
.music-status-play-overlay {
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, -50%) scale(.9);
}
.music-status-art:hover .music-status-play-overlay,
.music-status-art:focus-within .music-status-play-overlay {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, -50%) scale(1);
}
```

- [ ] **Step 3: Coarse pointer stays accessible**

```css
@media (hover: none), (pointer: coarse) {
  .music-status-play-overlay {
    opacity: .72;
    visibility: visible;
    transform: translate(-50%, -50%) scale(.94);
  }
}
```

- [ ] **Step 4: Add playing ring**

Use a thin pseudo-element ring with:

```css
background: conic-gradient(#f39ab5, #a899ee, #7fcddd, #efb1a3, #f39ab5);
animation: music-ring-spin 8s linear infinite;
```

Only `.music-status-widget.is-playing` reveals/animates it. Reduced motion keeps the ring static.

- [ ] **Step 5: Preserve proxy logic**

Keep click targets `sekaiPrevBtn`, `sekaiPlayPauseBtn`, `sekaiNextBtn`, and `window.__sekaiOpenPlayer?.()`. Keep `.is-playing` derived from `audio.src && !audio.paused`.

- [ ] **Step 6: Run and commit**

```bash
node --test tests/firefly-v3.test.mjs tests/firefly-v4.test.mjs tests/sekai-player-search.test.mjs
git add src/components/MusicStatusWidget.astro tests/firefly-v4.test.mjs
git commit -m "feat: refine homepage music interactions"
```

---

### Task 9: Harmonize responsive/accessibility polish

**Files:**
- Modify: `src/styles/firefly-v2.css`
- Modify: `src/styles/firefly-refresh.css`
- Modify only where polish requires tracked changes: homepage/sidebar/music/post/settings components from Tasks 3, 5, 6, 7, 8.
- Modify: `tests/firefly-v4.test.mjs`

**Interfaces:**
- Consumes: Tasks 1–8.
- Produces: coherent neutral v4 surfaces; no new business logic.

- [ ] **Step 1: Add failing cross-component tests**

```js
test('v4 social and activity links expose visible focus and reduced-motion-safe styling', () => {
  const css = readSource('src/styles/firefly-v2.css') + readSource('src/styles/firefly-refresh.css');
  assert.match(css, /profile-social-link:focus-visible/);
  assert.match(css, /recent-message-item:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});
```

- [ ] **Step 2: Normalize surface rules**

Use neutral background variables, one subtle border, restrained shadow, consistent radius, theme hue only for interaction accents, and remove leftover saturated neighboring widget fills.

- [ ] **Step 3: Manual desktop + 390px check**

Verify keyboard reach/focus for contacts, messages, post links, music, settings; Escape focus recovery; wave segmented controls; mobile play visible without hover; no 390px overflow; bottom-sheet safe area.

- [ ] **Step 4: Manual reduced-motion check**

Verify static visible waves, existing Sakura behavior, static playing ring, minimized card motion with both OS reduce-motion and site `reduceMotion=true`.

- [ ] **Step 5: Run full frontend suite**

```bash
npm test
```

- [ ] **Step 6: Commit only if Task 9 changed tracked files**

```bash
git add -u
git commit -m "feat: polish v4 responsive visual system"
```

Skip this commit when `git status --short` is clean.

---

### Task 10: Final integration verification and merge-ready review

**Files:**
- Modify only if verification reveals a defect.
- Review: design spec and this plan.

**Interfaces:**
- Consumes: Tasks 1–9.
- Produces: merge-ready branch with fresh frontend/backend evidence and explicit D1 deployment ordering.

- [ ] **Step 1: Frontend full verification**

```bash
npm test
```

Expected: Astro check 0 errors, static build succeeds, all registered Node tests pass.

- [ ] **Step 2: Backend full verification**

```bash
cd danmaku-api
npm test
npm run check
```

- [ ] **Step 3: Inspect built contracts**

Verify Recent Messages, GitHub/QQ links, v4 article classes, no broken source-relative Markdown covers, and no banner-wave UI in `/player` immersive output.

- [ ] **Step 4: Inspect branch diff**

```bash
git diff main...HEAD --stat
git diff main...HEAD -- src/lib/visual-settings.mjs src/components/VisualSettingsPanel.astro src/components/MusicStatusWidget.astro src/components/HomePostCard.astro danmaku-api/src/moments.ts danmaku-api/src/index.ts
```

Confirm no second settings key/audio state, no copied Firefly assets/code, no media reset, no `/player` regression.

- [ ] **Step 5: Apply D1 migration before Worker deployment**

`danmaku-api/wrangler.jsonc` maps `api.lidure22.xyz` to `src/index.ts` and `./migrations`. Production order:

```bash
cd danmaku-api
npx wrangler d1 migrations apply lidure-danmaku --remote
npm run deploy
```

Never deploy Worker code that queries `pinned` before `0007_add_moment_pins.sql` is applied.

- [ ] **Step 6: Create/update merge-ready PR summary**

Include wave/settings redesign, pinned Moments/migration, homepage messages/social/article/music changes, frontend results, backend results, and migration ordering.

- [ ] **Step 7: Commit verification fixes only when present**

After confirming `git status --short` contains only intended tracked fixes:

```bash
git add -u
git commit -m "fix: resolve v4 verification issues"
```

Skip when verification caused no tracked changes.
