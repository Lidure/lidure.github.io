# Firefly-inspired Home / Visual v4 Design

Status: approved in chat; implementation not started.

Branch: `feat/firefly-home-visual-v4`

Base: current `main` after Firefly visual/background v3.

## 1. Goal

The v4 pass should make the homepage feel more coherent, lively, and closer to the interaction language of Firefly without copying Firefly source code or assets.

The approved scope is:

1. Add a Firefly-style layered animated water-wave boundary between wallpaper/banner and page content.
2. Redesign the Background & Appearance settings panel so its information hierarchy and color system are calmer and more coherent.
3. Add up to three pinned Moments; pinning a fourth automatically unpins the oldest pinned Moment.
4. Refine the homepage music widget: the play/pause control appears only on cover hover/focus on desktop; while playing, the cover gets a restrained animated multicolor border.
5. Rework homepage article cards and cover presentation toward Firefly's list-card visual language.
6. Show the latest three public guestbook messages on the homepage.
7. Add Firefly-style social icon links to the profile card for GitHub and QQ.
8. Preserve all existing v3 wallpaper modes, media library/upload logic, Sakura renderer, player source-of-truth, and accessibility behavior.

## 2. Non-goals

- Do not copy Firefly implementation code, wave assets, icons, or CSS verbatim.
- Do not replace the SEKAI player's playback state or create another audio element.
- Do not create a second settings storage key; `hero_settings` remains the single visual settings source of truth.
- Do not move full guestbook comments, moderation controls, or message composer onto the homepage.
- Do not add more than three pinned Moments.
- Do not make the entire site use heavy RGB/glow effects.
- Do not alter `/player` wallpaper layout behavior.

## 3. Homepage information architecture

Keep the current three-column desktop architecture.

### Left sidebar

The left sidebar is simplified into three major areas:

1. Profile / About Me
2. Compact quick navigation
3. Common tags

The profile card contains:

- existing avatar
- site/user display name
- existing short introduction
- article count
- tag count
- a compact social-icon row

Social links are icon-only at rest, with accessible labels and a small tooltip on hover/focus.

Approved social links:

- GitHub: `https://github.com/Lidure`
- QQ: restore and reuse the historical blog link exactly: `https://qm.qq.com/q/ujOhar9jQQ`

The previous large text-style contact buttons must not return.

### Main column

Keep the featured area and latest-post section, but the normal post list is redesigned using the article-card rules in section 7.

### Right sidebar

Use this order:

1. Recent Moments
2. Recent Messages
3. Music
4. Site statistics
5. Existing small notice may remain after statistics if it still fits cleanly; it is not a v4 focus.

The right sidebar should feel like a "site activity" rail rather than a stack of unrelated colorful widgets.

## 4. Water-wave wallpaper boundary

### 4.1 Visual model

Use a Firefly-inspired four-layer gentle wave system.

The implementation must be original but follow this visual strategy:

- render an immediate static SVG first frame in HTML so the content boundary is visible before JavaScript starts;
- hand over to Canvas 2D animation after initialization;
- keep the SVG visible until the Canvas has rendered its first valid frame, then hide the SVG without a visible jump;
- keep four wave layers with different vertical offsets, opacity, and movement durations;
- the wave fill color should match the effective page/content surface so the content visually "flows upward" over the wallpaper;
- in fullscreen-home mode, match the effective first content-surface color/alpha rather than forcing an opaque unrelated page color;
- movement should be slow and soft, not ocean-surf or high-amplitude sine waves.

Recommended default layer motion should use four differentiated slow cycles in the same general cadence as Firefly (roughly 8–12 seconds), but not duplicate Firefly's renderer/constants exactly.

### 4.2 Where waves display

`banner` wallpaper mode:
- display at the lower boundary of the banner on standard pages;
- homepage, posts, Moments, Messages, and other standard banner pages may use it.

