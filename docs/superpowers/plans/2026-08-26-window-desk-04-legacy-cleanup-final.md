# Window Desk Redesign 04: Legacy Cleanup & Final Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the historical Firefly visual override chain, consolidate remaining wallpaper/bannerless behavior into the semantic design system, retire obsolete homepage components/tests, and verify the redesigned site as one maintainable production release.

**Architecture:** Plans 01–03 intentionally coexist with legacy CSS as a migration safety net. This plan first captures the functional shell behaviors that must survive, then migrates only the required wallpaper/bannerless rules into semantic files, removes old imports/files/components, trims obsolete visual tests from the suite, and performs full build/regression/diff/Pages verification before PR merge.

**Tech Stack:** Astro 6, TypeScript, CSS, Node built-in test runner, Git/GitHub Actions/GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-26-window-desk-tide-paper-design.md`

## Global Constraints

- Final ordinary-page style stack must not contain numbered Firefly visual layers.
- Keep wallpaper modes, theme hue, opacity, blur, card opacity compatibility, waves, full-screen media sharpness, fullscreen header behavior, floating controls, visual settings panel, page transitions, and immersive player behavior.
- Keep special immersive styles for `/player` and the independent SEKAI experience where required.
- Do not change Moments/message business APIs during cleanup.
- No production file named `firefly-v7*`, `final-final*`, or another override layer may be introduced.
- New semantic styles remain: `tokens.css`, `site-shell.css`, `home.css`, `article.css`, `moments.css`, `pages.css`; `global.css` may remain only for reset/base utilities that are genuinely global.
- Delete migration-only `article-reading.css`, `moments-life-wall.css`, `bannerless-pages.css`, and legacy Firefly visual files after their required behavior is moved.

---

## File Structure

**Create**
- `tests/window-desk-shell-behavior.test.mjs` — functional shell regression after old Firefly tests are retired.
- `tests/window-desk-cleanup.test.mjs` — asserts final import/file/component cleanup.

**Modify**
- `src/layouts/BaseLayout.astro` — final semantic imports only.
- `src/styles/site-shell.css` — receives required fullscreen/bannerless/wallpaper compatibility rules.
- `src/styles/tokens.css` — receives only genuinely global compatibility variables still needed by components.
- `src/styles/global.css` — trim obsolete ordinary-page visual rules; retain reset/base utilities.
- `package.json` — replace obsolete Firefly visual tests with final redesign tests.

**Delete after migration tests are green**
- `src/styles/firefly-refresh.css`
- `src/styles/firefly-v2.css`
- `src/styles/firefly-v2-pages.css`
- `src/styles/firefly-v4.css`
- `src/styles/firefly-v5-polish.css`
- `src/styles/firefly-v6-theme.css`
- `src/styles/firefly-wallpaper-modes.css`
- `src/styles/bannerless-pages.css`
- `src/styles/article-reading.css`
- `src/styles/moments-life-wall.css`

**Delete if `rg` shows zero imports after Plans 01–03**
- `src/components/HomeLeftSidebar.astro`
- `src/components/HomeRightSidebar.astro`
- `src/components/HomePostCard.astro`
- `src/components/HomeProfileSidebar.astro`
- `src/components/RecentMomentsWidget.astro`
- `src/components/MusicStatusWidget.astro`

**Retire from active test suite after functional assertions are captured below**
- `tests/firefly-ui-refresh.test.mjs`
- `tests/firefly-v3.test.mjs`
- `tests/firefly-v4.test.mjs`
- `tests/firefly-polish.test.mjs`
- `tests/firefly-alignment.test.mjs`
- `tests/firefly-profile-banner.test.mjs`

**Keep active dedicated behavior tests**
- `tests/site-build.test.mjs`
- `tests/sekai-player-search.test.mjs`
- `tests/hero-video-loop.test.mjs`
- `tests/music-cover-transition.test.mjs`
- `tests/banner-waves.test.mjs`
- `tests/visual-settings.test.mjs`
- `tests/post-cover.test.mjs`
- `tests/native-wallpaper-image.test.mjs`
- `tests/fullscreen-navbar-top.test.mjs`
- `tests/article-reading.test.mjs`
- `tests/article-toc.test.mjs`
- `tests/moments-journal-layout.test.mjs`
- `tests/window-desk-foundation.test.mjs`
- `tests/window-desk-public-pages.test.mjs`

---

### Task 1: Capture shell behavior independently of legacy CSS filenames

**Files:**
- Create: `tests/window-desk-shell-behavior.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Captures layout mode, player immersive default, header listener replacement, floating-control proxy, immersive controller, visual settings dialog IDs/accessibility, HeroSlideshow settings bridge, sakura reduced-motion/density/speed, fullscreen native media invariants, and wallpaper defaults.

