# Article + Moments Human Visual Language V2

## Status

Approved design direction from 2026-08-25. This specification replaces the visual direction introduced by PR #43 for **article detail pages** and **Moments / 碎碎念** only.

The goal is not a more polished generic template. The goal is two pages that feel authored, lived-in, and recognizably personal.

## Design principle and references

Reference projects include `ImUpXuu/xuhome`, `Amiyadesi/sayori-blog` / Mizuki, and personal sites found through their friend-link ecosystems. We borrow structural ideas—content-first reading, a consistent authorial language, asymmetric media composition, and an immediate personal feed—but do **not** copy skins, colors, markup, or signature motifs.

> **文章像一本自己排出来的小刊物，碎碎念像一面一直长下去的生活墙。**

The two pages intentionally use different compositions. They still belong to one site through typography, theme hue, wallpaper behavior, text colors, interaction timing, and spacing rhythm rather than identical cards.

---

# 1. Scope

## In scope

- Article detail page UI and reading experience.
- Moments header, text filter, composer presentation, feed structure, media layout, metadata, and responsive behavior.
- A narrow `BaseLayout` banner opt-out for these two pages.
- Retirement of the PR #43 visual layer that conflicts with this direction.

## Out of scope

- Homepage, article-list, or archive redesign.
- Moments API/database/auth/R2/reaction/comment/delete/lightbox/poster contract changes.
- AI summaries or dashboard widgets.
- Direct visual copying from reference sites.

---

# 2. PR #43 UI to retire

## Article

Remove:

- `ISSUE {year}`;
- `article-meta-rail` as a visible structured UI pattern;
- glowing/accent-bar H2 treatment;
- one large rounded article card as the dominant page container;
- `Discussion / 评论区` template label;
- the current generic vertical progress bar as the page signature.

## Moments

Remove:

- `Moments · Journal`;
- `全部 / 本月 / 最近更新` stat blocks;
- bordered hero-card header;
- film-strip/pill filter;
- neat chapter-card visual treatment for every date;
- the same rounded glass card around every Moment;
- filled category pills as a primary visual element.

V2 must stop importing and then delete `src/styles/moments-journal.css` and `src/lib/moments-journal-enhancer.mjs` after their required behavior is represented directly in the Moments page. Do **not** stack a second visual enhancer over PR #43.

---

# 3. Shared page chrome

## 3.1 Exact banner opt-out

`BaseLayout.astro` adds exactly:

```ts
showBanner?: boolean
```

Default: `true`.

Article details and Moments pass `showBanner={false}`.

When false, omit only the normal `BlogBanner + BannerWaves + fullscreen-scroll-indicator` stage. Keep the global header, HeroSlideshow wallpaper source, particles, player, visual settings, page transitions, standard content surface, and footer.

No broader layout-system rewrite is introduced.

## 3.2 Shared visual language

Both pages use existing theme variables and settings. Accent color guides the eye rather than filling surfaces.

Required tendencies:

- fewer visible containers;
- fewer pills;
- fewer repeated rounded rectangles;
- more whitespace;
- restrained, deterministic asymmetry;
- no decorative English microcopy added merely to look designed.

Light/dark mode, theme hue, wallpaper modes, card opacity, and border settings remain functional where a visible surface still exists.

---

# 4. Article — “个人刊物”

## 4.1 Composition

Desktop:

- outer canvas: about `1100–1180px`;
- primary reading column: about `700–740px`;
- side space is intentionally usable by media, quotes, notes, and the bookmark rail.

There is **no full-page card**. In normal/banner mode the reading canvas is visually open. In fullscreen/overlay wallpaper modes only, a low-contrast translucent reading field may sit behind the article to preserve readability; it must have no dashboard-like border/shadow treatment.

## 4.2 Masthead

Order:

1. title;
2. description/deck;
3. plain metadata;
4. plain tags;
5. body.

Title is left aligned, large but not landing-page huge, and has no badge/kicker.

The existing `post.data.description` becomes the deck. On wide desktop it sits slightly to the right of the main text axis with one short thin accent rule. On mobile it returns directly below the title in normal flow.

Metadata is plain text, e.g.:

`2026.08.25 · 更新于 08.25 · 约 6 分钟`

Tags render as lightweight `#tag` text, not filled pills.

## 4.3 Body typography

