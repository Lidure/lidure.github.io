# Sticky Message Board Redesign

## Status

Approved design for the `/messages` redesign. This document intentionally covers product behavior, data model, API boundaries, interaction rules, compatibility, performance, and testing. Implementation has not started.

## Goal

Replace the current conventional two-column guestbook with a shared, tactile sticky-note message board. Visitors should feel like they are placing notes on the same public corkboard rather than posting into a feed.

The redesign must preserve existing messages, comments, admin moderation, and the homepage recent-message integration.

## Core Experience

- One shared public corkboard for all visitors.
- Fixed logical width and vertically expanding height.
- Notes appear scattered rather than in a list or grid.
- New notes use a short “stick onto board” entrance animation.
- Notes are pure text in the first release.
- Note color is randomly selected by default but can be changed by the author.
- Note size is automatically classified as small, medium, or large from text length.
- Notes may overlap lightly, but no note may substantially cover another.
- Clicking a note opens details in a right-side drawer on desktop and a bottom sheet on mobile.
- Desktop hover and mobile long-press expose quick Emoji reactions.
- Desktop dragging is immediate; mobile dragging starts after an approximately 350 ms long press so normal vertical scrolling remains usable.
- Every visitor may drag any note locally for playful interaction.
- Only the original author’s browser may persist the final position of that author’s own new notes.
- The author may also edit, recolor, and delete their own new notes.
- Other visitors’ drag changes are local-only and disappear after reload.
- New messages from other visitors appear automatically without a full page refresh.

## Visual Direction

The board uses a restrained physical corkboard treatment rather than a cartoon classroom noticeboard.

- Fine cork grain with subtle inner shading and edge depth.
- Low-saturation paper colors suitable for both light and dark themes.
- Small pin or tape details may be used as decoration, but they should not dominate every note.
- Existing site typography remains authoritative for readability and visual continuity.
- Theme changes must adjust cork brightness, paper contrast, text contrast, and shadows together.
- Motion should be short and tactile rather than exaggerated.

Recommended motion behavior:

- New-note entrance: roughly 220–300 ms, combining small scale, slight drop, and shadow settling.
- Drag lift: small scale increase, stronger shadow, and slight reduction of the note’s resting rotation.
- Drop: short spring-like settle.
- Emoji quick bar: fade plus slight upward movement.
- Drawer/sheet: consistent with existing site transition timing.
- All motion respects `prefers-reduced-motion` and the site’s reduced-motion setting.

## Existing System Compatibility

The current `guest_messages` table remains the canonical message store. Existing comments remain attached with `target_type = 'message'`. Existing homepage recent-message UI continues to consume `/api/messages` rather than being replaced by a separate system.

Old guest messages are preserved. They do not receive ownership tokens retroactively because there is no trustworthy way to prove their original author.

For old messages:

- They render as sticky notes.
- They receive stable generated color, size, position, and rotation derived from the message ID.
- Their generated appearance does not change on refresh.
- Visitors may still drag them locally.
- Only the administrator may persistently reposition or delete them.
- They continue to support comments and new message-level Emoji reactions.

## Data Model

Extend `guest_messages` rather than creating a second message-layout table.

Suggested nullable columns:

- `note_color TEXT`
- `note_size TEXT`
- `pos_x REAL`
- `pos_y REAL`
- `rotation REAL`
- `author_token_hash TEXT`
- `updated_at INTEGER`

`note_size` is constrained by application logic to `small`, `medium`, or `large`.

Coordinates are stored in board logical units, not raw device pixels. The browser maps logical coordinates into the rendered board width.

A separate `message_reactions` table stores message-level reactions, following the same one-current-reaction-per-visitor pattern already used by Moments/comments.

Suggested shape:

- `message_id TEXT NOT NULL`
- `emoji TEXT NOT NULL`
- `ip_hash TEXT NOT NULL`
- `created_at INTEGER NOT NULL`

The table should support efficient lookup by `message_id` and replacement/removal of the current visitor’s reaction.

## Anonymous Author Ownership

New messages use browser-bound anonymous ownership with no account system.

Creation flow:

1. The server creates the message and generates a cryptographically strong random author token.
2. The database stores only a hash of that token.
3. The plaintext token is returned exactly once in the creation response.
4. The browser stores a local `messageId -> authorToken` mapping in `localStorage`.

Author mutations carry the token. The server hashes and verifies it before allowing persistent changes.

The author token authorizes:

- persistent position changes,
- text edits,
- color changes,
- deletion of that note.

Losing browser storage or changing devices means losing author control. There is no recovery or custom edit-code flow in this version.

Admin moderation remains authoritative and may delete or adjust any message.

## API Design

Keep `/api/messages` as the main endpoint family.

### GET `/api/messages`

Returns message content plus sticky-note metadata, comment count, and message reaction counts.

It should support an incremental synchronization parameter such as `since` or a cursor so polling does not repeatedly reload the entire board.

Old rows with null note metadata are converted to stable derived values in the response layer.

