# Public Message Stickers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent public sticker system to `/messages` so visitors can choose approved cute/cartoon character stickers, place them on the corkboard, and later move/delete their own stickers while admins can manage all stickers.

**Architecture:** Implement stickers as an independent `message_stickers` subsystem rather than special guest messages. The Worker owns validation, browser-level ownership tokens, five-sticker limits, position clamping, and admin overrides; the frontend owns the catalog UI, placement mode, rendered sticker layer, drag/delete interactions, and polling. Existing sticky-note comments, reactions, and local decorative stickers remain unchanged.

**Tech Stack:** Astro, TypeScript, browser Pointer Events, Cloudflare Workers, D1, Node test runner, existing admin session helpers, existing message-board logical coordinate/gesture helpers.

**Spec:** `docs/superpowers/specs/2026-08-29-public-message-stickers-design.md`

## Global Constraints

- Public stickers are independent from `guest_messages`; do not store stickers as special messages.
- Normal visitors may own at most 5 active public stickers per browser ownership token.
- Sticker owners may move/delete only their own stickers; administrators may move/delete all stickers and bypass the 5-sticker creation limit.
- Sticker identity is browser-level and anonymous; raw owner tokens stay in `localStorage`, only hashes are persisted in D1.
- Sticker keys must come from a shared allow-list catalog; clients cannot submit arbitrary image URLs.
- Public stickers render below sticky-note content and must not block sticky-note detail/comment interactions.
- Desktop drag starts only after pointer movement exceeds the existing drag threshold; touch drag keeps the existing long-press behavior.
- First release does not allow user scaling, arbitrary rotation, or changing sticker type after creation.
- Third-party character image URLs are isolated in the catalog so broken links can be replaced without changing controller/API code.
- The five-sticker browser limit is a normal-use restriction, not a security boundary; creation must also use server-side request/IP throttling.
- Ownership tokens used for GET ownership discovery must be sent in a request header, not in the URL/query string.

---

## File Structure

### Create

- `danmaku-api/migrations/0009_message_stickers.sql` — D1 table and indexes for public stickers.
- `danmaku-api/src/message-stickers.ts` — sticker catalog metadata required by the Worker plus route implementation/helpers.
- `danmaku-api/tests/message-stickers.test.ts` — route, ownership, limit, validation, admin, and clamping regression tests.
- `src/lib/message-sticker-catalog.ts` — browser-facing sticker manifest with labels, image URLs, and display footprints.
- `src/lib/message-sticker-api.ts` — localStorage ownership token plus GET/POST/PATCH/DELETE API client.
- `src/lib/message-sticker-controller.ts` — sticker panel, placement mode, public sticker rendering, drag/delete, ownership UI, polling.
- `src/styles/message-board-public-stickers.css` — public sticker panel/layer/placement/control styling.
- `tests/message-board-public-stickers.test.mjs` — static contract regression for panel markup, isolated layer, catalog, and controller wiring.

### Modify

- `danmaku-api/src/index.ts` — dispatch `/api/message-stickers` before generic routes.
- `src/components/MessageBoard.astro` — import public sticker CSS, add `贴纸屋 ✦` button/panel/layer hooks, initialize/cleanup sticker controller, pass admin state bridge.
- `src/lib/message-board-controller.ts` — expose admin-mode changes via a small callback/event contract without absorbing sticker logic.
- `src/styles/message-board.css` — only minimal layout adjustments needed for the second toolbar action; no public-sticker styling here.
- `tests/message-board-page.test.mjs` — preserve existing note-detail/comment behavior and assert sticker layer does not replace existing board structure.
- `danmaku-api/README.md` — document migration 0009 and `/api/message-stickers` behavior.

---

### Task 1: D1 Schema and Worker Sticker Domain

**Files:**
- Create: `danmaku-api/migrations/0009_message_stickers.sql`
- Create: `danmaku-api/src/message-stickers.ts`
- Create: `danmaku-api/tests/message-stickers.test.ts`
- Modify: `danmaku-api/src/index.ts`

