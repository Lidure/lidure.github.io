# Firefly Visual & Background v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the approved Firefly-inspired v3 background/visual system without replacing the existing media library, slideshow pipeline, SEKAI player, or immersive `/player` behavior.

**Architecture:** `BaseLayout.layoutMode` stays `standard|immersive`; standard pages gain a separate persisted `wallpaperMode: banner|fullscreen`. A pure `visual-settings.mjs` module owns normalization/merge-safe `hero_settings` persistence and exposes a browser bridge. The visible settings DOM/styles move out of `HeroSlideshow`, but legacy control IDs remain so existing media business logic can keep binding to them. Layout appearance is CSS/data-attribute driven; sakura becomes a worker-first real-petal canvas effect.

**Tech Stack:** Astro 6, ES modules/TypeScript, CSS, localStorage, CustomEvent, Vite `import.meta.glob`, Canvas 2D, OffscreenCanvas/Web Worker, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-24-firefly-visual-background-v3-design.md`

## Global Constraints

- `hero_settings` remains the only persisted visual/background settings object.
- Preserve old `enabled`, `autoplay`, `interval`, `opacity`, `quality`, `sakura` values and unknown legacy keys.
- Every `hero_settings` write must merge; `HeroSlideshow` must not overwrite the whole object.
- Media upload, URL add, preview, library, selected media, slideshow order and autoplay business logic remain in `HeroSlideshow`.
- SEKAI playback/playlist state remains unchanged.
- `/player` ignores standard-page wallpaper presentation and remains immersive.
- Banner: desktop `62vh`/min `360px`/overlap `56px`; tablet `54vh`/min `320px`/overlap `44px`; mobile `42vh`/min `260px`/overlap `28px`.
- Fullscreen default `backgroundBlur=6` and `cardOpacity=0.92`; banner ignores background blur.
- Homepage cover priority: explicit `cover` → first Markdown image → text-only.
- Homepage music controls proxy existing player IDs/API.
- Sakura: real SVG petal, worker/offscreen path first, Canvas 2D fallback, no emoji petals.
- Restore-default actions reset settings only; they never delete/reorder media-library data.
- Final gate: `npm test` exit `0`, Astro check `0 errors`, build succeeds, built homepage/player contracts inspected.

---

### Task 1: Build merge-safe visual settings state and browser bridge

**Files:**
- Create: `src/lib/visual-settings.mjs`
- Create: `tests/visual-settings.test.mjs`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `package.json`

**Interfaces:** `DEFAULT_VISUAL_SETTINGS`, `normalizeVisualSettings(raw)`, `readVisualSettings(storage)`, `applyVisualSettingsToDocument(settings, doc)`, `writeVisualSettings(patch, {storage, doc, target})`; browser bridge `window.__lidureVisualSettings.read()` / `.write(patch)`; event `lidure:visual-settings-change` detail `{settings, changedKeys}`.

- [ ] **Step 1: Write RED tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_VISUAL_SETTINGS, normalizeVisualSettings } from '../src/lib/visual-settings.mjs';

test('old values and unknown keys survive v2 normalization', () => {
  const s = normalizeVisualSettings({
    enabled:false, autoplay:false, interval:9000, opacity:0.25,
    quality:'original', sakura:true, customLegacyValue:'keep-me',
  });
  assert.equal(s.enabled,false); assert.equal(s.autoplay,false); assert.equal(s.interval,9000);
  assert.equal(s.opacity,0.25); assert.equal(s.quality,'original'); assert.equal(s.sakura,true);
  assert.equal(s.wallpaperMode,'banner'); assert.equal(s.backgroundBlur,6);
  assert.equal(s.cardOpacity,0.92); assert.equal(s.themeHue,340);
  assert.equal(s.customLegacyValue,'keep-me');
});

test('invalid values are clamped', () => {
  const s=normalizeVisualSettings({wallpaperMode:'bad',opacity:4,backgroundBlur:-3,cardOpacity:0,sakuraDensity:9,sakuraSpeed:-2});
  assert.equal(s.wallpaperMode,'banner'); assert.equal(s.opacity,1); assert.equal(s.backgroundBlur,0);
  assert.equal(s.cardOpacity,0.2); assert.equal(s.sakuraDensity,1); assert.equal(s.sakuraSpeed,0.25);
});
assert.equal(DEFAULT_VISUAL_SETTINGS.version,2);
```

