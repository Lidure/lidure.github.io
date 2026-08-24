# Firefly Visual & Background v3 Design

Date: 2026-08-24
Branch: `feat/firefly-banner-covers-music`
Status: Design approved in chat; implementation not started

## 1. Goals

This iteration deepens the Firefly-inspired visual system while preserving the blog's existing background media, Project SEKAI music player, immersive `/player` page, article routes, uploads, and persisted user settings.

The target is:

- stronger Firefly-like banner-to-content transition and wallpaper modes;
- richer homepage article presentation with real images;
- Firefly-like large-cover homepage music widget;
- an integrated `Appearance / Background / Effects` settings center;
- higher-quality sakura rendering with better lifecycle/performance;
- strict backward compatibility with current background media and `hero_settings`.

This is not a 1:1 Firefly clone. Existing Lidure/PJSK identity remains authoritative.

## 2. Non-goals

- Do not rewrite the background media library/upload/slideshow business logic.
- Do not replace the existing SEKAI player state or playback pipeline.
- Do not make `/player` depend on the standard-page wallpaper mode.
- Do not introduce a second source of truth for wallpaper/effect settings.
- Do not require every Markdown article to add `cover` frontmatter.
- Do not add Firefly wave effects in the first implementation unless needed later.

## 3. Wallpaper architecture

### 3.1 Standard vs immersive layout remains unchanged

`BaseLayout` keeps its existing page-level modes:

- `standard`
- `immersive`

Wallpaper presentation is a setting **inside standard mode**, not a new `layoutMode`.

`/player` remains immersive regardless of the selected standard-page wallpaper mode.

### 3.2 Standard-page wallpaper modes

Add two standard-page wallpaper modes:

- `banner` — default
- `fullscreen`

`enabled: false` continues to mean no wallpaper; no separate `none` mode is required in the UI.

The selected image/video, slideshow order, uploads, URLs, background library, and autoplay pipeline remain shared between both modes.

### 3.3 Banner wallpaper

Desktop:

- visual height: `60–64vh`, target default `62vh`;
- minimum height chosen to protect short desktop viewports;
- wallpaper spans full viewport width;
- standard content max width remains approximately `1340px`, while the banner copy may use a wider visual allowance up to roughly `1360–1440px`;
- content surface overlaps the banner by `52–56px`, target `56px`;
- bottom of banner receives an `80–120px` soft fade into the page background;
- navigation remains transparent over the banner and becomes translucent/solid after scroll.

Tablet:

- height about `52–56vh`;
- overlap about `40–48px`.

Mobile:

- height about `40–44vh`;
- overlap about `24–32px`;
- smaller title sizing and lighter fade.

The transition should read visually as:

`wallpaper/video → soft fade → overlapping content cards`, not as a hard split.

### 3.4 Fullscreen wallpaper

Homepage:

- wallpaper occupies the first `100vh`;
- navigation overlays the wallpaper;
- homepage content begins after the first viewport;
- content cards may expose the wallpaper through controlled opacity and blur.

Non-home standard pages:

- content starts below the navigation rather than forcing a 100vh hero;
- wallpaper remains fixed/fullscreen underneath the page;
- cards use configurable opacity and backdrop blur.

Immersive `/player`:

- ignores `banner/fullscreen` presentation mode;
- always remains its own immersive fullscreen layout;
- may share the selected media, overlay strength, and sakura enable state.

## 4. Integrated Appearance / Background / Effects center

Replace the current long single-list settings presentation with three tabs while reusing current background business logic.

### 4.1 Panel shell

Desktop:

- width approximately `420–480px`;
- header: `背景与外观` + close action;
- tabs: `外观 / 背景 / 特效`;
- clear grouped controls and restrained Firefly-style card hierarchy.

Mobile:

- near-full-width sheet/panel;
- controls remain touch friendly;
- media library remains a separate management view.

### 4.2 Appearance tab

Controls:

- theme hue;
- card border enable;
- card follow-theme enable;
- default card opacity.

These settings affect standard pages only unless explicitly shared.

### 4.3 Background tab

Controls:

- wallpaper mode segmented control: `横幅壁纸 / 全屏壁纸`;
- enable background;
- autoplay;
- slideshow interval;
- overlay strength;
- background blur where applicable;
- card opacity where applicable;
- banner gradient transition enable;
- banner title enable;
- upload quality;
- add image/video;
- background library entry.