**Interfaces:**
- Produces `handleMessageStickerRequest(request: Request, url: URL, env: MessageStickerEnv): Promise<Response | null>`.
- Produces public API shape `MessageStickerItem = { id, stickerKey, x, y, rotation, createdAt, updatedAt }`.
- Consumes existing admin `readSession()` and existing hashing primitives/patterns from the message-board code.

- [ ] **Step 1: Add a failing API test fixture for the new route**

Create tests that call `/api/message-stickers` through `handleMessageStickerRequest` and initially expect GET to return `{ items: [], ownedIds: [], ownedCount: 0 }`.

```ts
it('lists public stickers without exposing ownership hashes', async () => {
  const response = await handleMessageStickerRequest(
    request('https://example.test/api/message-stickers', { headers: { 'X-Message-Sticker-Owner': OWNER_TOKEN } }),
    new URL('https://example.test/api/message-stickers'),
    env,
  );
  expect(response?.status).toBe(200);
  const body = await response!.json() as any;
  expect(body.items).toEqual([]);
  expect(body.ownedIds).toEqual([]);
  expect(body.ownedCount).toBe(0);
  expect(JSON.stringify(body)).not.toContain('owner_token_hash');
});
```

- [ ] **Step 2: Run the API test and verify RED**

Run from `danmaku-api`:

```bash
npm test -- message-stickers.test.ts
```

Expected: FAIL because `message-stickers.ts` / `handleMessageStickerRequest` does not exist.

- [ ] **Step 3: Add migration 0009**

Use exactly:

```sql
CREATE TABLE IF NOT EXISTS message_stickers (
  id TEXT PRIMARY KEY,
  sticker_key TEXT NOT NULL,
  pos_x REAL NOT NULL,
  pos_y REAL NOT NULL,
  rotation REAL NOT NULL DEFAULT 0,
  owner_token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_message_stickers_owner
ON message_stickers(owner_token_hash);

CREATE INDEX IF NOT EXISTS idx_message_stickers_updated
ON message_stickers(updated_at);
```

- [ ] **Step 4: Implement minimal catalog and GET route**

Define a server allow-list with the same stable keys later used by the frontend, e.g.:

```ts
export const MESSAGE_STICKER_DEFINITIONS = {
  'hello-kitty-01': { width: 88, height: 94 },
  'cinnamoroll-01': { width: 96, height: 84 },
  'kuromi-01': { width: 88, height: 96 },
  'my-melody-01': { width: 90, height: 98 },
  'pompompurin-01': { width: 96, height: 88 },
  'pochacco-01': { width: 90, height: 96 },
  'keroppi-01': { width: 88, height: 82 },
} as const;
```

Implement GET so the optional `X-Message-Sticker-Owner` header is hashed and only used to compute `ownedIds` / `ownedCount`.

- [ ] **Step 5: Wire the Worker dispatcher and verify GET GREEN**

In `danmaku-api/src/index.ts`, call `handleMessageStickerRequest()` next to `handleStickyMessageRequest()` before unrelated route handling.

Run:

```bash
npm test -- message-stickers.test.ts
```