Add this test file to `test:site`.

- [ ] **Step 2: Verify RED**

```bash
node --test tests/visual-settings.test.mjs
```

Expected: module-not-found.

- [ ] **Step 3: Implement the settings module**

Use defaults `{version:2,enabled:true,autoplay:true,interval:15000,opacity:0.45,quality:'high',sakura:true,wallpaperMode:'banner',backgroundBlur:6,cardOpacity:0.92,bannerGradient:true,bannerTitle:true,themeHue:340,cardBorder:true,cardFollowTheme:false,sakuraDensity:0.65,sakuraSpeed:1,reduceMotion:false}`. Clamp interval `2000..20000`, opacity `0..1`, blur `0..20`, cardOpacity `0.2..1`, hue `0..360`, density `0..1`, speed `0.25..2`. Normalize with `{...defaults,...raw}` so unknown keys survive.

`applyVisualSettingsToDocument` must set `data-wallpaper-mode`, `data-banner-gradient`, `data-banner-title`, `data-card-border`, `data-card-follow-theme`, `data-reduce-motion`, `no-hero-bg`, `--wallpaper-overlay`, `--wallpaper-blur`, `--card-opacity`, `--card-opacity-percent`, `--theme-hue`.

`writeVisualSettings` merges current+patch, writes JSON, applies document state, and emits `lidure:visual-settings-change`.

- [ ] **Step 4: Replace BaseLayout enabled-only first-paint bootstrap**

Before paint, synchronously parse `hero_settings` and set the same attributes/variables using the same defaults/clamps. This avoids wallpaper/opacity flashing.

- [ ] **Step 5: Install persistent browser bridge**

```js
import {applyVisualSettingsToDocument,readVisualSettings,writeVisualSettings} from '../lib/visual-settings.mjs';
function installVisualSettingsBridge(){
  window.__lidureVisualSettings={
    read:()=>readVisualSettings(window.localStorage),
    write:(patch)=>writeVisualSettings(patch,{storage:window.localStorage,doc:document,target:document}),
  };
  applyVisualSettingsToDocument(window.__lidureVisualSettings.read(),document);
}
if(!window.__lidureVisualSettingsLifecycleBound){window.__lidureVisualSettingsLifecycleBound=true;document.addEventListener('astro:page-load',installVisualSettingsBridge);}
installVisualSettingsBridge();
```

- [ ] **Step 6: GREEN + commit**

```bash
node --test tests/visual-settings.test.mjs tests/firefly-ui-refresh.test.mjs
git add src/lib/visual-settings.mjs src/layouts/BaseLayout.astro tests/visual-settings.test.mjs package.json
git commit -m "feat: add compatible visual settings state"
```

---

### Task 2: Move visible settings UI/styles out of HeroSlideshow and preserve business bindings

**Files:** create `src/components/VisualSettingsPanel.astro`; modify `src/layouts/BaseLayout.astro`, `src/components/HeroSlideshow.astro`, `tests/firefly-ui-refresh.test.mjs`.

**Interfaces:** preserve legacy IDs `hero-settings-btn`, `settings-close`, `toggle-enabled`, `toggle-autoplay`, `toggle-sakura`, `interval-range`, `interval-val`, `opacity-range`, `opacity-val`, `quality-select`, `file-input`, `url-input`, `url-add-btn`, `media-manage-btn`, `media-count`. Add `visual-tab-appearance`, `visual-tab-background`, `visual-tab-effects`, `wallpaper-mode-banner`, `wallpaper-mode-fullscreen`, `background-blur-range`, `card-opacity-range`, `fullscreen-card-opacity-range`, `theme-hue-range`, `toggle-card-border`, `toggle-card-follow-theme`, `toggle-banner-gradient`, `toggle-banner-title`, `sakura-density-range`, `sakura-speed-range`, `toggle-reduce-motion`, `visual-reset-current`.