Mode-specific controls should only appear when relevant. Fullscreen-only blur/card-opacity controls must not clutter banner mode.

The existing media library, media preview, upload, URL add, and current-media logic are preserved.

### 4.4 Effects tab

Initial controls:

- sakura enable;
- sakura density;
- sakura speed;
- reduce motion.

The structure should allow future effects without enlarging `HeroSlideshow` into an all-purpose settings component.

## 5. Settings state and backward compatibility

Keep `hero_settings` as the single persisted source of truth. Do not migrate to many unrelated localStorage keys.

The v2-compatible shape is conceptually:

```js
{
  version: 2,

  // Existing fields preserved
  enabled: true,
  autoplay: true,
  interval: 15000,
  opacity: 0.45,
  quality: "high",
  sakura: true,

  // New wallpaper presentation
  wallpaperMode: "banner", // banner | fullscreen

  // New background appearance
  backgroundBlur: 0,
  cardOpacity: 0.92,
  bannerGradient: true,
  bannerTitle: true,

  // New general appearance
  themeHue: 340,
  cardBorder: true,
  cardFollowTheme: false,

  // New effect tuning
  sakuraDensity: 0.65,
  sakuraSpeed: 1,
  reduceMotion: false
}
```

Rules:

- missing new fields receive defaults without overwriting old stored values;
- existing fields keep their meaning;
- `sakura` remains the top-level sakura enable flag for compatibility;
- restoring visual defaults must not delete user media/library data;
- existing media-related persistence remains untouched.

At startup, critical values are reflected immediately on `<html>` and CSS variables to avoid post-load visual flashing, e.g.:

- `data-wallpaper-mode="banner|fullscreen"`
- wallpaper overlay variable;
- wallpaper blur variable;
- card opacity variable;
- theme hue variable.

## 6. Visual settings communication contract

Introduce one small visual-settings layer rather than allowing components to mutate each other directly.

Conceptual flow:

`Settings UI → hero_settings → HTML attributes/CSS variables → lidure:visual-settings-change`

Consumers:

- `HeroSlideshow`
- standard page shell
- cards
- sakura effect

Compatibility:

- continue emitting `lidure:sakura-setting` during transition so existing code does not break abruptly;
- remove legacy event paths only after the new sakura implementation fully owns the behavior.

The settings layer must not own media upload/library business logic.

## 7. Sakura effect v2

Replace the current Emoji/DOM-petal renderer with a real canvas-based petal system inspired by Firefly's architecture.

### 7.1 Visual behavior

Use real petal artwork (PNG/SVG-derived raster asset), not emoji characters.

Each petal may vary in:

- size;
- rotation;
- opacity;
- horizontal wind;
- mild oscillation;
- fall speed.

The effect should remain decorative and soft, not visually dominant.

### 7.2 Rendering architecture

Preferred desktop path:

- `OffscreenCanvas + Web Worker` when supported.

Fallback:

- main-thread Canvas 2D implementation.

Lifecycle requirements:

- pause/stop while page is backgrounded;
- resume cleanly without duplicate canvases/workers;
- handle resize without leaks;
- destroy/recreate cleanly on setting changes and Astro navigation.

### 7.3 Density defaults

Desktop normal mode:

- approximately `20–36` active petals depending on density setting.

Mobile:

- approximately `10–18` active petals;
- lower render cost / reduced DPR strategy if necessary.

Reduced motion:

- if user setting or `prefers-reduced-motion` is active, drastically reduce or stop continuous petals;
- do not automatically disable the background video itself solely because decorative motion is reduced.

## 8. Homepage article images

`HomePostCard` already supports `post.data.cover`; extend image resolution priority to:

1. explicit `frontmatter.cover`;
2. first Markdown image in the article body;
3. no image → text-only card.

Do not require data-model changes for existing articles.

Relative Markdown image paths must resolve correctly against the article/content asset location or be transformed to a browser-valid URL using Astro/content conventions. Do not emit broken raw source-relative URLs.

Desktop card:

- copy approximately `62–68%`;
- image approximately `32–38%`;
- target visual crop near `16:9`;
- restrained rounded corners;
- very subtle hover scale.

Mobile:

- image moves above copy;
- no side-by-side squeeze.

