# Firefly Visual & Background v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved Firefly-inspired v3 visual/background system: broader banner transition, banner/fullscreen wallpaper modes, compatible appearance/background/effects settings, automatic homepage article covers, large-cover music widget, and a performant real-petal sakura renderer without replacing the existing media library or SEKAI player.

**Architecture:** Keep `BaseLayout` page mode (`standard|immersive`) separate from standard-page wallpaper mode (`banner|fullscreen`). Add one pure visual-settings module around the existing `hero_settings` object and expose one browser bridge (`window.__lidureVisualSettings`) so old background controls and new appearance controls merge into the same stored object instead of overwriting each other. Move the visible settings DOM **and its scoped styles** out of the already-large `HeroSlideshow`, while keeping media-library/preview/slideshow business logic there; drive page appearance through `<html>` attributes and CSS variables. Replace the DOM/emoji sakura renderer with a worker-first canvas implementation; homepage article covers and music controls remain consumers of existing content/player state.

**Tech Stack:** Astro 6, TypeScript/ES modules, CSS, localStorage, CustomEvent, Canvas 2D, OffscreenCanvas/Web Worker with main-thread fallback, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-24-firefly-visual-background-v3-design.md`

## Global Constraints

- Keep `hero_settings` as the single persisted visual/background settings object.
- Preserve existing `enabled`, `autoplay`, `interval`, `opacity`, `quality`, and `sakura` values when new fields are absent.
- Every future write to `hero_settings` must merge with existing values; legacy background controls must not overwrite new v2 fields.
- Do not rewrite background media upload, URL add, preview, library, slideshow order, autoplay, or selected-media business logic.
- Do not replace the existing SEKAI audio/player/playlist state.
- `BaseLayout.layoutMode` remains only `standard|immersive`; wallpaper mode is `banner|fullscreen` inside standard pages.
- `/player` always remains immersive and ignores standard-page `banner|fullscreen` layout presentation.
- Banner target: desktop `62vh`, minimum `360px`, content overlap `56px`; tablet `54vh`, minimum `320px`, overlap `44px`; mobile `42vh`, minimum `260px`, overlap `28px`.
- Fullscreen default background blur is `6px`; banner mode ignores `backgroundBlur`.
- Homepage cover priority is explicit `cover` → first Markdown image → text-only.
- Homepage music widget must proxy `#sekaiPrevBtn`, `#sekaiPlayPauseBtn`, `#sekaiNextBtn`, and `window.__sekaiOpenPlayer()`.
- Sakura uses real petal artwork, worker/offscreen canvas when possible, and a main-thread Canvas 2D fallback.
- Final gate: `npm test` must pass; Astro check/build must report zero errors; built homepage/player contracts must be inspected before merge.

---

## File Structure

### New focused units

- `src/lib/visual-settings.mjs` — defaults, normalization, persistence, document attributes/CSS variables, settings event dispatch.
- `src/components/VisualSettingsPanel.astro` — visible `外观 / 背景 / 特效` panel **plus the moved settings-panel/button styles**; preserves legacy background-control IDs required by `HeroSlideshow`.
- `src/lib/post-cover.mjs` — pure Markdown first-image extraction and asset-key resolution.
- `src/lib/sakura-physics.mjs` — petal creation/update helpers shared by worker and fallback renderer.
- `src/workers/sakura.worker.ts` — OffscreenCanvas renderer/lifecycle.
- `src/components/SakuraEffect.astro` — browser feature detection, worker orchestration, main-thread fallback, settings/lifecycle handling.
- `public/sakura-petal.svg` — actual petal artwork used by both render paths.
- `tests/visual-settings.test.mjs` — compatibility/state tests.
- `tests/post-cover.test.mjs` — Markdown cover parser tests, including filenames with parentheses.
- `tests/sakura-effect.test.mjs` — renderer/settings source contracts and physics unit tests.

### Existing units modified

- `src/layouts/BaseLayout.astro` — early wallpaper bootstrap, browser settings bridge, `is-home` body class, mount `VisualSettingsPanel` before `HeroSlideshow`, replace `SekaiParticles` with `SakuraEffect`.
- `src/components/HeroSlideshow.astro` — remove visible settings shell/styles moved to `VisualSettingsPanel`; keep slideshow/media panel/preview/business script; change all `hero_settings` persistence to merge writes through the browser bridge.
- `src/components/HomePostCard.astro` — resolve cover using explicit frontmatter or first Markdown image.
- `src/components/MusicStatusWidget.astro` — large-cover approved composition while retaining existing proxy logic.
- `src/styles/firefly-refresh.css` — banner/fullscreen geometry, fade/overlap, responsive dimensions.
- `src/styles/firefly-v2.css` — card opacity/theme-hue/border/follow-theme behavior and wallpaper-aware card layers.
- `tests/firefly-ui-refresh.test.mjs` — source/build-level v3 regression contracts.
- `package.json` — include new unit tests in `test:site`.
- Delete after migration: `src/components/SekaiParticles.astro`.

---

### Task 1: Establish the `hero_settings` v2 compatibility layer and browser bridge

**Files:**
- Create: `src/lib/visual-settings.mjs`
- Create: `tests/visual-settings.test.mjs`
- Modify: `package.json`
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Produces: `VISUAL_SETTINGS_KEY`, `DEFAULT_VISUAL_SETTINGS`, `normalizeVisualSettings(raw)`, `readVisualSettings(storage)`, `applyVisualSettingsToDocument(settings, doc)`, `writeVisualSettings(patch, options)`.
- Browser bridge: `window.__lidureVisualSettings.read()` and `window.__lidureVisualSettings.write(patch)`.
- Emits: `lidure:visual-settings-change` with `detail: { settings, changedKeys }`.
- Later tasks consume the exact attributes `data-wallpaper-mode`, `data-banner-gradient`, `data-banner-title`, `data-card-border`, `data-card-follow-theme`, `data-reduce-motion` and CSS variables `--wallpaper-overlay`, `--wallpaper-blur`, `--card-opacity`, `--card-opacity-percent`, `--theme-hue`.