- [ ] **Step 1: Add RED contracts**

```js
test('visual settings panel owns DOM and scoped styles while Hero keeps media views',()=>{
  const panel=readSource('src/components/VisualSettingsPanel.astro');const hero=readSource('src/components/HeroSlideshow.astro');const layout=readSource('src/layouts/BaseLayout.astro');
  assert.match(panel,/id="hero-settings-btn"/);assert.match(panel,/id="visual-tab-appearance"/);assert.match(panel,/id="wallpaper-mode-fullscreen"/);assert.match(panel,/id="fullscreen-card-opacity-range"/);assert.match(panel,/id="visual-reset-current"/);assert.match(panel,/\.hero-settings-panel/);assert.match(panel,/\.hero-settings-btn/);assert.doesNotMatch(hero,/id="hero-settings-btn"/);assert.match(hero,/id="media-panel"/);assert.match(hero,/id="media-preview"/);assert.match(layout,/<VisualSettingsPanel\s*\/>[\s\S]*?<HeroSlideshow\s*\/>/);
});
test('HeroSlideshow uses merge-safe visual settings bridge',()=>{const hero=readSource('src/components/HeroSlideshow.astro');assert.match(hero,/__lidureVisualSettings/);assert.doesNotMatch(hero,/localStorage\.setItem\(\s*['"]hero_settings['"]/);});
```

- [ ] **Step 2: Verify RED**

```bash
node --test tests/firefly-ui-refresh.test.mjs
```

- [ ] **Step 3: Move settings markup AND scoped settings CSS together**

Move button/panel/legacy controls and all `.hero-settings-btn`, `.hero-settings-panel`, `.settings-*`, `.toggle-*`, range/select/upload/url CSS to `VisualSettingsPanel`. Keep `.media-panel`, `.media-preview`, slideshow/video/canvas markup+styles in Hero. Mount `<VisualSettingsPanel />` before `<HeroSlideshow />` so the existing Hero script finds preserved IDs.

Appearance tab: hue, card opacity, border, follow-theme. Background: banner/fullscreen segmented control, legacy background controls, fullscreen blur, second synchronized card-opacity range, banner gradient/title, upload/library. Effects: sakura switch, density, speed, reduce-motion. Footer: reset-current.

- [ ] **Step 4: Replace legacy whole-object writes**

Each old runtime handler keeps its behavior but persists only a patch via `window.__lidureVisualSettings.write(...)` for enabled/autoplay/interval/opacity/quality/sakura. Remove direct `localStorage.setItem('hero_settings',...)`; do not change other media-library keys.

- [ ] **Step 5: Bind new controls and sync duplicate card opacity**

Both opacity ranges update the same `cardOpacity` and mirror each other's value. Other new controls write `wallpaperMode`, `backgroundBlur`, `themeHue`, `cardBorder`, `cardFollowTheme`, `bannerGradient`, `bannerTitle`, `sakuraDensity`, `sakuraSpeed`, `reduceMotion`. On `astro:page-load`, read bridge state and populate all controls.

- [ ] **Step 6: Implement reset-current without deleting media**

Appearance defaults: `themeHue:340,cardOpacity:0.92,cardBorder:true,cardFollowTheme:false`. Effects: `sakura:true,sakuraDensity:0.65,sakuraSpeed:1,reduceMotion:false` and trigger the existing sakura checkbox handler. Background: use existing inputs and dispatch their native events to set enabled/autoplay true, interval 15s, opacity 45%, quality high; then patch `wallpaperMode:'banner',backgroundBlur:6,cardOpacity:0.92,bannerGradient:true,bannerTitle:true`. Never touch media arrays/current URLs/upload storage.