No fake placeholder image is used when an article has no usable image.

## 9. Homepage music widget

Use the user-provided Firefly screenshot as the primary visual reference rather than the latest compact Firefly music component.

### 9.1 Structure

- widget header: `音乐`;
- large, nearly full-width square/near-square rounded cover;
- central circular play/pause button floating over the cover;
- bottom circular previous and next buttons;
- optionally one restrained single-line track title for usability;
- no dense artist/status block.

Suggested cover radius: approximately `20–24px`.

### 9.2 Behavior

- center button proxies existing `#sekaiPlayPauseBtn`;
- previous proxies `#sekaiPrevBtn`;
- next proxies `#sekaiNextBtn`;
- clicking the non-control cover area/title region calls existing `window.__sekaiOpenPlayer()`;
- cover and play/pause state continue to observe the existing SEKAI player DOM/audio state;
- do not create a second audio element or second playlist state.

## 10. Banner / content visual hierarchy

The standard page surface should not look like an isolated opaque block glued under the banner.

Use:

- larger banner height;
- soft bottom fade;
- deeper overlap;
- high-z-index content cards;
- layered background/card colors;
- controlled transparency only where wallpaper mode calls for it.

Avoid:

- heavy glowing edges;
- large obvious gradient stripes;
- excessive glass on every card;
- Firefly wave effects in initial scope.

## 11. Responsive behavior

The existing v2 homepage 3-column layout remains authoritative:

- `>=1200px`: left + main + right;
- `850–1199px`: main + stacked sidebar column;
- `<850px`: single-column stacking.

New music/card/banner behavior must fit this contract.

Fullscreen wallpaper must not introduce horizontal scrolling or hide floating controls.

## 12. Accessibility and motion

- all settings controls have accessible labels;
- segmented wallpaper mode is keyboard reachable;
- music controls have `aria-label` and visible focus styles;
- settings tabs are keyboard reachable;
- sakura canvas is `aria-hidden` and pointer-events none;
- `prefers-reduced-motion` is respected;
- contrast remains readable in light and dark themes and at low card opacity.

## 13. Main files expected to change

Likely production areas:

- `src/layouts/BaseLayout.astro`
- `src/components/HeroSlideshow.astro`
- new/refactored visual settings component(s)
- `src/components/SekaiParticles.astro` or replacement sakura component
- new worker / settings utility files
- `src/components/HomePostCard.astro`
- `src/components/MusicStatusWidget.astro`
- `src/styles/firefly-refresh.css`
- `src/styles/firefly-v2.css`
- targeted tests

Business logic preservation takes precedence over minimizing the file count.

## 14. Acceptance criteria

1. Banner mode desktop hero is visibly broader/taller, about `62vh`, with ~`56px` content overlap and a soft bottom fade.
2. Fullscreen homepage wallpaper occupies the first viewport; homepage content begins below it.
3. Fullscreen non-home pages show fixed wallpaper behind content without forcing a blank 100vh hero.
4. `/player` remains immersive and unaffected by `banner/fullscreen` standard-page mode.
5. Existing media upload, URL add, background library, preview, slideshow, autoplay, and selected media continue to work.
6. Existing `hero_settings` users retain prior enable/autoplay/opacity/quality/sakura values.
7. Settings UI is split into `外观 / 背景 / 特效` and exposes only mode-relevant controls.
8. Homepage cards use `cover`, then article first image, then text-only fallback without broken image URLs.
9. Homepage music widget visually matches the approved large-cover composition and proxies the existing SEKAI controls/state.
10. Sakura uses real petals, supports Worker/OffscreenCanvas when possible, and has a main-thread fallback.
11. Sakura and visual settings do not leak duplicate listeners/workers/canvases across Astro navigation.
12. Mobile and reduced-motion modes reduce decorative load appropriately.
13. Existing homepage/sidebar/message/player regressions remain covered.
14. Final verification must include full `npm test`, Astro check/build, and inspection of built homepage/player output before merge.

## 15. Design principles

- Learn Firefly's layering, state separation, and interaction hierarchy; do not blindly transplant implementation.
- Keep one media system and one player system.
- Keep `hero_settings` as the compatibility anchor.
- Prefer CSS attributes/variables and small events over direct cross-component DOM mutation.
- Preserve the user's PJSK/video-background identity while making the site feel structurally closer to Firefly.
