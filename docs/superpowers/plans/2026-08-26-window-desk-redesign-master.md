# Window Desk Redesign Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the approved 「窗边书桌 × 潮汐纸页」 redesign through four independently testable checkpoints without losing existing wallpaper, player, Moments, message, or accessibility behavior.

**Architecture:** The redesign is intentionally split into four plans because the approved spec spans multiple independently reviewable subsystems. Execute them strictly in order on `redesign/window-desk-tide-paper`; each plan ends with a build/regression checkpoint, and legacy CSS is not deleted until the final cleanup plan.

**Tech Stack:** Astro 6, TypeScript, CSS custom properties, Node built-in test runner, GitHub Actions/Pages.

**Spec:** `docs/superpowers/specs/2026-08-26-window-desk-tide-paper-design.md`

## Global Constraints

- Final direction: `70% 日常小清新 + 30% ACG 个人气质`.
- Preserve wallpaper/theme hue/visual settings/waves/player/transitions and existing business APIs.
- Ordinary UI/body font is Zen Maru Gothic; Ma Shan Zheng is limited to site-name/rare handwritten accents; code font is unchanged.
- Final ordinary-page CSS vocabulary is semantic, not versioned: `tokens.css`, `site-shell.css`, `home.css`, `article.css`, `moments.css`, `pages.css`.
- Do not delete legacy Firefly styles until Plans 01–03 are green and Plan 04 has replacement behavior tests.
- Never weaken an existing functional regression solely because its old visual assertion became obsolete; migrate the behavior assertion to a new semantic test first.

## Authoritative Cross-Plan Clarifications

These clarifications override any subordinate-plan snippet that could be read differently:

1. **Reading progress is independent from TOC visibility.** `ArticleToc.astro` (or the final article reading component) must mount the reading progress indicator for every article. When eligible H2/H3 count is `< 2`, hide only desktop/mobile TOC navigation, not the progress indicator. A valid implementation is to pass `showToc` into the component and render progress unconditionally.
2. **Theme accent keeps the current default hue fallback.** The canonical token is `--accent: hsl(var(--theme-hue, 255) ...);`. Tests must match `var(--theme-hue, 255)` (or allow the optional fallback) rather than requiring `var(--theme-hue)` with no fallback.
3. **Footer year must not become stale.** Render the current year from Astro/server-side JavaScript (`const currentYear = new Date().getFullYear()`) and interpolate it; the visible copy remains `搁浅的小窝 · {currentYear}`.
4. **Recent Moments failure is silent.** Homepage recent-Moments preview stays hidden when the API returns no items or throws; it must not produce an error card that becomes a permanent homepage feature.
5. **Special experiences stay special.** `/player` and `/sekai-quest` keep their independent scene styling; cleanup only removes ordinary-page Firefly visual layers and shared rules that have semantic replacements.

## Execution Order

- [ ] **Checkpoint 01 — Foundation & Home**

Execute `docs/superpowers/plans/2026-08-26-window-desk-01-foundation-home.md` completely. Before accepting the token test, ensure its accent assertion accepts the canonical fallback form, for example:

```js
assert.match(tokens(), /--accent:\s*hsl\(var\(--theme-hue(?:,\s*255)?\)/);
```

Required checkpoint:

```bash
npm run build
npm run test:site
```

Both must pass before Plan 02.

- [ ] **Checkpoint 02 — Article Reading**

Execute `docs/superpowers/plans/2026-08-26-window-desk-02-article-reading.md`. Apply clarification #1: render the progress element unconditionally and wrap only the TOC navigation in `showToc`.

Recommended final component contract:

```astro
---
type Entry = { depth: number; slug: string; text: string };
interface Props { entries: Entry[]; showToc: boolean; }
const { entries, showToc } = Astro.props;
---
<div class="article-reading-progress" aria-hidden="true"><span></span></div>
{showToc && (
  <>
    <nav class="article-toc article-toc-desktop" aria-label="文章目录">...</nav>
    <details class="article-toc article-toc-mobile">...</details>
  </>
)}
```

And the page always mounts it:

```astro
<ArticleToc entries={tocEntries} showToc={showToc} />
```

Required checkpoint:

```bash
npm run build
npm run test:site
```

- [ ] **Checkpoint 03 — Moments & Public Pages**

Execute `docs/superpowers/plans/2026-08-26-window-desk-03-moments-public-pages.md`. Apply clarification #3 to the footer instead of hardcoding `2026`:

```astro
---
const currentYear = new Date().getFullYear();
---
<strong>搁浅的小窝 · {currentYear}</strong>
```

Required checkpoint:

```bash
npm run build
npm run test:site
```

- [ ] **Checkpoint 04 — Legacy Cleanup & Final Verification**

Execute `docs/superpowers/plans/2026-08-26-window-desk-04-legacy-cleanup-final.md` only after the first three checkpoints are green. The final cleanup test and shell-behavior test become the safety net before old Firefly files/tests are removed.

Required final verification:

```bash
npm run build
npm run test:site
```

Then run code review, apply review fixes, rerun both commands on the exact PR head, open the PR, wait for required checks, merge, and verify the GitHub Pages deployment run associated with the merge commit.

## Self-Review Result

- **Spec coverage:** foundation/theme, homepage, navigation, article/TOC, Moments, posts/archive/tags/messages/About/search/footer, responsive behavior, accessibility, API fallbacks, legacy cleanup, tests, PR/deployment are each assigned to an explicit checkpoint.
- **Placeholder scan:** subordinate plans contain concrete paths, selectors, commands, interfaces, and expected outcomes; no `TBD`, `TODO`, or deferred implementation requirement is part of the execution contract.
- **Type/interface consistency:** `homePresence.now` is `{ label; value; href? }`; article TOC entries are `{ depth; slug; text }`; existing `fetchMoments({ limit, signal })` and `getGitHubProjects()` interfaces are reused without creating competing API layers.
- **Scope boundary:** business APIs, player runtime, SEKAI gameplay, upload/auth/comment storage are regression-protected dependencies, not redesign targets.