`fullscreen` wallpaper mode:
- homepage: display at the bottom of the first 100vh wallpaper viewport to mark entry into content;
- non-home standard pages: do not display a wave because there is no discrete hero boundary.

`/player`:
- never display waves.

### 4.3 Responsive geometry

Desktop:
- target visible wave height: about 12–15vh;
- clamp to a practical minimum/maximum so ultrawide and very short screens remain sane.

Mobile:
- target around 8–10vh;
- lower amplitude and rendering cost;
- wave can be disabled independently through `waveMobile`.

### 4.4 Reduced motion

If either site setting `reduceMotion` or `prefers-reduced-motion: reduce` is active:

- stop continuous Canvas wave animation;
- keep the static layered SVG wave visible;
- do not remove the wallpaper-to-content boundary.

### 4.5 Settings

Add these fields to `hero_settings`:

```js
{
  waveEnabled: true,
  waveStrength: "standard", // soft | standard | strong
  waveSpeed: "normal",      // slow | normal | fast
  waveMobile: true
}
```

Wave strength affects both amplitude and effective layer opacity.

Wave speed affects phase/movement speed only, not shape.

## 5. Background & Appearance settings center redesign

### 5.1 Core principle

The problem with the current panel is visual priority, not missing functionality.

The new panel keeps the three tabs but redesigns the visual shell and grouping:

- Appearance
- Background
- Effects

Large areas use neutral translucent surfaces.

The active theme hue should be used only for selected tabs, enabled controls, slider progress, and a few small accent icons. Pink, cyan, purple, and warm colors must not all compete inside the panel.

### 5.2 Desktop panel

Target width: about 430–450px.

Use:

- neutral frosted panel shell;
- subtle border;
- moderate blur;
- restrained shadow;
- rounded corners consistent with the rest of v4;
- grouped setting cards with spacing-based hierarchy.

Header:

- title: `背景与外观`
- short helper line such as `Customize your space`
- close button

Tabs use a segmented-control appearance.

### 5.3 Appearance tab

Contains only page/card appearance controls:

- theme hue
- card opacity
- card border
- card follows theme

Do not duplicate unrelated wallpaper controls here.

### 5.4 Background tab

Contains:

#### Wallpaper group
- banner / fullscreen segmented selector
- enable background
- autoplay
- interval
- overlay strength
- fullscreen blur (only in fullscreen mode)
- fullscreen card opacity mirror (same underlying `cardOpacity`, not a second state)

#### Banner effects group
Shown when relevant:

- banner gradient
- banner title
- water waves
- wave strength segmented selector
- wave speed segmented selector
- waves on mobile

#### Media group
Make media management visually separate from switches:

- quality
- add media entry
- URL entry
- background library card with media count and chevron

The existing media upload/library/preview business logic remains owned by the existing media/slideshow subsystem. Existing critical media-control IDs/interfaces should be retained where practical so the redesign does not rewrite media business logic merely for appearance.

### 5.5 Effects tab

Contains:

- Sakura enable
- Sakura density
- Sakura speed
- reduce motion

Wave controls remain in Background because waves belong to the wallpaper/content boundary rather than generic decoration.

### 5.6 Mobile panel

On small screens the settings UI becomes a bottom-sheet style surface rather than a narrow floating desktop card.

Requirements:

- max height around 82–88dvh;
- independent internal scrolling;
- `safe-area-inset-bottom` support;
- persistent header/close affordance;
- segmented tabs remain usable by touch;
- no horizontal overflow at 390px viewport width.

### 5.7 Settings storage version

Keep storage key `hero_settings` and migrate to conceptual version 3.