- Chinese long-form line-height: final value within `1.75–1.85`.
- Paragraph spacing remains editorial and moderate.
- H2 uses a CSS counter (`01`, `02`, …) placed pale and slightly outside the text axis.
- H2 has no bar, glow, pill, or full divider.
- H3/H4 use typography and spacing only.
- Counters never change Markdown heading IDs/content.

## 4.4 Rich content

### Images

A paragraph containing only an image may use a breakout container up to about `960px`. The image itself uses `width:auto; max-width:100%`, so portrait images retain a natural narrow width instead of being stretched.

- no universal heavy shadow/border;
- captions are quiet and align to the image edge;
- no random rotation.

### Quotes

Blockquotes shift slightly into the left margin and rely on typography plus one thin mark. No tinted quote card.

### Code

Workbench/document-snippet feel: quiet high-contrast surface, horizontal scrolling, no fake Mac traffic lights. Copy control may fade until hover/focus on desktop but must remain discoverable on touch.

### Tables

Document-like rows with light horizontal separators rather than a boxed grid. Mobile overflow remains horizontal and safe.

### KaTeX

Inline and block math must remain unclipped and unaffected by breakout rules.

## 4.5 Bookmark reading rail

Desktop (`>= 980px`) shows a minimal bookmark rail in the outer margin:

- thin track;
- small movable progress marker;
- tiny static ticks for rendered H2 headings;
- tick hover/focus reveals that heading title;
- no persistent text list and no card background.

Article rendering must retain Astro heading data so H2 ticks are deterministic.

Mobile/tablet (`< 980px`) hides the rail and uses only a `2px` top reading-progress line.

Reduced-motion mode removes interpolation; position updates remain immediate.

## 4.6 Ending

After prose, show a centered `· · ·` end mark, then the existing `Comments` component directly. No `Discussion`, no extra comment card, and no decorative English heading.

---

# 5. Moments — “生活墙”

## 5.1 Entrance

No hero card and no statistics.

Top area contains only:

- `碎碎念`;
- one short Chinese description;
- the text category filter.

There is **no month navigator in V2**. Date navigation is deliberately excluded to avoid adding another UI subsystem.

## 5.2 Category filter

Keep categories `全部 / 生活 / 音乐 / 游戏 / 吐槽`.

They render as plain text controls. The active item uses a short accent underline plus normal text-weight change; color alone is not the only selected-state cue.

Controls retain practical click/touch padding but must not visually become pills.

On desktop the filter may sit directly below the title and becomes sticky beneath the global site header. The sticky surface is transparent/near-transparent, not a floating card.

## 5.3 Composer

Use the existing auth/admin visibility rules. Wherever the current publish trigger is allowed, its collapsed presentation becomes:

`今天想记点什么？`

It appears as one quiet writable line inside the content flow.

Click expands the existing composer in place. Preserve category, link, emoji, image/video upload, poster, preview, submit, success/error, and auth behavior. Textarea is visually dominant; secondary controls are quieter.

Do not wrap the expanded composer in a dashboard-like outer card. Existing IDs/hooks are preserved, or all callers are updated atomically in the same implementation task.

## 5.4 Day groups

DOM uses semantic day-group wrappers, but they have no enclosing border/card.

Desktop (`>= 980px`):

- left zone shows large pale `MM / DD`;
- small weekday/year sits below;
- date marker is `position: sticky` within its day group with a top offset aligned below the site header;
- today's group gets one **static** accent dot;
- no pulsing animation;
- no full-height timeline line.

Mobile/tablet: date returns to normal horizontal flow above that day's Moments; it is not sticky.

## 5.5 Deterministic life-wall variants

Each Moment receives exactly one primary variant from content/media, never randomness:

- `moment--whisper`: no media and trimmed text length `<= 32` characters;
- `moment--text`: no media and text length `> 32`;
- `moment--photo-one`: exactly one image and no video;
- `moment--photo-two`: exactly two images and no video;
- `moment--photo-three`: exactly three images and no video;
- `moment--gallery`: four or more images and no video;
- `moment--video`: one or more videos (video wins over photo variants).

### Whisper

Slightly larger text, narrower width, and a small horizontal offset on desktop. No card shell.

### Text

Readable width around `58–66ch`; no mandatory border. Fullscreen/overlay may add only a faint local paper tint if wallpaper contrast requires it.

### One photo

Photo dominates, retains natural aspect ratio within max dimensions, and can project wider than text. **Single photos are never tilted.**

### Two photos