- [ ] **Step 1: Write failing unit tests for old-setting preservation and new defaults**

Create `tests/visual-settings.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_VISUAL_SETTINGS,
  normalizeVisualSettings,
} from '../src/lib/visual-settings.mjs';

test('normalization preserves old hero settings and fills v2 defaults', () => {
  const result = normalizeVisualSettings({
    enabled: false,
    autoplay: false,
    interval: 9000,
    opacity: 0.25,
    quality: 'original',
    sakura: true,
    customLegacyValue: 'keep-me',
  });

  assert.equal(result.enabled, false);
  assert.equal(result.autoplay, false);
  assert.equal(result.interval, 9000);
  assert.equal(result.opacity, 0.25);
  assert.equal(result.quality, 'original');
  assert.equal(result.sakura, true);
  assert.equal(result.wallpaperMode, 'banner');
  assert.equal(result.backgroundBlur, 6);
  assert.equal(result.cardOpacity, 0.92);
  assert.equal(result.themeHue, 340);
  assert.equal(result.customLegacyValue, 'keep-me');
});

test('invalid v2 values are clamped or replaced', () => {
  const result = normalizeVisualSettings({
    wallpaperMode: 'broken', opacity: 4, backgroundBlur: -8,
    cardOpacity: 0, sakuraDensity: 9, sakuraSpeed: -2,
  });
  assert.equal(result.wallpaperMode, 'banner');
  assert.equal(result.opacity, 1);
  assert.equal(result.backgroundBlur, 0);
  assert.equal(result.cardOpacity, 0.2);
  assert.equal(result.sakuraDensity, 1);
  assert.equal(result.sakuraSpeed, 0.25);
});

assert.equal(DEFAULT_VISUAL_SETTINGS.version, 2);
```

Update `package.json` so `test:site` includes `tests/visual-settings.test.mjs`.

- [ ] **Step 2: Run the new unit test and verify RED**

```bash
node --test tests/visual-settings.test.mjs
```

Expected: FAIL because `src/lib/visual-settings.mjs` does not exist.

- [ ] **Step 3: Implement the pure settings module**

Create `src/lib/visual-settings.mjs`:

```js
export const VISUAL_SETTINGS_KEY = 'hero_settings';
export const DEFAULT_VISUAL_SETTINGS = Object.freeze({
  version: 2,
  enabled: true,
  autoplay: true,
  interval: 15000,
  opacity: 0.45,
  quality: 'high',
  sakura: true,
  wallpaperMode: 'banner',
  backgroundBlur: 6,
  cardOpacity: 0.92,
  bannerGradient: true,
  bannerTitle: true,
  themeHue: 340,
  cardBorder: true,
  cardFollowTheme: false,
  sakuraDensity: 0.65,
  sakuraSpeed: 1,
  reduceMotion: false,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeVisualSettings(raw = {}) {
  const merged = { ...DEFAULT_VISUAL_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
  return {
    ...merged,
    version: 2,
    enabled: merged.enabled !== false,
    autoplay: merged.autoplay !== false,
    interval: clamp(finiteOr(merged.interval, 15000), 2000, 20000),
    opacity: clamp(finiteOr(merged.opacity, 0.45), 0, 1),
    quality: ['high', 'medium', 'original'].includes(merged.quality) ? merged.quality : 'high',
    sakura: merged.sakura === true,
    wallpaperMode: merged.wallpaperMode === 'fullscreen' ? 'fullscreen' : 'banner',
    backgroundBlur: clamp(finiteOr(merged.backgroundBlur, 6), 0, 20),
    cardOpacity: clamp(finiteOr(merged.cardOpacity, 0.92), 0.2, 1),
    bannerGradient: merged.bannerGradient !== false,
    bannerTitle: merged.bannerTitle !== false,
    themeHue: clamp(finiteOr(merged.themeHue, 340), 0, 360),
    cardBorder: merged.cardBorder !== false,
    cardFollowTheme: merged.cardFollowTheme === true,
    sakuraDensity: clamp(finiteOr(merged.sakuraDensity, 0.65), 0, 1),
    sakuraSpeed: clamp(finiteOr(merged.sakuraSpeed, 1), 0.25, 2),
    reduceMotion: merged.reduceMotion === true,
  };
}

export function readVisualSettings(storage) {
  try {
    return normalizeVisualSettings(JSON.parse(storage?.getItem(VISUAL_SETTINGS_KEY) || '{}'));
  } catch {
    return normalizeVisualSettings({});
  }
}

export function applyVisualSettingsToDocument(settings, doc) {
  const root = doc.documentElement;
  root.dataset.wallpaperMode = settings.wallpaperMode;
  root.dataset.bannerGradient = String(settings.bannerGradient);
  root.dataset.bannerTitle = String(settings.bannerTitle);
  root.dataset.cardBorder = String(settings.cardBorder);
  root.dataset.cardFollowTheme = String(settings.cardFollowTheme);
  root.dataset.reduceMotion = String(settings.reduceMotion);
  root.classList.toggle('no-hero-bg', !settings.enabled);
  root.style.setProperty('--wallpaper-overlay', String(settings.opacity));
  root.style.setProperty('--wallpaper-blur', `${settings.backgroundBlur}px`);
  root.style.setProperty('--card-opacity', String(settings.cardOpacity));
  root.style.setProperty('--card-opacity-percent', `${Math.round(settings.cardOpacity * 100)}%`);
  root.style.setProperty('--theme-hue', String(settings.themeHue));
}

export function writeVisualSettings(patch, { storage, doc, target } = {}) {
  const current = readVisualSettings(storage);
  const settings = normalizeVisualSettings({ ...current, ...patch });
  storage?.setItem(VISUAL_SETTINGS_KEY, JSON.stringify(settings));
  if (doc) applyVisualSettingsToDocument(settings, doc);
  target?.dispatchEvent(new CustomEvent('lidure:visual-settings-change', {
    detail: { settings, changedKeys: Object.keys(patch) },
  }));
  return settings;
}
```

