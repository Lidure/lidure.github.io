# Article + Moments Human Visual Language V2

## Status

Approved direction from the design discussion on 2026-08-25. This specification replaces the visual direction introduced by PR #43 for **article detail pages** and **Moments / 碎碎念** only.

The goal is not to produce a more polished generic blog template. The goal is to make these two pages feel authored, lived-in, and recognizably personal.

## References and Design Principle

Reference projects include `ImUpXuu/xuhome`, `Amiyadesi/sayori-blog` / Mizuki, and personal sites discovered through their friend-link ecosystems. We borrow structural ideas such as content-first reading, expressive but consistent visual language, asymmetric media composition, and social-feed immediacy. We do **not** copy their skins, color schemes, markup, or signature motifs.

The new design follows one sentence:

> **文章像一本自己排出来的小刊物，碎碎念像一面一直长下去的生活墙。**

The two pages may have different compositions. They remain part of the same site through typography, theme hue, wallpaper behavior, text colors, interaction timing, and spacing rhythm rather than by forcing them into identical cards.

---

# 1. Scope

## 1.1 In scope

- Article detail page UI and reading experience.
- Moments page header, filter, composer presentation, feed structure, media layout, metadata presentation, and responsive behavior.
- A BaseLayout escape hatch that allows these pages to opt out of the standard banner while retaining the global header, wallpaper, particles, player, visual-settings panel, page transitions, and footer.
- Removal or retirement of the PR #43 visual layer that conflicts with this direction.

## 1.2 Out of scope

- Homepage redesign.
- Article list / archive redesign.
- Changing the content collection schema unless absolutely required for a non-breaking optional field.
- Changing Moments API contracts, database format, authentication, R2 upload behavior, reactions, comments, deletion, lightbox, or poster generation.
- Copying the visual identity of xuhome, Mizuki, or any friend-link site.
- Adding a large dashboard-like sidebar, statistics dashboard, or AI summary block.

---

# 2. What must be removed from PR #43

The following visual ideas are explicitly retired:

### Article

- `ISSUE {year}` badge.
- Editorial metadata rail as a boxed/structured UI concept.
- The current decorative H2 accent bar / glow treatment.
- The current large rounded article-shell-card look as the dominant page container.
- `Discussion / 评论区` template-like section label.
- A visible generic vertical progress bar as the main article signature.

### Moments

- `Moments · Journal` kicker.
- The three-stat header (`全部 / 本月 / 最近更新`).
- Header rendered as a bordered hero card.
- Connected pill / film-strip filter UI.
- Every day rendered as a neat chapter-card system.
- Every Moment rendered as the same rounded glass/card component.
- Uniform category pills as a primary visual element.

The implementation should delete or stop importing `src/styles/moments-journal.css` and `src/lib/moments-journal-enhancer.mjs` once equivalent functional behavior is represented directly in the new layout. Do not stack V2 styles on top of the old enhancer.

---

# 3. Shared page chrome

## 3.1 Banner opt-out

`BaseLayout.astro` gains a small, explicit page-level option, for example `showBanner?: boolean` with a default of `true`.

Article details and Moments pass `showBanner={false}`. The pages retain:

- global site header;
- fullscreen/banner/overlay wallpaper modes;
- HeroSlideshow background source;
- visual settings;
- music player;
- particles;
- page transitions;
- footer.

Only the normal `BlogBanner + BannerWaves + fullscreen scroll indicator` stage is omitted for these two pages.

This is intentionally a narrow layout capability, not a new layout system.

## 3.2 Shared visual language

Both pages should use:

- `--standard-text`, `--standard-muted`, `--standard-accent`, `--standard-line`, theme hue and existing card opacity variables;
- a restrained accent color: accent should guide the eye, not fill most surfaces;
- fewer visible containers;
- fewer pills;
- fewer rounded rectangles;
- noticeably more whitespace;
- small imperfections/asymmetries only where they support content;
- no decorative English microcopy added only to make the page look designed.

Light/dark mode and user-configured theme hue must remain fully functional.

---

