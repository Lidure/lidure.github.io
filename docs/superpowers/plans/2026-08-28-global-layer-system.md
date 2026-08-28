# Global Layer System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ad-hoc global `z-index` values with one semantic site-wide layer system so decorative effects stay behind content, launchers stay below navigation, and expanded panels/dialogs reliably appear above navigation.

**Architecture:** Define seven ordered layer tokens once in `src/styles/global.css`, then migrate only global stacking surfaces to those tokens. Internal component stacking (note pins, cover art, visualizer layers, etc.) remains local. Add a source-level layer contract test that verifies token ordering and exact component assignments, including removal of known legacy magic numbers.

**Tech Stack:** Astro 6, CSS custom properties, Node.js built-in test runner (`node:test`), existing `npm run build` / `npm run test:site` / `npm test` scripts.

**Spec:** `docs/superpowers/specs/2026-08-28-global-layer-system-design.md`

## Global Constraints

- Global ordering must remain: `decoration < content < floating < nav < overlay < modal < toast`.
- Shared tokens must be defined exactly once in global CSS and consumed semantically.
- Decorative effects remain non-interactive and below real UI.
- Closed floating launcher buttons remain below navigation.
- Expanded player/settings panels and message drawer remain above navigation.
- The sticky-note composer backdrop is a blocking modal layer above ordinary overlays.
- Page-transition progress remains the highest passive layer and keeps `pointer-events: none`.
- Do not introduce portals/teleports unless an existing ancestor stacking context makes the contract impossible.
- Do not redesign component appearance or change interaction semantics.
- Do not migrate local `z-index` values used only for internal component composition.
- No Cloudflare Worker or D1 changes are required.

---

## File Structure

- `src/styles/global.css` — single source of truth for the seven global layer tokens.
- `src/components/BannerWaves.astro` — maps global banner-wave surface to `--z-decoration`.
- `src/styles/immersive-nav.css` — maps immersive header/navigation to `--z-nav`; preserves local layout behavior.
- `src/components/SekaiPlayer.astro` — maps collapsed launcher to `--z-floating` and expanded player panel to `--z-overlay`.
- `src/components/VisualSettingsPanel.astro` — maps collapsed launcher to `--z-floating` and expanded settings panel to `--z-overlay`.
- `src/styles/message-board.css` — maps detail drawer to `--z-overlay` and composer backdrop to `--z-modal`.
- `src/components/PageTransitionEnhancer.astro` — maps passive progress bar to `--z-toast`.
- `tests/global-layer-system.test.mjs` — contract tests for token ordering, component assignments, and removal of migrated magic numbers.
- `package.json` — adds the new contract test to `test:site`.

---

### Task 1: Establish the Global Layer Contract in RED

**Files:**
- Create: `tests/global-layer-system.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: existing source files as UTF-8 text.
- Produces: regression contract asserting the seven token names and all approved component-to-layer mappings.

- [ ] **Step 1: Write the failing layer-contract test**

Create `tests/global-layer-system.test.mjs` with helpers that read repository files and extract the root token values. The test must assert these exact tokens exist in `src/styles/global.css` and are strictly increasing:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const TOKEN_NAMES = [
  '--z-decoration',
  '--z-content',
  '--z-floating',
  '--z-nav',
  '--z-overlay',
  '--z-modal',
  '--z-toast',
];

function tokenValue(css, token) {
  const match = css.match(new RegExp(`${token.replaceAll('-', '\\-')}\\s*:\\s*(\\d+)\\s*;`));
  return match ? Number(match[1]) : null;
}

test('global layer tokens exist once and are strictly ordered', async () => {
  const globalCss = await read('src/styles/global.css');
  const values = TOKEN_NAMES.map((token) => {
    const matches = [...globalCss.matchAll(new RegExp(`${token.replaceAll('-', '\\-')}\\s*:`, 'g'))];
    assert.equal(matches.length, 1, `${token} must be defined exactly once`);
    const value = tokenValue(globalCss, token);
    assert.notEqual(value, null, `${token} must have an integer value`);
    return value;
  });

  for (let index = 1; index < values.length; index += 1) {
    assert.ok(values[index] > values[index - 1], `${TOKEN_NAMES[index]} must be above ${TOKEN_NAMES[index - 1]}`);
  }
});
```

Add contract assertions for these exact semantic uses:

```js
test('global surfaces consume semantic layer tokens', async () => {
  const [waves, nav, player, settings, messages, transition] = await Promise.all([
    read('src/components/BannerWaves.astro'),
    read('src/styles/immersive-nav.css'),
    read('src/components/SekaiPlayer.astro'),
    read('src/components/VisualSettingsPanel.astro'),
    read('src/styles/message-board.css'),
    read('src/components/PageTransitionEnhancer.astro'),
  ]);

  assert.match(waves, /\.banner-waves[\s\S]*?z-index:\s*var\(--z-decoration\)/);
  assert.match(nav, /\.site-header[\s\S]*?z-index:\s*var\(--z-nav\)/);

  assert.match(player, /\.sekai-player-btn[\s\S]*?z-index:\s*var\(--z-floating\)/);
  assert.match(player, /\.sekai-player-panel[\s\S]*?z-index:\s*var\(--z-overlay\)/);

  assert.match(settings, /\.hero-settings-btn[\s\S]*?z-index:\s*var\(--z-floating\)/);
  assert.match(settings, /\.hero-settings-panel[\s\S]*?z-index:\s*var\(--z-overlay\)/);

  assert.match(messages, /\.message-drawer[\s\S]*?z-index:\s*var\(--z-overlay\)/);
  assert.match(messages, /\.message-composer-backdrop[\s\S]*?z-index:\s*var\(--z-modal\)/);

  assert.match(transition, /#page-transition-progress[\s\S]*?z-index:\s*var\(--z-toast\)/);
  assert.match(transition, /#page-transition-progress[\s\S]*?pointer-events:\s*none/);
});
```

Add a regression assertion forbidding only the known migrated global magic numbers in the files being migrated:

```js
test('migrated global surfaces no longer depend on legacy magic z-index values', async () => {
  const files = await Promise.all([
    read('src/styles/immersive-nav.css'),
    read('src/components/SekaiPlayer.astro'),
    read('src/components/VisualSettingsPanel.astro'),
    read('src/styles/message-board.css'),
    read('src/components/PageTransitionEnhancer.astro'),
  ]);
  const joined = files.join('\n');
  for (const value of ['9998', '9999', '10000', '10020', '10050']) {
    assert.doesNotMatch(joined, new RegExp(`z-index:\\s*${value}\\b`));
  }
});
```

- [ ] **Step 2: Add the new test to `test:site`**

Append `tests/global-layer-system.test.mjs` to the existing `test:site` command in `package.json` without removing any current test files.

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
node --test tests/global-layer-system.test.mjs
```

Expected: FAIL because the shared tokens do not exist yet and the migrated components still use numeric z-index values.

- [ ] **Step 4: Commit the RED contract**

```bash
git add tests/global-layer-system.test.mjs package.json
git commit -m "test: define global layer contract"
```

---

### Task 2: Define Shared Tokens and Migrate Decoration, Navigation, and Passive Status

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/components/BannerWaves.astro`
- Modify: `src/styles/immersive-nav.css`
- Modify: `src/components/PageTransitionEnhancer.astro`
- Test: `tests/global-layer-system.test.mjs`

**Interfaces:**
- Consumes: the seven token names fixed by Task 1.
- Produces: shared CSS layer scale available to every component; decoration/nav/toast mappings.

- [ ] **Step 1: Add the seven global tokens under the first `:root` in `src/styles/global.css`**

Add exactly:

```css
  --z-decoration: 10;
  --z-content: 100;
  --z-floating: 1000;
  --z-nav: 2000;
  --z-overlay: 3000;
  --z-modal: 4000;
  --z-toast: 5000;
```

Keep them together with a short comment such as `/* Global stacking contract */`. Do not duplicate the tokens in theme selectors.

- [ ] **Step 2: Migrate banner waves to decoration**

In `src/components/BannerWaves.astro`, replace the global `.banner-waves` value:

```css
z-index: 15;
```

with:

```css
z-index: var(--z-decoration);
```

Retain `pointer-events: none` on the wave container and its children.

- [ ] **Step 3: Migrate immersive navigation to nav**

In `src/styles/immersive-nav.css`, replace:

```css
z-index: 10020;
```

on `body.layout-immersive .site-header` with:

```css
z-index: var(--z-nav);
```

Do not change the local `site-floating-controls` value in this step unless it is a true global launcher that must consume `--z-floating`; internal/legacy local ordering can remain untouched when it does not violate the approved contract.

- [ ] **Step 4: Migrate page transition progress to toast**

In `src/components/PageTransitionEnhancer.astro`, replace:

```css
z-index: 10050;
```

with:

```css
z-index: var(--z-toast);
```

Keep:

```css
pointer-events: none;
```

unchanged.

- [ ] **Step 5: Run the focused contract test**

Run:

```bash
node --test tests/global-layer-system.test.mjs
```

Expected: still FAIL only on the player/settings/message-board mappings that Task 3 has not migrated yet; token-order, waves, nav, and progress assertions should pass.

- [ ] **Step 6: Commit the base layer system**

```bash
git add src/styles/global.css src/components/BannerWaves.astro src/styles/immersive-nav.css src/components/PageTransitionEnhancer.astro
git commit -m "refactor: establish global layer tokens"
```

---

### Task 3: Migrate Expanded Interactive Surfaces

**Files:**
- Modify: `src/components/SekaiPlayer.astro`
- Modify: `src/components/VisualSettingsPanel.astro`
- Modify: `src/styles/message-board.css`
- Test: `tests/global-layer-system.test.mjs`