- [ ] **Step 7: Accessible Astro-safe tabs**

Use `role=tablist/tab/tabpanel`, `aria-controls`, `aria-selected`, tabindex and ArrowLeft/ArrowRight. Remove/rebind a single handler stored as `window.__visualSettingsPanelHandler`.

- [ ] **Step 8: GREEN + commit**

```bash
node --test tests/firefly-ui-refresh.test.mjs tests/visual-settings.test.mjs
git add src/components/VisualSettingsPanel.astro src/layouts/BaseLayout.astro src/components/HeroSlideshow.astro tests/firefly-ui-refresh.test.mjs
git commit -m "feat: add integrated visual settings panel"
```

---

### Task 3: Implement wider/taller banner and banner/fullscreen wallpaper modes

**Files:** `src/layouts/BaseLayout.astro`, `src/components/BlogBanner.astro`, `src/styles/firefly-refresh.css`, `src/styles/firefly-v2.css`, `tests/firefly-ui-refresh.test.mjs`.

- [ ] **Step 1: RED geometry contract**

```js
test('v3 wallpaper geometry matches approved values',()=>{const layout=readSource('src/layouts/BaseLayout.astro');const css=readSource('src/styles/firefly-refresh.css');assert.match(layout,/isHome/);assert.match(css,/--blog-banner-height:\s*62vh/);assert.match(css,/--blog-banner-overlap:\s*56px/);assert.match(css,/min-height:\s*360px/);assert.match(css,/\.blog-banner-copy[\s\S]*?1380px/);assert.match(css,/data-wallpaper-mode="fullscreen"/);assert.match(css,/--card-opacity-percent/);});
```

- [ ] **Step 2: RED**

```bash
node --test tests/firefly-ui-refresh.test.mjs
```

- [ ] **Step 3: Add `is-home` marker**

`const isHome = normalizedPath === '' || normalizedPath === '/';` and body class-list includes `is-home` when true.

- [ ] **Step 4: Banner CSS**

Desktop variables `62vh/56px`, hero/banner min 360px; `.blog-banner-copy{width:min(1380px,calc(100vw - 48px))}` and subtitle max 820px; content margin-top `-56px`; 110px soft gradient when enabled. Tablet uses `54vh/44px/min320`; mobile `42vh/28px/min260` and narrower copy.

- [ ] **Step 5: Fullscreen CSS**

Standard hero fixed `100vh`, blur `var(--wallpaper-blur,6px)`, slight scale to hide blur edges. Home banner is `100vh` and content begins after it. Non-home hides BlogBanner and starts surface at 64px. Primary cards/sidebar widgets use `color-mix(... var(--card-opacity-percent,92%) ...)` plus `backdrop-filter:blur(14px)`; do not glass every child.

- [ ] **Step 6: Make theme controls visually real**

Default main accent derives from `--theme-hue` (`hsl(...340...)` remains pink); keep purple/cyan/warm semantics. `data-banner-title=false` hides banner copy; `data-card-border=false` removes primary card borders; follow-theme adds only a subtle hue-tinted edge, not a saturated gradient.

- [ ] **Step 7: GREEN/build + commit**

```bash
node --test tests/firefly-ui-refresh.test.mjs
npm run build
git add src/layouts/BaseLayout.astro src/components/BlogBanner.astro src/styles/firefly-refresh.css src/styles/firefly-v2.css tests/firefly-ui-refresh.test.mjs
git commit -m "feat: add banner and fullscreen wallpaper modes"
```

---

### Task 4: Add automatic homepage article covers

**Files:** create `src/lib/post-cover.mjs`, `tests/post-cover.test.mjs`; modify `src/components/HomePostCard.astro`, `src/styles/firefly-refresh.css`, `package.json`.

- [ ] **Step 1: RED tests including existing parenthesized filename**