Asymmetric pair, approximately `60/40`. On desktop only, second supporting image uses a fixed `rotate(0.7deg)`.

### Three photos

One lead image plus two supporting images. Desktop supporting image 2 uses `rotate(0.7deg)` and image 3 uses `rotate(-0.6deg)`.

### Four or more

Controlled gallery grid. No rotation. Avoid forcing nine-grid geometry when not necessary.

### Video

Dedicated wider presentation with existing poster/controls. No rotation and not styled identically to image tiles.

All rotations are removed below `720px` and under reduced-motion/user-reduced-motion modes.

## 5.6 Metadata and actions

Category becomes small dot + plain text (or plain text alone), with subtle theme-derived category color. No filled pills.

Time uses quiet tabular/monospace numerals near metadata/media.

Existing reactions and counts remain readable. Secondary desktop actions may reduce opacity until `hover`/`focus-within`; touch-critical actions remain visible on mobile. Admin delete remains discoverable. Reaction pickers/comments must not be clipped by overflow.

Links render as normal readable domain/text links, not link cards.

## 5.7 Mobile Moments

Below `720px`:

- one content column;
- date above each day group;
- no offsets/rotations;
- media uses available width and natural ratios;
- composer full width;
- text filter may horizontally scroll but remains visually text-only;
- reaction/comment controls stay tap-friendly.

---

# 6. Architecture and ownership

## BaseLayout

Only add `showBanner`; all existing pages default to current banner behavior.

## Article

- `src/pages/posts/[slug].astro`: data, `Content`, rendered headings, masthead composition, rail hooks.
- Replace `src/styles/article-reading.css` wholesale rather than layering V2 over PR #43.
- Extract a small article-reading controller only if the page script becomes difficult to test/read.

Do not preserve PR #43 markup just for compatibility.

## Moments

- `src/pages/moments.astro` stays owner of API/auth/upload/reaction/lightbox behavior.
- Directly replace header/filter/composer/feed render structure and card classes in that file.
- Pure date/content-classification helpers may move to `src/lib/`.
- Remove the old journal enhancer and stylesheet after direct rendering is complete.

Because `moments.astro` is large, implementation must use targeted edits plus regression tests, not a blind whole-file rewrite of business logic.

---

# 7. Behavior preservation

The redesign is incorrect if it breaks:

- Markdown/KaTeX/article comments;
- Moments API load and ordering;
- auth/admin state;
- publish;
- image/video upload and video poster behavior;
- emoji insertion;
- category filtering;
- reactions/picker;
- Moment comments;
- delete;
- lightbox;
- wallpaper modes;
- theme hue/light-dark mode;
- relevant card opacity/border controls;
- Astro client-side transitions.

---

# 8. Motion and accessibility

- No cascade marketing entrance animations.
- No pulsing decoration by default.
- `prefers-reduced-motion` and `html[data-reduce-motion="true"]` disable decorative transition/rotation/interpolation.
- Focus states remain visible.
- Filters/composer triggers remain keyboard accessible.
- Media keeps current keyboard/lightbox accessibility.
- Selected state never relies on color alone.

---

# 9. Testing

Regression tests must cover:

1. `showBanner` exists and defaults to current behavior.
2. Article no longer renders `ISSUE`, `article-meta-rail`, or `Discussion`.
3. Article has masthead/deck/plain metadata/H2-counter/bookmark-rail hooks.
4. Article CSS covers breakout images, quotes, code, tables, KaTeX safety, desktop rail and mobile progress.
5. Moments no longer imports old journal enhancer/style.
6. Moments has text filter, composer prompt, semantic day groups/date rail, and deterministic variant classes.
7. Functional IDs/selectors needed by publish/reaction/lightbox/auth/delete remain present.
8. Mobile flattens the life wall into one readable flow.
9. Reduced-motion rules cover all new decorative movement.

Final verification:

- focused Node tests;
- `npm run test:site`;
- `npm run build` (`astro check && astro build`);
- GitHub Pages deploy after merge.

---

# 10. Acceptance criteria

Success means:

- article screenshots no longer read as a generic “editorial template”;
- Moments screenshots no longer resemble a dashboard/card system or cloned social app;
- both pages differ in composition but clearly belong to the same site;
- content is the first visual priority;
- images retain natural proportions and varied visual weight;
- existing wallpaper/theme controls still work;
- desktop has personality while mobile remains calm/readable;
- no existing article or Moments business feature is lost.
