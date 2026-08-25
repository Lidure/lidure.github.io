# Article & Moments Layout Refresh Design

## Goal

Redesign the blog article page and Moments (`碎碎念`) page so they feel intentionally different but clearly belong to the same site. The article page should prioritize long-form reading with a magazine/editorial feel. Moments should feel like a personal digital scrapbook/timeline rather than a generic social feed.

The redesign must stay compatible with the current theme system, light/dark modes, theme hue, fullscreen/overlay wallpaper modes, card border settings, mobile layout, and existing Moments functionality.

## Design language

Shared language across both pages:

- Use the existing theme hue and standard color tokens instead of introducing fixed unrelated colors.
- Keep borders subtle and low-contrast; use accent color for structure, not as a large background fill.
- Prefer layered whitespace, typography, fine rules, and small visual markers over heavy glass cards.
- Preserve current rounded visual language, but reduce the feeling that every block is a separate card.
- Maintain good contrast in both light and dark themes and when wallpaper mode is fullscreen/overlay.
- Motion should be short and restrained, with reduced-motion behavior preserved.

The two page identities are:

- **Articles:** editorial magazine / reading sheet.
- **Moments:** digital journal / dated scrapbook / film strip.

## Article page

### 1. Article shell and reading width

The current article body is visually dominated by one large `.post-shell` card. The redesign should make the shell feel lighter and let typography become the primary structure.

Desktop:

- Overall article region may use up to roughly `980px` for metadata, wide media, and utility elements.
- Primary text column should sit around `720–780px` readable width.
- Text remains centered, while selected media may break out to approximately `900–980px`.
- The outer article surface should use a quiet background/border treatment rather than a thick floating-card look.

Mobile:

- Remove unnecessary nested horizontal padding.
- Body text should use nearly the full available viewport with safe side padding.
- Wide media should collapse cleanly back to container width.

### 2. Editorial article header

The existing publish/update/tag metadata should become a dedicated editorial metadata rail above the content.

It should contain:

- publish date,
- updated date when meaningful,
- estimated reading time,
- tag count or tag list,
- a small theme-color issue/stamp marker.

Example visual rhythm:

`2026 · 08 · 25  /  8 MIN READ  /  #BLOG  #ASTRO`

The metadata rail should be visually secondary to the article title already shown in the banner. It must not duplicate the banner title as a second large heading.

Reading time should be computed from rendered/source text using a stable approximation suitable for Chinese and mixed Chinese/English content. It is display-only and must not alter content collection schema.

### 3. Typography hierarchy

Body text:

- Optimize line-height and paragraph spacing specifically for Chinese long-form reading.
- Target approximately `1.78–1.88` line-height depending on breakpoint.
- Use consistent paragraph rhythm without oversized vertical gaps.
- Preserve `Noto Sans SC` as the primary body family unless the existing site font stack resolves differently.

Headings:

- H2 becomes the main chapter marker.
- H2 should use a small accent-side marker or numeric/chapter-style visual cue rather than only a full-width underline.
- H3 should be quieter and more typographic, with less decoration.
- H4 and below should remain clearly distinguishable but restrained.
- Heading scroll offsets should account for the fixed site header.

Links:

- Use theme-accent text and a subtle gradient or animated underline.
- Hover/focus must remain readable and accessible.

### 4. Reading progress accent

Add a lightweight reading-progress indicator.

Desktop:

- A thin vertical accent rail at the article side.
- It fills according to article reading progress.
- It should be decorative/non-interactive and never cover text.

Mobile:

- Replace the side rail with a thin top progress line.

Rules:

- Progress is based on the article content region, not total document height.
- Must update on scroll/resize.
- Must respect reduced motion; progress itself may update instantly without animated interpolation.
- Must not interfere with the existing fullscreen wallpaper scroll blur controller.

### 5. Rich content treatment

Images:

- Normal portrait/small images remain within the reading column.
- Wide landscape images can break out beyond the text column on desktop.
- Keep current light border/shadow behavior but make it more restrained.
- Captions, where available through Markdown/HTML structure, should be visually secondary.

Blockquotes:

- Redesign as editorial side-note blocks.
- Use a narrow accent rule, subtle tinted surface, and comfortable padding.
- Avoid heavy filled callout styling.

Code:

