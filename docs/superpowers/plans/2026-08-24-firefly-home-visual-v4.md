# Firefly Home / Visual v4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved Firefly-inspired v4 homepage and visual refresh: layered water-wave banner transitions, a redesigned visual settings center, server-side pinned Moments, refined post/music cards, recent guestbook previews, and profile social icons.

**Architecture:** Keep v3's existing Astro layout, `hero_settings` storage, slideshow/media library, Sakura renderer, and SEKAI player as the foundation. Add waves as a small self-contained visual subsystem driven by normalized visual settings, extend Moments pinning through the existing Cloudflare Worker + D1 backend, and keep homepage activity widgets as thin clients over the existing public APIs. Implement each concern behind stable interfaces so the settings panel and homepage components do not duplicate business logic.

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
- `src/lib/visual-settings.mjs` — normalize/read/write/apply v3 visual settings and root datasets/CSS variables.
- `src/lib/banner-waves.mjs` — pure wave presets/constants used by the browser renderer and unit tests.
- `src/components/BannerWaves.astro` — static SVG first frame, Canvas runtime, lifecycle, reduced-motion handling.
- `src/layouts/BaseLayout.astro` — early no-flash visual bootstrap and wave placement relative to standard content.
- `src/components/VisualSettingsPanel.astro` — redesigned Appearance / Background / Effects settings UI.
- `src/styles/firefly-refresh.css` and `src/styles/firefly-v2.css` — banner boundary geometry and shared v4 surfaces.

### Moments pinning
- `danmaku-api/migrations/0007_add_moment_pins.sql` — non-destructive D1 pin columns/indexes.
- `danmaku-api/src/moments.ts` — pin data model, list ordering/pagination, pin mutation.
- `danmaku-api/src/index.ts` — authenticated `PATCH /api/moments/:id/pin` route.
- `src/lib/moments-api.ts` — frontend pin fields and `setMomentPinned()` client.
- `src/pages/moments.astro` — pin marker and admin pin/unpin controls.
- `src/components/RecentMomentsWidget.astro` — preserve three-entry capacity while prioritizing pinned items.

### Homepage widgets and cards
- `src/components/HomeLeftSidebar.astro` — profile social icon row.
- `src/components/RecentMessagesWidget.astro` — homepage-only public guestbook preview.
- `src/components/HomeRightSidebar.astro` — activity rail ordering.
- `src/components/HomePostCard.astro` — Firefly-inspired inset-cover article cards.
- `src/components/MusicStatusWidget.astro` — hover/focus play control and playing ring.
- `src/styles/firefly-v2.css` / `src/styles/firefly-refresh.css` — harmonized card/rail responsive visuals.

### Tests
- `tests/visual-settings.test.mjs` — visual settings migration/normalization.
- `tests/banner-waves.test.mjs` — pure wave preset behavior.
- `tests/firefly-v4.test.mjs` — static integration/accessibility/responsive contracts for v4 UI.
- `tests/site-build.test.mjs` — built-output integration where needed.
- `danmaku-api/tests/moments.test.ts` — pin list/pagination/mutation/route behavior.
- `package.json` — register new frontend test files in `test:site`.

---

### Task 1: Upgrade visual settings storage to v3 wave-aware state

**Files:**
- Modify: `src/lib/visual-settings.mjs`
- Modify: `src/layouts/BaseLayout.astro` (early inline bootstrap and root datasets)
- Modify: `tests/visual-settings.test.mjs`
- Create: `tests/firefly-v4.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing `VISUAL_SETTINGS_KEY`, `normalizeVisualSettings`, `readVisualSettings`, `applyVisualSettingsToDocument`, `writeVisualSettings`.
- Produces: normalized settings with `version`, `waveEnabled`, `waveStrength`, `waveSpeed`, `waveMobile`; root datasets `data-wave-enabled`, `data-wave-strength`, `data-wave-speed`, `data-wave-mobile`.

- [ ] **Step 1: Add failing normalization/migration tests**

Append tests equivalent to:

```js
import {
  DEFAULT_VISUAL_SETTINGS,
  normalizeVisualSettings,
  applyVisualSettingsToDocument,
} from '../src/lib/visual-settings.mjs';