```js
{
  version: 3,

  enabled: true,
  wallpaperMode: "banner",
  autoplay: true,
  interval: 15000,
  opacity: 0.45,
  backgroundBlur: 6,
  bannerGradient: true,
  bannerTitle: true,

  waveEnabled: true,
  waveStrength: "standard",
  waveSpeed: "normal",
  waveMobile: true,

  themeHue: 340,
  cardOpacity: 0.92,
  cardBorder: true,
  cardFollowTheme: false,

  sakura: true,
  sakuraDensity: 0.65,
  sakuraSpeed: 1,
  reduceMotion: false,

  quality: "high"
}
```

Migration rules:

- preserve every existing user value;
- add missing v3 fields only;
- all writes remain merge-safe;
- media/library data must never be deleted by visual reset;
- reset-current-tab resets only fields owned by that tab.

## 6. Pinned Moments

### 6.1 Data model

Moment API objects gain:

```ts
pinned?: boolean;
pinnedAt?: number;
```

D1 persistence uses non-destructive columns conceptually equivalent to:

```sql
pinned INTEGER NOT NULL DEFAULT 0,
pinned_at INTEGER NULL
```

`pinned_at` stores epoch milliseconds so it maps directly to the frontend `pinnedAt: number` contract.

### 6.2 Maximum of three pins

The backend is authoritative.

Pin operation algorithm:

1. If the target is already pinned, the operation is a no-op and MUST preserve its existing `pinnedAt`; repeatedly clicking pin must not reorder pinned items.
2. Count currently pinned Moments.
3. If fewer than three are pinned, pin the target with the current epoch-millisecond pin timestamp.
4. If three are already pinned, find the item with the oldest `pinnedAt`, unpin it, then pin the new target.
5. Perform the displacement and new pin together using D1 batch/transaction-equivalent semantics so a successful request never leaves four pinned rows.

Unpin clears `pinned` to false/0 and `pinnedAt`/`pinned_at` to null.

### 6.3 API

Add one dedicated authenticated admin mutation:

```http
PATCH /api/moments/:id/pin
Content-Type: application/json
Cookie: existing admin session

{ "pinned": true }
```

Unpin uses the same route with `{ "pinned": false }`.

The route must reuse the existing Moments session/auth requirement.

Frontend client API exposes:

```ts
setMomentPinned(momentId, pinned)
```

The response returns the updated target item and, when a fourth pin displaced an older pin, enough updated state for the frontend to refresh deterministically. A simple `{ item, displacedId? }` contract is acceptable.

Do not encode pinning as a local-only preference.

### 6.4 Sorting and pagination

Public list behavior is explicitly defined so pins do not break the existing cursor model.

First request with no cursor:

1. fetch up to three pinned Moments ordered by `pinned_at DESC`;
2. fetch unpinned Moments ordered by existing `date DESC, id DESC`;
3. return pinned items first and fill the remaining requested `limit` with unpinned items;
4. total returned item count MUST NOT exceed `limit`.

Subsequent requests with a cursor:

- cursor pagination applies only to `pinned = 0` rows;
- pinned rows are excluded from all cursor pages;
- keep the existing date/id cursor semantics for the unpinned stream.

This prevents pinned rows from appearing again on page 2 and avoids changing the cursor format solely for pinning.

### 6.5 UI

Full Moments page:

- pinned items show a restrained pin marker;
- admin mode exposes `置顶` / `取消置顶`;
- pin/unpin preserves existing reactions/comments/media UI.

Homepage Recent Moments:

- keep the existing maximum capacity of three entries;
- pinned items occupy the first slots in pin order;
- fill any remaining slots with the latest unpinned items;
- if three items are pinned, the homepage widget shows those three pinned items and does not expand beyond its current height.

## 7. Homepage article cards

### 7.1 Desktop list layout

Use a Firefly-inspired inset-cover list card.

For posts with a cover:

- content section: about 66–68%;
- inset cover: about 32–34%;
- cover has its own rounded corners and margin from card edges;
- card title remains the dominant text element;
- metadata directly below title shows published date plus a restrained subset of category/tags available in the current blog model;
- description clamps to two lines;
- bottom metadata may show compact reading time and remaining tag information, but should not duplicate the same label in two places.