Expected: initial GET contract PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add danmaku-api/migrations/0009_message_stickers.sql danmaku-api/src/message-stickers.ts danmaku-api/src/index.ts danmaku-api/tests/message-stickers.test.ts
git commit -m "feat: add public message sticker storage"
```

---

### Task 2: Sticker Create Limit, Validation, and Ownership Mutation

**Files:**
- Modify: `danmaku-api/src/message-stickers.ts`
- Modify: `danmaku-api/tests/message-stickers.test.ts`

**Interfaces:**
- POST consumes `{ stickerKey, ownerToken, posX, posY }` and returns `{ item }`.
- PATCH consumes `{ id, ownerToken?, posX, posY }` and returns `{ item }`.
- DELETE consumes `{ id, ownerToken? }` and returns `{ deleted: true }`.
- Admin session may authorize PATCH/DELETE without an owner match and may bypass the POST count limit.

- [ ] **Step 1: Add failing tests for POST validation and five-sticker limit**

Cover:

```ts
it('rejects unknown sticker keys with STICKER_INVALID_KEY', ...);
it('rejects a sixth sticker for the same browser token', ...);
it('clamps sticker coordinates using the catalog footprint', ...);
it('never persists or returns the raw owner token', ...);
```

For the sixth creation assert HTTP `429` or `409` consistently and body code `STICKER_LIMIT_REACHED`.

- [ ] **Step 2: Verify RED for POST tests**

Run:

```bash
npm test -- message-stickers.test.ts
```

Expected: new POST tests FAIL.

- [ ] **Step 3: Implement POST**

Required algorithm:

```ts
const ownerToken = normalizeOwnerToken(body.value.ownerToken);
const ownerHash = await hashStickerOwnerToken(ownerToken);
const definition = getMessageStickerDefinition(stickerKey);
const ownedCount = await countOwnedStickers(env.DB, ownerHash);
if (!admin && ownedCount >= 5) return errorResponse(...'STICKER_LIMIT_REACHED'...);
const { x, y } = clampStickerPosition(posX, posY, definition);
const rotation = deterministicStickerRotation(id);
```

Use a bounded token length (minimum 24 characters, maximum 256) and reject missing/malformed values.

- [ ] **Step 4: Add failing PATCH/DELETE authorization tests**

Cover owner success, foreign token 403, admin success, and deletion releasing one quota slot.

- [ ] **Step 5: Verify RED for mutation tests**

Run the same API test command; expected new mutation tests FAIL.

- [ ] **Step 6: Implement PATCH and DELETE**

PATCH only accepts `posX` / `posY`; ignore or reject attempts to modify `stickerKey`, rotation, or dimensions. Authorize with owner hash match OR valid admin session.

- [ ] **Step 7: Add bounded creation throttling test**

Reuse the project’s existing request/IP hash or rate-limit pattern so rapid sticker creation from one network identity is capped independently of the browser-token quota. The test must prove throttling does not alter GET/PATCH/DELETE behavior.

- [ ] **Step 8: Run all Worker tests and type checks**

```bash
npm test
npm run typecheck --if-present
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```bash
git add danmaku-api/src/message-stickers.ts danmaku-api/tests/message-stickers.test.ts
git commit -m "feat: secure public sticker mutations"
```

---

### Task 3: Browser Catalog and Sticker API Client

**Files:**
- Create: `src/lib/message-sticker-catalog.ts`
- Create: `src/lib/message-sticker-api.ts`
- Create: `tests/message-board-public-stickers.test.mjs`

**Interfaces:**
- Produces `MESSAGE_STICKER_CATALOG` entries `{ key, label, character, imageUrl, width, height }`.
- Produces `getOrCreateStickerOwnerToken()`, `fetchMessageStickers()`, `createMessageSticker()`, `updateOwnedMessageSticker()`, `deleteOwnedMessageSticker()`.
- API ownership header name is exactly `X-Message-Sticker-Owner`.

- [ ] **Step 1: Write a failing static contract test for catalog isolation and owner header**

Assert:

```js
assert.match(catalogSource, /MESSAGE_STICKER_CATALOG/);
assert.match(apiSource, /message_sticker_owner_token_v1/);
assert.match(apiSource, /X-Message-Sticker-Owner/);
assert.doesNotMatch(apiSource, /ownerToken=.*URLSearchParams/);
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/message-board-public-stickers.test.mjs
```

Expected: FAIL because catalog/API files do not exist.

- [ ] **Step 3: Implement the browser catalog**

Add 12–18 approved entries. Keep all third-party URLs only in this file. Include at minimum the seven server keys defined in Task 1 and add variants using additional stable keys that are also mirrored in the server catalog before release.

- [ ] **Step 4: Implement browser owner token storage and API calls**

Use `crypto.getRandomValues` to create a high-entropy browser token and store under `message_sticker_owner_token_v1`. GET passes the token only in the ownership header. POST/PATCH/DELETE pass `ownerToken` in JSON body, matching the spec.