The spread of `current` before `patch` is the compatibility guarantee: unknown legacy/media-adjacent values survive writes.

- [ ] **Step 4: Add early first-paint bootstrap in `BaseLayout.astro`**

Replace the current `enabled`-only bootstrap with:

```js
(function() {
  try {
    var raw = JSON.parse(localStorage.getItem('hero_settings') || '{}');
    var root = document.documentElement;
    var mode = raw.wallpaperMode === 'fullscreen' ? 'fullscreen' : 'banner';
    var opacity = Number.isFinite(Number(raw.opacity)) ? Math.max(0, Math.min(1, Number(raw.opacity))) : 0.45;
    var blur = Number.isFinite(Number(raw.backgroundBlur)) ? Math.max(0, Math.min(20, Number(raw.backgroundBlur))) : 6;
    var cardOpacity = Number.isFinite(Number(raw.cardOpacity)) ? Math.max(0.2, Math.min(1, Number(raw.cardOpacity))) : 0.92;
    var hue = Number.isFinite(Number(raw.themeHue)) ? Math.max(0, Math.min(360, Number(raw.themeHue))) : 340;
    root.dataset.wallpaperMode = mode;
    root.dataset.bannerGradient = String(raw.bannerGradient !== false);
    root.dataset.bannerTitle = String(raw.bannerTitle !== false);
    root.dataset.cardBorder = String(raw.cardBorder !== false);
    root.dataset.cardFollowTheme = String(raw.cardFollowTheme === true);
    root.dataset.reduceMotion = String(raw.reduceMotion === true);
    root.classList.toggle('no-hero-bg', raw.enabled === false);
    root.style.setProperty('--wallpaper-overlay', String(opacity));
    root.style.setProperty('--wallpaper-blur', blur + 'px');
    root.style.setProperty('--card-opacity', String(cardOpacity));
    root.style.setProperty('--card-opacity-percent', Math.round(cardOpacity * 100) + '%');
    root.style.setProperty('--theme-hue', String(hue));
  } catch (_) {}
})();
```

- [ ] **Step 5: Install one Astro-navigation-safe browser bridge**

Add a normal bundled script in `BaseLayout`:

```js
import {
  applyVisualSettingsToDocument,
  readVisualSettings,
  writeVisualSettings,
} from '../lib/visual-settings.mjs';

function installVisualSettingsBridge() {
  window.__lidureVisualSettings = {
    read() {
      return readVisualSettings(window.localStorage);
    },
    write(patch) {
      return writeVisualSettings(patch, {
        storage: window.localStorage,
        doc: document,
        target: document,
      });
    },
  };
  applyVisualSettingsToDocument(window.__lidureVisualSettings.read(), document);
}

if (!window.__lidureVisualSettingsLifecycleBound) {
  window.__lidureVisualSettingsLifecycleBound = true;
  document.addEventListener('astro:page-load', installVisualSettingsBridge);
}
installVisualSettingsBridge();
```

- [ ] **Step 6: Run unit + existing shell tests and verify GREEN**

```bash
node --test tests/visual-settings.test.mjs tests/firefly-ui-refresh.test.mjs
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/visual-settings.mjs src/layouts/BaseLayout.astro tests/visual-settings.test.mjs package.json
git commit -m "feat: add compatible visual settings state"
```

---

### Task 2: Extract visible settings DOM/styles and make legacy writes merge-safe

**Files:**
- Create: `src/components/VisualSettingsPanel.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/HeroSlideshow.astro`
- Modify: `tests/firefly-ui-refresh.test.mjs`

**Interfaces:**
- Preserves legacy IDs used by existing background business logic: `hero-settings-btn`, `settings-close`, `toggle-enabled`, `toggle-autoplay`, `toggle-sakura`, `interval-range`, `interval-val`, `opacity-range`, `opacity-val`, `quality-select`, `file-input`, `url-input`, `url-add-btn`, `media-manage-btn`, `media-count`.
- Adds v3 controls: `visual-tab-appearance`, `visual-tab-background`, `visual-tab-effects`, `wallpaper-mode-banner`, `wallpaper-mode-fullscreen`, `background-blur-range`, `card-opacity-range`, `theme-hue-range`, `toggle-card-border`, `toggle-card-follow-theme`, `toggle-banner-gradient`, `toggle-banner-title`, `sakura-density-range`, `sakura-speed-range`, `toggle-reduce-motion`.
- `HeroSlideshow` retains `media-panel`, `media-preview`, slideshow canvas/video/layer and all media-management behavior.

- [ ] **Step 1: Add failing source-contract tests**

Append:

```js
test('visual settings panel owns visible settings DOM and scoped styles', () => {
  const panel = readSource('src/components/VisualSettingsPanel.astro');
  const hero = readSource('src/components/HeroSlideshow.astro');
  const layout = readSource('src/layouts/BaseLayout.astro');

  assert.match(panel, /id="visual-tab-appearance"/);
  assert.match(panel, /id="visual-tab-background"/);
  assert.match(panel, /id="visual-tab-effects"/);
  assert.match(panel, /id="hero-settings-btn"/);
  assert.match(panel, /id="toggle-enabled"/);
  assert.match(panel, /id="media-manage-btn"/);
  assert.match(panel, /id="wallpaper-mode-banner"/);
  assert.match(panel, /\.hero-settings-panel/);
  assert.match(panel, /\.hero-settings-btn/);
  assert.doesNotMatch(hero, /id="hero-settings-btn"/);
  assert.match(hero, /id="media-panel"/);
  assert.match(layout, /<VisualSettingsPanel\s*\/>[\s\S]*?<HeroSlideshow\s*\/>/);
});

test('legacy HeroSlideshow settings persist through merge-safe visual settings bridge', () => {
  const hero = readSource('src/components/HeroSlideshow.astro');
  assert.match(hero, /__lidureVisualSettings/);
  assert.doesNotMatch(hero, /localStorage\.setItem\(\s*['"]hero_settings['"]/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/firefly-ui-refresh.test.mjs
```