test('v3 visual defaults include wave controls without dropping legacy keys', () => {
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

test('v3 visual settings apply wave datasets to the document root', () => {
  const attrs = {};
  const root = {
    dataset: attrs,
    classList: { toggle() {} },
    style: { setProperty() {} },
  };
  applyVisualSettingsToDocument({
    waveEnabled: false,
    waveStrength: 'strong',
    waveSpeed: 'fast',
    waveMobile: false,
  }, { documentElement: root });

  assert.equal(attrs.waveEnabled, 'false');
  assert.equal(attrs.waveStrength, 'strong');
  assert.equal(attrs.waveSpeed, 'fast');
  assert.equal(attrs.waveMobile, 'false');
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run:

```bash
node --test tests/visual-settings.test.mjs
```

Expected: FAIL because current defaults are version 2 and wave fields/datasets do not exist.

- [ ] **Step 3: Implement minimal v3 settings normalization**

Update defaults and normalization with exactly these new fields:

```js
export const DEFAULT_VISUAL_SETTINGS = Object.freeze({
  version: 3,
  // existing keys unchanged...
  waveEnabled: true,
  waveStrength: 'standard',
  waveSpeed: 'normal',
  waveMobile: true,
});

const WAVE_STRENGTHS = ['soft', 'standard', 'strong'];
const WAVE_SPEEDS = ['slow', 'normal', 'fast'];

// in normalizeVisualSettings return:
version: 3,
waveEnabled: merged.waveEnabled !== false,
waveStrength: WAVE_STRENGTHS.includes(merged.waveStrength)
  ? merged.waveStrength
  : 'standard',
waveSpeed: WAVE_SPEEDS.includes(merged.waveSpeed)
  ? merged.waveSpeed
  : 'normal',
waveMobile: merged.waveMobile !== false,
```

Apply root datasets in `applyVisualSettingsToDocument()`:

```js
root.dataset.waveEnabled = String(normalized.waveEnabled);
root.dataset.waveStrength = normalized.waveStrength;
root.dataset.waveSpeed = normalized.waveSpeed;
root.dataset.waveMobile = String(normalized.waveMobile);
```

Preserve the existing `{ ...merged }` return pattern so unknown media-library keys survive normalization.

- [ ] **Step 4: Mirror critical wave defaults in the no-flash inline bootstrap**

In `BaseLayout.astro`'s early inline `hero_settings` bootstrap, add only synchronous critical attributes:

```js
root.dataset.waveEnabled = String(raw.waveEnabled !== false);
root.dataset.waveStrength = ['soft', 'standard', 'strong'].includes(raw.waveStrength)
  ? raw.waveStrength
  : 'standard';
root.dataset.waveSpeed = ['slow', 'normal', 'fast'].includes(raw.waveSpeed)
  ? raw.waveSpeed
  : 'normal';
root.dataset.waveMobile = String(raw.waveMobile !== false);
```

Do not introduce another localStorage read or another storage key.

- [ ] **Step 5: Add v4 source-contract smoke test and register it**

Create `tests/firefly-v4.test.mjs` with the initial contract:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('v4 early bootstrap exposes wave settings before hydration', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /data(?:set)?\.waveEnabled|dataset\.waveEnabled/);
  assert.match(layout, /dataset\.waveStrength/);
  assert.match(layout, /dataset\.waveSpeed/);
  assert.match(layout, /dataset\.waveMobile/);
});
```

Add `tests/firefly-v4.test.mjs` to `test:site` in `package.json`.

- [ ] **Step 6: Run focused frontend tests and confirm GREEN**

Run:

```bash
node --test tests/visual-settings.test.mjs tests/firefly-v4.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

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
- Consumes: root datasets from Task 1 and `lidure:visual-settings-change` events.
- Produces: `resolveWavePreset(settings)` and a `BannerWaves` component with static SVG + Canvas runtime.

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

test('unknown wave presets fall back to standard/normal', () => {
  assert.deepEqual(resolveWavePreset({ waveStrength: 'x', waveSpeed: 'y' }), {
    amplitude: 1,
    alpha: 1,
    speed: 1,
  });
});
```

- [ ] **Step 2: Run test and confirm RED**

```bash
node --test tests/banner-waves.test.mjs
```

Expected: FAIL because `src/lib/banner-waves.mjs` does not exist.

- [ ] **Step 3: Implement pure wave constants/preset resolver**

Create `src/lib/banner-waves.mjs` with original constants, not copied Firefly source:

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

- [ ] **Step 4: Add failing UI contract for static SVG + Canvas handoff**

Append to `tests/firefly-v4.test.mjs`:

```js
test('v4 waves render a static first frame and Canvas runtime with reduced-motion fallback', () => {
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

Run:

```bash
node --test tests/firefly-v4.test.mjs
```

Expected: FAIL because the component is not present.

- [ ] **Step 5: Implement `BannerWaves.astro`**

The component must contain:

```astro
<div class="banner-waves" id="banner-waves" aria-hidden="true">
  <svg class="banner-waves-static" viewBox="0 0 160 32" preserveAspectRatio="none">
    <!-- four original gentle paths/uses filled with currentColor/page background -->
  </svg>
  <canvas data-wave-canvas></canvas>
</div>
```

Browser script requirements:

```ts
import { WAVE_LAYERS, resolveWavePreset } from '../lib/banner-waves.mjs';
```

Runtime behavior:
- read settings through `window.__lidureVisualSettings?.read()` when available, otherwise root datasets;
- hide the entire component when `waveEnabled === false`;
- hide on coarse mobile only when `waveMobile === false`;
- derive fill color using `getComputedStyle(document.documentElement).getPropertyValue('--standard-page-bg')` with `--bg` fallback;
- size canvas with device-pixel-ratio capped at `2`;
- draw four filled bezier wave bands with differentiated durations/phases;
- keep the SVG visible until the first successful Canvas draw, then add `.is-canvas-ready`;
- if reduced motion is active, stop RAF and keep the static SVG visible;
- pause RAF while `document.hidden`;
- clean ResizeObserver/RAF/listeners on `astro:before-swap`.

- [ ] **Step 6: Mount waves once in the standard layout boundary**

In `BaseLayout.astro`:

```astro
import BannerWaves from '../components/BannerWaves.astro';
```

Place it between `<BlogBanner ... />` and `.standard-page-surface`, inside a wrapper whose CSS can anchor it to the hero lower edge. Render only for `isStandard`; CSS handles banner/fullscreen-home visibility and `/player` stays excluded because it is immersive.

- [ ] **Step 7: Add responsive/display CSS**

In `firefly-refresh.css`, implement:
- banner mode: absolute/overlapping wave at hero bottom;
- fullscreen homepage: wave at the bottom of the first `100vh` hero;
- fullscreen non-home: `display:none`;
- desktop height `clamp(72px, 13vh, 150px)`;
- mobile height `clamp(48px, 9vh, 92px)`;
- `pointer-events:none`, `overflow:hidden`, and no layout shift;
- static/canvas crossfade only when motion is allowed.

- [ ] **Step 8: Run wave and v4 tests**

```bash
node --test tests/banner-waves.test.mjs tests/firefly-v4.test.mjs
```

Expected: PASS.

- [ ] **Step 9: Register wave test and commit**

Add `tests/banner-waves.test.mjs` to `test:site`, then:

```bash
git add src/lib/banner-waves.mjs src/components/BannerWaves.astro src/layouts/BaseLayout.astro src/styles/firefly-refresh.css tests/banner-waves.test.mjs tests/firefly-v4.test.mjs package.json
git commit -m "feat: add layered banner waves"
```

---

### Task 3: Redesign the Background & Appearance settings panel

**Files:**
- Modify: `src/components/VisualSettingsPanel.astro`
- Modify: `tests/firefly-v4.test.mjs`
- Modify: `tests/site-build.test.mjs` only if built-output selectors need coverage.

**Interfaces:**
- Consumes: `window.__lidureVisualSettings.read/write`, existing media-control IDs, Task 1 wave keys.
- Produces: accessible three-tab desktop panel and mobile bottom-sheet UI without changing media business logic.

- [ ] **Step 1: Add failing settings-panel structure tests**

Append:

```js
test('v4 settings center groups waves under Background and becomes a mobile bottom sheet', () => {
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
  assert.match(panel, /position:\s*fixed[\s\S]*bottom:/);
  assert.match(panel, /88dvh|86dvh|84dvh|82dvh/);
});
```

Run:

```bash
node --test tests/firefly-v4.test.mjs
```

Expected: FAIL because wave controls and bottom-sheet styles do not yet exist.

- [ ] **Step 2: Refactor markup into neutral grouped surfaces**

Keep these existing critical IDs intact:

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

Use three tab panels with group cards:
- Appearance: theme hue, card opacity, card border, card-follow-theme.
- Background / Wallpaper: mode, enabled, autoplay, interval, opacity, fullscreen blur/card opacity.
- Background / Banner effects: banner gradient/title + wave controls.
- Background / Media: quality + upload/URL + library.
- Effects: Sakura + reduce motion.

Add header helper text `Customize your space`.

- [ ] **Step 3: Bind wave controls to merge-safe writes**

Use the existing panel helpers and write exact patches:

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

Synchronize segmented buttons with `aria-pressed` and current normalized settings. Background-tab reset must restore only Background-owned fields including all four wave keys; it must not touch `images`, `posters`, or media-selection keys.

- [ ] **Step 4: Replace multi-tone settings styling with one neutral system**

Desktop:
- width `min(445px, calc(100vw - 40px))`;
- neutral translucent shell/card backgrounds;
- one active theme accent for tabs, checked toggles, slider progress, selected segmented buttons;
- remove decorative per-group pink/cyan/purple/warm surfaces from the panel.

Mobile `@media (max-width: 720px)`:

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

Ensure internal `.settings-body` scrolls and the page itself does not gain horizontal overflow.

- [ ] **Step 5: Preserve accessibility behavior**

Retain/verify:
- `role="dialog"`, `aria-labelledby`, settings-button `aria-expanded`;
- proper tablist/tab/tabpanel roles;
- ArrowLeft/ArrowRight tab navigation;
- Escape closes and returns focus;
- visible `:focus-visible` states;
- segmented wave options keyboard reachable.

- [ ] **Step 6: Run focused tests**

```bash
node --test tests/firefly-v3.test.mjs tests/firefly-v4.test.mjs tests/visual-settings.test.mjs
```

Expected: PASS, including all v3 compatibility assertions.

- [ ] **Step 7: Commit**

```bash
git add src/components/VisualSettingsPanel.astro tests/firefly-v4.test.mjs tests/site-build.test.mjs
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
- Consumes: existing D1 `moments` table and admin session middleware.
- Produces: `MomentApiItem.pinned`, `MomentApiItem.pinnedAt`, `setMomentPinned(db, id, pinned, options)`, `PATCH /api/moments/:id/pin`.

- [ ] **Step 1: Add failing list-model tests for pins**

Extend test row fixtures with `pinned` and `pinned_at` and add cases that assert:

```ts
const result = await listMoments(db, 3);
expect(result.items.map((item) => item.id)).toEqual([
  'pinned-new',
  'pinned-old',
  'normal-new',
]);
expect(result.items[0]).toMatchObject({ pinned: true, pinnedAt: 3000 });
```

Add a cursor case where the mocked SQL expectation verifies the cursor page includes `pinned = 0` and returns no pinned row.

- [ ] **Step 2: Add failing pin mutation tests**

Import the new function in the test:

```ts
import { setMomentPinned } from '../src/moments';
```

Cover all approved semantics:

```ts
it('pinning an already pinned moment is a no-op and preserves pinnedAt', async () => { /* expect no UPDATE */ });
it('pinning a fourth moment displaces the oldest pin in one batch', async () => { /* assert two UPDATE statements */ });
it('unpin clears pinned and pinned_at', async () => { /* assert UPDATE args */ });
```

Use `now: () => 5000` so timestamp assertions are deterministic.

- [ ] **Step 3: Run backend tests and confirm RED**

```bash
cd danmaku-api
npm test -- tests/moments.test.ts
```

Expected: FAIL because the model/function/route do not exist.

- [ ] **Step 4: Add D1 migration**

Create `0007_add_moment_pins.sql`:

```sql
ALTER TABLE moments ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE moments ADD COLUMN pinned_at INTEGER;
CREATE INDEX IF NOT EXISTS idx_moments_pinned_at ON moments(pinned, pinned_at DESC);
```

No table recreation or destructive migration.

- [ ] **Step 5: Extend Moments data types and aggregation**

In `danmaku-api/src/moments.ts`:

```ts
export type MomentApiItem = {
  // existing fields...
  pinned: boolean;
  pinnedAt?: number;
};
```

Extend selected/list rows with:

```ts
pinned: number;
pinned_at: number | null;
```

Map them in aggregation:

```ts
pinned: row.pinned === 1,
...(row.pinned_at != null ? { pinnedAt: row.pinned_at } : {}),
```

- [ ] **Step 6: Implement first-page and cursor-page query split**

`listMoments()` must keep the current return type:

```ts
Promise<{ items: MomentApiItem[]; nextCursor: string | null }>
```

No cursor:
1. query up to three pinned Moment IDs/rows ordered `pinned_at DESC`;
2. compute `normalLimit = max(0, limit - pinnedCount)`;
3. query unpinned rows ordered existing `date DESC, id DESC` with `normalLimit + 1` distinct Moments worth of data;
4. return `pinnedItems.concat(normalItems.slice(0, normalLimit))`;
5. next cursor derives only from the last returned unpinned item and only when an extra unpinned item exists.

Cursor present:
- query only `WHERE pinned = 0 AND (date < ? OR (date = ? AND id < ?))`;
- never prepend pins.

Keep media-row aggregation correct when a Moment has multiple media rows.

- [ ] **Step 7: Implement `setMomentPinned()`**

Signature:

```ts
export async function setMomentPinned(
  db: D1Database,
  id: string,
  pinned: boolean,
  options: { now?: () => number } = {},
): Promise<{ item: MomentApiItem; displacedId?: string }>
```

Behavior:
- load target pin state first;
- if target missing, throw an error carrying code `MOMENT_NOT_FOUND`;
- if target already pinned and requested `true`, return current item with no update;
- unpin: `UPDATE moments SET pinned = 0, pinned_at = NULL, updated_at = ? WHERE id = ?`;
- pin with fewer than three current pins: one update to `pinned = 1, pinned_at = now()`;
- pin with three current pins: select oldest `ORDER BY pinned_at ASC, id ASC LIMIT 1`, then D1 `batch()` the displacement update and target update;
- return target via existing single-item fetch helper and `displacedId` when used.

- [ ] **Step 8: Add authenticated HTTP route tests**

Test:

```http
PATCH https://api.example.com/api/moments/moment-4/pin
Content-Type: application/json
{ "pinned": true }
```

Assertions:
- unauthenticated request -> 401;
- malformed body -> 400;
- authenticated request -> 200 JSON with `{ item, displacedId? }`.

Use the same signed-session test helper/pattern already used by create/delete Moment route tests.

- [ ] **Step 9: Implement route in `danmaku-api/src/index.ts`**

Route detection must run before the generic `/api/moments/:id` DELETE branch:

```ts
const pinMatch = url.pathname.match(/^\/api\/moments\/([^/]+)\/pin$/);
if (pinMatch) {
  if (request.method === 'PATCH') {
    return handleSetMomentPinned(decodeURIComponent(pinMatch[1]), request, env);
  }
  return errorResponse('Method not allowed', 'METHOD_NOT_ALLOWED', 405, request, env);
}
```

Handler requirements:
- `requireSession()`;
- JSON body only;
- `pinned` must be boolean;
- call `setMomentPinned(env.DB, id, pinned)`;
- map `MOMENT_NOT_FOUND` to 404 and validation to 400.

- [ ] **Step 10: Run backend checks**

```bash
cd danmaku-api
npm test -- tests/moments.test.ts
npm run check
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add danmaku-api/migrations/0007_add_moment_pins.sql danmaku-api/src/moments.ts danmaku-api/src/index.ts danmaku-api/tests/moments.test.ts
git commit -m "feat: add pinned moments API"
```

---

### Task 5: Wire pinned Moments into the frontend and admin UI

**Files:**
- Modify: `src/lib/moments-api.ts`
- Modify: `src/pages/moments.astro`
- Modify: `src/components/RecentMomentsWidget.astro`
- Modify: `tests/firefly-v4.test.mjs`

**Interfaces:**
- Consumes: Task 4 `PATCH /api/moments/:id/pin` and pinned list fields.
- Produces: `setMomentPinned(momentId, pinned)`, admin pin buttons, pin markers, homepage pin-priority rendering.

- [ ] **Step 1: Add failing frontend pin contracts**

Append:

```js
test('v4 moments frontend exposes authenticated pin controls and homepage pin markers', () => {
  const api = readSource('src/lib/moments-api.ts');
  const page = readSource('src/pages/moments.astro');
  const recent = readSource('src/components/RecentMomentsWidget.astro');
  assert.match(api, /setMomentPinned/);
  assert.match(api, /\/pin/);
  assert.match(page, /moment-pin/);
  assert.match(page, /取消置顶|置顶/);
  assert.match(recent, /pinned/);
  assert.match(recent, /置顶/);
});
```

Run:

```bash
node --test tests/firefly-v4.test.mjs
```

Expected: FAIL.

- [ ] **Step 2: Extend frontend API contract**

In `MomentApiItem` add:

```ts
pinned: boolean;
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

- [ ] **Step 3: Add pin marker and admin button in `/moments` rendering**

For each item:
- render a small `.moment-pin-badge` when `item.pinned`;
- in admin mode append a `.moment-pin` button with text `取消置顶` or `置顶`;
- click calls `setMomentPinned(item.id, !item.pinned)`;
- after success refresh the list from `fetchMoments()` instead of trying to locally guess displacement order;
- disable the button while request is active;
- keep delete/reaction/comment/media behavior unchanged.

- [ ] **Step 4: Update Recent Moments to show pin state without growing beyond three entries**

Continue requesting:

```ts
fetchMoments({ limit: 3 })
```

Render `items.slice(0, 3)` exactly as today, but prepend a small pin glyph/text to meta when `item.pinned`:

```js
meta.textContent = `${item.pinned ? '📌 置顶 · ' : ''}${item.category || '日常'} · ${formatDate(item.date)}`;
```

The server already supplies pin-first order, so do not resort independently in the widget.

- [ ] **Step 5: Style pin UI minimally**

Use the existing Moment card system:
- badge uses theme accent soft background;
- admin pin button matches delete/admin control sizing but not destructive red;
- no large pinned banner.

- [ ] **Step 6: Run focused frontend tests**

```bash
node --test tests/firefly-v4.test.mjs tests/site-build.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/moments-api.ts src/pages/moments.astro src/components/RecentMomentsWidget.astro tests/firefly-v4.test.mjs
git commit -m "feat: add pinned moments UI"
```

---

### Task 6: Add homepage social contacts and Recent Messages activity widget

**Files:**
- Modify: `src/components/HomeLeftSidebar.astro`
- Create: `src/components/RecentMessagesWidget.astro`
- Modify: `src/components/HomeRightSidebar.astro`
- Modify: `tests/firefly-v4.test.mjs`
- Modify: `src/styles/firefly-v2.css` or the existing homepage sidebar style section that owns these classes.

**Interfaces:**
- Consumes: `fetchGuestMessages()` and `formatPublicTime()` from `src/lib/public-interactions.ts`.
- Produces: icon-only GitHub/QQ links and three-message homepage preview.

- [ ] **Step 1: Add failing homepage activity/social tests**

```js
test('v4 homepage profile exposes approved GitHub and QQ icon links', () => {
  const left = readSource('src/components/HomeLeftSidebar.astro');
  assert.match(left, /https:\/\/github\.com\/Lidure/);
  assert.match(left, /https:\/\/qm\.qq\.com\/q\/ujOhar9jQQ/);
  assert.match(left, /aria-label="GitHub"/);
  assert.match(left, /aria-label="QQ"/);
});

test('v4 right rail includes recent messages between moments and music', () => {
  const right = readSource('src/components/HomeRightSidebar.astro');
  const messages = readSource('src/components/RecentMessagesWidget.astro');
  assert.match(right, /RecentMessagesWidget/);
  assert.ok(right.indexOf('RecentMomentsWidget') < right.indexOf('RecentMessagesWidget'));
  assert.ok(right.indexOf('RecentMessagesWidget') < right.indexOf('MusicStatusWidget'));
  assert.match(messages, /fetchGuestMessages/);
  assert.match(messages, /slice\(0,\s*3\)/);
  assert.match(messages, /href="\/messages"|href\s*=\s*['"]\/messages['"]/);
});
```

Run and confirm RED.

- [ ] **Step 2: Add profile social row**

In `HomeLeftSidebar.astro`, define:

```ts
const socialLinks = [
  { type: 'github', href: 'https://github.com/Lidure', label: 'GitHub' },
  { type: 'qq', href: 'https://qm.qq.com/q/ujOhar9jQQ', label: 'QQ' },
];
```

Render inside the existing About Me card after stats:

```astro
<nav class="profile-social-links" aria-label="联系方式">
  {socialLinks.map((link) => (
    <a href={link.href} target="_blank" rel="noreferrer" aria-label={link.label} title={link.label} class={`profile-social-link is-${link.type}`}>
      <!-- original inline SVG path for service icon, not copied from Firefly -->
    </a>
  ))}
</nav>
```

Icons are neutral at rest and gain subtle theme/brand feedback on hover/focus.

- [ ] **Step 3: Create `RecentMessagesWidget.astro`**

Markup:

```astro
<div class="recent-messages-widget" id="recent-messages-widget">
  <div class="recent-messages-list" data-message-list>
    <p class="sidebar-widget-placeholder">正在读取最近留言…</p>
  </div>
  <a class="sidebar-widget-more" href="/messages">查看全部留言 →</a>
</div>
```

Client script:

```ts
import { fetchGuestMessages, formatPublicTime } from '../lib/public-interactions';
```

On init:
- fetch messages;
- `messages.slice(0, 3)`;
- each entry is an `<a href="/messages" class="recent-message-item">`;
- nickname and formatted time in meta row;
- text in a child clamped to two lines;
- empty/error state uses quiet `.sidebar-widget-placeholder`;
- use an initialized dataset guard compatible with Astro page transitions.

- [ ] **Step 4: Insert the widget into the right rail**

In `HomeRightSidebar.astro` order:

```astro
<SidebarWidget title="最近碎碎念" ...><RecentMomentsWidget /></SidebarWidget>
<SidebarWidget title="最近留言" ...><RecentMessagesWidget /></SidebarWidget>
<SidebarWidget title="音乐" ...><MusicStatusWidget /></SidebarWidget>
```

Keep site statistics after music; existing small notice may remain last.

- [ ] **Step 5: Harmonize activity-rail styles**

Use one neutral card language for Moments/Messages/Music/Stats:
- no separate saturated background per widget;
- 1–2 line clamps;
- subtle separators;
- same hover elevation/transition scale;
- `:focus-visible` outline for message/social links.

- [ ] **Step 6: Run focused tests**

```bash
node --test tests/firefly-v4.test.mjs tests/site-build.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/HomeLeftSidebar.astro src/components/RecentMessagesWidget.astro src/components/HomeRightSidebar.astro src/styles/firefly-v2.css tests/firefly-v4.test.mjs
git commit -m "feat: add homepage social and guestbook activity"
```

---

### Task 7: Rework homepage article cards toward the approved Firefly list language

**Files:**
- Modify: `src/components/HomePostCard.astro`
- Modify: `src/styles/firefly-v2.css` and/or `src/styles/firefly-refresh.css` in the existing homepage-card sections.
- Modify: `tests/firefly-v4.test.mjs`
- Preserve: `src/lib/post-cover.mjs`

**Interfaces:**
- Consumes: existing `resolvePostCover()` priority `frontmatter -> first Markdown image -> none`.
- Produces: desktop inset-cover list card and mobile top-cover card without fake placeholders.

- [ ] **Step 1: Add failing post-card contracts**

```js
test('v4 homepage posts use inset cover, enter affordance, and mobile top-cover layout', () => {
  const card = readSource('src/components/HomePostCard.astro');
  const css = readSource('src/styles/firefly-v2.css') + readSource('src/styles/firefly-refresh.css');
  assert.match(card, /home-post-enter/);
  assert.match(card, /home-post-cover/);
  assert.match(card, /home-post-reading-time|分钟阅读/);
  assert.match(css, /\.home-post-card\.has-cover/);
  assert.match(css, /32%|33%|34%/);
  assert.match(css, /\.home-post-cover[\s\S]*?scale\(1\.0[4-6]\)/);
  assert.match(css, /@media[^\{]*max-width[^\{]*760px[\s\S]*?\.home-post-card\.has-cover/);
});
```

Run and confirm RED for the new enter/layout contracts.

- [ ] **Step 2: Refine component markup while preserving cover resolution**

Keep the existing `resolvePostCover()` call unchanged.

For covered posts, render:

```astro
<article class:list={['home-post-card', { 'has-cover': !!cover, 'no-cover': !cover }]}>
  <div class="home-post-copy">...</div>
  {cover ? (
    <a class="home-post-cover" href={href} aria-label={`阅读 ${post.data.title}`}>
      <img ... />
      <span class="home-post-cover-overlay" aria-hidden="true"></span>
      <span class="home-post-enter" aria-hidden="true">›</span>
    </a>
  ) : (
    <a class="home-post-enter home-post-enter-text" href={href} aria-label={`阅读 ${post.data.title}`}>›</a>
  )}
</article>
```

Metadata hierarchy:
- title dominant;
- published date and reading time directly below/near title;
- description exactly two-line clamp on desktop;
- tags compact and do not duplicate the same metadata elsewhere.

- [ ] **Step 3: Implement desktop inset-cover geometry**

Desktop rules:
- `position:relative` card;
- covered copy width around `66%–68%`;
- cover absolute/inset on right with `width: 33%` (acceptable 32–34%);
- cover margins approximately `14–16px` from card edges;
- cover independent `border-radius: 14–16px`;
- card hover translate no more than `-2px`;
- cover hover image `transform: scale(1.05)`;
- subtle dark overlay + chevron fade in;
- no heavy glow.

No-cover card gets a narrow right enter affordance but no generated placeholder image.

- [ ] **Step 4: Implement mobile top-cover geometry**

At `max-width: 760px`:
- `.home-post-card.has-cover` becomes one-column;
- `.home-post-cover` returns to normal flow and appears before/above copy visually;
- `width:100%`, aspect ratio near `16 / 9`;
- copy uses full width;
- remove desktop absolute cover offsets;
- preserve two-line description where space permits.

- [ ] **Step 5: Run cover and v4 regressions**

```bash
node --test tests/post-cover.test.mjs tests/firefly-v4.test.mjs tests/site-build.test.mjs
```

Expected: PASS; automatic Markdown-first-image cover behavior remains intact.

- [ ] **Step 6: Commit**

```bash
git add src/components/HomePostCard.astro src/styles/firefly-v2.css src/styles/firefly-refresh.css tests/firefly-v4.test.mjs
git commit -m "feat: refine homepage article cards"
```

---

### Task 8: Refine the homepage music card hover control and playing ring

**Files:**
- Modify: `src/components/MusicStatusWidget.astro`
- Modify: `tests/firefly-v4.test.mjs`
- Preserve: existing SEKAI proxy button IDs and source-of-truth behavior.

**Interfaces:**
- Consumes: existing `#sekaiPrevBtn`, `#sekaiPlayPauseBtn`, `#sekaiNextBtn`, `#sekaiAudio`, `window.__sekaiOpenPlayer`.
- Produces: desktop hover/focus-only play overlay, coarse-pointer persistent low-opacity overlay, `.is-playing` animated border state.

- [ ] **Step 1: Add failing music interaction/visual tests**

```js
test('v4 music overlay is hover/focus driven on desktop and playing state owns the color ring', () => {
  const music = readSource('src/components/MusicStatusWidget.astro');
  assert.match(music, /opacity:\s*0/);
  assert.match(music, /music-status-art:hover[\s\S]*music-status-play-overlay|music-status-art:focus-within/);
  assert.match(music, /@media\s*\(hover:\s*none\)|pointer:\s*coarse/);
  assert.match(music, /is-playing[\s\S]*conic-gradient/);
  assert.match(music, /animation-play-state:\s*paused|animation:\s*none/);
  assert.match(music, /prefers-reduced-motion/);
  assert.match(music, /id="sekaiPlayPauseBtn"/);
});
```

Run and confirm RED.

- [ ] **Step 2: Make desktop play overlay hidden at rest**

Base overlay:

```css
.music-status-play-overlay {
  opacity: 0;
  visibility: hidden;
  transform: translate(-50%, -50%) scale(.9);
  transition: opacity 180ms ease, transform 180ms ease, visibility 180ms ease;
}
.music-status-art:hover .music-status-play-overlay,
.music-status-art:focus-within .music-status-play-overlay {
  opacity: 1;
  visibility: visible;
  transform: translate(-50%, -50%) scale(1);
}
```

Do not remove the button from the DOM or tab order.

- [ ] **Step 3: Add coarse-pointer/mobile persistent low-opacity control**

```css
@media (hover: none), (pointer: coarse) {
  .music-status-play-overlay {
    opacity: .72;
    visibility: visible;
    transform: translate(-50%, -50%) scale(.94);
  }
}
```

The overlay button toggles playback; the surrounding cover-open button retains full-player behavior.

- [ ] **Step 4: Add restrained animated playing ring**

Avoid clipping the ring by moving `overflow:hidden` to an inner cover layer if necessary. Use an art pseudo-element or nested wrapper:

```css
.music-status-art::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  padding: 2px;
  background: conic-gradient(from var(--music-ring-angle), #f39ab5, #a899ee, #7fcddd, #efb1a3, #f39ab5);
  /* mask center out so only a thin ring remains */
  opacity: 0;
  pointer-events: none;
}
.music-status-widget.is-playing .music-status-art::before {
  opacity: .82;
  animation: music-ring-spin 8s linear infinite;
}
```

Implement rotation with a broadly supported transform on a pseudo-element/wrapper if custom-property angle animation would require `@property`; prefer the simpler transform solution.

When paused, `.is-playing` is removed by existing `sync()` so the animation stops automatically.

Reduced motion:
- keep ring visible while playing;
- disable rotation animation.

- [ ] **Step 5: Preserve current player proxy logic**

Do not alter these click paths:

```js
document.getElementById('sekaiPrevBtn')?.click();
document.getElementById('sekaiPlayPauseBtn')?.click();
document.getElementById('sekaiNextBtn')?.click();
window.__sekaiOpenPlayer?.();
```

Continue deriving `.is-playing` from `audio.src && !audio.paused`.

- [ ] **Step 6: Run music regressions**

```bash
node --test tests/firefly-v3.test.mjs tests/firefly-v4.test.mjs tests/sekai-player-search.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/MusicStatusWidget.astro tests/firefly-v4.test.mjs
git commit -m "feat: refine homepage music interactions"
```

---

### Task 9: Harmonize responsive/accessibility polish across v4 homepage surfaces

**Files:**
- Modify: `src/styles/firefly-v2.css`
- Modify: `src/styles/firefly-refresh.css`
- Modify: `src/components/HomeLeftSidebar.astro`
- Modify: `src/components/HomeRightSidebar.astro`
- Modify: `src/components/RecentMessagesWidget.astro`
- Modify: `src/components/RecentMomentsWidget.astro`
- Modify: `src/components/HomePostCard.astro`
- Modify: `src/components/MusicStatusWidget.astro`
- Modify: `src/components/VisualSettingsPanel.astro`
- Modify: `tests/firefly-v4.test.mjs`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: one consistent neutral card system and mobile behavior without new business logic.

- [ ] **Step 1: Add failing cross-component accessibility/responsive contracts**

```js
test('v4 social activity and article controls expose visible focus and reduced-motion-safe transitions', () => {
  const css = readSource('src/styles/firefly-v2.css') + readSource('src/styles/firefly-refresh.css');
  const left = readSource('src/components/HomeLeftSidebar.astro');
  const messages = readSource('src/components/RecentMessagesWidget.astro');
  assert.match(css, /profile-social-link:focus-visible/);
  assert.match(css, /recent-message-item:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(left, /aria-label="联系方式"/);
  assert.match(messages, /recent-message-item/);
});

test('v4 mobile surfaces do not depend on hover-only access', () => {
  const music = readSource('src/components/MusicStatusWidget.astro');
  const panel = readSource('src/components/VisualSettingsPanel.astro');
  assert.match(music, /hover:\s*none|pointer:\s*coarse/);
  assert.match(panel, /safe-area-inset-bottom/);
  assert.match(panel, /100dvh|8[2-8]dvh/);
});
```

Run and confirm any remaining RED assertions.

- [ ] **Step 2: Normalize shared surface variables/rules**

Ensure profile, side widgets, article cards, and settings groups consistently use:
- neutral background based on current standard card/page variables;
- one subtle border;
- restrained shadow;
- theme hue for interaction accents only;
- consistent medium-large radius family;
- continuous animation only where explicitly approved (waves, Sakura, playing ring).

Remove leftover saturated per-widget fills that conflict with v4's neutral activity-rail design.

- [ ] **Step 3: Verify keyboard and touch behavior**

Manual browser checklist at desktop width and 390px width:
- Tab reaches GitHub, QQ, Recent Messages, post links, music controls, settings controls;
- focus indicators visible;
- settings Escape returns focus to gear;
- wave segmented controls keyboard operable;
- mobile music play control visible without hover;
- no horizontal overflow at 390px;
- bottom sheet respects safe-area padding.

- [ ] **Step 4: Verify reduced motion behavior manually**

With OS reduced motion and then with site `reduceMotion=true`:
- waves stay static but visible;
- Sakura stops according to existing behavior;
- music playing ring remains static but visible;
- hover card transforms/continuous decorative animations are suppressed or minimized.

- [ ] **Step 5: Run all frontend tests**

```bash
npm test
```

Expected: Astro check/build succeeds and every registered Node test passes.

- [ ] **Step 6: Commit**

```bash
git add src/styles/firefly-v2.css src/styles/firefly-refresh.css src/components/HomeLeftSidebar.astro src/components/HomeRightSidebar.astro src/components/RecentMessagesWidget.astro src/components/RecentMomentsWidget.astro src/components/HomePostCard.astro src/components/MusicStatusWidget.astro src/components/VisualSettingsPanel.astro tests/firefly-v4.test.mjs
git commit -m "feat: polish v4 responsive visual system"
```

---

### Task 10: Final integration verification and merge-ready review

**Files:**
- Modify only if verification exposes a defect.
- Review: `docs/superpowers/specs/2026-08-24-firefly-home-visual-v4-design.md`
- Review: this plan.

**Interfaces:**
- Consumes: Tasks 1–9.
- Produces: merge-ready feature branch with fresh frontend and backend evidence.

- [ ] **Step 1: Run frontend full verification from repository root**

```bash
npm test
```

Expected:
- `astro check`: 0 errors;
- static build succeeds;
- all frontend Node tests including `firefly-v4`, `banner-waves`, visual-settings, post-cover and existing v3 regressions pass.

- [ ] **Step 2: Run backend full verification**

```bash
cd danmaku-api
npm test
npm run check
```

Expected: all Vitest tests pass and TypeScript check is clean.

- [ ] **Step 3: Inspect built homepage contracts**

After `npm test`, inspect `dist/index.html` or use existing `tests/site-build.test.mjs` assertions to verify:
- Recent Messages widget shell is emitted;
- GitHub and historical QQ links are emitted;
- article card classes are present;
- no broken source-relative Markdown cover URL is emitted;
- `/player` output does not contain a banner-wave mount in immersive content.

- [ ] **Step 4: Inspect branch diff for accidental scope creep**

```bash
git diff main...HEAD --stat
git diff main...HEAD -- src/lib/visual-settings.mjs src/components/VisualSettingsPanel.astro src/components/MusicStatusWidget.astro src/components/HomePostCard.astro danmaku-api/src/moments.ts danmaku-api/src/index.ts
```

Confirm:
- no second settings storage key;
- no second audio/player state;
- no copied Firefly assets/code;
- no unintended media-library reset;
- no `/player` layout regression.

- [ ] **Step 5: Review D1 deployment requirement before production merge**

Because `api.lidure22.xyz` is deployed from `danmaku-api/src/index.ts` and `wrangler.jsonc` points to `./migrations`, note explicitly in the PR/merge checklist that production must apply migration `0007_add_moment_pins.sql` before or together with deploying the Worker code that queries `pinned` columns.

Do not merge a Worker build that expects pin columns before the D1 migration is applied.

- [ ] **Step 6: Create/update merge-ready PR and request review**

PR summary must list:
- waves/settings redesign;
- pinned Moments + D1 migration;
- homepage messages/social/article/music changes;
- frontend test result;
- backend test/check result;
- migration ordering requirement.

- [ ] **Step 7: Commit any verification-only fixes separately**

If verification required code changes:

```bash
git add <only-fixed-files>
git commit -m "fix: resolve v4 verification issues"
```

If no fixes were needed, do not create an empty verification commit.