- [ ] **Step 1: Create the new behavior test**

Create `tests/window-desk-shell-behavior.test.mjs` with explicit source-level assertions:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('standard and immersive modes remain explicit', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  assert.match(layout, /layoutMode/);
  assert.match(layout, /layout-\$\{layoutMode\}/);
  assert.match(layout, /normalizedPath\s*===\s*['"]\/player['"]/);
  assert.match(layout, /['"]immersive['"]\s*:\s*['"]standard['"]/);
  assert.match(layout, /<SiteHeader\s+currentPath=/);
  assert.match(layout, /<FloatingControls\s*\/?>/);
  assert.match(layout, /!isStandard\s*&&\s*<ImmersiveUiController\s*\/>/);
});

test('header and floating controls preserve navigation-safe listeners and proxies', () => {
  const header = read('src/components/SiteHeader.astro');
  const controls = read('src/components/FloatingControls.astro');
  assert.match(header, /window\.__siteHeaderScrollHandler/);
  assert.match(header, /removeEventListener\(['"]scroll['"]/);
  assert.match(header, /addEventListener\(['"]scroll['"]/);
  assert.match(controls, /id="floating-background-btn"/);
  assert.match(controls, /getElementById\(['"]hero-settings-btn['"]\)/);
  assert.match(controls, /id="floating-back-to-top"/);
});

test('immersive controller still owns shell visibility only', () => {
  const controller = read('src/components/ImmersiveUiController.astro');
  assert.match(controller, /\.site-header/);
  assert.match(controller, /\.site-floating-controls/);
  assert.match(controller, /\.sekai-player-btn/);
  assert.match(controller, /#hero-settings-panel/);
  assert.match(controller, /astro:before-swap/);
  assert.doesNotMatch(controller, /\.topbar/);
});

test('visual settings dialog and merge-safe bridge remain intact', () => {
  const panel = read('src/components/VisualSettingsPanel.astro');
  const hero = read('src/components/HeroSlideshow.astro');
  assert.match(panel, /id="visual-tab-appearance"/);
  assert.match(panel, /id="visual-tab-background"/);
  assert.match(panel, /id="visual-tab-effects"/);
  assert.match(panel, /id="hero-settings-btn"/);
  assert.match(panel, /role="dialog"/);
  assert.match(panel, /event\.key\s*===\s*['"]Escape['"]/);
  assert.match(panel, /100dvh/);
  assert.match(panel, /safe-area-inset-bottom/);
  assert.match(hero, /__lidureVisualSettings/);
  assert.match(hero, /Object\.assign\(\{\},\s*current,\s*payload\)/);
});

test('sakura remains canvas-based and respects user motion/settings', () => {
  const particles = read('src/components/SekaiParticles.astro');
  const worker = read('src/workers/sakura.worker.js');
  assert.match(particles, /id="sakura-canvas"/);
  assert.match(particles, /prefers-reduced-motion/);
  assert.match(particles, /sakuraDensity/);
  assert.match(particles, /sakuraSpeed/);
  assert.match(worker, /MAX_PETALS\s*=\s*24/);
  assert.match(worker, /density/);
  assert.match(worker, /speedMultiplier/);
});

test('wallpaper defaults remain synchronized', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  const controller = read('src/components/FullscreenWallpaperController.astro');
  assert.match(layout, /raw\.backgroundBlur[\s\S]*?:\s*5;/);
  assert.match(layout, /raw\.themeHue[\s\S]*?:\s*255;/);
  assert.match(layout, /bridge\.write\(\{\s*themeHue:\s*255\s*\}\)/);
  assert.match(layout, /bridge\.write\(\{\s*backgroundBlur:\s*5\s*\}\)/);
  assert.match(controller, /const blurRatio = Math\.min\(scrollY \/ 300, 1\)/);
});
```

Add this test to `test:site` while keeping old Firefly tests active for the moment.

- [ ] **Step 2: Run it before cleanup**

```bash
node --test tests/window-desk-shell-behavior.test.mjs
```

Expected: PASS on the pre-cleanup branch. If it does not, fix the test to reflect actual preserved behavior from current production code before deleting anything; do not change production behavior in this step.

- [ ] **Step 3: Commit the safety net**

```bash
git add tests/window-desk-shell-behavior.test.mjs package.json
git commit -m "test: capture shell behavior before css cleanup"
```

---

### Task 2: Migrate required wallpaper and bannerless behavior into semantic styles

**Files:**
- Modify: `src/styles/site-shell.css`
- Modify: `src/styles/tokens.css`
- Create: `tests/window-desk-cleanup.test.mjs`
- Modify: `package.json`

**Interfaces:**
- `site-shell.css` owns standard-page behavior for `data-wallpaper-mode="banner"`, `fullscreen`, `overlay`, `.no-hero-bg`, `.is-bannerless`, `data-card-border`, and `data-card-follow-theme` compatibility.
- Native fullscreen video/image must not receive blur/scale softening from content rules.

- [ ] **Step 1: Write failing semantic-ownership tests**

Create `tests/window-desk-cleanup.test.mjs`:

```js
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('semantic shell owns wallpaper and bannerless compatibility', () => {
  const shell = read('src/styles/site-shell.css');
  assert.match(shell, /data-wallpaper-mode="fullscreen"/);
  assert.match(shell, /data-wallpaper-mode="overlay"/);
  assert.match(shell, /data-wallpaper-mode="banner"/);
  assert.match(shell, /\.no-hero-bg/);
  assert.match(shell, /\.is-bannerless/);
  assert.match(shell, /--wallpaper-overlay/);
  assert.match(shell, /--wallpaper-blur/);
});

test('fullscreen native media remains sharp', () => {
  const shell = read('src/styles/site-shell.css');
  const blocks = [...shell.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const mediaBlocks = blocks.filter(([, selector]) =>
    selector.includes('data-wallpaper-mode="fullscreen"') &&
    (selector.includes('.slideshow-video') || selector.includes('.slideshow-image'))
  );
  assert.ok(mediaBlocks.length > 0);
  for (const [, , body] of mediaBlocks) {
    assert.doesNotMatch(body, /filter:\s*blur/);
    assert.doesNotMatch(body, /transform:\s*scale/);
  }
});
```

Add it to `test:site`.

- [ ] **Step 2: Verify RED**

```bash
node --test tests/window-desk-cleanup.test.mjs
```

Expected: FAIL because compatibility is still owned by legacy CSS.

- [ ] **Step 3: Move required rules, do not copy whole legacy files**

Use these existing runtime attributes as selectors in `site-shell.css`:

```css
html[data-wallpaper-mode='fullscreen'] body.layout-standard .standard-page-surface,
html[data-wallpaper-mode='overlay'] body.layout-standard .standard-page-surface {
  background: transparent;
}

html[data-wallpaper-mode='fullscreen'] body.layout-standard .slideshow-video,
html[data-wallpaper-mode='fullscreen'] body.layout-standard .slideshow-image {
  object-fit: cover;
}

body.layout-standard.is-bannerless .standard-page-surface {
  margin-top: 0;
}

body.layout-standard.is-bannerless .standard-content {
  padding-top: 96px;
}

html.no-hero-bg body.layout-standard {
  --paper: hsl(var(--theme-hue, 255) 24% 99% / 0.96);
}
```

Also port the existing overlay/blur/card-opacity formulas that are still read by `VisualSettingsPanel`/`FullscreenWallpaperController`, keeping their current variable names (`--wallpaper-overlay`, `--wallpaper-blur`, `--card-opacity`, `--card-opacity-percent`). Do not port obsolete three-column/home-card selectors.

- [ ] **Step 4: Run compatibility tests**

```bash
node --test tests/window-desk-cleanup.test.mjs tests/native-wallpaper-image.test.mjs tests/fullscreen-navbar-top.test.mjs tests/visual-settings.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles/site-shell.css src/styles/tokens.css tests/window-desk-cleanup.test.mjs package.json
git commit -m "refactor: move wallpaper behavior into semantic shell"
```

---

### Task 3: Remove legacy stylesheet imports and migration files

**Files:**
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/posts/[slug].astro`
- Modify: `src/pages/moments.astro`
- Delete the ten migration/legacy CSS files listed in File Structure.
- Modify: `tests/window-desk-cleanup.test.mjs`

**Interfaces:**
- Final BaseLayout ordinary style imports: `global.css`, `tokens.css`, `site-shell.css`, `pages.css`, plus special immersive stylesheet(s) that remain required.
- Home/article/Moments import their own semantic page CSS from their route files.

- [ ] **Step 1: Add failing final-import assertions**

Append:

```js
test('BaseLayout no longer loads versioned Firefly visual layers', () => {
  const layout = read('src/layouts/BaseLayout.astro');
  for (const legacy of [
    'firefly-refresh.css', 'firefly-v2.css', 'firefly-v2-pages.css',
    'firefly-v4.css', 'firefly-v5-polish.css', 'firefly-v6-theme.css',
    'firefly-wallpaper-modes.css', 'bannerless-pages.css',
  ]) assert.doesNotMatch(layout, new RegExp(legacy.replaceAll('.', '\\.')));
  assert.match(layout, /global\.css/);
  assert.match(layout, /tokens\.css/);
  assert.match(layout, /site-shell\.css/);
  assert.match(layout, /pages\.css/);
});

test('page-level migration styles are gone', () => {
  assert.equal(existsSync(new URL('../src/styles/article-reading.css', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/styles/moments-life-wall.css', import.meta.url)), false);
  assert.doesNotMatch(read('src/pages/posts/[slug].astro'), /article-reading\.css/);
  assert.doesNotMatch(read('src/pages/moments.astro'), /moments-life-wall\.css/);
});
```

- [ ] **Step 2: Verify RED**

```bash
node --test tests/window-desk-cleanup.test.mjs
```

Expected: FAIL while legacy imports/files still exist.

- [ ] **Step 3: Remove legacy imports and delete files**

Delete exactly:

```text
src/styles/firefly-refresh.css
src/styles/firefly-v2.css
src/styles/firefly-v2-pages.css
src/styles/firefly-v4.css
src/styles/firefly-v5-polish.css
src/styles/firefly-v6-theme.css
src/styles/firefly-wallpaper-modes.css
src/styles/bannerless-pages.css
src/styles/article-reading.css
src/styles/moments-life-wall.css
```

Remove corresponding imports from `BaseLayout.astro`, `[slug].astro`, and `moments.astro`.

- [ ] **Step 4: Run cleanup + dedicated functional suites**

```bash
node --test tests/window-desk-cleanup.test.mjs tests/window-desk-shell-behavior.test.mjs tests/visual-settings.test.mjs tests/native-wallpaper-image.test.mjs tests/fullscreen-navbar-top.test.mjs tests/banner-waves.test.mjs tests/article-toc.test.mjs tests/moments-journal-layout.test.mjs
npm run check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/styles src/layouts/BaseLayout.astro src/pages/posts/[slug].astro src/pages/moments.astro tests/window-desk-cleanup.test.mjs
git commit -m "refactor: remove legacy firefly visual layers"
```

---

### Task 4: Remove obsolete home components only after proving zero imports

**Files:**
- Delete the six old home components listed above when unreferenced.
- Modify: `tests/window-desk-cleanup.test.mjs`

**Interfaces:**
- The new home relies only on `home-presence.ts`, `HomeRecentMoments.astro`, Astro collection data, and existing global player links.

- [ ] **Step 1: Prove the candidates are unreferenced**

Run:

```bash
rg "HomeLeftSidebar|HomeRightSidebar|HomePostCard|HomeProfileSidebar|RecentMomentsWidget|MusicStatusWidget" src --glob '!src/components/HomeLeftSidebar.astro' --glob '!src/components/HomeRightSidebar.astro' --glob '!src/components/HomePostCard.astro' --glob '!src/components/HomeProfileSidebar.astro' --glob '!src/components/RecentMomentsWidget.astro' --glob '!src/components/MusicStatusWidget.astro'
```

Expected: no matches. If there is a match, remove that obsolete import/use as part of the new homepage architecture first; these components must not remain part of another route accidentally.

- [ ] **Step 2: Add cleanup assertions**

```js
test('retired portal homepage components are removed', () => {
  for (const path of [
    'src/components/HomeLeftSidebar.astro',
    'src/components/HomeRightSidebar.astro',
    'src/components/HomePostCard.astro',
    'src/components/HomeProfileSidebar.astro',
    'src/components/RecentMomentsWidget.astro',
    'src/components/MusicStatusWidget.astro',
  ]) assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, path);
});
```

- [ ] **Step 3: Delete the six files and run tests**

```bash
rm src/components/HomeLeftSidebar.astro src/components/HomeRightSidebar.astro src/components/HomePostCard.astro src/components/HomeProfileSidebar.astro src/components/RecentMomentsWidget.astro src/components/MusicStatusWidget.astro
node --test tests/window-desk-cleanup.test.mjs tests/window-desk-foundation.test.mjs tests/sekai-player-search.test.mjs
```

Expected: PASS. `SekaiPlayer` remains independently accessible from the global player UI.

- [ ] **Step 4: Commit**

```bash
git add -A src/components tests/window-desk-cleanup.test.mjs
git commit -m "refactor: remove retired homepage portal components"
```

---

### Task 5: Retire obsolete Firefly visual tests without losing functional coverage

**Files:**
- Modify: `package.json`
- Delete: `tests/firefly-ui-refresh.test.mjs`, `tests/firefly-v3.test.mjs`, `tests/firefly-v4.test.mjs`, `tests/firefly-polish.test.mjs`, `tests/firefly-alignment.test.mjs`, `tests/firefly-profile-banner.test.mjs`

**Interfaces:**
- Functional shell behavior formerly mixed into `firefly-ui-refresh` / `firefly-v3` is now covered by `window-desk-shell-behavior.test.mjs` plus dedicated tests named in File Structure.
- New visual structure is covered by foundation/article/Moments/public-page/cleanup tests.

- [ ] **Step 1: Run all replacement tests before removing old files**

```bash
node --test \
  tests/window-desk-foundation.test.mjs \
  tests/window-desk-shell-behavior.test.mjs \
  tests/window-desk-cleanup.test.mjs \
  tests/article-reading.test.mjs \
  tests/article-toc.test.mjs \
  tests/moments-journal-layout.test.mjs \
  tests/window-desk-public-pages.test.mjs \
  tests/visual-settings.test.mjs \
  tests/banner-waves.test.mjs \
  tests/native-wallpaper-image.test.mjs \
  tests/fullscreen-navbar-top.test.mjs \
  tests/sekai-player-search.test.mjs \
  tests/hero-video-loop.test.mjs \
  tests/music-cover-transition.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Delete the obsolete visual test files**

Delete exactly the six files listed under Files.

- [ ] **Step 3: Rewrite `test:site` to use the maintained suite**

The command must include the dedicated tests above and must not reference any deleted `firefly-*.test.mjs` file. Keep `site-build`, poster/media, player, settings, wallpaper, article, Moments, and the four new redesign suites.

- [ ] **Step 4: Run the new complete suite**

```bash
npm run test:site
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A tests package.json
git commit -m "test: retire superseded firefly visual contracts"
```

---

### Task 6: Trim `global.css` to genuine global responsibilities

**Files:**
- Modify: `src/styles/global.css`
- Modify: `tests/window-desk-cleanup.test.mjs`

**Interfaces:**
- `global.css` may contain reset/base elements, generic utilities that are still shared, and non-visual compatibility required by special routes.
- It must not own `.home-layout`, `.home-featured-card`, `.timeline-item`, `.tag-pill`, `.moment-card`, `.article-bookmark`, or other retired ordinary-page component styles.

- [ ] **Step 1: Add failing forbidden-selector assertions**

```js
test('global css no longer owns retired ordinary-page components', () => {
  const global = read('src/styles/global.css');
  for (const selector of [
    '.home-layout', '.home-featured-card', '.timeline-item', '.tag-pill',
    '.moment-card', '.article-bookmark', '.messages-layout',
  ]) assert.doesNotMatch(global, new RegExp(selector.replace('.', '\\.')));
});
```

- [ ] **Step 2: Verify current state**

```bash
node --test tests/window-desk-cleanup.test.mjs
```

Expected: RED if historical ordinary-page rules remain in `global.css`.

- [ ] **Step 3: Remove only retired selector blocks**

Use an explicit search before editing:

```bash
rg -n "home-layout|home-featured-card|timeline-item|tag-pill|moment-card|article-bookmark|messages-layout" src/styles/global.css
```

Delete those complete selector blocks and associated media-query-only variants. Do not remove generic `.card`, form reset, keyframes, or special-route rules unless `rg` across `src/` proves them unused.

- [ ] **Step 4: Run cleanup and build**

```bash
node --test tests/window-desk-cleanup.test.mjs
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles/global.css tests/window-desk-cleanup.test.mjs
git commit -m "refactor: reduce global css to shared base"
```

---

### Task 7: Final production verification and PR handoff

**Files:**
- Modify only for defects found by the exact verification commands below.

- [ ] **Step 1: Run fresh full verification**

```bash
npm run build
npm run test:site
```

Expected: both commands PASS on the final branch head.

- [ ] **Step 2: Verify no legacy names remain in production imports**

```bash
rg -n "firefly-(refresh|v2|v4|v5|v6|wallpaper-modes)|article-reading\.css|moments-life-wall\.css|bannerless-pages\.css" src package.json
```

Expected: no production import/reference matches. Historical docs may still mention old names and are not a failure.

- [ ] **Step 3: Verify the five primary routes and auxiliary routes build**

After `npm run build`, confirm these generated paths exist:

```bash
test -f dist/index.html
test -f dist/posts/index.html
test -f dist/moments/index.html
test -f dist/archive/index.html
test -f dist/about/index.html
test -f dist/tags/index.html
test -f dist/messages/index.html
test -f dist/search/index.html
test -f dist/player/index.html
test -f dist/sekai-quest/index.html
```

Expected: all commands exit 0.

- [ ] **Step 4: Review the final diff**

```bash
git diff --stat main...HEAD
git diff --name-status main...HEAD
```

Confirm the diff contains the approved redesign/spec/plans and no unrelated application/API changes.

- [ ] **Step 5: Request code review before merge**

Invoke `superpowers:requesting-code-review` and address concrete findings before opening/finalizing the PR.

- [ ] **Step 6: Run verification again after review fixes**

```bash
npm run build
npm run test:site
```

Expected: PASS on the exact commit proposed for merge.

- [ ] **Step 7: Open the PR**

Create a PR from `redesign/window-desk-tide-paper` to `main` with a summary covering:
- unified semantic design system;
- personal-first homepage;
- H2/H3 article TOC;
- Moments life-slice redesign;
- posts/archive/tags/messages/About information architecture;
- legacy Firefly CSS/test cleanup;
- verification commands and results.

- [ ] **Step 8: Merge only after required checks are green**

Use the repository's normal merge method. Do not merge while required checks are pending/failing.

- [ ] **Step 9: Verify GitHub Pages deployment after merge**

Fetch the workflow run associated with the merge commit and confirm build/deploy success. If deployment fails, treat that as an incomplete release and debug before claiming completion.