- [ ] **Step 5: Run the static contract test GREEN**

```bash
node --test tests/message-board-public-stickers.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add src/lib/message-sticker-catalog.ts src/lib/message-sticker-api.ts tests/message-board-public-stickers.test.mjs
git commit -m "feat: add public sticker catalog client"
```

---

### Task 4: Sticker Panel and Public Sticker Rendering Layer

**Files:**
- Modify: `src/components/MessageBoard.astro`
- Create: `src/styles/message-board-public-stickers.css`
- Create: `src/lib/message-sticker-controller.ts`
- Modify: `tests/message-board-public-stickers.test.mjs`
- Modify: `tests/message-board-page.test.mjs`

**Interfaces:**
- `initMessageStickerController(options)` returns cleanup function.
- Required DOM hooks: `#message-sticker-open`, `#message-sticker-panel`, `#message-sticker-grid`, `#message-public-sticker-layer`, `#message-sticker-status`, `#message-sticker-count`.
- Controller consumes `MESSAGE_STICKER_CATALOG` and the Task 3 API client.

- [ ] **Step 1: Add failing DOM contract tests**

Assert `MessageBoard.astro` contains:

```html
<button id="message-sticker-open">...</button>
<div id="message-public-sticker-layer"></div>
```

and imports `message-board-public-stickers.css` plus initializes the sticker controller.

Also assert the existing `#message-board-stage` and `#message-drawer` remain present so sticker work cannot regress note details/comments.

- [ ] **Step 2: Run RED**

```bash
node --test tests/message-board-public-stickers.test.mjs tests/message-board-page.test.mjs
```

Expected: new sticker contract assertions FAIL while existing message-board tests remain meaningful.

- [ ] **Step 3: Add toolbar entry, panel shell, and layer mount**

Place `贴纸屋 ✦` beside `贴一张便签`. The panel must include close control, grid, `我的贴纸 0 / 5`, and status text. Put `#message-public-sticker-layer` inside the board stage before sticky notes are appended.

- [ ] **Step 4: Implement initial fetch/render/controller cleanup**

Render server items as absolutely positioned `.message-public-sticker` elements using the same logical-to-rendered coordinate conversion as notes. On image error, mark/hide only the failed sticker image; never render broken-image alt boxes over the board.

- [ ] **Step 5: Style the panel and under-note layer**

CSS requirements:

```css
.message-public-sticker-layer { position: absolute; inset: 0; z-index: 4; pointer-events: none; }
.message-public-sticker { position: absolute; pointer-events: auto; }
.sticky-note { z-index: 10; }
.message-public-sticker.is-dragging { z-index: 30; }
```

Do not globally raise sticker z-index above notes.

- [ ] **Step 6: Verify static tests GREEN**

Run the node tests from Step 2; expected PASS.

- [ ] **Step 7: Commit Task 4**

```bash
git add src/components/MessageBoard.astro src/styles/message-board-public-stickers.css src/lib/message-sticker-controller.ts tests/message-board-public-stickers.test.mjs tests/message-board-page.test.mjs
git commit -m "feat: add public sticker picker UI"
```

---

### Task 5: Placement Mode and Five-Sticker UX

**Files:**
- Modify: `src/lib/message-sticker-controller.ts`
- Modify: `src/styles/message-board-public-stickers.css`
- Modify: `tests/message-board-public-stickers.test.mjs`

**Interfaces:**
- Catalog selection sets `placingStickerKey`.
- Board placement calls `createMessageSticker(stickerKey, logicalX, logicalY)`.
- Controller displays owned count from GET/POST results and disables creation at 5/5 for non-admin users.

- [ ] **Step 1: Add failing contracts for placement mode**

Assert source contains clear placement state, Escape cancellation, board-coordinate conversion, and pending/error handling. Also assert the panel exposes owned count text.

- [ ] **Step 2: Run RED**

```bash
node --test tests/message-board-public-stickers.test.mjs
```

