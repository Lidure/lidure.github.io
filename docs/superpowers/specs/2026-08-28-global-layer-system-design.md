# Global Layer System Design

**Date:** 2026-08-28

## Summary

The site currently assigns `z-index` values independently in many components. This causes expanded interactive surfaces to lose to unrelated layers such as the immersive navigation or banner waves. The fix is to replace ad-hoc stacking numbers with a shared global layer scale and migrate the key interactive surfaces to that scale.

The intended behavior is simple: decorative effects stay behind content; ordinary floating launch buttons stay below navigation; expanded panels, drawers, and dialogs sit above navigation; blocking modals sit above other expanded panels; passive status UI such as the page-transition progress bar may sit at the very top as long as it does not intercept input.

## Goals

1. Establish one shared z-index contract for the whole site.
2. Ensure banner waves, particles, wallpaper effects, and similar decoration can never cover expanded interactive panels.
3. Keep small floating launcher buttons below the site navigation.
4. Ensure expanded surfaces such as the sticky-note composer, message drawer, SEKAI player panel, and visual settings panel sit above navigation.
5. Keep blocking modal/confirmation surfaces above ordinary expanded panels.
6. Preserve the page-transition progress bar as the highest passive layer with `pointer-events: none`.
7. Prevent future regressions by testing the layer contract rather than relying on magic numbers.

## Non-goals

- No portal/teleport rewrite of existing Astro components.
- No redesign of navigation, player, message board, or visual settings appearance.
- No change to interaction semantics, keyboard behavior, dragging, polling, or persistence.
- No broad refactor of every local `z-index` used inside a component for internal composition (for example icon-on-cover or note-on-board ordering).

## Layer Scale

Define the shared layer tokens once in global CSS, under `:root`:

```css
--z-decoration: 10;
--z-content: 100;
--z-floating: 1000;
--z-nav: 2000;
--z-overlay: 3000;
--z-modal: 4000;
--z-toast: 5000;
```

The exact numeric spacing is intentionally generous. Components consume semantic tokens instead of inventing their own large values.

### Layer meanings

| Token | Intended use |
| --- | --- |
| `--z-decoration` | Wallpaper effects, banner waves, particles, purely decorative canvases |
| `--z-content` | Main page surfaces and content roots when an explicit layer is needed |
| `--z-floating` | Closed-state floating launchers and utility buttons |
| `--z-nav` | Header, immersive navigation, mobile navigation panel |
| `--z-overlay` | Expanded non-blocking panels, drawers, popovers, player windows |
| `--z-modal` | Blocking composer/modal/confirmation surfaces and their backdrops |
| `--z-toast` | Passive top-level status such as page transition progress or toast UI |

## Component Migration

### Banner waves and decoration

`BannerWaves.astro` currently owns a local `z-index: 15`. It will move to `var(--z-decoration)`. Decorative layers must remain `pointer-events: none`.

Other decorative canvases or particles found during implementation should use the same decoration token when they participate in the global stacking context. Internal z-index values inside an isolated decorative component do not need conversion unless they escape that component.

### Navigation

`immersive-nav.css` currently gives the site header `z-index: 10020`. The header and mobile navigation panel will use `var(--z-nav)`.

Ordinary site navigation in standard layouts should follow the same semantic layer when it has an explicit global z-index.

### Floating launcher buttons

The collapsed SEKAI player button and the background/appearance settings button will use `var(--z-floating)`.

This preserves the approved rule that the launcher itself should not cover the navigation.

### Expanded player and settings panels

The expanded SEKAI player panel and visual settings panel will use `var(--z-overlay)`.

The closed launcher button remains in `--z-floating`; opening the panel changes only the panel layer, not the button layer.

### Message board surfaces

The message detail drawer is an expanded non-blocking surface and will use `var(--z-overlay)`.

The sticky-note composer includes a page-covering backdrop and blocks interaction with the board while open, so it will use `var(--z-modal)` rather than ordinary overlay.

This guarantees both surfaces remain above banner waves and navigation.

### Page transition progress

`PageTransitionEnhancer.astro` currently uses `z-index: 10050`. It will use `var(--z-toast)` and retain `pointer-events: none`.

## Stacking Context Rules

Semantic z-index tokens only work predictably when an ancestor does not trap a surface inside a lower stacking context. During implementation, each migrated expanded surface must be checked for ancestors that create stacking contexts through properties such as `transform`, `filter`, `opacity < 1`, `isolation`, or positioned elements with z-index.

If an expanded fixed-position surface is already rendered near the document root, keep the existing DOM structure. If an ancestor stacking context prevents the new token from winning globally, fix the relevant stacking context with the smallest possible structural/CSS change. Do not introduce a portal unless the existing DOM makes the contract impossible to satisfy.

## Interaction Rules

The following ordering must always hold:

```text
decoration < content < floating launcher < navigation < expanded overlay < modal < passive top status
```

Examples:

- Banner waves must be below the sticky-note composer and message drawer.
- Immersive navigation must be above the collapsed SEKAI launcher.
- An open SEKAI player panel must be above immersive navigation.
- An open visual settings panel must be above navigation, while its launcher remains below navigation.
- The sticky-note composer modal must be above navigation and ordinary overlay panels.
- The page-transition progress bar may render above all of them but must never capture pointer input.

## Testing Strategy

Add a layer-contract test that reads the relevant source/CSS and asserts:

1. All seven root layer tokens exist in one shared global location and are strictly ordered.
2. Banner waves use `--z-decoration`.
3. Immersive navigation uses `--z-nav` and no longer uses the old `10020` magic number.
4. SEKAI launcher uses `--z-floating`; SEKAI panel uses `--z-overlay`.
5. Visual settings launcher uses `--z-floating`; visual settings panel uses `--z-overlay`.
6. Message drawer uses `--z-overlay`; message composer backdrop uses `--z-modal`.
7. Page-transition progress uses `--z-toast` and remains non-interactive.
8. Migrated global surfaces do not retain the replaced high-value magic numbers.

Existing site tests must remain green. If a browser-level layer regression test already exists in the repository, extend it; otherwise the source-level contract test is sufficient for this bounded set of known stacking relationships.

## Rollout

Implement on `feat/global-layer-tokens`, run the full test suite and build, then open a pull request against `main`. No Cloudflare Worker or D1 migration is required because the change is frontend-only.

## Acceptance Criteria

- Opening the sticky-note composer always places it above banner waves and navigation.
- Opening the message drawer always places it above banner waves and navigation.
- On immersive pages, the expanded SEKAI player panel appears above the site navigation.
- The collapsed SEKAI player button remains below navigation.
- The background/appearance settings panel appears above navigation, while its closed launcher remains below navigation.
- No migrated component depends on `9998`, `9999`, `10000`, `10020`, or `10050` for global ordering.
- Shared layer tokens are the single documented source of truth for global stacking order.
- Full site tests and production build pass.
