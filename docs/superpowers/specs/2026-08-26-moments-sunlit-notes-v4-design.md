# Moments Sunlit Notes V4 Design

## Goal
Rebuild the Moments presentation into a fresh, everyday-life page with a clear personal signature, avoiding generic glass-card/dashboard aesthetics while preserving all existing behavior.

## Visual concept: 窗边便笺 / Sunlit Notes
The page should feel like casual notes and photos collected near a window: airy, soft, slightly imperfect, but not childish. The personality comes from repeated small motifs instead of decorative overload.

## Borrowed principles, not skins
- From Firefly: freshness, restrained motion, theme-hue compatibility, wallpaper awareness.
- From xuhome: one consistent personal motif matters more than generic component polish.
- From personal Moments/朋友圈 blogs: content first; metadata and controls stay quiet until needed.

## Page rules
1. Keep `showBanner={false}` and the existing API/upload/comment/reaction/lightbox/admin behavior.
2. Header becomes a quiet notebook heading, not a hero. Use one small handwritten-style accent line and a tiny seasonal/daylight motif; no stats cards, no English product-like eyebrow.
3. Filters become plain text tabs with a hand-drawn underline; no filled pill backgrounds in the default state.
4. Compose trigger reads like a note prompt and expands the existing editor in place.
5. Day groups use a slim date tab that visually attaches to the feed instead of a full-width divider or giant date rail.
6. Every Moment remains readable as one cohesive unit, but cards must look like paper notes rather than SaaS cards: soft translucent paper surface, asymmetric corner treatment, tiny paper-notch/tape motif, almost no drop shadow.
7. Add deterministic time-of-day metadata derived from the post timestamp:
   - 05:00-10:59 `清晨`
   - 11:00-16:59 `白昼`
   - 17:00-19:59 `黄昏`
   - 20:00-04:59 `深夜`
   Each state gets only a tiny icon/mark and a subtle hue variation. No random layout.
8. Category becomes a small colored pencil stroke + text, not a badge/pill.
9. Text posts should feel like notes: comfortable Chinese line-height, slightly different treatment for short whispers, but no oversized quote typography.
10. Media stays inside the note. One image uses natural ratio and centered presentation; two/three/gallery layouts are tidy but slightly editorial. No rotation. Video stays full-width inside the note.
11. Reaction/comment area is visually recessed into a quiet footer. Emoji/reaction pickers must remain strictly hidden until opened.
12. On desktop, consecutive notes may alternate a tiny deterministic horizontal inset based on index (max 12px) to avoid sterile repetition; mobile removes the inset completely.
13. Wallpaper/fullscreen modes keep enough translucent surface for legibility, but avoid heavy blur. Light/dark/theme hue remain supported.
14. Reduced-motion preference disables lift/fade transitions.

## Mobile
Single-column, no lateral offsets, smaller date tabs, image grids collapse sensibly, editor remains full width, all controls remain accessible.

## Non-goals
- No new backend fields.
- No random decoration.
- No new dependency.
- No change to Moments API contracts, R2 uploads, poster generation, login, deletion, pinning, comments, reactions, or lightbox behavior.