### POST `/api/messages`

Creates a note and returns:

- the message item,
- generated stable board metadata,
- the one-time plaintext `authorToken`.

Initial placement should be collision-aware rather than purely random.

### PATCH `/api/messages`

Updates an author-owned new note. Supported fields are limited to the mutable note state required by the product:

- text,
- note color,
- final logical x/y position.

Size is recalculated from text length rather than trusted directly from the client. Resting rotation remains server-controlled/stable rather than user-editable.

The server verifies the author token before applying the update. The administrator may use the existing admin authorization path for moderation operations.

### DELETE `/api/messages`

Supports deletion by the note author with the author token and deletion by the administrator with admin authorization.

Associated comments and reactions must not be left in an inconsistent state; deletion behavior should explicitly clean dependent data or preserve it only if the existing schema intentionally does so.

### POST `/api/message-reactions`

Adds, switches, or removes the current visitor’s single Emoji reaction for one message, following the existing Moments/comment reaction behavior.

## Board Coordinate System

Use a fixed-width logical board coordinate space. Rendering scales that logical width to the available board width on desktop, tablet, and mobile.

The design objective is that notes retain the same spatial relationships across devices instead of being independently randomized per viewport.

The board’s rendered height is computed from the lowest note plus bottom breathing room. As content grows, the board extends downward.

## Placement Algorithm

New-note placement uses random candidate sampling with collision scoring.

For each candidate position, score at least:

- overlap area with existing notes,
- distance from board edges,
- available whitespace,
- preference toward the newer/lower portion of the current board.

Choose the best candidate from a bounded sample set. Light edge overlap is allowed. Excessive overlap is rejected.

If no acceptable candidate exists in the current active region, extend the board downward and search in the new region.

Old notes use a stable seeded layout derived from message IDs. This must be deterministic so the same old dataset produces the same initial board on every refresh.

## Drag and Collision Rules

Dragging is visually unconstrained so it feels natural. Hard collision blocking during pointer movement is intentionally avoided.

On release:

1. Clamp the note inside valid board bounds.
2. Evaluate excessive overlap.
3. If overlap exceeds the accepted threshold, move the note to the nearest acceptable position.
4. Preserve light overlap.
5. If the visitor is the verified author, persist the final x/y coordinates once.
6. Otherwise keep the move local-only.

Do not write position updates continuously during pointer movement.

## Layering

Clicking or dragging a note temporarily raises it above nearby notes in the current browser.

Do not persist z-index globally. Persisting layer order would create unnecessary writes and allow ordinary clicks from different visitors to constantly change shared state.

## Note Detail Drawer

Desktop uses a right-side drawer. Mobile uses a bottom sheet.

The detail surface contains:

- full message text,
- author display ID,
- creation time,
- reaction counts and controls,
- comments,
- author edit/delete controls when a valid local author token is available,
- admin moderation controls when admin mode is active.

Opening a note for details must not rearrange the board itself.

## Composer and Editing

The composer is opened through a clear “贴一张便签” action rather than permanently occupying a large left column.

Fields in the first release:

- display ID,
- text,
- color choice.

A color is preselected randomly. The visitor may change it before posting.

Editing an existing owned note reuses the same editor flow. Text changes recalculate the small/medium/large size class and may trigger a post-edit collision correction if the footprint changes substantially.

## Note Size Classification

Use three bounded sizes rather than fully fluid note dimensions.

The exact character thresholds belong in implementation constants and tests, but the behavior is:

- short message -> small,
- normal message -> medium,
- longer message -> large.

The existing message maximum length remains enforced unless a separate approved change alters it.

## Quick Emoji Interaction

The board itself stays visually clean. Reaction controls are normally hidden.

- Desktop: hover/focus exposes a compact Emoji bar.
- Mobile: long press exposes the same control, while drag intent is disambiguated by pointer movement after the long-press threshold.
- Tapping/clicking the note body opens details.

The first release should use a small curated quick set such as `❤️ 😂 ✨ 👍`; the detail drawer may expose the broader supported reaction set if desired by the existing interaction system.

## Live Synchronization

Use lightweight polling instead of WebSockets.

Recommended cadence while the page is visible: approximately 12–15 seconds.

Rules:

- Pause or substantially reduce polling while the tab is hidden.
- Run an immediate sync when the page becomes visible again.
- Fetch only changes since the last successful synchronization when possible.
- Insert newly created notes with the stick-on animation.
- Do not re-render or reorder the whole board for each poll.
- Do not overwrite a note currently being dragged or edited locally; defer remote reconciliation until the local interaction finishes.

## Frontend Structure

Do not continue growing all behavior inside `src/pages/messages.astro`.

Recommended responsibilities:

- `messages.astro`: page shell and initial mount.
- `MessageBoard`: board lifecycle, logical coordinate mapping, note collection, polling, interaction locks.
- `StickyNote`: note visuals, pointer interaction, temporary z-order, quick reactions.
- `NoteComposer`: create/edit form and color picker.
- `MessageDrawer`: desktop drawer/mobile sheet, comments, reactions, ownership/admin actions.
- `message-board-layout.ts`: deterministic layout, size classification, coordinate mapping, collision scoring/correction.
- `public-interactions.ts`: typed client API additions for message ownership, mutations, reactions, and incremental fetches.

