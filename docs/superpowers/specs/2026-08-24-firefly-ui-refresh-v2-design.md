# Firefly UI Refresh v2 — Design Specification

Date: 2026-08-24
Status: Approved in chat; pending written-spec review
Reference: CuteLeaf/Firefly (layout language and information density), while preserving this site's Project SEKAI identity and existing business logic.

## 1. Background

The first Firefly-inspired refresh moved the site toward a cleaner blog layout, but it over-corrected in several places:

- the standard page shell became too restrained and visually flat;
- the homepage copied the idea of a content/sidebar split without reproducing Firefly's richer widget density;
- the guestbook became too narrow and sparse on desktop;
- the immersive page lost navigation, and its existing hide-UI logic still targets the old `.topbar` selector;
- the SEKAI player and background settings still exist in the DOM, but their discoverability and visibility can be broken by the new shell and immersive-state rules;
- the site lost some of its distinctive Project SEKAI / video / music personality.

The v2 redesign keeps the reliable business logic and rebuilds the presentation shell around it.

## 2. Product Goal

The target balance is:

- roughly 70% Firefly in layout structure, information density, sidebar composition, card hierarchy, and theme-hue layering;
- roughly 30% this site's own identity through video backgrounds, Project SEKAI music, background management, immersive playback, danmaku, and selective pink/purple/cyan accents.

The redesign must make the site feel richer and more cohesive without hiding or deleting existing features.

## 3. Non-Negotiable Principles

1. **No feature loss for visual consistency.** The player and background manager are core product features, not legacy decorations.
2. **Preserve stable business logic.** Do not rewrite HeroSlideshow media/cache/loop behavior, SekaiPlayer playback/import/search, Moments APIs, guestbook APIs, or danmaku APIs unless a verified bug requires it.
3. **Use Firefly as a structural reference, not a clone.** Reproduce useful hierarchy and density, not its exact component implementation.
4. **Colorful does not mean gradient-heavy.** Use a coherent hue system and semantic accent families instead of returning to global glow/gradient soup.
5. **Standard and immersive layouts share interaction primitives.** Navigation and floating controls must behave consistently between page modes.

## 4. Page Architecture

### 4.1 Standard pages

Standard pages use the following stack:

1. persistent background media layer;
2. sticky/overlay site navigation;
3. 48–50vh desktop banner, 34–36vh mobile banner;
4. content panel overlapping the banner by approximately 24–32px;
5. responsive grid shell;
6. footer;
7. persistent floating controls above page content.

The content panel should not feel like a single giant empty sheet. It should contain visible grid structure, widgets, and cards soon after the banner overlap.

### 4.2 Immersive page

`/player` remains full-viewport video/background driven and does **not** render the standard banner or standard footer.

It must render by default:

- site navigation;
- SEKAI player floating entry;
- background settings floating entry;
- immersive controls;
- danmaku controls/composer;
- visualizer/cover content.

Only explicit user interaction with the immersive “hide UI” control may progressively hide these surfaces.

## 5. Shared Navigation

`SiteHeader` is shared by standard and immersive layouts.

### Standard mode

- transparent/lightweight over the banner;
- converts to translucent solid background after scrolling;
- active route is indicated by restrained accent styling;
- desktop shows direct navigation;
- mobile uses the existing collapsible menu behavior.

### Immersive mode

- stays visually lighter than standard scrolled navigation;
- may use a subtle dark transparent gradient/blur to protect readability over video;
- must never disappear solely because `layoutMode="immersive"` is active;
- participates in the immersive hide-UI state machine.

## 6. Unified Floating Controls

A new shared `FloatingControls` surface will become the canonical access point for site-level utilities.

Desktop placement: lower-right vertical stack, respecting the existing SEKAI player button.

Order from bottom upward:

1. existing SEKAI player button — largest and visually dominant;
2. background settings button;
3. theme toggle;
4. back-to-top button.

### Visual hierarchy

- SEKAI button keeps its distinctive record/music identity;
- utility buttons are approximately 40–42px desktop and 36–38px mobile;
- utility controls use soft translucent or tinted square-round buttons, not oversized pills;
- semantic hover accents:
  - background: cyan/teal;
  - theme: pink;
  - back-to-top: purple;
- mobile placement must avoid safe areas, the danmaku composer, and player overlays.

### Behavior

- the existing HeroSlideshow settings panel remains the actual background management UI;
- the floating background button opens that existing panel rather than duplicating its logic;
- the existing SekaiPlayer component remains the actual music player;
- floating controls are persistent across Astro navigation where appropriate;
- standard pages always expose player and background access;
- immersive mode defaults to showing them.