Expected: FAIL because the panel/styles are still inside `HeroSlideshow` and old persistence still writes directly.

- [ ] **Step 3: Move the settings button, settings panel, controls, and their styles together**

Create `VisualSettingsPanel.astro`. Move, rather than duplicate, the existing visible settings markup **and every CSS rule that styles `.hero-settings-btn`, `.hero-settings-panel`, `.settings-*`, `.toggle-*`, range/select/upload/url controls** from `HeroSlideshow`. Leave `.media-panel`, `.media-preview`, slideshow, video/canvas and their styles in `HeroSlideshow`.

Render in this order so the old Hero script can query the preserved IDs when it initializes:

```astro
<VisualSettingsPanel />
<HeroSlideshow />
```

Use this visible structure:

```astro
<button id="hero-settings-btn" class="hero-settings-btn" type="button" aria-label="背景与外观" title="背景与外观">…</button>
<div class="hero-settings-panel" id="hero-settings-panel" transition:persist>
  <div class="settings-header">
    <span class="settings-title">背景与外观</span>
    <button id="settings-close" type="button" aria-label="关闭">×</button>
  </div>
  <div class="visual-tabs" role="tablist" aria-label="背景与外观设置">
    <button id="visual-tab-appearance" role="tab" aria-selected="true">外观</button>
    <button id="visual-tab-background" role="tab" aria-selected="false">背景</button>
    <button id="visual-tab-effects" role="tab" aria-selected="false">特效</button>
  </div>
  <div class="settings-body">
    <section data-visual-panel="appearance">…v3 appearance controls…</section>
    <section data-visual-panel="background" hidden>…legacy background controls + wallpaper-mode controls…</section>
    <section data-visual-panel="effects" hidden>…toggle-sakura + v3 effect controls…</section>
  </div>
</div>
```

- [ ] **Step 4: Replace every `hero_settings` overwrite in `HeroSlideshow` with patch writes**

For each legacy control handler, keep the existing media/display side effect but replace persistence with the browser bridge. Examples:

```js
window.__lidureVisualSettings?.write({ enabled: toggleEnabled.checked });
window.__lidureVisualSettings?.write({ autoplay: toggleAutoplay.checked });
window.__lidureVisualSettings?.write({ interval: Number(intervalRange.value) * 1000 });
window.__lidureVisualSettings?.write({ opacity: Number(opacityRange.value) / 100 });
window.__lidureVisualSettings?.write({ quality: qualitySelect.value });
window.__lidureVisualSettings?.write({ sakura: toggleSakura.checked });
```

Delete direct `localStorage.setItem('hero_settings', ...)` writes from this component. Media-library persistence keys other than `hero_settings` are untouched.

- [ ] **Step 5: Bind only new v3 controls in `VisualSettingsPanel`**

Use the bridge:

```js
function update(patch) {
  return window.__lidureVisualSettings?.write(patch);
}

wallpaperBanner.addEventListener('click', () => update({ wallpaperMode: 'banner' }));
wallpaperFullscreen.addEventListener('click', () => update({ wallpaperMode: 'fullscreen' }));
blurRange.addEventListener('input', () => update({ backgroundBlur: Number(blurRange.value) }));
cardOpacityRange.addEventListener('input', () => update({ cardOpacity: Number(cardOpacityRange.value) / 100 }));
hueRange.addEventListener('input', () => update({ themeHue: Number(hueRange.value) }));
cardBorder.addEventListener('change', () => update({ cardBorder: cardBorder.checked }));
cardFollowTheme.addEventListener('change', () => update({ cardFollowTheme: cardFollowTheme.checked }));
bannerGradient.addEventListener('change', () => update({ bannerGradient: bannerGradient.checked }));
bannerTitle.addEventListener('change', () => update({ bannerTitle: bannerTitle.checked }));
sakuraDensity.addEventListener('input', () => update({ sakuraDensity: Number(sakuraDensity.value) / 100 }));
sakuraSpeed.addEventListener('input', () => update({ sakuraSpeed: Number(sakuraSpeed.value) / 100 }));
reduceMotion.addEventListener('change', () => update({ reduceMotion: reduceMotion.checked }));
```

The panel reads initial values from `window.__lidureVisualSettings.read()` on `astro:page-load`.

- [ ] **Step 6: Make tab lifecycle Astro-navigation safe**

Store the global keyboard/tab handler on `window.__visualSettingsPanelHandler`; remove the previous listener before adding a replacement. Tabs update `aria-selected`, `tabindex`, `[hidden]`, and support `ArrowLeft/ArrowRight`.

- [ ] **Step 7: Run contracts**

```bash
node --test tests/firefly-ui-refresh.test.mjs tests/visual-settings.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/components/VisualSettingsPanel.astro src/layouts/BaseLayout.astro src/components/HeroSlideshow.astro tests/firefly-ui-refresh.test.mjs
git commit -m "feat: add integrated visual settings panel"
```

---