- Inline code remains compact.
- Code blocks get an editor-snippet treatment: clearer header edge, improved inner spacing, better contrast, consistent radius.
- No fake window controls unless they carry real information.

Tables:

- Improve header contrast and row separation.
- Preserve horizontal scrolling on narrow screens.
- Rounded outer treatment should not break native table semantics.

Math:

- Preserve KaTeX behavior and horizontal overflow safety.
- Do not shrink equations solely to force them into the text column.

### 6. Comments boundary

Comments remain functionally unchanged.

The end of the article should have a clear editorial break before comments so comments do not look like part of the prose. The visual transition can use spacing, a fine rule, and a small section label.

## Moments page

### 1. Page identity and width

The current page is constrained to about `760px` and begins with a large decorative Hero. The redesign should feel broader and less top-heavy.

Desktop:

- Increase the main Moments layout width to roughly `880–980px` where useful.
- Keep readable text blocks narrower inside individual moments.
- Media can use the wider canvas.

Mobile:

- Reduce timeline indentation and prioritize content width.
- Avoid decorative elements that consume horizontal space.

### 2. Compact journal header

Replace the oversized centered Hero feel with a compact journal-cover header.

Structure:

- left: `碎碎念`, short description, small Moments kicker,
- right or lower row: compact statistics such as total entries, this-month count, latest update.

The existing oversized bubble decoration should be reduced or simplified so it becomes background texture rather than the main visual event.

The header should feel like the cover/header of a personal journal, not a landing-page hero.

### 3. Category film-strip controls

The category filters should become a visually connected strip instead of isolated generic pills.

Behavior stays the same.

Visual treatment:

- one continuous or semi-continuous control band,
- compact category markers,
- category identity may use derived hue offsets/tints but must remain harmonized with the current theme hue,
- active category gets stronger contrast without a large saturated gradient fill,
- keyboard focus states remain explicit.

Publish action remains easy to discover but should visually integrate with the control strip rather than looking like a separate floating app FAB.

### 4. Date chapters

Moments should be grouped visually by date sections.

Example:

`2026 / AUG / 25`

followed by that date's entries.

Implementation may group consecutive moments client-side during rendering without changing the backend/API data shape.

Date chapter rules:

- Show a new chapter marker when the calendar date changes.
- Keep chronological ordering consistent with current behavior.
- The current day receives a small animated or softly pulsing accent dot only when entries exist for today.
- Reduced-motion mode disables the pulse.
- Date labels should remain understandable in Chinese locale; month abbreviation may be stylistic but must not be the only date representation available to assistive technology.

### 5. Moment card variants

All entries remain semantically articles, but presentation adapts to content.

#### Text-only

- Light paper/note surface.
- Content is the primary element.
- Metadata is compact and secondary.

#### Single image/video

- Media receives more visual area.
- Text behaves like a caption/note rather than being buried below controls.
- Preserve current image/video loading, poster, and lightbox behavior.

#### Multi-image

- Use a scrapbook/film-contact-sheet composition rather than a rigid generic social-media grid.
- Layout must remain deterministic and usable for 2–9 assets.
- Mobile collapses to a safe grid without horizontal overflow.

The redesign must not change upload limits or media data formats.

### 6. Timeline structure

Reduce the visual weight of the current traditional vertical line.

Preferred structure:

- date chapters provide primary chronological grouping,
- a fine guide line or small binding markers may connect entries within a chapter,
- use subtle cut/notch/binding details through CSS only,
- avoid decorative assets that add network weight.

Hover elevation should be minimal. The page should feel like stacked journal entries rather than floating product cards.

### 7. Metadata and reactions

Timestamp, category, optional link, admin actions, and reactions remain available but move to a lower visual priority.

Desktop:

- secondary controls may become more visible on hover/focus-within.

Mobile/touch:

- important actions must remain directly available; do not hide critical controls behind hover-only behavior.

Reaction picker functionality and existing stored reaction behavior must remain unchanged.

### 8. Publish composer

Keep all existing publish functionality:

- date/time,
- category,
- text,
- emoji insertion,
- optional URL,
- image/video upload,
- video poster controls,
- session/login/logout state,
- submit feedback.

Visual redesign:

- composer expands naturally below the control strip like an opened journal note,
- textarea receives more room,
- category/media selection hierarchy becomes clearer,
- reduce heavy glass-panel appearance,
- media previews remain easy to scan and remove.