# 4. Article page — “个人刊物”

## 4.1 Page composition

Desktop composition:

- outer page width: approximately `1100–1180px`;
- primary reading column: approximately `700–740px`;
- asymmetric free space on both sides is intentional;
- wide media, tables, code, quotes, and margin notes may use that free space.

The page does **not** sit inside a single visually dominant card. A very subtle reading surface may be used for contrast in fullscreen/overlay wallpaper modes, but it must read as a sheet/field, not as a dashboard card.

## 4.2 Masthead

The article itself owns the top of the page.

Order:

1. article title;
2. optional description / deck;
3. quiet publication metadata;
4. tags as plain text links/labels;
5. article body.

Title:

- left aligned;
- large but not landing-page huge;
- maximum width below the full canvas width so very long Chinese titles remain readable;
- no badge above it;
- no English kicker unless the content itself supplies one.

Description:

- uses the existing `post.data.description`;
- on wide screens it may sit slightly to the right of the title/body axis as a **margin note / deck**;
- shown with a short thin accent rule or a tiny marker, not a card;
- on mobile it returns to normal document flow below the title.

Metadata:

- plain text, e.g. `2026.08.25 · 更新于 08.25 · 约 6 分钟`;
- tags appear as lightweight `#tag` text, not filled pills;
- separators can be punctuation or thin rules;
- metadata is a secondary visual layer.

## 4.3 Reading body

Paragraphs:

- optimize for Chinese long-form reading;
- approximately `1.75–1.85` line height depending on final font size;
- paragraph rhythm should feel editorial rather than Markdown-default;
- avoid exaggerated paragraph gaps.

Headings:

- H2 uses CSS counters for a subtle chapter number (`01`, `02`, ...);
- chapter number should be pale and slightly outside the main text axis;
- H2 itself has no glowing bar, pill, box, or full-width divider;
- H3 is mostly typographic: weight, size, spacing;
- H4 is deliberately quiet.

The H2 counter is a visual aid only and must not alter heading IDs or Markdown content.

## 4.4 Asymmetric rich content

The content column is stable; selected blocks are allowed to break it.

### Images

- standard image: follows reading column;
- landscape / large image: may expand to roughly `900–1000px`;
- portrait image: should preserve natural width and should not be forced to fill the row;
- no universal heavy border/shadow treatment;
- subtle radius is allowed but not required on every image;
- captions are understated and align to the image edge.

A small, deterministic variation is allowed based on content shape/class, but the layout must not randomly rotate images on every page load.

### Blockquotes

- can break slightly into the left margin;
- primarily typographic: larger/lighter text, thin line or mark;
- no large tinted quote card.

### Code

- workbench/document-snippet feel;
- quiet background and readable contrast;
- no fake Mac traffic-light decoration;
- copy affordance may appear on hover/focus on desktop and remain discoverable on touch devices;
- preserve horizontal scrolling.

### Tables

- document-like table treatment;
- light horizontal separators preferred over cell-box grids;
- horizontal overflow must remain safe on mobile.

### KaTeX

Existing inline/block math must remain intact and must not be clipped by breakout layout rules.

## 4.5 Reading trajectory

Desktop may show a **minimal bookmark rail**, not a TOC card.

Requirements:

- thin vertical track positioned in the page margin;
- current overall reading position is represented by a small movable marker;
- H2 headings become tiny static chapter ticks derived from Astro-rendered headings;
- hovering/focusing a tick may reveal the heading title in a small native-feeling tooltip/popover;
- no persistent large text list;
- no glass card container.

Mobile:

- hide the bookmark rail entirely;
- use only a very thin top reading-progress line.

Reduced-motion mode disables animated interpolation; position updates may remain immediate.

## 4.6 Article ending

After prose:

- use a small typographic ending mark such as `· · ·` or one minimal accent ornament;
- then enter comments naturally;
- remove `Discussion` and other decorative English labels;
- comments may have a simple Chinese heading only if needed for orientation.

Future previous/next links, if added, should look like a page index, not two large cards.

---

# 5. Moments page — “生活墙”