- [ ] **Step 3: Implement desktop placement preview**

After selecting a sticker, close/collapse the panel, set `data-placing-sticker`, create a semi-transparent preview that tracks pointer movement over the board, and convert client coordinates into the 1200px logical coordinate system before POST.

- [ ] **Step 4: Implement touch placement**

Do not require a cursor-following preview on coarse pointers. Show a compact selected-sticker banner and create on the next valid tap in board space.

- [ ] **Step 5: Implement cancellation and quota feedback**

Escape, explicit cancel, or clicking outside the board exits placement mode. `STICKER_LIMIT_REACHED` updates the panel to `我的贴纸 5 / 5` and prompts deletion rather than leaving a pending sticker.

- [ ] **Step 6: Run tests and build**

```bash
node --test tests/message-board-public-stickers.test.mjs tests/message-board-page.test.mjs
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add src/lib/message-sticker-controller.ts src/styles/message-board-public-stickers.css tests/message-board-public-stickers.test.mjs
git commit -m "feat: add public sticker placement mode"
```

---

### Task 6: Owner/Admin Drag and Delete Without Note Conflicts

**Files:**
- Modify: `src/lib/message-sticker-controller.ts`
- Modify: `src/lib/message-board-controller.ts`
- Modify: `src/components/MessageBoard.astro`
- Modify: `tests/message-board-public-stickers.test.mjs`
- Test existing: `tests/message-board-gesture.test.mjs`

**Interfaces:**
- Message-board controller emits or calls a bridge when admin mode changes: e.g. `window.dispatchEvent(new CustomEvent('message-board-admin-change', { detail: { authenticated } }))`.
- Sticker controller listens for that event and recomputes `canManageSticker(id)` as `adminMode || ownedIds.has(id)`.
- Drag uses existing `createGestureState`, `updateGesture`, `finishGesture` semantics.

- [ ] **Step 1: Add failing contracts for admin bridge and ownership controls**

Assert the message-board controller exposes admin changes and the sticker controller imports/reuses `message-board-gesture.mjs` instead of inventing a competing click/drag threshold.

- [ ] **Step 2: Run RED**

```bash
node --test tests/message-board-public-stickers.test.mjs tests/message-board-gesture.test.mjs
```

- [ ] **Step 3: Add the minimal admin-state bridge**

When `syncAdminUi(authenticated)` runs, emit one stable browser event. Do not move sticker logic into `message-board-controller.ts`.

- [ ] **Step 4: Implement owner/admin click menu and delete**

A manageable sticker receives a light popover with `删除`. Foreign stickers have no controls. Confirm before delete, call API, remove item from state, decrement owned count when appropriate.

- [ ] **Step 5: Implement pointer drag using existing gesture helper**

Desktop: waiting → drag only after movement threshold. Touch: short tap opens controls; hold starts drag. While dragging, only that sticker gets raised z-index. On PATCH failure restore the last server-confirmed position.

- [ ] **Step 6: Verify note interaction remains intact**

Run:

```bash
node --test tests/message-board-gesture.test.mjs tests/message-board-page.test.mjs tests/message-board-public-stickers.test.mjs
```

Expected: PASS, including the regression that single-clicking a sticky note still opens its detail/comments.

- [ ] **Step 7: Commit Task 6**

```bash
git add src/lib/message-sticker-controller.ts src/lib/message-board-controller.ts src/components/MessageBoard.astro tests/message-board-public-stickers.test.mjs
git commit -m "feat: manage owned public stickers"
```

---

### Task 7: Public Sticker Synchronization and Resilience

**Files:**
- Modify: `src/lib/message-sticker-controller.ts`
- Modify: `src/lib/message-sticker-api.ts`
- Modify: `tests/message-board-public-stickers.test.mjs`

**Interfaces:**
- Polling interval: 15 seconds, matching the message board’s existing cadence.
- GET returns a full current sticker snapshot; controller reconciles create/update/delete by replacing or diffing against the full set.
- Active drag interaction must not be overwritten until local PATCH resolves.