## 7. Immersive Hide-UI State Repair

The old immersive page still targets `.topbar`, which no longer represents the navigation.

The state machine must be updated to use current selectors and explicit groups:

- Stage 0: all UI visible;
- Stage 1: hide site navigation only or reduce primary chrome while preserving player/background access;
- Stage 2: hide shared floating controls and danmaku composer, while keeping visual content;
- Stage 3: hide cover/danmaku/visualizer overlays for a near-pure background experience;
- next activation returns to Stage 0.

The implementation must not rely on obsolete `.topbar` selectors.

## 8. Desktop Standard Grid

### 8.1 Wide desktop (>= 1200px)

Target container width: approximately 1280–1360px.

Grid:

- left sidebar: 220–240px;
- main column: flexible `1fr`;
- right sidebar: 260–300px;
- gap: approximately 16–20px.

This replaces the current sparse “article list + one profile card” composition.

### 8.2 Medium desktop/tablet (850–1199px)

Use two columns:

- main content;
- one combined sidebar.

Left-sidebar widgets move into the surviving sidebar in a logical order.

### 8.3 Mobile (< 850px)

Use a single column. Recommended order:

1. profile/identity widget;
2. featured/latest content;
3. tags/categories;
4. moments/music/site widgets;
5. page-specific content as appropriate.

The layout must not create horizontal scroll or large artificial empty zones.

## 9. Homepage Composition

### Left sidebar — identity/navigation

- profile card;
- article count and unique tag count;
- compact site shortcuts;
- category/tag navigation based on existing metadata.

Do not invent fake metrics.

### Main column — primary content

- optional featured/pinned section;
- latest article list;
- Firefly-like information density: title, description, date, reading time where available, tags, optional cover;
- article cards may use right-side cover on desktop, stacked cover on narrow screens;
- preserve optional `cover` frontmatter support.

The redesign must not force all existing Markdown files to add a new `category` field.

### Right sidebar — dynamic/site widgets

Initial v2 widgets:

- popular/recent tags;
- recent Moments preview;
- site statistics;
- music status widget;
- small announcement/site note.

The music widget is a status/launcher card only. It does not replace the real SekaiPlayer.

## 10. Category / Quick Navigation

Do not introduce a mandatory new category content model during this redesign.

Instead, provide a compact category-like navigation surface using existing information:

- Featured;
- Latest;
- Tags;
- optional high-frequency tag shortcuts.

This provides Firefly-like navigational density without requiring migration of all article frontmatter.

## 11. Guestbook Redesign

The current `max-width: 760px` single-column guestbook is explicitly rejected for desktop.

### Desktop

Target total width: approximately 1180–1240px.

Two-column layout:

- left sticky composer/admin panel: 340–380px;
- right message stream: remaining width.

Left panel contains:

- concise intro;
- user ID field;
- textarea;
- submit action/status;
- admin session/login state.

Right side contains:

- message count / recent-update header;
- message cards in a readable single stream;
- each card: user identity, time, content, comments/action footer;
- delete control only in authenticated admin mode.

### Mobile

Single column:

1. composer/admin panel;
2. message stream.

### Visual direction

- user identity gets a small accent treatment;
- cards may use a very thin theme-colored top edge or subtle tint;
- comments/actions use small clear buttons;
- avoid huge glass panels, blank space, and one-color monotony.

All existing guestbook APIs and IDs required by the business script must be preserved unless tests are updated to an intentionally new contract.

## 12. Color System

The previous “neutral + one pink accent” system is replaced by a hue-layered semantic system inspired by Firefly.

### Core accent families

- primary pink: navigation active state, title marker, primary actions;
- Project SEKAI purple: music/immersive/special states;
- cyan/teal: background/media/settings/status surfaces;
- warm yellow/orange: featured/pinned/warning/highlight states.

### Neutral hierarchy

Light mode:

- lightly tinted page background;
- near-white primary cards;
- slightly tinted secondary widgets;
- stronger hover/active layers.

Dark mode:

- blue-purple charcoal page background rather than flat near-black;
- visibly separated card and elevated-card levels;
- hue-tinted hover/active states;
- borders remain subtle.

### Rule

Most card area remains neutral. Color is introduced through small surfaces, borders, icons, tags, headings, and active states. Only selected emphasis widgets may use restrained gradients.

## 13. Card Hierarchy

Three card levels:

### Primary content card

Use for articles and guest messages.

- radius ~16px;
- subtle border;
- soft shadow;
- comfortable content padding;
- no large hover lift.

### Sidebar widget

- radius 12–14px;
- compact spacing;
- title row + content;
- may use subtle semantic tint.