Names may adapt to the repository’s established component conventions, but responsibilities should remain separated.

## Error Handling

Initial load failure:

- Keep the corkboard shell visible.
- Show a lightweight retry affordance rather than replacing the whole page with an error screen.

Polling failure:

- Preserve the current board.
- Retry later without disruptive alerts.

Create/edit failure:

- Keep the user’s typed text and selected color in the composer.
- Show a concise actionable error.

Persistent drag save failure:

- Revert the author’s note to the last server-confirmed position.
- Show a small non-blocking save-failed message.

Rate limiting (`429`):

- Surface a specific “操作太频繁，请稍后再试” style message.

Authorization failure:

- Treat the note as non-owned in the UI after the server rejects the stored token.
- Do not repeatedly retry a stale token mutation.

## Performance

- Use `transform` for drag movement.
- Avoid layout reads/writes on every pointer frame.
- Run collision checks on creation and release, not continuously during drag.
- Commit one position request on release for owned notes.
- Avoid a full-board refresh for polling.
- For very long boards, progressively mount/render distant sections rather than forcing all historical notes into an expensive interactive layer at once.
- Preserve a basic readable fallback for users without interactive JavaScript where practical.

## Accessibility

- Notes remain keyboard-focusable.
- Opening details is available without dragging.
- Quick reactions must also be reachable by keyboard/focus, not hover only.
- The composer and drawer use proper labels, focus management, and escape/close behavior.
- Mobile dragging must not break ordinary page scrolling.
- Reduced-motion preferences are fully respected.
- Paper/background/text contrast must remain readable in both light and dark themes.

## Homepage Integration

`RecentMessagesWidget` continues to fetch the existing message API and show recent text entries.

Only small wording/visual adjustments are expected, for example presenting them as recently posted notes. The homepage widget does not become another draggable corkboard.

The API response must remain backward-compatible enough that the homepage widget can continue reading `userId`, `text`, and `createdAt` without special migration logic.

## Testing Strategy

### Pure layout tests

Lock down:

- deterministic old-message placement,
- small/medium/large classification,
- logical-to-rendered coordinate mapping,
- collision scoring,
- overlap threshold enforcement,
- board-height extension,
- release correction near edges and overlapping notes.

### API tests

Lock down:

- creation returns an author token once,
- only the token hash is persisted,
- valid author token can edit/recolor/move/delete its note,
- invalid or missing token cannot persist author-only mutations,
- old notes remain readable without tokens,
- admin moderation still works,
- message reactions add/switch/remove correctly,
- incremental message synchronization works,
- existing comments continue to work against message targets,
- homepage-required message fields remain present.

### Page/interaction contract tests

Lock down:

- desktop direct drag,
- mobile long-press drag without breaking scroll,
- non-author drag remains local-only,
- author drag persists only on release,
- click opens desktop drawer/mobile sheet,
- quick Emoji interaction is discoverable and usable,
- new polled messages appear without full refresh,
- current drag/edit state is not overwritten by polling,
- light/dark theme readability,
- reduced-motion behavior.

## Acceptance Criteria

The redesign is complete only when all of the following are true:

1. All existing messages remain available.
2. Existing messages render as stable sticky notes and do not shuffle on refresh.
3. New notes receive collision-aware scattered placement.
4. The board grows downward as notes accumulate.
5. Light overlap is possible, but severe covering is corrected.
6. Desktop dragging feels immediate and mobile scrolling remains normal until a long press begins drag mode.
7. Any visitor can move a note temporarily.
8. Only the creator browser can persist position changes for its own new notes.
9. The creator browser can edit, recolor, and delete its own new notes.
10. Old notes cannot be falsely claimed by ordinary visitors.
11. Desktop detail view is a right drawer and mobile detail view is a bottom sheet.
12. Comments continue to work.
13. Message-level Emoji reactions work from quick controls and detail view.
14. New messages appear automatically without a page refresh.
15. Polling does not disrupt a note currently being dragged or edited.
16. Network failures do not erase drafted content or destroy the current board state.
17. The homepage recent-message widget still works.
18. Light theme, dark theme, keyboard use, mobile interaction, and reduced-motion mode are all usable.
19. Automated tests cover deterministic layout, ownership authorization, incremental synchronization, reactions, drag persistence, and compatibility contracts.

## Explicit Non-Goals for This Version

- Image attachments in notes.
- User accounts or login-based ownership.
- Cross-device recovery of author ownership.
- Custom edit codes/passwords.
- Infinite pan/zoom canvas.
- User-controlled arbitrary note resizing or rotation.
- Persisted global z-index changes.
- WebSocket real-time delivery.
- Rebuilding the homepage recent-message widget as a second corkboard.