### Task 3: Implement banner and fullscreen wallpaper presentation

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/BlogBanner.astro`
- Modify: `src/styles/firefly-refresh.css`
- Modify: `src/styles/firefly-v2.css`
- Modify: `tests/firefly-ui-refresh.test.mjs`

**Interfaces:**
- Consumes Task 1 attributes/variables.
- Produces body class `is-home` only when normalized pathname is `/`.

- [ ] **Step 1: Add failing geometry/mode contracts**

```js
test('v3 wallpaper modes define approved banner geometry and fullscreen home behavior', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  const css = readSource('src/styles/firefly-refresh.css');
  assert.match(layout, /isHome/);
  assert.match(layout, /is-home/);
  assert.match(css, /--blog-banner-height:\s*62vh/);
  assert.match(css, /min-height:\s*360px/);
  assert.match(css, /--blog-banner-overlap:\s*56px/);
  assert.match(css, /data-wallpaper-mode="fullscreen"/);
  assert.match(css, /body\.layout-standard\.is-home[\s\S]*?100vh/);
  assert.match(css, /--wallpaper-blur/);
  assert.match(css, /--card-opacity-percent/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/firefly-ui-refresh.test.mjs
```

Expected: FAIL on `62vh`, `56px`, and fullscreen selectors.

- [ ] **Step 3: Add the home marker in `BaseLayout`**

```astro
const isHome = normalizedPath === '' || normalizedPath === '/';
...
<body class:list={[`layout-${layoutMode}`, { 'is-home': isHome }]}>
```

Do not change the `standard|immersive` decision.

- [ ] **Step 4: Implement banner-mode geometry and fade**

```css
body.layout-standard {
  --blog-banner-height: 62vh;
  --blog-banner-overlap: 56px;
}
body.layout-standard .hero-slideshow {
  position: absolute;
  inset: 0 0 auto;
  width: 100%;
  height: var(--blog-banner-height);
  min-height: 360px;
}
html[data-wallpaper-mode="banner"] body.layout-standard .blog-banner {
  height: var(--blog-banner-height);
  min-height: 360px;
}
html[data-wallpaper-mode="banner"] body.layout-standard .standard-page-surface {
  margin-top: calc(-1 * var(--blog-banner-overlap));
}
html[data-wallpaper-mode="banner"][data-banner-gradient="true"] body.layout-standard .blog-banner::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 110px;
  pointer-events: none;
  background: linear-gradient(to bottom, transparent, color-mix(in srgb, var(--standard-page-bg) 90%, transparent));
}
```

Responsive values:

```css
@media (max-width: 1199px) and (min-width: 721px) {
  body.layout-standard { --blog-banner-height: 54vh; --blog-banner-overlap: 44px; }
  body.layout-standard .hero-slideshow,
  html[data-wallpaper-mode="banner"] body.layout-standard .blog-banner { min-height: 320px; }
}
@media (max-width: 720px) {
  body.layout-standard { --blog-banner-height: 42vh; --blog-banner-overlap: 28px; }
  body.layout-standard .hero-slideshow,
  html[data-wallpaper-mode="banner"] body.layout-standard .blog-banner { min-height: 260px; }
}
```

- [ ] **Step 5: Implement fullscreen standard-page presentation**

```css
html[data-wallpaper-mode="fullscreen"] body.layout-standard .hero-slideshow {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100vh;
  min-height: 100vh;
  filter: blur(var(--wallpaper-blur, 6px));
  transform: scale(1.02);
}
html[data-wallpaper-mode="fullscreen"] body.layout-standard.is-home .blog-banner {
  height: 100vh;
  min-height: 100vh;
}
html[data-wallpaper-mode="fullscreen"] body.layout-standard.is-home .standard-page-surface { margin-top: 0; }
html[data-wallpaper-mode="fullscreen"] body.layout-standard:not(.is-home) .blog-banner { display: none; }
html[data-wallpaper-mode="fullscreen"] body.layout-standard:not(.is-home) .standard-page-surface {
  margin-top: 64px;
  min-height: calc(100vh - 64px);
}
```

For fullscreen cards/sidebar widgets use:

```css
background: color-mix(in srgb, var(--standard-card-bg) var(--card-opacity-percent, 92%), transparent);
backdrop-filter: blur(14px);
-webkit-backdrop-filter: blur(14px);
```

Do not apply glass to every decorative child.

- [ ] **Step 6: Honor banner-title/card appearance settings**

```css
html[data-banner-title="false"] body.layout-standard .blog-banner-copy { visibility: hidden; }
html[data-card-border="false"] body.layout-standard .home-post-card,
html[data-card-border="false"] body.layout-standard .sidebar-widget,
html[data-card-border="false"] body.layout-standard .card { border-color: transparent; }
html[data-card-follow-theme="true"] body.layout-standard .sidebar-widget,
html[data-card-follow-theme="true"] body.layout-standard .home-post-card {
  box-shadow: inset 0 0 0 1px hsl(var(--theme-hue, 340) 70% 65% / 0.08);
}
```

- [ ] **Step 7: Run contracts and build**

```bash
node --test tests/firefly-ui-refresh.test.mjs
npm run build
```

Expected: all pass; Astro check/build exits `0`.

- [ ] **Step 8: Commit**

```bash
git add src/layouts/BaseLayout.astro src/components/BlogBanner.astro src/styles/firefly-refresh.css src/styles/firefly-v2.css tests/firefly-ui-refresh.test.mjs
git commit -m "feat: add banner and fullscreen wallpaper modes"
```

---

### Task 4: Resolve homepage article covers from frontmatter or Markdown

**Files:**
- Create: `src/lib/post-cover.mjs`
- Create: `tests/post-cover.test.mjs`
- Modify: `src/components/HomePostCard.astro`
- Modify: `src/styles/firefly-refresh.css`
- Modify: `package.json`

**Interfaces:**
- Produces: `extractFirstMarkdownImage(body) -> string|null`, `resolvePostCover({ cover, body, postId, assets }) -> string|null`.
- `assets` keys match `../content/blog/<path>` and values are browser URLs from `import.meta.glob`.

- [ ] **Step 1: Write failing parser tests, including nested parentheses**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { extractFirstMarkdownImage, resolvePostCover } from '../src/lib/post-cover.mjs';

test('extracts first Markdown image when filename contains parentheses', () => {
  const body = 'text\n![alt](131770967_p0_master1200(1)(1).png)\n![later](image.png)';
  assert.equal(extractFirstMarkdownImage(body), '131770967_p0_master1200(1)(1).png');
});

test('explicit cover wins over Markdown image', () => {
  assert.equal(resolvePostCover({ cover: '/cover.jpg', body: '![x](image.png)', postId: 'hello-world.md', assets: {} }), '/cover.jpg');
});

test('relative Markdown image resolves through build asset map', () => {
  assert.equal(resolvePostCover({
    body: '![x](image.png)',
    postId: '视觉光流.md',
    assets: { '../content/blog/image.png': '/_astro/image.hash.png' },
  }), '/_astro/image.hash.png');
});
```

Add `tests/post-cover.test.mjs` to `test:site`.

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/post-cover.test.mjs
```

Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement a balanced-parenthesis Markdown destination parser**

Do not use a naive lazy regex because the repository already contains `131770967_p0_master1200(1)(1).png`. `extractFirstMarkdownImage` must locate `![`, find the matching `](`, then scan the destination character-by-character, incrementing depth on nested `(` and decrementing on `)`. At depth `0`, whitespace begins an optional Markdown title and the outer `)` ends the destination. Strip `<...>` wrappers.

`resolvePostCover`:

```js
export function resolvePostCover({ cover, body, postId, assets }) {
  if (cover) return cover;
  const ref = extractFirstMarkdownImage(body);
  if (!ref) return null;
  if (/^(?:https?:|data:|blob:)/i.test(ref) || ref.startsWith('/')) return ref;
  const normalizedId = String(postId || '').replace(/\\/g, '/');
  const baseDir = normalizedId.includes('/') ? normalizedId.slice(0, normalizedId.lastIndexOf('/') + 1) : '';
  const absolute = new URL(ref, `https://content.local/${baseDir}`).pathname.slice(1);
  const key = `../content/blog/${decodeURIComponent(absolute)}`;
  return assets[key] || null;
}
```

- [ ] **Step 4: Use a Vite asset map in `HomePostCard.astro`**

```js
import { resolvePostCover } from '../lib/post-cover.mjs';
const blogAssets = import.meta.glob('../content/blog/**/*.{png,jpg,jpeg,webp,gif,avif}', {
  eager: true,
  query: '?url',
  import: 'default',
});
const coverSrc = resolvePostCover({ cover: post.data.cover, body: post.body ?? '', postId: post.id, assets: blogAssets });
```

Render `coverSrc`; set `has-cover` from `!!coverSrc`.

- [ ] **Step 5: Apply approved proportions**

```css
body.layout-standard .home-post-cover {
  flex: 0 0 35%;
  min-width: 230px;
  margin: 10px 10px 10px 0;
  border-radius: 14px;
  aspect-ratio: 16 / 9;
}
```

On `max-width:620px`, image is above copy, `width:100%`, `min-width:0`, `height:auto`, `aspect-ratio:16/9`.

- [ ] **Step 6: Run parser, shell tests, and build**

```bash
node --test tests/post-cover.test.mjs tests/firefly-ui-refresh.test.mjs
npm run build
```

Expected: all pass; built homepage includes images for posts with resolvable first images.

- [ ] **Step 7: Commit**

```bash
git add src/lib/post-cover.mjs src/components/HomePostCard.astro src/styles/firefly-refresh.css tests/post-cover.test.mjs package.json
git commit -m "feat: show article images on homepage"
```

---

### Task 5: Redesign homepage music widget to the approved large-cover composition

**Files:**
- Modify: `src/components/MusicStatusWidget.astro`
- Modify: `tests/firefly-ui-refresh.test.mjs`

**Interfaces:**
- Consumes unchanged: `sekaiAudio`, `sekaiTrackTitle`, `sekaiDockCover|sekaiCover`, `sekaiPrevBtn`, `sekaiPlayPauseBtn`, `sekaiNextBtn`, `window.__sekaiOpenPlayer()`.
- Keeps homepage IDs: `home-music-open`, `home-music-prev`, `home-music-play-pause`, `home-music-next`.

- [ ] **Step 1: Add failing composition contract**

```js
test('home music widget uses large cover with central play and separate prev next controls', () => {
  const music = readSource('src/components/MusicStatusWidget.astro');
  assert.match(music, /music-status-cover-shell/);
  assert.match(music, /music-status-cover-open/);
  assert.match(music, /music-status-play-overlay/);
  assert.match(music, /data-music-title/);
  assert.match(music, /id="home-music-prev"/);
  assert.match(music, /id="home-music-next"/);
  assert.doesNotMatch(music, /data-music-artist/);
  assert.doesNotMatch(music, /data-music-state/);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/firefly-ui-refresh.test.mjs
```

Expected: FAIL because current widget is compact/info-heavy.

- [ ] **Step 3: Replace markup without nested buttons**

```astro
<div class="music-status-widget" id="home-music-status">
  <div class="music-status-cover-shell">
    <button id="home-music-open" class="music-status-cover-open" type="button" aria-label="打开 SEKAI 播放器">
      <img data-music-cover alt="" />
      <span data-music-fallback aria-hidden="true">♪</span>
    </button>
    <button id="home-music-play-pause" class="music-status-play-overlay" type="button" aria-label="播放" title="播放">▶</button>
  </div>
  <strong class="music-status-track-title" data-music-title>SEKAI Player</strong>
  <div class="music-status-controls">
    <button id="home-music-prev" type="button" aria-label="上一首">‹</button>
    <button id="home-music-next" type="button" aria-label="下一首">›</button>
  </div>
</div>
```

Keep cover/title/play-state observation. Center button proxies `sekaiPlayPauseBtn`; cover/title calls `window.__sekaiOpenPlayer?.()`.

- [ ] **Step 4: Apply screenshot-like styling**

```css
.music-status-cover-shell { position: relative; width: min(100%, 238px); margin: 0 auto; aspect-ratio: 1; }
.music-status-cover-open { width: 100%; height: 100%; padding: 0; overflow: hidden; border-radius: 22px; }
.music-status-cover-open img { width: 100%; height: 100%; object-fit: cover; }
.music-status-play-overlay { position: absolute; left: 50%; top: 50%; translate: -50% -50%; width: 58px; height: 58px; border-radius: 50%; }
.music-status-controls { display: flex; justify-content: space-around; align-items: center; padding: 4px 20px 2px; }
.music-status-controls button { width: 42px; height: 42px; border-radius: 50%; }
.music-status-track-title { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center; }
```

Use restrained translucency; no heavy glow.

- [ ] **Step 5: Run music regressions**

```bash
node --test tests/firefly-ui-refresh.test.mjs
```

Expected: existing player-open/control contracts and new composition contract pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/MusicStatusWidget.astro tests/firefly-ui-refresh.test.mjs
git commit -m "feat: redesign homepage music widget"
```

---

### Task 6: Replace emoji sakura with worker-first real-petal canvas rendering

**Files:**
- Create: `public/sakura-petal.svg`
- Create: `src/lib/sakura-physics.mjs`
- Create: `src/workers/sakura.worker.ts`
- Create: `src/components/SakuraEffect.astro`
- Create: `tests/sakura-effect.test.mjs`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `package.json`
- Delete after GREEN: `src/components/SekaiParticles.astro`

**Interfaces:**
- Physics: `createPetal(width, height, speedScale, random=Math.random)`, `stepPetal(petal, width, height, dt, speedScale)`.
- Worker messages: `init`, `settings`, `resize`, `pause`, `resume`, `destroy` with the exact payloads from the spec/plan below.
- `SakuraEffect` consumes `lidure:visual-settings-change` and legacy `lidure:sakura-setting`.

- [ ] **Step 1: Write failing physics/source contracts**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createPetal, stepPetal } from '../src/lib/sakura-physics.mjs';
import { readFileSync } from 'node:fs';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('petal physics produces finite movable petals', () => {
  const fixedRandom = () => 0.5;
  const petal = createPetal(1200, 800, 1, fixedRandom);
  const next = stepPetal(petal, 1200, 800, 1 / 60, 1);
  assert.ok(Number.isFinite(next.x));
  assert.ok(Number.isFinite(next.y));
  assert.notEqual(next.y, petal.y);
});

test('sakura effect is worker-first with fallback and no emoji renderer', () => {
  const component = read('src/components/SakuraEffect.astro');
  const worker = read('src/workers/sakura.worker.ts');
  assert.match(component, /transferControlToOffscreen/);
  assert.match(component, /new Worker/);
  assert.match(component, /getContext\(['"]2d['"]\)/);
  assert.match(component, /lidure:visual-settings-change/);
  assert.match(component, /prefers-reduced-motion/);
  assert.match(worker, /['"]pause['"]/);
  assert.match(worker, /['"]resume['"]/);
  assert.doesNotMatch(component, /🌸|🌷|🌹|🌺|❀/);
});
```

Add `tests/sakura-effect.test.mjs` to `test:site`.

- [ ] **Step 2: Run and verify RED**

```bash
node --test tests/sakura-effect.test.mjs
```

Expected: FAIL because new modules do not exist.

- [ ] **Step 3: Add real petal artwork**

Create `public/sakura-petal.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><linearGradient id="p" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ffd7e6"/><stop offset="1" stop-color="#f08fb3"/></linearGradient></defs>
  <path d="M31.8 57C18 47 9 35 11 23 13 12 24 7 32 18 40 7 51 12 53 23 55 35 46 47 31.8 57Z" fill="url(#p)"/>
  <path d="M32 18c-2 11-1 23 0 39" fill="none" stroke="#e879a5" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>
</svg>
```

- [ ] **Step 4: Implement shared physics**

Petal fields: `x,y,size,rotation,rotationSpeed,vy,vx,phase,phaseSpeed,opacity`. `stepPetal` returns a new object. Density mapping:

```js
const desktopCount = Math.round(20 + settings.sakuraDensity * 16);
const mobileCount = Math.round(10 + settings.sakuraDensity * 8);
```

Reduced-motion continuous count is `0`.

- [ ] **Step 5: Implement worker renderer**

Worker message shapes:

```ts
type SakuraMessage =
  | { type: 'init'; canvas: OffscreenCanvas; width: number; height: number; dpr: number; settings: SakuraSettings }
  | { type: 'settings'; settings: SakuraSettings }
  | { type: 'resize'; width: number; height: number; dpr: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'destroy' };
```

Fetch `/sakura-petal.svg`, convert via `createImageBitmap`, draw with translate/rotate/globalAlpha. Animation scheduling uses worker `requestAnimationFrame` when available and a `setTimeout(..., 16)` fallback otherwise. `pause/destroy` cancel whichever scheduler is active.

- [ ] **Step 6: Implement `SakuraEffect.astro` orchestration and main-thread fallback**

```astro
<canvas id="sakura-canvas" aria-hidden="true"></canvas>
```

Feature detection:

```js
const canUseWorker = 'Worker' in window && 'OffscreenCanvas' in window && 'transferControlToOffscreen' in HTMLCanvasElement.prototype;
```

Worker path transfers once. Fallback path loads `new Image()` from `/sakura-petal.svg`, uses the shared physics helpers and Canvas 2D. Both paths listen to settings, `visibilitychange`, resize, and `astro:before-swap`. System reduced-motion OR stored `reduceMotion` stops continuous petals. Canvas is fixed, pointer-events none, and below interactive overlays.

If worker petal image initialization fails, terminate the worker and start the main-thread fallback; do not leave a blank-but-running worker.

- [ ] **Step 7: Swap component and delete old renderer**

Replace `SekaiParticles` import/render with `SakuraEffect`, then `git rm src/components/SekaiParticles.astro` after tests are GREEN.

- [ ] **Step 8: Run tests and build**

```bash
node --test tests/sakura-effect.test.mjs tests/visual-settings.test.mjs tests/firefly-ui-refresh.test.mjs
npm run build
```

Expected: all pass; Astro build exits `0`.

- [ ] **Step 9: Commit**

```bash
git add public/sakura-petal.svg src/lib/sakura-physics.mjs src/workers/sakura.worker.ts src/components/SakuraEffect.astro src/layouts/BaseLayout.astro tests/sakura-effect.test.mjs package.json
git rm src/components/SekaiParticles.astro
git commit -m "feat: upgrade sakura effect renderer"
```

---

### Task 7: Finish responsive, accessibility, and integrated regression contracts

**Files:**
- Modify: `src/components/VisualSettingsPanel.astro`
- Modify: `src/styles/firefly-refresh.css`
- Modify: `src/styles/firefly-v2.css`
- Modify: `tests/firefly-ui-refresh.test.mjs`
- Modify: `tests/site-build.test.mjs`

**Interfaces:** consumes all previous task interfaces and adds no business state.

- [ ] **Step 1: Add failing built-page contracts**

```js
test('built homepage exposes visual settings and wallpaper-aware shell', () => {
  const html = readBuilt('index.html');
  assert.match(html, /id="hero-settings-btn"/);
  assert.match(html, /id="visual-tab-background"/);
  assert.match(html, /id="wallpaper-mode-fullscreen"/);
  assert.match(html, /id="home-music-play-pause"/);
});

test('immersive player remains independent of standard wallpaper presentation', () => {
  const html = readBuilt('player/index.html');
  assert.match(html, /layout-immersive/);
  assert.doesNotMatch(html, /class="blog-banner"/);
  assert.doesNotMatch(html, /class="standard-page-surface"/);
  assert.match(html, /id="hero-settings-btn"/);
});
```

- [ ] **Step 2: Run build/contracts and verify any missing integration fails specifically**

```bash
npm run build && node --test tests/firefly-ui-refresh.test.mjs tests/site-build.test.mjs
```

- [ ] **Step 3: Finish responsive panel/fullscreen card rules**

Implement exactly:

- panel desktop width `clamp(420px, 34vw, 480px)`;
- mobile max width `calc(100vw - 20px)` with bottom/center sheet behavior;
- segmented wallpaper buttons at least `44px` high;
- visible range-value labels;
- no horizontal overflow below `850px`;
- fullscreen cards maintain readable contrast at `cardOpacity=0.2` using backdrop blur plus minimal border/shadow;
- floating controls remain below media preview/modal layers.

- [ ] **Step 4: Finish keyboard/focus/motion behavior**

Settings tabs use `role=tablist/tab/tabpanel`, `aria-controls`, `aria-selected`, and visible `:focus-visible`. Mode buttons/music controls/close/media buttons get visible focus. Reduced motion disables decorative hover movement and continuous sakura only; background video is not automatically disabled.

- [ ] **Step 5: Run complete verification**

```bash
npm test
```

Expected: `astro check` reports `0 errors`, build succeeds, all Node tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/VisualSettingsPanel.astro src/styles/firefly-refresh.css src/styles/firefly-v2.css tests/firefly-ui-refresh.test.mjs tests/site-build.test.mjs
git commit -m "test: lock Firefly v3 visual regressions"
```

---

### Task 8: Final branch verification, CI fallback, and cleanup

**Files:**
- Temporary only if local verification is unavailable: `.github/workflows/verify-firefly-v3.yml`, `.ci/firefly-v3-result.txt`
- No permanent production-file changes unless verification finds a defect.

**Interfaces:** produces final merge evidence only.

- [ ] **Step 1: Re-run full suite from final source tree**

```bash
npm ci
npm test
```

Expected: exit `0`; Astro check `0 errors`; all tests pass.

- [ ] **Step 2: Inspect built contracts explicitly**

`dist/index.html` must contain `hero-settings-btn`, `visual-tab-background`, `wallpaper-mode-fullscreen`, `home-music-play-pause`, and image markup for posts whose cover resolves.

`dist/player/index.html` must contain `layout-immersive`, `site-header`, `sekaiPlayerBtn`, `hero-settings-btn`, and must not contain `blog-banner` or `standard-page-surface`.

- [ ] **Step 3: If local execution is unavailable, use one clean temporary GitHub Actions verifier**

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with:
    node-version: 22
    cache: npm
- run: npm ci
- run: npm test
```

Record the result on the feature branch, inspect it, then delete the workflow/result before final diff review. Never merge temporary CI artifacts.

- [ ] **Step 4: Review final diff**

```bash
git diff --stat main...HEAD
git diff --check main...HEAD
```

Verify no temporary `.ci` files/workflows, no duplicate `hero-settings-btn`, no import of `SekaiParticles`, no direct `localStorage.setItem('hero_settings', ...)` in `HeroSlideshow`, and no unrelated content/media changes.

- [ ] **Step 5: Final cleanup commit only if needed**

```bash
git add -A
git commit -m "chore: finalize Firefly visual background v3"
```

Do not merge to `main` without explicit user authorization.