Hover:

- card rises only slightly;
- cover scales about 1.04–1.06;
- cover receives a subtle dark overlay;
- a restrained enter/chevron indicator appears over the cover;
- no heavy glow.

Cover selection priority remains exactly the v3 behavior:

1. frontmatter `cover`;
2. first Markdown image;
3. no image -> text-only card.

Relative Markdown image resolution must remain build-safe.

### 7.2 No-cover cards

Do not create fake placeholders.

Use a text-first card with a subtle enter area/chevron so the right side does not feel visually broken.

### 7.3 Mobile

Below the existing mobile breakpoint:

- image moves above copy;
- use a wide cover ratio around 16:9;
- title/metadata/description/tags flow below;
- avoid squeezed desktop side-by-side layout.

## 8. Homepage music widget

The existing SEKAI player remains the single playback source of truth.

### 8.1 Resting state

Desktop resting state:

- large square cover remains the primary visual;
- current track title remains one restrained line;
- previous/next buttons remain available in the lower control row;
- the central play/pause control is visually hidden when the cover is not hovered/focused.

### 8.2 Hover/focus behavior

On desktop pointer hover or keyboard focus within the cover control:

- dim cover slightly;
- fade/scale the central play/pause control in;
- keep the control fully keyboard accessible.

On coarse-pointer/mobile devices:

- do not rely on hover or tap-to-reveal state;
- keep the central play/pause control persistently visible at restrained opacity;
- tapping the control toggles playback;
- tapping the non-control cover area keeps the existing open-full-player behavior.

### 8.3 Playing visual

Only while the existing player reports actual playing state:

- add a thin animated multicolor ring/glow around the cover;
- palette: restrained pink -> violet -> cyan -> warm pink -> pink;
- low saturation relative to a typical RGB gamer effect;
- one rotation/cycle around 6–9 seconds;
- pause animation when playback pauses.

Use a pseudo-element / mask / gradient technique so the effect does not alter cover image layout.

If reduced motion is active:

- retain a static multicolor border;
- stop continuous color rotation.

## 9. Recent Messages homepage widget

Create a small homepage-only recent guestbook component.

Data source:

- reuse `fetchGuestMessages()` from `src/lib/public-interactions.ts`;
- do not create another message API.

Display exactly the latest three public messages when available.

Each preview includes:

- user ID / nickname;
- compact formatted time;
- at most 1–2 lines of message text.

Do not show on homepage:

- message comment widgets;
- delete/admin controls;
- full message composer.

Each message preview and the widget footer both link to `/messages`.

Loading/error states should be quiet and should not collapse the entire sidebar.

## 10. Social contacts

Add icon-only social contacts inside the left profile card.

Approved links:

```ts
[
  { type: "github", href: "https://github.com/Lidure", label: "GitHub" },
  { type: "qq", href: "https://qm.qq.com/q/ujOhar9jQQ", label: "QQ" }
]
```

Behavior:

- both are external links and open safely with appropriate `target`/`rel` handling;
- icon buttons use Firefly-like minimal visual language, but use original/local icon markup rather than copied Firefly assets;
- neutral at rest;
- subtle brand/theme feedback on hover/focus;
- tooltip and accessible name identify the service;
- do not display the QQ number as persistent text.

## 11. Visual language across v4

Use one consistent card system across profile, recent activity, posts, and settings:

- moderate rounded corners;
- subtle borders;
- restrained shadow;
- neutral surfaces;
- theme hue as accent rather than full-card fill;
- avoid simultaneous pink/purple/cyan/warm backgrounds on neighboring cards;
- use spacing and typography for hierarchy.

Animation principles:

- short UI transitions around 160–240ms;
- decorative continuous animation should be slow;
- all decorative motion responds to reduced-motion settings;
- no large bouncy transforms.

## 12. Accessibility