## 5.1 Page entrance

No hero card.

Desktop page head:

- plain `碎碎念` title on the left;
- one short Chinese sentence below/next to it;
- optional current year/month navigation on the right (`2026 / 08`) if useful;
- no total-count dashboard;
- no English kicker.

The title area should feel like the top of a personal notebook page, not an app header.

## 5.2 Filter

Categories remain `全部 / 生活 / 音乐 / 游戏 / 吐槽`.

Presentation:

- plain text navigation;
- spacing rather than pills defines the controls;
- active item gets a short accent underline or dot;
- filter may become sticky under the site header on desktop if it remains visually light;
- touch targets must still meet practical minimum size via padding without looking like pills.

## 5.3 Composer

The entry point is a sentence rather than a toolbar button:

> `今天想记点什么？`

Collapsed state:

- looks like one quiet writable line in the content flow;
- small pencil/plus icon is optional;
- admin/auth behavior remains unchanged.

Expanded state:

- unfolds in place;
- textarea becomes the dominant element;
- category, link, emoji, image/video upload and submit controls remain available but are visually secondary;
- media previews appear directly beneath the text area;
- avoid an outer dashboard-like panel wherever possible;
- functional error/success messages remain visible.

The composer must preserve all current IDs/hooks or update callers in one atomic change.

## 5.4 Day groups

Moments remain chronologically ordered but date grouping becomes a **background rhythm**, not a collection of chapter cards.

DOM may still use semantic day-group wrappers for filtering and layout, but visually:

- the left margin shows a large pale date such as `08 / 25`;
- weekday or year can be much smaller beneath it;
- several Moments can share the same date marker;
- date marker may become sticky only if it does not compete with content;
- no border around the whole day group;
- no full-height timeline line is required.

Today's marker can use one tiny accent dot. Do not use a pulsing animation by default; a static mark is more human and calmer.

## 5.5 Life-wall layout

Desktop uses an intentionally uneven two-zone grid:

- narrow date / side-note zone;
- flexible content zone;

Within the content zone, Moments receive layout variants based on actual content. The renderer should add deterministic classes such as:

- `moment--whisper`: very short text, no media;
- `moment--text`: normal text-only;
- `moment--photo-one`;
- `moment--photo-two`;
- `moment--photo-three`;
- `moment--gallery`;
- `moment--video`.

The variant must come from content/media count, never from random choice.

### Short text / whisper

- can be slightly larger;
- may sit narrower or offset from the main axis;
- no visible card shell;
- feels like a thought written into whitespace.

### Normal text

- readable width around `58–66ch`;
- no mandatory border;
- optional very subtle paper tint in wallpaper-heavy modes only.

### One photo

- image is the dominant object;
- preserve natural aspect ratio within sensible max dimensions;
- can project wider than the text column;
- time/caption may align to a photo edge;
- allow a deterministic `~1deg` hand-set tilt class only for selected structural variants, not random rotation.

### Two photos

- asymmetric pair: roughly `60/40` or `55/45` rather than equal squares;
- preserve useful image content with `object-fit` chosen conservatively.

### Three photos

- one lead image + two supporting images.

### Four or more

- controlled gallery grid is acceptable;
- avoid generic social-app nine-grid when image count does not require it.

### Video

- receives a wider dedicated presentation;
- poster and controls remain functional;
- do not style it identically to an image tile.

## 5.6 Moment metadata and actions

Category:

- small dot + text (`● 音乐`) or just text;
- color derives from theme hue/category offsets but remains subtle;
- no filled category pill.

Time:

- quiet monospace/tabular numeric text near the category or media edge.

Reactions/comments/share/delete:

- existing reactions and counts remain visible enough to understand state;
- secondary desktop actions may reduce opacity until card hover/focus-within;
- critical touch controls stay visible on mobile;
- admin delete remains discoverable in admin mode;
- comments and reaction pickers must not be clipped by overflow rules.

Links:

- present as readable domain/text links, not a separate card.

## 5.7 Mobile Moments

Below roughly `720px`:

- collapse to one content column;
- date becomes a horizontal heading above each day group;
- remove offsets/tilts that reduce usable width;
- media uses full available width with natural ratios;
- composer uses full width;
- category filter scrolls horizontally if needed but remains text-like;
- reaction/comment controls remain easy to tap;
- no sticky date rail.

The mobile page should still feel like the same life wall, just flattened for readability.

---

# 6. Architecture and file boundaries

## 6.1 BaseLayout

Modify only enough to support banner opt-out. Existing standard pages continue to render exactly as before by default.

## 6.2 Article

Preferred ownership:

- `src/pages/posts/[slug].astro`: data, heading extraction, article composition, progress/rail initialization;
- a dedicated article stylesheet (the existing `article-reading.css` may be replaced wholesale rather than incrementally patched);
- a small article reading/heading controller module if the page script becomes non-trivial.

Do not preserve PR #43 markup purely for compatibility if it no longer serves the new composition.

## 6.3 Moments

V2 should move away from the PR #43 progressive journal enhancer.

Preferred ownership:

- `src/pages/moments.astro` remains the source of API/auth/upload/reaction/lightbox behavior;
- replace the feed/header/composer markup and render classes in that page directly;
- if necessary, extract **pure layout classification/date helpers** to `src/lib/`, but do not move API behavior simply for aesthetic refactoring;
- remove old journal enhancer/style imports after the direct layout is complete.

Because `moments.astro` is large, implementation should use targeted edits and regression tests, not a full blind rewrite of the business script.

---

# 7. Behavior preservation

The redesign is considered incorrect if it breaks any of the following:

- article Markdown rendering;
- KaTeX;
- article comments;
- Moments API load;
- Moments authentication/admin state;
- publish form submission;
- image upload;
- video upload/poster behavior;
- emoji insertion;
- category filtering;
- reactions and reaction picker;
- comments;
- delete flow;
- image lightbox;
- fullscreen/banner/overlay wallpaper settings;
- theme hue;
- light/dark mode;
- card opacity / border settings where those settings are meaningful for any remaining surfaces;
- Astro client-side page transitions.

---

# 8. Motion and accessibility

- Use motion sparingly; content entrance should not cascade like a marketing page.
- No default pulsing decorations.
- `prefers-reduced-motion` and `html[data-reduce-motion="true"]` must disable decorative transitions/tilts/animated scrolling effects.
- Focus states must remain visible.
- Text filters and composer triggers must remain keyboard accessible.
- Media remains keyboard/lightbox accessible where currently supported.
- Color is never the only indicator of selected category or interactive state.

---

# 9. Testing strategy

Add/update source regression tests for:

1. BaseLayout banner opt-out exists and defaults to current behavior.
2. Article no longer renders `ISSUE`, `article-meta-rail`, or `Discussion` template labels.
3. Article exposes masthead, deck, plain metadata, chapter-counter and bookmark-rail hooks.
4. Article rich-content CSS has breakout image, quote, code, table, mobile, KaTeX-safe rules.
5. Moments no longer imports the old journal enhancer/style.
6. Moments renders text filters, composer prompt, day-group/date-rail structure and deterministic content variants.
7. Existing functional IDs / selectors required for publish, reaction, lightbox, auth, and delete remain present.
8. Mobile rules collapse the life wall into a single readable flow.
9. Reduced-motion rules cover new decorative motion.

Final verification must include:

- focused Node tests;
- `npm run test:site`;
- `npm run build` (`astro check && astro build`);
- review of the GitHub Pages deploy after merge.

---

# 10. Acceptance criteria

The redesign is successful when:

- an article screenshot is not immediately recognizable as a generic “editorial SaaS/blog template”;
- a Moments screenshot does not look like a card dashboard, admin panel, or cloned social app;
- the two pages are visibly different in composition but clearly belong to the same website;
- content, not UI chrome, is the first thing seen;
- images have more natural proportions and visual weight;
- the design still works with the user's wallpaper/theme controls;
- desktop has personality without sacrificing mobile readability;
- no existing article/Moments business feature is lost.