**Interfaces:**
- Consumes: `--z-floating`, `--z-overlay`, and `--z-modal` from Task 2.
- Produces: approved launcher/navigation/overlay/modal ordering for the known interactive surfaces.

- [ ] **Step 1: Migrate the SEKAI launcher and panel**

In `src/components/SekaiPlayer.astro`, change only the two global surface assignments:

```css
.sekai-player-btn {
  /* ... */
  z-index: var(--z-floating);
}

.sekai-player-panel {
  /* ... */
  z-index: var(--z-overlay);
}
```

Do not alter local z-index values for the dock cover, visualizer, icon, header, body, CD visualizer, or other internal composition.

- [ ] **Step 2: Migrate the visual settings launcher and panel**

In `src/components/VisualSettingsPanel.astro`, replace the launcher/panel numeric values with:

```css
.hero-settings-btn {
  /* ... */
  z-index: var(--z-floating);
}

.hero-settings-panel {
  /* ... */
  z-index: var(--z-overlay);
}
```

Do not change panel dimensions, colors, placement, or transition behavior.

- [ ] **Step 3: Migrate message board drawer and composer**

In `src/styles/message-board.css`, use:

```css
.message-composer-backdrop {
  /* ... */
  z-index: var(--z-modal);
}

.message-drawer {
  /* ... */
  z-index: var(--z-overlay);
}
```

Keep sticky-note local values (`20`, `40`, etc.) unchanged because they only order notes inside the board stage.

- [ ] **Step 4: Inspect ancestors for stacking-context traps**

For each expanded fixed surface above, verify its DOM ancestry does not place it inside an ancestor with a lower global stacking context created by `transform`, `filter`, `opacity < 1`, `isolation`, or positioned `z-index`.

Use source inspection first. If no trap exists, make no structural change. If a trap is found, make the smallest CSS/DOM correction that lets the fixed surface participate in the global layer scale; do not introduce a portal unless no smaller correction can satisfy the contract.

- [ ] **Step 5: Run the focused layer contract and verify GREEN**

Run:

```bash
node --test tests/global-layer-system.test.mjs
```

Expected: PASS all layer-system tests.

- [ ] **Step 6: Run the component-adjacent tests**

Run:

```bash
node --test \
  tests/message-board-page.test.mjs \
  tests/message-board-layout.test.mjs \
  tests/message-board-gesture.test.mjs \
  tests/sekai-player-search.test.mjs \
  tests/visual-settings.test.mjs \
  tests/banner-waves.test.mjs \
  tests/fullscreen-navbar-top.test.mjs
```

Expected: PASS with no behavioral regression.

- [ ] **Step 7: Commit interactive surface migration**

```bash
git add src/components/SekaiPlayer.astro src/components/VisualSettingsPanel.astro src/styles/message-board.css
git commit -m "fix: keep expanded panels above navigation"
```

---

### Task 4: Full Verification and Pull Request

**Files:**
- Verify: all files changed by Tasks 1–3
- No production file additions beyond the approved spec/plan/tests/CSS edits.

**Interfaces:**
- Consumes: complete semantic layer migration.
- Produces: one reviewable frontend-only PR against `main`.

- [ ] **Step 1: Run the complete site test suite**

Run:

```bash
npm run test:site
```

Expected: PASS all site tests, including `tests/global-layer-system.test.mjs`.

- [ ] **Step 2: Run production type-check and build**

Run:

```bash
npm run build
```

Expected: `astro check` succeeds and `astro build` completes successfully.

- [ ] **Step 3: Run the repository's full verification command**

Run:

```bash
npm test
```

Expected: PASS. This intentionally repeats build + site tests as the final release gate.

- [ ] **Step 4: Review the final diff for scope discipline**

Confirm:

```text
- shared layer tokens appear once in global.css
- launcher buttons use --z-floating
- navigation uses --z-nav
- expanded non-blocking panels/drawers use --z-overlay
- blocking composer uses --z-modal
- waves use --z-decoration
- page progress uses --z-toast and pointer-events:none
- internal component z-index values were not broadly rewritten
- no Worker/D1 files changed
```

- [ ] **Step 5: Open a pull request against `main`**

Use title:

```text
fix: unify global overlay layer priorities
```

Use body:

```markdown
## Summary
- add a shared semantic z-index scale for global site surfaces
- keep decorative waves below real UI and launchers below navigation
- keep expanded player/settings/message surfaces above navigation
- add a regression contract preventing the known magic-number layer conflicts

## Verification
- `node --test tests/global-layer-system.test.mjs`
- component-adjacent message/player/settings/banner/nav tests
- `npm run test:site`
- `npm run build`
- `npm test`

Frontend-only change; no Cloudflare Worker or D1 deployment required.
```

Create the PR as Draft until all checks are green, then mark it Ready for review. Do not merge without the user's confirmation.