No API/authentication behavior changes are in scope.

## Theme and wallpaper integration

Both redesigned pages must use the existing standard theme variables and respond to:

- light/dark mode,
- theme hue,
- card opacity,
- card border toggle,
- card-follow-theme behavior,
- fullscreen wallpaper mode,
- overlay wallpaper mode.

Avoid introducing fixed pink/purple styling for core structure. Accent decorations should derive from existing variables such as `--standard-accent`, `--standard-accent-soft`, and related standard palette tokens.

When fullscreen wallpaper is active, article and Moments surfaces may retain controlled translucency, but text contrast must remain sufficient and the page must not reintroduce excessive backdrop blur.

## Responsive behavior

Breakpoints should follow existing site conventions where possible rather than creating many new one-off breakpoints.

Desktop priorities:

- editorial whitespace,
- breakout media,
- side reading-progress rail,
- broader Moments media composition.

Tablet priorities:

- preserve reading width,
- reduce decorative side offsets,
- keep category strip usable with wrapping or horizontal scrolling.

Mobile priorities:

- maximize content width,
- top reading-progress line,
- date chapter labels above entries,
- no hover-only critical controls,
- media grids without overflow,
- readable code/table horizontal scrolling.

## Accessibility

- Preserve semantic article structure and heading order from Markdown.
- Ensure all interactive controls have visible `:focus-visible` states.
- Decorative progress rails, binding marks, and today pulse must not be announced by screen readers.
- Respect `prefers-reduced-motion` and existing `data-reduce-motion="true"` behavior.
- Do not communicate category/date/state using color alone.
- Maintain sufficient text/background contrast in light, dark, fullscreen, and overlay modes.

## Technical boundaries

Primary implementation areas are expected to be:

- `src/pages/posts/[slug].astro` for article metadata/progress hooks,
- shared article typography styles in the standard/global style layer,
- `src/pages/moments.astro` for Moments structure, rendering groups, and page-specific styles,
- small focused helper logic if date grouping/reading time becomes clearer when extracted.

Avoid unrelated refactors of the global layout, wallpaper system, or Moments API/auth/upload backend.

The existing Moments page is large; implementation should prefer extracting focused presentation helpers/styles only when it reduces risk and complexity. A large rewrite of networking/authentication logic is explicitly out of scope.

## Verification strategy

Automated regression tests should cover at minimum:

### Article

- editorial metadata rail exists,
- reading-time output exists,
- reading progress hooks exist and are scoped to article content,
- prose width and wide-media breakout rules exist,
- H2/H3 hierarchy and blockquote/code/table treatments are present,
- mobile progress treatment exists,
- reduced-motion handling exists.

### Moments

- date chapter grouping logic exists,
- today marker logic exists with reduced-motion support,
- text/single-media/multi-media variants receive distinct classes or deterministic selectors,
- category control strip remains functional,
- publish composer IDs/data hooks required by existing JS remain intact,
- reactions/lightbox/upload/session behavior hooks are preserved,
- mobile layout removes excessive timeline indentation.

### Integration

- `astro check && astro build` passes,
- existing site test suite passes,
- GitHub Pages deployment succeeds after merge,
- manual visual verification should cover desktop + mobile, light + dark, and at least fullscreen + normal wallpaper modes.

## Out of scope

- Changing Moments API contracts or persistence format.
- Changing authentication/session design.
- Changing upload limits or storage provider.
- Rewriting Markdown content.
- Adding a full table-of-contents subsystem unless later requested separately.
- Replacing the site-wide font system.
- Redesigning unrelated pages such as home, projects, messages, or player.

## Success criteria

The redesign is successful when:

1. A long article feels comfortable to read for several minutes without the page looking like one oversized generic card.
2. Article headings, metadata, quotes, code, tables, and media have a clear editorial hierarchy.
3. Moments can be scanned by date and media type without every entry looking identical.
4. Moments retains all current publishing, media, reaction, lightbox, and session capabilities.
5. Both pages clearly respond to the selected theme hue and light/dark mode without becoming visually noisy.
6. Mobile layouts feel intentionally designed rather than scaled-down desktop versions.
7. The two pages have distinct identities while still looking like parts of the same blog.