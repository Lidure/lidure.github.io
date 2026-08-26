# Moments Sunlit Notes V4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the existing compact Moments timeline into a distinctive small-fresh everyday-life “Sunlit Notes” page without changing any backend or interaction contracts.

**Architecture:** Keep the existing `moments.astro` behavior and DOM ownership. Add one deterministic helper for time-of-day labels, render that metadata beside each Moment, and replace the current `moments-life-wall.css` visual language with a paper-note system. Regression tests enforce the new motif and protect picker-hidden behavior.

**Tech Stack:** Astro, TypeScript-in-Astro scripts, CSS, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-26-moments-sunlit-notes-v4-design.md`

## Global Constraints
- No new dependency.
- Do not change Moments API, R2 upload, poster, login, delete, pin, comment, reaction, or lightbox contracts.
- No random layout/decorations.
- Emoji/reaction panels must remain hidden until explicit user action.
- Preserve theme hue, light/dark, fullscreen/overlay wallpaper compatibility.
- Mobile removes all desktop lateral note offsets.

---

### Task 1: Deterministic daypart metadata

**Files:**
- Modify: `src/lib/moments-life-wall.mjs`
- Modify: `src/pages/moments.astro`
- Test: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Produces: `getMomentDaypart(value)` returning `{ key, label, mark }`.
- `key` is one of `morning | day | evening | night`.

- [ ] **Step 1: Write the failing test**

Add assertions that 06:30=>`清晨`, 12:00=>`白昼`, 18:30=>`黄昏`, 23:00=>`深夜`; assert page imports/calls `getMomentDaypart`, and renders `.moment-daypart` with `data-daypart`.

- [ ] **Step 2: Verify RED**

Run: `node --test tests/moments-journal-layout.test.mjs`
Expected: FAIL because `getMomentDaypart` and `.moment-daypart` are absent.

- [ ] **Step 3: Implement helper and renderer**

```js
export function getMomentDaypart(value) {
  const parsed = value instanceof Date ? value : new Date(value);
  const hour = Number.isNaN(parsed.getTime()) ? 12 : parsed.getHours();
  if (hour >= 5 && hour < 11) return { key: 'morning', label: '清晨', mark: '☼' };
  if (hour >= 11 && hour < 17) return { key: 'day', label: '白昼', mark: '·' };
  if (hour >= 17 && hour < 20) return { key: 'evening', label: '黄昏', mark: '◐' };
  return { key: 'night', label: '深夜', mark: '☾' };
}
```

In `buildMomentCard`, append a quiet `span.moment-daypart` before the time and set `data-daypart`.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/moments-journal-layout.test.mjs`
Expected: PASS.

### Task 2: Replace dashboard/card styling with Sunlit Notes motif

**Files:**
- Modify: `src/styles/moments-life-wall.css`
- Test: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Consumes existing `.moment-day`, `.moment-card`, `.card-content`, `.moment-category`, `.moment-daypart`, media, reaction, comment classes.

- [ ] **Step 1: Write failing visual-contract assertions**

Assert CSS contains `--note-paper`, `.moment-card::after` paper-notch/tape motif, text-tab active underline, date-tab styling, deterministic `--note-shift`, daypart selectors, and mobile reset `--note-shift: 0px`. Assert default filter is not a filled pill and card has no large box shadow.

- [ ] **Step 2: Verify RED**

Run targeted test and confirm missing motif assertions fail.

- [ ] **Step 3: Rewrite the CSS visual system**

Implement:
- 920-960px airy shell;
- quiet two-line header with short accent stroke;
- text tabs with active hand-drawn underline;
- attached date tab;
- paper-note cards with 14-18px asymmetric radii, 1px soft border, subtle surface, tiny top-corner tape/notch pseudo-element;
- index-driven max 12px lateral shift using existing `--delay`/new `--note-shift` set by page renderer;
- category pencil-stroke marker;
- daypart micro-colors;
- low-weight footer actions;
- image grids with natural one-image ratio and tidy multi-image arrangements;
- strict `[hidden] { display:none !important; }` for all pickers;
- mobile zero lateral offset;
- reduced-motion removal.

- [ ] **Step 4: Verify GREEN**

Run targeted test, then `npm run build` and `npm run test:site` in branch CI.

### Task 3: Add deterministic note offset and preserve interaction contracts

**Files:**
- Modify: `src/pages/moments.astro`
- Test: `tests/moments-journal-layout.test.mjs`

**Interfaces:**
- Produces inline CSS variable `--note-shift` from card index with fixed sequence `[0, 8, -5, 11, -8, 4]` pixels.

- [ ] **Step 1: Write failing test**

Assert the page contains a fixed shift sequence and sets `--note-shift`; assert no `Math.random` appears in Moments renderer.

- [ ] **Step 2: Verify RED**

Run targeted test; expected FAIL.

- [ ] **Step 3: Implement minimal renderer change**

```ts
const noteShifts = [0, 8, -5, 11, -8, 4];
card.style.setProperty('--note-shift', `${noteShifts[idx % noteShifts.length]}px`);
```

Keep every existing behavior hook unchanged.

- [ ] **Step 4: Run all verification**

Run branch CI with `npm ci`, `npm run build`, `npm run test:site`.
Expected: all commands succeed.

### Task 4: PR cleanup and deployment verification

**Files:**
- Delete temporary branch-only validation workflow before PR if one was added.

- [ ] Review diff against `main`: only Moments helper/page/style/tests plus spec/plan docs.
- [ ] Open PR with screenshots not required, but describe visual intent and preserved behaviors.
- [ ] Merge only after branch validation is green.
- [ ] Verify the production `Deploy to GitHub Pages` build and deploy jobs both succeed.