- [ ] **Step 1: Add failing polling/reconciliation contracts**

Assert the controller defines a 15,000ms poll interval, pauses while `document.hidden`, resumes on visibility change, and protects active sticker interactions from poll overwrite.

- [ ] **Step 2: Run RED**

```bash
node --test tests/message-board-public-stickers.test.mjs
```

- [ ] **Step 3: Implement full-snapshot polling**

Every 15 seconds fetch the current sticker list and owned IDs. Reconcile deletions as well as creates/moves. Keep polling quiet on transient network errors.

- [ ] **Step 4: Add active-interaction lock**

Mirror the note controller’s interaction-lock concept: defer remote replacement of a sticker currently being dragged until its local mutation resolves.

- [ ] **Step 5: Implement responsive repositioning**

On board/stage resize, recompute rendered positions from logical x/y; never persist display pixels back to the server.

- [ ] **Step 6: Run frontend tests and build**

```bash
node --test tests/message-board-public-stickers.test.mjs tests/message-board-page.test.mjs tests/message-board-gesture.test.mjs
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit Task 7**

```bash
git add src/lib/message-sticker-controller.ts src/lib/message-sticker-api.ts tests/message-board-public-stickers.test.mjs
git commit -m "feat: sync public message stickers"
```

---

### Task 8: Documentation, Full Regression, and Release Gate

**Files:**
- Modify: `danmaku-api/README.md`
- Review: all files from Tasks 1–7

**Interfaces:**
- Deployment requires applying `0009_message_stickers.sql` to the production D1 database before/with Worker code that serves `/api/message-stickers`.

- [ ] **Step 1: Document migration and API**

Add concise README sections for:

```text
0009_message_stickers.sql
GET/POST/PATCH/DELETE /api/message-stickers
X-Message-Sticker-Owner
5 active stickers per browser token
admin override
```

Also mention catalog URLs are third-party assets and can require replacement if hosts change.

- [ ] **Step 2: Run complete Worker regression**

From `danmaku-api`:

```bash
npm test
npm run typecheck --if-present
```

Expected: PASS.

- [ ] **Step 3: Run complete site regression**

From repository root:

```bash
node --test tests/message-board-gesture.test.mjs tests/message-board-page.test.mjs tests/message-board-public-stickers.test.mjs
npm run build
```

Expected: PASS.

- [ ] **Step 4: Inspect branch diff for accidental scope expansion**

Expected changed scope is limited to the design/plan docs, migration, sticker API/domain, sticker frontend files, targeted message-board bridge/layout files, tests, and Worker README. No unrelated page/theme/article files should change.

- [ ] **Step 5: Create temporary GitHub Actions verification only if existing CI cannot exercise the new focused tests**

The temporary workflow must run Worker tests, focused message-board tests, and root build, then be deleted after a confirmed GREEN run so it is not merged.

- [ ] **Step 6: Open PR**

PR body must include:

```text
- public persistent sticker picker
- browser-level anonymous ownership
- 5-sticker normal-use quota + server-side throttling
- owner/admin move and delete
- under-note z-index so comments/details remain clickable
- D1 migration 0009 deployment requirement
- third-party character asset caveat
- exact regression/build results
```

- [ ] **Step 7: Verify PR mergeability and CI, then squash merge**

Use the final PR head SHA as the expected merge head. Do not merge if migration/API tests, focused message-board tests, or site build are red.

---

## Self-Review

- **Spec coverage:** The plan covers catalog isolation, persistent D1 storage, browser ownership, 5-sticker limit, admin override, allow-list validation, placement, under-note layering, desktop/touch drag semantics, deletion, polling, rate limiting, broken image resilience, responsive coordinates, and deployment documentation.
- **Placeholder scan:** No `TBD`/`TODO` or undefined future implementation placeholders remain.
- **Type consistency:** The same `stickerKey`, `x`, `y`, `rotation`, `ownedIds`, `ownedCount`, `ownerToken`, and `X-Message-Sticker-Owner` names are used across server, browser API, controller, and tests.