```js
import assert from 'node:assert/strict';import test from 'node:test';import {extractFirstMarkdownImage,resolvePostCover} from '../src/lib/post-cover.mjs';
test('parses nested parentheses',()=>assert.equal(extractFirstMarkdownImage('![a](131770967_p0_master1200(1)(1).png)'),'131770967_p0_master1200(1)(1).png'));
test('cover wins',()=>assert.equal(resolvePostCover({cover:'/c.jpg',body:'![x](image.png)',postId:'a.md',assets:{}}),'/c.jpg'));
test('relative image resolves',()=>assert.equal(resolvePostCover({body:'![x](image.png)',postId:'视觉光流.md',assets:{'../content/blog/image.png':'/_astro/image.hash.png'}}),'/_astro/image.hash.png'));
```

- [ ] **Step 2: Balanced parser**

Scan destination character-by-character with nested parenthesis depth; at depth zero outer `)` ends destination and whitespace starts optional title. Strip `<...>`. Do not use lazy regex.

`resolvePostCover`: explicit cover first; absolute/http/data/blob unchanged; relative path resolved against post-id directory then mapped to `../content/blog/...` asset key.

- [ ] **Step 3: Vite asset map + card layout**

```js
const blogAssets=import.meta.glob('../content/blog/**/*.{png,jpg,jpeg,webp,gif,avif}',{eager:true,query:'?url',import:'default'});
```

Use resolved cover. Desktop image ~35%, 16:9, rounded; mobile image above text. No placeholder if null.

- [ ] **Step 4: GREEN/build + commit**

```bash
node --test tests/post-cover.test.mjs tests/firefly-ui-refresh.test.mjs
npm run build
git add src/lib/post-cover.mjs src/components/HomePostCard.astro src/styles/firefly-refresh.css tests/post-cover.test.mjs package.json
git commit -m "feat: show article images on homepage"
```

---

### Task 5: Redesign homepage music widget to screenshot composition

**Files:** `src/components/MusicStatusWidget.astro`, `tests/firefly-ui-refresh.test.mjs`.

- [ ] **Step 1: RED composition contract**

Require `music-status-cover-shell`, `music-status-play-overlay`, one `data-music-title`, prev/next IDs, and absence of artist/state display.

- [ ] **Step 2: New non-nested-button structure**

Cover button opens `__sekaiOpenPlayer`; central overlay button proxies `sekaiPlayPauseBtn`; bottom circular buttons proxy prev/next. Keep existing cover/title/audio observer.

- [ ] **Step 3: Approved dimensions**

Cover `min(100%,238px)`, square, radius 22px; central play 58px circle; prev/next 42px; one-line centered title; restrained translucency, no heavy glow.

- [ ] **Step 4: GREEN + commit**

```bash
node --test tests/firefly-ui-refresh.test.mjs
git add src/components/MusicStatusWidget.astro tests/firefly-ui-refresh.test.mjs
git commit -m "feat: redesign homepage music widget"
```

---

### Task 6: Replace emoji sakura with worker-first real-petal canvas

**Files:** create `public/sakura-petal.svg`, `src/lib/sakura-physics.mjs`, `src/workers/sakura.worker.ts`, `src/components/SakuraEffect.astro`, `tests/sakura-effect.test.mjs`; modify `src/layouts/BaseLayout.astro`, `package.json`; delete `src/components/SekaiParticles.astro` after GREEN.

- [ ] **Step 1: RED physics/source contracts**

Test petal movement, worker/offscreen detection, Canvas fallback, visual-settings listener, reduced-motion, pause/resume worker messages, and absence of emoji petals.

- [ ] **Step 2: Real SVG petal**

Use a transparent pink two-lobed SVG asset, not an emoji/text glyph.

- [ ] **Step 3: Shared physics**

Petal fields `x,y,size,rotation,rotationSpeed,vy,vx,phase,phaseSpeed,opacity`; injected random for tests. Counts desktop `20+density*16`, mobile `10+density*8`, rounded; continuous count 0 under reduced motion.

- [ ] **Step 4: Worker protocol**