### Emphasis card

Use sparingly for featured content, music status, or announcement.

- may use a soft gradient edge/tint;
- must remain visually subordinate to the banner/background media.

## 14. Existing Visual Features to Preserve

The redesign must preserve and intentionally integrate:

- background image/video slideshow;
- background settings panel;
- custom background URL/upload/library management;
- HeroSlideshow loop and poster behavior;
- SEKAI player floating entry and full panel;
- local music import;
- online playlist import;
- player search and tag filtering;
- player visualizers;
- Sakura particle option;
- immersive visualizer/cover;
- danmaku stage/composer;
- Moments business behavior;
- guestbook business behavior.

## 15. Visual Patterns to Avoid

Do not restore:

- global gradient soup;
- colorful glow on every card/button;
- meaningless floating blobs/dots;
- giant landing-page CTA composition;
- glassmorphism on all content cards;
- 999px pill styling for all tags/actions;
- large hover lifts everywhere;
- decorative effects that reduce text readability over video.

## 16. Bug / Regression Checklist

The following are hard requirements, not optional polish:

1. `/player` must show site navigation by default.
2. `/player` must show the SEKAI player entry by default.
3. `/player` must show background settings access by default.
4. `/player` must not render the standard banner or standard footer.
5. Immersive hide logic must not reference obsolete `.topbar`.
6. Standard pages must keep player/background controls above content layers and clickable.
7. HeroSlideshow settings actions must remain functional.
8. SekaiPlayer import/search/filter/playback/visualizer behaviors must remain functional.
9. Guestbook desktop layout must not use the old 760px-only shell.
10. Homepage >=1200px must expose distinct left sidebar, main content, and right sidebar regions.
11. Medium and mobile layouts must degrade without overflow.
12. Existing public domain configuration remains `lidure22.xyz` / `api.lidure22.xyz` as currently configured.

## 17. Expected Implementation Surface

Likely new components:

- `src/components/FloatingControls.astro`
- `src/components/HomeLeftSidebar.astro`
- `src/components/HomeRightSidebar.astro`
- optional reusable widget components such as `SidebarWidget.astro`, `MusicStatusWidget.astro`, `RecentMomentsWidget.astro`

Likely modified files:

- `src/layouts/BaseLayout.astro`
- `src/components/SiteHeader.astro`
- `src/pages/index.astro`
- `src/pages/messages.astro`
- `src/pages/player.astro` — selector/state repair only where possible
- `src/styles/firefly-refresh.css`
- immersive navigation/floating-control styles
- regression tests

High-risk files to avoid modifying unless required by a failing test:

- `src/components/HeroSlideshow.astro`
- `src/components/SekaiPlayer.astro`

## 18. Testing Strategy

### Static/source contracts

Add tests that verify:

- standard and immersive layout contracts;
- shared navigation and floating-control rendering;
- no obsolete `.topbar` dependency in immersive hide-state logic;
- homepage three-region contract;
- guestbook wide/two-column desktop contract;
- required player/background control IDs remain mounted.

### Built-output contracts

For built `/player/`:

- contains `layout-immersive`;
- contains `site-header`;
- contains `sekaiPlayerBtn`;
- contains `hero-settings-btn`;
- does not contain standard `blog-banner`;
- does not render standard footer shell.

### Business regression

Retain existing tests for:

- Hero video loop guard;
- Hero saved posters/background behavior;
- Sekai player imported-song search/filtering;
- guestbook admin/delete behavior;
- Moments auth/media behavior;
- public URL/domain configuration.

### Final gate

- `astro check` with no errors;
- `astro build` succeeds;
- complete `npm test` passes;
- temporary CI verification files/workflows are removed before merge;
- final diff contains only intended production/test changes.

## 19. Acceptance Criteria

The redesign is accepted when all three statements are true:

### Firefly-like

The site visibly inherits Firefly's useful qualities: rich responsive grid structure, sidebar widgets, content density, consistent card hierarchy, and hue-layered theme styling.

### Still this site

The video backgrounds, background manager, Project SEKAI player, music status, immersive visualizer, danmaku, and selective PJSK color accents remain obvious and easy to access.

### No hidden regressions

No visual redesign may make an existing core feature disappear, become unclickable, or silently change its business behavior.

## 20. Scope Boundary

This v2 redesign does **not** include:

- replacing the site with Firefly source code;
- migrating to Firefly's configuration system;
- introducing mandatory article categories;
- rewriting the music player;
- rewriting the slideshow engine;
- rewriting Moments/guestbook APIs;
- adding unrelated new backend services.

Those can be considered separately after the shell is stable.