- settings tabs retain proper tab roles and keyboard navigation;
- segmented wave strength/speed controls are keyboard operable;
- social icons have accessible labels;
- QQ and GitHub focus states are visible;
- music play overlay appears on `:focus-visible` as well as hover;
- waves and decorative visual layers are `aria-hidden` and pointer-events none;
- Recent Messages links remain keyboard reachable;
- pinned Moment controls are buttons with clear labels;
- mobile bottom sheet respects safe areas.

## 13. Likely implementation areas

Frontend likely touches:

- `src/components/BlogBanner.astro`
- new `src/components/BannerWaves.astro` or equivalent
- new wave renderer utility
- `src/components/VisualSettingsPanel.astro`
- `src/lib/visual-settings.mjs`
- `src/components/HomeLeftSidebar.astro`
- `src/components/HomeRightSidebar.astro`
- `src/components/RecentMomentsWidget.astro`
- new `src/components/RecentMessagesWidget.astro`
- `src/components/MusicStatusWidget.astro`
- `src/components/HomePostCard.astro`
- homepage/global v4 styles

Moments API/backend likely touches:

- `src/lib/moments-api.ts`
- `danmaku-api/src/moments.ts`
- `danmaku-api/src/index.ts`
- generated/deployed Worker counterpart if the repository requires it
- D1 migration files
- API tests

Tests likely touch/add:

- visual settings migration tests
- wave structural/settings/reduced-motion tests
- article card structural tests
- music hover/playing-state tests
- Recent Messages widget tests
- Moments pinning backend tests, including fourth-pin displacement, pinned no-op, and cursor behavior
- responsive/accessibility structural tests

## 14. Acceptance criteria

1. Banner mode has a four-layer gentle water-wave boundary that animates smoothly and has a static reduced-motion fallback.
2. Homepage fullscreen mode displays the wave at the first-screen boundary; non-home fullscreen and `/player` do not.
3. Background settings exposes wave enable, strength, speed, and mobile controls and persists them in merge-safe `hero_settings` version 3.
4. Settings panel is visually redesigned with neutral grouped surfaces and no competing multi-color control groups.
5. Mobile settings behaves as a bottom sheet and remains usable at 390px width.
6. Up to three Moments can be pinned server-side.
7. Pinning a fourth Moment atomically/effectively unpins the oldest pinned Moment; re-pinning an already pinned item is a no-op and does not change order.
8. First-page Moment list returns pinned-first within the requested limit, while cursor pages contain only unpinned rows with no duplicate pins.
9. Homepage Recent Moments remains capped at three entries and prioritizes pinned items.
10. Homepage article cards use inset covers on desktop and top covers on mobile; cover fallback order remains intact.
11. Music play/pause overlay is hidden at desktop rest and appears on cover hover/focus; mobile keeps a restrained persistent control; playing state produces a restrained animated multicolor ring.
12. Reduced motion freezes the music ring and water waves without removing essential visual boundaries or controls.
13. Homepage right sidebar shows the latest three public guestbook messages and links to `/messages`.
14. Profile card shows GitHub and QQ icon links; QQ uses exactly `https://qm.qq.com/q/ujOhar9jQQ`.
15. Existing wallpaper media library/upload/slideshow, Sakura, guestbook page, comments, reactions, and SEKAI player behavior do not regress.
16. Full frontend test suite, Astro check, static build, and targeted backend Moments tests pass before merge.
17. Final manual/browser QA should cover at minimum 390px, ~768px, and desktop ~1440px layouts if a browser-capable execution environment is available.

## 15. Delivery / merge policy

Implementation happens only on `feat/firefly-home-visual-v4` or a descendant isolated branch.

Do not merge until:

- implementation plan tasks are complete;
- all tests pass;
- Astro check/build pass;
- Moments API pin migration/tests pass;
- temporary verification workflows/files are removed;
- final branch diff is reviewed;
- user-approved behavior above is preserved.