Messages: `init{canvas,width,height,dpr,settings}`, `settings{settings}`, `resize{width,height,dpr}`, `pause`, `resume`, `destroy`. Fetch SVG and `createImageBitmap`; draw with transform/alpha. Worker rAF when available, 16ms timeout fallback. Init failure signals main-thread fallback.

- [ ] **Step 5: SakuraEffect fallback/lifecycle**

One fixed pointer-events-none canvas. Transfer offscreen only once; fallback uses `Image('/sakura-petal.svg')` + shared physics. Listen to `lidure:visual-settings-change`, legacy `lidure:sakura-setting`, visibility, rAF-throttled resize, `astro:before-swap`. System OR stored reduced-motion stops continuous petals. Clean worker/listeners/canvas before re-init.

- [ ] **Step 6: Swap/delete old renderer**

Replace BaseLayout import/render with `SakuraEffect`; remove `SekaiParticles.astro` after GREEN.

- [ ] **Step 7: GREEN/build + commit**

```bash
node --test tests/sakura-effect.test.mjs tests/visual-settings.test.mjs tests/firefly-ui-refresh.test.mjs
npm run build
git add public/sakura-petal.svg src/lib/sakura-physics.mjs src/workers/sakura.worker.ts src/components/SakuraEffect.astro src/layouts/BaseLayout.astro tests/sakura-effect.test.mjs package.json
git rm src/components/SekaiParticles.astro
git commit -m "feat: upgrade sakura effect renderer"
```

---

### Task 7: Responsive/accessibility integration and built-page regressions

**Files:** `src/components/VisualSettingsPanel.astro`, `src/styles/firefly-refresh.css`, `src/styles/firefly-v2.css`, `tests/firefly-ui-refresh.test.mjs`, `tests/site-build.test.mjs`.

- [ ] **Step 1: Built contracts**

Homepage must contain settings button/tabs, fullscreen selector, music play control. Player must contain immersive layout/header/SEKAI/background settings and no BlogBanner/standard surface.

- [ ] **Step 2: Responsive rules**

Panel desktop `clamp(420px,34vw,480px)`, mobile max `calc(100vw - 20px)` sheet; segmented controls >=44px; visible range values; no horizontal overflow <850px. Low-opacity fullscreen cards remain readable. Floating controls below modal/media preview.

- [ ] **Step 3: Accessibility/motion**

Visible focus for tabs/mode/reset/music/close/media controls; correct tab ARIA. Reduced motion disables decorative hover movement and continuous sakura only, not background video.

- [ ] **Step 4: Full GREEN + commit**

```bash
npm test
git add src/components/VisualSettingsPanel.astro src/styles/firefly-refresh.css src/styles/firefly-v2.css tests/firefly-ui-refresh.test.mjs tests/site-build.test.mjs
git commit -m "test: lock Firefly v3 visual regressions"
```

---

### Task 8: Final verification and temporary-CI cleanup

- [ ] **Step 1: Final suite**

```bash
npm ci
npm test
```

Expected exit 0, Astro check 0 errors, all tests pass.

- [ ] **Step 2: Inspect built output**

`dist/index.html`: settings/tabs/fullscreen/music control and post images for resolvable posts. `dist/player/index.html`: immersive/header/SEKAI/background settings; no BlogBanner/standard surface.

- [ ] **Step 3: CI fallback if local execution unavailable**

Use one temporary branch-only workflow with checkout v4, setup-node v4 Node 22 + npm cache, `npm ci`, `npm test`. Record result, inspect, then delete workflow/result before diff. Never merge temporary CI files.

- [ ] **Step 4: Diff checks**

```bash
git diff --stat main...HEAD
git diff --check main...HEAD
```

No temp CI, duplicate settings button, `SekaiParticles` import, direct Hero `hero_settings` overwrite, or unrelated media/content edits.

- [ ] **Step 5: Cleanup commit only if needed**

```bash
git add -A
git commit -m "chore: finalize Firefly visual background v3"
```

Do not merge without explicit user authorization.
