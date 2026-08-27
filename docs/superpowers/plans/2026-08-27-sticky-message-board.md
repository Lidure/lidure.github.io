# Sticky Message Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/messages` with a shared corkboard-style sticky-note wall that preserves all existing messages/comments, adds browser-bound anonymous ownership, persistent author moves/edits/deletes, message reactions, collision-aware placement, mobile long-press drag, and lightweight live polling.

**Architecture:** Keep `guest_messages` as the canonical D1 table and extend it with sticky-note metadata and author-token hashes. The Cloudflare Worker remains the source of truth for persistence and authorization; the Astro frontend gets a thin API client, a pure layout helper, and a focused message-board controller mounted by a small `MessageBoard.astro` shell. Existing comments, admin session auth, and `RecentMessagesWidget` stay compatible.

**Tech Stack:** Astro 6.4.4, TypeScript 5.8.3, browser DOM APIs, Node `node:test`, Cloudflare Workers + D1, Vitest 2.1.8 for Worker tests.

**Spec:** `docs/superpowers/specs/2026-08-27-sticky-message-board-design.md`

## Global Constraints

- Preserve every existing `guest_messages` row; do not retroactively grant author ownership to legacy rows.
- Existing comments with `target_type = 'message'` must continue working.
- Existing homepage callers must still receive `id`, `userId`, `text`, and `createdAt` from `/api/messages`.
- New-note ownership is browser-bound only; no accounts, recovery codes, or cross-device recovery.
- Any visitor may move any note locally, but only a verified author or admin may persist position changes.
- New-note text stays pure text; keep the public message limit at 800 characters to match the existing page/legacy public contract.
- Note sizes are exactly `small`, `medium`, or `large`; clients never persist arbitrary width/height/rotation.
- Do not persist global z-index.
- Polling cadence while visible is 15 seconds; no WebSocket work in this version.
- Mobile drag starts after a 350 ms long press; ordinary vertical scroll must continue before drag activation.
- Quick board reactions are limited to `❤️`, `😂`, `✨`, `👍` in the first release.
- Respect both `prefers-reduced-motion` and the site `html[data-reduce-motion="true"]` convention.
- `danmaku-api/src/index.ts` + `danmaku-api/wrangler.jsonc` are the deployed Worker source/config; do not add feature logic to legacy `danmaku-api-pages/_worker.js`.

## File Map

- Create `danmaku-api/migrations/0008_sticky_message_board.sql` — D1 schema extension and `message_reactions` table.
- Create `danmaku-api/src/message-board.ts` — pure note metadata, token hashing, size classification, placement helpers, row mapping.
- Modify `danmaku-api/src/index.ts` — route wiring, D1 reads/writes, ownership/admin authorization, incremental sync, cleanup.
- Create `danmaku-api/tests/messages.test.ts` — Worker contract tests for sticky messages, ownership, reactions, polling, legacy compatibility.
- Modify `src/lib/public-interactions.ts` — typed note metadata, incremental fetch, author-token storage, author mutations, message reactions.
- Create `src/lib/message-board-layout.mjs` — browser-pure deterministic legacy layout, collision scoring/correction, board-height and coordinate helpers.
- Create `tests/message-board-layout.test.mjs` — executable layout-unit tests.
- Create `src/components/MessageBoard.astro` — accessible board/composer/drawer/admin shell and reusable DOM templates.
- Create `src/lib/message-board-controller.ts` — rendering, drag state, composer, drawer, reactions, comments integration, polling, interaction locks.
- Create `src/styles/message-board.css` — cork/paper visuals, responsive drawer/sheet, motion, dark theme, reduced motion.
- Replace `src/pages/messages.astro` — minimal page wrapper that mounts `MessageBoard`.
- Modify `src/components/RecentMessagesWidget.astro` — keep API compatibility, adjust copy only.
- Create `tests/message-board-page.test.mjs` — source-contract tests for shell/controller/accessibility/mobile/polling semantics.
- Modify `package.json` — include new root tests in `test:site`.
- Modify `danmaku-api/README.md` — sticky-message migration/deploy verification and correct current `lidure22.xyz` Worker domain references.

---

### Task 1: Add sticky-note schema and pure Worker domain helpers

**Files:**
- Create: `danmaku-api/migrations/0008_sticky_message_board.sql`
- Create: `danmaku-api/src/message-board.ts`
- Create: `danmaku-api/tests/messages.test.ts`

**Interfaces:**
- Produces `MESSAGE_REACTION_EMOJIS`, `NOTE_COLORS`, `classifyMessageNoteSize(text)`, `deriveLegacyNoteMeta(id, text)`, `createAuthorToken()`, `hashAuthorToken(token)`, `verifyAuthorToken(token, expectedHash)`, `chooseMessagePlacement(seed, occupied)`, and `toGuestMessageItem(row, commentCount, reactions)`.
- Later Worker route code consumes those helpers; frontend does not import this Worker module.

- [ ] **Step 1: Write the migration contract test before the migration exists**

Add this test to `danmaku-api/tests/messages.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(new URL('../migrations/0008_sticky_message_board.sql', import.meta.url), 'utf8');

describe('sticky message board schema', () => {
  it('adds note metadata and one reaction per visitor/message', () => {
    for (const column of ['note_color', 'note_size', 'pos_x', 'pos_y', 'rotation', 'author_token_hash', 'updated_at']) {
      expect(migration).toMatch(new RegExp(`ALTER TABLE guest_messages ADD COLUMN ${column}`));
    }
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS message_reactions/);
    expect(migration).toMatch(/PRIMARY KEY \(message_id, ip_hash\)/);
    expect(migration).toMatch(/CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id/);
  });
});
```

- [ ] **Step 2: Run the focused Worker test and confirm RED**

Run:

```bash
npm --prefix danmaku-api test -- --run tests/messages.test.ts
```

Expected: FAIL because `0008_sticky_message_board.sql` does not exist.

- [ ] **Step 3: Add the migration**

Create `danmaku-api/migrations/0008_sticky_message_board.sql` with exactly these schema changes:

```sql
ALTER TABLE guest_messages ADD COLUMN note_color TEXT;
ALTER TABLE guest_messages ADD COLUMN note_size TEXT;
ALTER TABLE guest_messages ADD COLUMN pos_x REAL;
ALTER TABLE guest_messages ADD COLUMN pos_y REAL;
ALTER TABLE guest_messages ADD COLUMN rotation REAL;
ALTER TABLE guest_messages ADD COLUMN author_token_hash TEXT;
ALTER TABLE guest_messages ADD COLUMN updated_at INTEGER;

CREATE TABLE IF NOT EXISTS message_reactions (
  message_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, ip_hash)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id
ON message_reactions(message_id);
```

- [ ] **Step 4: Add failing pure-helper tests**

Append tests that lock exact first-release constants and ownership behavior:

```ts
import {
  MESSAGE_REACTION_EMOJIS,
  classifyMessageNoteSize,
  createAuthorToken,
  deriveLegacyNoteMeta,
  hashAuthorToken,
  verifyAuthorToken,
} from '../src/message-board';

it('classifies notes into three bounded sizes', () => {
  expect(classifyMessageNoteSize('a'.repeat(64))).toBe('small');
  expect(classifyMessageNoteSize('a'.repeat(65))).toBe('medium');
  expect(classifyMessageNoteSize('a'.repeat(220))).toBe('medium');
  expect(classifyMessageNoteSize('a'.repeat(221))).toBe('large');
});

it('derives stable legacy metadata without granting ownership', () => {
  const first = deriveLegacyNoteMeta('legacy-id-1', '旧留言');
  const second = deriveLegacyNoteMeta('legacy-id-1', '旧留言');
  expect(second).toEqual(first);
  expect(first.rotation).toBeGreaterThanOrEqual(-4);
  expect(first.rotation).toBeLessThanOrEqual(4);
  expect(first.authorOwned).toBe(false);
});

it('creates a one-time token whose hash verifies without storing plaintext', async () => {
  const token = createAuthorToken();
  const hash = await hashAuthorToken(token);
  expect(token.length).toBeGreaterThanOrEqual(32);
  expect(hash).not.toContain(token);
  await expect(verifyAuthorToken(token, hash)).resolves.toBe(true);
  await expect(verifyAuthorToken(`${token}x`, hash)).resolves.toBe(false);
});

it('limits board quick reactions to the approved set', () => {
  expect(MESSAGE_REACTION_EMOJIS).toEqual(['❤️', '😂', '✨', '👍']);
});
```

- [ ] **Step 5: Run helper tests and confirm RED**

Run the same focused Vitest command. Expected: FAIL because `src/message-board.ts` does not exist.

- [ ] **Step 6: Implement the pure Worker helper module**

Create `danmaku-api/src/message-board.ts` with these public constants/types and semantics:

```ts
export const MESSAGE_REACTION_EMOJIS = ['❤️', '😂', '✨', '👍'] as const;
export const NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple'] as const;
export type MessageNoteSize = 'small' | 'medium' | 'large';
export type MessageNoteColor = typeof NOTE_COLORS[number];

export function classifyMessageNoteSize(text: string): MessageNoteSize {
  const length = Array.from(text.trim()).length;
  if (length <= 64) return 'small';
  if (length <= 220) return 'medium';
  return 'large';
}
```

Use a deterministic FNV-1a-style 32-bit seed for legacy layout; map the seed to one approved color, `x` in `[40, 900]`, `y` in `[60, 760]`, and rotation in `[-4, 4]`. `createAuthorToken()` must fill 32 random bytes with `crypto.getRandomValues` and return URL-safe base64. `hashAuthorToken()` must SHA-256 the token and return lowercase hex. `verifyAuthorToken()` must hash the provided token and compare equal-length hex strings without early exit.

For `chooseMessagePlacement(seed, occupied)`, use 24 deterministic candidate points within a 1200-unit board, score overlap plus edge penalty, permit up to 22% footprint overlap, and move the active search band down by 320 units when no candidate meets the threshold. Use logical footprints `small=220x180`, `medium=270x220`, `large=330x260`.

- [ ] **Step 7: Run helper/migration tests GREEN**

```bash
npm --prefix danmaku-api test -- --run tests/messages.test.ts
npm --prefix danmaku-api run check
```

Expected: both pass.

- [ ] **Step 8: Commit Task 1**

```bash
git add danmaku-api/migrations/0008_sticky_message_board.sql danmaku-api/src/message-board.ts danmaku-api/tests/messages.test.ts
git commit -m "feat: add sticky message board domain model"
```

---

### Task 2: Upgrade `/api/messages` with ownership, metadata, reactions, and incremental sync

**Files:**
- Modify: `danmaku-api/src/index.ts`
- Modify: `danmaku-api/tests/messages.test.ts`

**Interfaces:**
- `GET /api/messages?limit=&before=&since=` returns `{ items, now, nextCursor, nextBefore }`.
- `POST /api/messages` accepts `{ userId, text, noteColor }` and returns `{ item, authorToken }`.
- `PATCH /api/messages` accepts `{ id, authorToken?, text?, noteColor?, posX?, posY? }`; author token or valid admin session is required.
- `DELETE /api/messages` accepts `{ id, authorToken? }`; verified author or valid admin session is required.
- `POST /api/message-reactions` accepts `{ messageId, emoji, previousEmoji? }` and returns `{ reactions, selectedEmoji }`.

- [ ] **Step 1: Add failing API tests for legacy compatibility and incremental list**

Build a D1 stub using the same `makeDb(handler)` pattern already used in `auth.test.ts`, then add:

```ts
it('keeps homepage fields while returning sticky metadata and cursors', async () => {
  const db = makeDb((sql) => {
    if (sql.includes('FROM guest_messages')) {
      return makeBoundStatement({
        all: vi.fn().mockResolvedValue({
          results: [{ id: 'old-1', user_id: '旅人', text: '你好', created_at: 1000, note_color: null, note_size: null, pos_x: null, pos_y: null, rotation: null, author_token_hash: null, updated_at: null }],
        }),
      });
    }
    return makeBoundStatement();
  });
  const response = await worker.fetch(new Request('https://example.com/api/messages?limit=80'), makeEnv({ DB: db }));
  const body = await response.json();
  expect(body.items[0]).toMatchObject({ id: 'old-1', userId: '旅人', text: '你好', createdAt: 1000, note: expect.any(Object) });
  expect(body).toMatchObject({ now: expect.any(Number), nextCursor: expect.any(Number) });
});

it('uses since against COALESCE(updated_at, created_at)', async () => {
  const seenSql: string[] = [];
  const db = makeDb((sql) => { seenSql.push(sql); return makeBoundStatement(); });
  await worker.fetch(new Request('https://example.com/api/messages?since=1234'), makeEnv({ DB: db }));
  expect(seenSql.join('\n')).toContain('COALESCE(updated_at, created_at) > ?');
});
```

- [ ] **Step 2: Run focused tests and confirm RED**

```bash
npm --prefix danmaku-api test -- --run tests/messages.test.ts
```

Expected: FAIL because current list only returns basic fields and no cursor semantics.

- [ ] **Step 3: Implement list pagination/incremental sync**

Replace the current `handleMessagesList` query with explicit sticky columns and two modes:

```ts
const since = Math.max(0, Number(url.searchParams.get('since')) || 0);
const before = Math.max(0, Number(url.searchParams.get('before')) || 0);
const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 80));
```

- `since > 0`: query `WHERE COALESCE(updated_at, created_at) > ? ORDER BY COALESCE(updated_at, created_at) ASC LIMIT ?`.
- `before > 0`: query `WHERE created_at < ? ORDER BY created_at DESC LIMIT ?`.
- otherwise: newest first.

Attach comment counts with one grouped query and reaction counts with one grouped query. Map null metadata through `deriveLegacyNoteMeta`. Return `nextCursor = now`; return `nextBefore` as the oldest returned `createdAt` only when exactly `limit` items were returned.

- [ ] **Step 4: Add failing create/ownership tests**

```ts
it('creates a sticky note and returns the plaintext token only in the response', async () => {
  const writes: unknown[][] = [];
  const db = makeDb((sql, args) => {
    if (sql.startsWith('INSERT INTO guest_messages')) writes.push(args);
    return makeBoundStatement();
  });
  const response = await worker.fetch(new Request('https://example.com/api/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'A', text: 'hello board', noteColor: 'pink' }),
  }), makeEnv({ DB: db }));
  const body = await response.json();
  expect(response.status).toBe(201);
  expect(body.authorToken).toEqual(expect.any(String));
  expect(body.item.note.color).toBe('pink');
  expect(JSON.stringify(writes)).not.toContain(body.authorToken);
});

it('rejects author mutation with a wrong token', async () => {
  const db = makeDb((sql) => sql.includes('SELECT author_token_hash')
    ? makeBoundStatement({ first: vi.fn().mockResolvedValue({ author_token_hash: await hashAuthorToken('correct') }) })
    : makeBoundStatement());
  const response = await worker.fetch(new Request('https://example.com/api/messages', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'n1', authorToken: 'wrong', posX: 100, posY: 200 }),
  }), makeEnv({ DB: db }));
  expect(response.status).toBe(403);
});
```

When implementing the test helper, precompute the expected hash outside the synchronous `makeDb` callback.

- [ ] **Step 5: Implement create/PATCH/delete authorization**

Route `PATCH` in the `/api/messages` branch. On create:

```ts
const authorToken = createAuthorToken();
const authorTokenHash = await hashAuthorToken(authorToken);
const noteSize = classifyMessageNoteSize(text);
const noteColor = normalizeMessageNoteColor(body.value.noteColor) || seededDefaultColor(id);
const occupied = await readRecentOccupiedNotes(env.DB, 200);
const position = chooseMessagePlacement(id, occupied);
```

Insert all metadata and `updated_at = now`; return the plaintext token once.

For PATCH, allow only `text`, `noteColor`, `posX`, `posY`. Recompute `note_size` from updated text, clamp logical coordinates to the 1200-unit board and non-negative y, never accept a client rotation. Authorization order is: valid author token -> allow; otherwise valid admin session -> allow; otherwise return `403` with code `MESSAGE_FORBIDDEN`.

For DELETE, use the same authorization order. Before deleting the message, delete:

```sql
DELETE FROM comment_reactions WHERE comment_id IN (
  SELECT id FROM comments WHERE target_type = 'message' AND target_id = ?
);
DELETE FROM comments WHERE target_type = 'message' AND target_id = ?;
DELETE FROM message_reactions WHERE message_id = ?;
DELETE FROM guest_messages WHERE id = ?;
```

Legacy rows with null `author_token_hash` can therefore only pass the admin path.

- [ ] **Step 6: Add failing message-reaction tests**

```ts
it('adds, switches, and removes the current visitor reaction', async () => {
  const sql: string[] = [];
  const db = makeDb((statement) => { sql.push(statement); return makeBoundStatement(); });
  const response = await worker.fetch(new Request('https://example.com/api/message-reactions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '127.0.0.1' },
    body: JSON.stringify({ messageId: 'm1', emoji: '❤️', previousEmoji: '' }),
  }), makeEnv({ DB: db }));
  expect(response.status).toBe(200);
  expect(sql.some((value) => value.includes('DELETE FROM message_reactions'))).toBe(true);
  expect(sql.some((value) => value.includes('INSERT INTO message_reactions'))).toBe(true);
});
```

Also assert unsupported emoji returns 400.

- [ ] **Step 7: Implement `/api/message-reactions`**

Mirror the current one-reaction-per-IP behavior: validate target exists, hash client, delete current row, reinsert unless `previousEmoji === emoji`, aggregate counts, and return the selected emoji. Do not create another reaction table or user identity scheme.

- [ ] **Step 8: Run Worker GREEN suite**

```bash
npm --prefix danmaku-api test -- --run tests/messages.test.ts
npm --prefix danmaku-api test
npm --prefix danmaku-api run check
```

Expected: all pass.

- [ ] **Step 9: Commit Task 2**

```bash
git add danmaku-api/src/index.ts danmaku-api/tests/messages.test.ts
git commit -m "feat: add owned sticky message API"
```

---

### Task 3: Extend the browser API client and author-token storage

**Files:**
- Modify: `src/lib/public-interactions.ts`
- Create: `tests/message-board-page.test.mjs`

**Interfaces:**
- Add `MessageNoteMeta`, `GuestMessagePage`, `GuestMessagePatch` types.
- Add `fetchGuestMessagePage(options)`, while keeping existing `fetchGuestMessages()` returning an array for `RecentMessagesWidget`.
- Add `createGuestMessage(userId, text, noteColor)`, `updateOwnedGuestMessage(id, patch)`, `deleteOwnedGuestMessage(id)`, `hasGuestMessageOwnership(id)`, `reactToGuestMessage(...)`.
- Keep existing admin `deleteGuestMessage(id)` unchanged in meaning.

- [ ] **Step 1: Write failing source-contract tests**

Create `tests/message-board-page.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const api = read('src/lib/public-interactions.ts');

test('message API keeps legacy list compatibility and adds owned sticky mutations', () => {
  assert.match(api, /export type MessageNoteMeta/);
  assert.match(api, /export async function fetchGuestMessagePage/);
  assert.match(api, /export async function fetchGuestMessages\(\)/);
  assert.match(api, /export async function updateOwnedGuestMessage/);
  assert.match(api, /export async function deleteOwnedGuestMessage/);
  assert.match(api, /export function hasGuestMessageOwnership/);
  assert.match(api, /export async function reactToGuestMessage/);
  assert.match(api, /guest_message_author_tokens_v1/);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/message-board-page.test.mjs
```

Expected: FAIL on missing sticky API functions.

- [ ] **Step 3: Implement types and storage helpers**

Use this type shape:

```ts
export type MessageNoteMeta = {
  color: 'yellow' | 'pink' | 'blue' | 'green' | 'purple';
  size: 'small' | 'medium' | 'large';
  x: number;
  y: number;
  rotation: number;
  legacy: boolean;
};

export type GuestMessage = {
  id: string;
  userId: string;
  text: string;
  createdAt: number;
  updatedAt?: number;
  commentCount?: number;
  reactions?: Record<string, number>;
  note: MessageNoteMeta;
};
```

Store ownership as JSON under `guest_message_author_tokens_v1`:

```ts
type MessageAuthorTokenMap = Record<string, string>;
```

On successful POST, save only `{ [item.id]: authorToken }`; never expose the map in DOM attributes or query parameters. On 401/403 from an owned mutation, delete that message’s stale token.

- [ ] **Step 4: Implement incremental/page fetch without breaking homepage**

`fetchGuestMessagePage({ limit = 80, before, since })` builds query params and returns `{ items, now, nextCursor, nextBefore }`. Keep:

```ts
export async function fetchGuestMessages() {
  return (await fetchGuestMessagePage({ limit: 80 })).items;
}
```

This preserves `RecentMessagesWidget` without modification to its fetch call.

- [ ] **Step 5: Implement create/update/delete/reaction functions**

- `createGuestMessage(userId, text, noteColor)` sends the approved color and stores `authorToken` from the response.
- `updateOwnedGuestMessage` reads the token and PATCHes `{ id, authorToken, ...patch }`.
- `deleteOwnedGuestMessage` reads the token and DELETEs `{ id, authorToken }`, then removes the local token after success.
- `reactToGuestMessage` uses `/message-reactions` and the same selected-emoji return shape as `reactToComment`.

- [ ] **Step 6: Run client contract GREEN**

```bash
node --test tests/message-board-page.test.mjs
npm run check
```

Expected: both pass.

- [ ] **Step 7: Commit Task 3**

```bash
git add src/lib/public-interactions.ts tests/message-board-page.test.mjs
git commit -m "feat: add sticky message client API"
```

---

### Task 4: Build and test the deterministic browser layout engine

**Files:**
- Create: `src/lib/message-board-layout.mjs`
- Create: `tests/message-board-layout.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `BOARD_LOGICAL_WIDTH`, `NOTE_FOOTPRINTS`, `classifyBoardNoteSize`, `deriveLegacyBoardNote`, `scoreCandidate`, `findBestPlacement`, `correctDroppedPosition`, `computeBoardHeight`, `logicalToRenderedPosition`.
- Controller in Task 5 consumes all layout functions; no DOM access is allowed in this module.

- [ ] **Step 1: Write executable RED tests**

Create `tests/message-board-layout.test.mjs` with:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOARD_LOGICAL_WIDTH,
  classifyBoardNoteSize,
  computeBoardHeight,
  correctDroppedPosition,
  deriveLegacyBoardNote,
  findBestPlacement,
} from '../src/lib/message-board-layout.mjs';

test('layout constants and size thresholds match the Worker contract', () => {
  assert.equal(BOARD_LOGICAL_WIDTH, 1200);
  assert.equal(classifyBoardNoteSize('a'.repeat(64)), 'small');
  assert.equal(classifyBoardNoteSize('a'.repeat(65)), 'medium');
  assert.equal(classifyBoardNoteSize('a'.repeat(221)), 'large');
});

test('legacy note derivation is stable', () => {
  assert.deepEqual(deriveLegacyBoardNote('same-id', 'text'), deriveLegacyBoardNote('same-id', 'text'));
});

test('placement avoids severe overlap and expands downward when crowded', () => {
  const occupied = Array.from({ length: 20 }, (_, i) => ({ x: 20 + (i % 4) * 290, y: 40 + Math.floor(i / 4) * 230, size: 'medium' }));
  const placed = findBestPlacement('new-id', 'medium', occupied);
  assert.ok(placed.y >= 0);
  assert.ok(placed.x >= 0 && placed.x < BOARD_LOGICAL_WIDTH);
});

test('drop correction clamps board edges', () => {
  const corrected = correctDroppedPosition({ x: -50, y: -30, size: 'small' }, []);
  assert.ok(corrected.x >= 0);
  assert.ok(corrected.y >= 0);
});

test('board height keeps bottom breathing room', () => {
  assert.ok(computeBoardHeight([{ x: 50, y: 900, size: 'small' }]) >= 1180);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/message-board-layout.test.mjs
```

Expected: FAIL because the layout module does not exist.

- [ ] **Step 3: Implement the pure layout module**

Use the same thresholds, 1200 logical width, logical footprints, 24 candidate samples, 22% overlap threshold, and `[-4, 4]` legacy rotation envelope as the Worker. `correctDroppedPosition` must search nearby offsets in 24-unit rings only after a drop violates the overlap threshold; it must not magnetically rearrange valid light overlaps.

`computeBoardHeight(notes)` returns at least `720`, otherwise `max(y + footprintHeight) + 220`.

`logicalToRenderedPosition(note, renderedWidth)` uses `scale = renderedWidth / 1200` for x/y placement. CSS will enforce a practical minimum board-stage width on narrow phones rather than inventing a different random layout.

- [ ] **Step 4: Add the tests to `test:site`**

Insert `tests/message-board-layout.test.mjs tests/message-board-page.test.mjs` into the existing `node --test` script in `package.json`.

- [ ] **Step 5: Run GREEN**

```bash
node --test tests/message-board-layout.test.mjs tests/message-board-page.test.mjs
npm run test:site
```

Expected: all pass.

- [ ] **Step 6: Commit Task 4**

```bash
git add src/lib/message-board-layout.mjs tests/message-board-layout.test.mjs package.json
git commit -m "feat: add sticky message layout engine"
```

---

### Task 5: Replace the old two-column page with a corkboard shell and deterministic rendering

**Files:**
- Create: `src/components/MessageBoard.astro`
- Create: `src/lib/message-board-controller.ts`
- Create: `src/styles/message-board.css`
- Replace: `src/pages/messages.astro`
- Modify: `tests/message-board-page.test.mjs`

**Interfaces:**
- `MessageBoard.astro` exposes stable hooks: `message-board-root`, `message-board-stage`, `message-board-status`, `message-board-count`, `message-compose-open`, `message-composer`, `message-drawer`, `message-admin`.
- `message-board-controller.ts` exports `initMessageBoard()` and returns a cleanup function.
- Page lifecycle binds on `astro:page-load` and cleans on `astro:before-swap`.

- [ ] **Step 1: Add RED shell/architecture tests**

Append:

```js
const page = read('src/pages/messages.astro');
const board = read('src/components/MessageBoard.astro');
const controller = read('src/lib/message-board-controller.ts');

test('messages page delegates to the dedicated interactive board', () => {
  assert.match(page, /import MessageBoard from ['"]\.\.\/components\/MessageBoard\.astro['"]/);
  assert.match(page, /<MessageBoard\s*\/>/);
  assert.doesNotMatch(page, /messages-layout/);
  assert.doesNotMatch(page, /function renderMessages/);
});

test('board shell exposes corkboard, composer, drawer, and status hooks', () => {
  for (const hook of ['message-board-root', 'message-board-stage', 'message-compose-open', 'message-composer', 'message-drawer', 'message-admin']) {
    assert.match(board, new RegExp(`id="${hook}"`));
  }
  assert.match(controller, /export function initMessageBoard/);
  assert.match(controller, /fetchGuestMessagePage/);
  assert.match(controller, /computeBoardHeight/);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/message-board-page.test.mjs
```

Expected: FAIL because the new component/controller do not exist.

- [ ] **Step 3: Create the accessible `MessageBoard.astro` shell**

Use a single board header with title copy and the `贴一张便签` button, a horizontally safe board viewport containing the stage, hidden composer dialog, hidden detail drawer, and collapsed admin area. Include semantic templates for note DOM creation rather than rendering notes in Astro because data is runtime API data.

The stage must use `role="region"`, `aria-label="公共留言板"`; composer and drawer use `role="dialog"`, `aria-modal="true"`, labelled headings, explicit close buttons, and status nodes with `aria-live="polite"`.

Import `../styles/message-board.css` and initialize controller in an Astro script:

```ts
import { initMessageBoard } from '../lib/message-board-controller';

const w = window as typeof window & { __messageBoardCleanup?: () => void; __messageBoardBound?: boolean };
function mount() {
  w.__messageBoardCleanup?.();
  w.__messageBoardCleanup = initMessageBoard();
}
if (!w.__messageBoardBound) {
  w.__messageBoardBound = true;
  document.addEventListener('astro:page-load', mount);
  document.addEventListener('astro:before-swap', () => w.__messageBoardCleanup?.());
}
mount();
```

- [ ] **Step 4: Replace `messages.astro` with a minimal wrapper**

Keep the same BaseLayout metadata/banner intent, but reduce body to:

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import MessageBoard from '../components/MessageBoard.astro';
---
<BaseLayout title="留言板 | 搁浅 的小窝" description="在公共留言板贴下一张便签。" bannerTitle="留言板" bannerSubtitle="路过的话，就贴下一张便签吧。">
  <MessageBoard />
</BaseLayout>
```

- [ ] **Step 5: Implement initial board loading/rendering in the controller**

On init:

1. fetch first page with `fetchGuestMessagePage({ limit: 100 })`;
2. render every message to one focusable `.sticky-note` element;
3. use persisted `message.note` metadata or deterministic fallback;
4. set `data-message-id`, `data-note-size`, `data-note-color` and CSS custom properties `--note-x`, `--note-y`, `--note-rotation`;
5. set stage height using `computeBoardHeight`;
6. update count/status;
7. if `nextBefore` exists, mount a simple `加载更早的便签` button at the board bottom rather than loading all history at once.

Do not wire drag/edit/reactions yet in this task.

- [ ] **Step 6: Add first-pass layout CSS**

`message-board.css` must define the cork stage, note sizes/colors, stage minimum width, readable typography, and no legacy card/list styles. Keep stage `min-width: 720px` inside `.message-board-viewport { overflow-x: auto; }` on narrow viewports so logical placement remains stable instead of re-randomizing notes.

- [ ] **Step 7: Run GREEN + build**

```bash
node --test tests/message-board-page.test.mjs
npm run build
```

Expected: pass.

- [ ] **Step 8: Commit Task 5**

```bash
git add src/components/MessageBoard.astro src/lib/message-board-controller.ts src/styles/message-board.css src/pages/messages.astro tests/message-board-page.test.mjs
git commit -m "feat: render messages as a shared corkboard"
```

---

### Task 6: Add composer, owned edit/delete, and drag persistence

**Files:**
- Modify: `src/components/MessageBoard.astro`
- Modify: `src/lib/message-board-controller.ts`
- Modify: `src/styles/message-board.css`
- Modify: `tests/message-board-page.test.mjs`

**Interfaces:**
- Composer handles create and edit modes with fields `userId`, `text`, `noteColor`.
- Drag state commits one PATCH only on release for owned notes; non-owned notes remain local-only.
- Mobile drag threshold is exactly 350 ms.

- [ ] **Step 1: Add RED interaction-contract tests**

```js
test('composer supports random color, owned edit, and retained draft errors', () => {
  assert.match(controller, /createGuestMessage/);
  assert.match(controller, /updateOwnedGuestMessage/);
  assert.match(controller, /deleteOwnedGuestMessage/);
  assert.match(controller, /hasGuestMessageOwnership/);
  assert.match(controller, /draft/);
  assert.match(board, /name="noteColor"/);
  assert.match(board, /maxlength="800"/);
});

test('drag is desktop-direct, mobile-long-press, and persists only on release', () => {
  assert.match(controller, /const MOBILE_DRAG_HOLD_MS = 350/);
  assert.match(controller, /pointerdown/);
  assert.match(controller, /pointermove/);
  assert.match(controller, /pointerup/);
  assert.match(controller, /correctDroppedPosition/);
  assert.match(controller, /updateOwnedGuestMessage/);
  assert.doesNotMatch(controller, /pointermove[\s\S]{0,500}updateOwnedGuestMessage/);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/message-board-page.test.mjs
```

- [ ] **Step 3: Implement create/edit composer**

Opening create mode pre-fills stored user ID and chooses one of five colors randomly. Successful POST inserts the returned item into the in-memory map and renders it with `.sticky-note--new` so CSS can play one entrance animation. Keep text/color values intact if POST/PATCH fails; clear only after success.

Owned edit mode is available only when `hasGuestMessageOwnership(id)` is true. User ID is not editable on an existing note in this version; text and color are. After text edit, accept the server-returned recalculated size and run local collision correction if footprint grew.

- [ ] **Step 4: Implement pointer drag state**

Use one state record:

```ts
type DragState = {
  pointerId: number;
  messageId: string;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  active: boolean;
  holdTimer?: number;
};
```

Desktop mouse/pen activates immediately. Touch schedules activation at 350 ms and cancels if pre-activation movement exceeds 8 px, preserving page scroll. While active, use `setPointerCapture`, update only CSS transform variables, add `.is-dragging`, and temporarily raise local z-index.

On `pointerup`, call `correctDroppedPosition`, update local state, then call `updateOwnedGuestMessage(id, { posX, posY })` exactly once only if ownership exists. For non-owned notes, keep the local position until reload. If persistence fails, restore the server-confirmed x/y saved before drag and show a non-blocking status message.

- [ ] **Step 5: Implement owned delete**

Owned drawer/composer action confirms deletion, calls `deleteOwnedGuestMessage`, removes the note locally, recomputes board height, closes surfaces. Admin delete remains a separate path in Task 7.

- [ ] **Step 6: Add tactile drag/composer styles**

`.is-dragging` slightly scales up, strengthens shadow, and reduces rotation toward zero. `.sticky-note--new` uses a 240 ms attach animation. No animation may be required for correctness; reduced-motion rules later disable all transforms/animations.

- [ ] **Step 7: Run GREEN**

```bash
node --test tests/message-board-page.test.mjs tests/message-board-layout.test.mjs
npm run build
```

- [ ] **Step 8: Commit Task 6**

```bash
git add src/components/MessageBoard.astro src/lib/message-board-controller.ts src/styles/message-board.css tests/message-board-page.test.mjs
git commit -m "feat: add sticky note composing and drag ownership"
```

---

### Task 7: Add detail drawer, comments, quick reactions, admin controls, and live polling

**Files:**
- Modify: `src/components/MessageBoard.astro`
- Modify: `src/lib/message-board-controller.ts`
- Modify: `src/styles/message-board.css`
- Modify: `tests/message-board-page.test.mjs`

**Interfaces:**
- Desktop detail surface is a right drawer; <=720 px uses bottom sheet CSS.
- Existing `createCommentsWidget('message', id, count)` is mounted inside drawer content.
- Poll interval is exactly 15,000 ms while visible.
- Remote updates to a locally locked message are deferred until drag/edit ends.

- [ ] **Step 1: Add RED tests for drawer/reactions/polling/admin**

```js
test('detail surface reuses comments and exposes quick message reactions', () => {
  assert.match(controller, /createCommentsWidget\(['"]message['"]/);
  assert.match(controller, /reactToGuestMessage/);
  for (const emoji of ['❤️', '😂', '✨', '👍']) assert.match(board + controller, new RegExp(emoji));
  assert.match(board, /message-drawer/);
});

test('live sync polls every 15 seconds and pauses while hidden', () => {
  assert.match(controller, /const MESSAGE_POLL_MS = 15_000/);
  assert.match(controller, /visibilitychange/);
  assert.match(controller, /fetchGuestMessagePage\(\{[^}]*since/);
  assert.match(controller, /interactionLocks/);
});

test('admin moderation remains available separately from author ownership', () => {
  assert.match(controller, /getSession/);
  assert.match(controller, /login/);
  assert.match(controller, /logout/);
  assert.match(controller, /deleteGuestMessage/);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/message-board-page.test.mjs
```

- [ ] **Step 3: Implement drawer/bottom-sheet behavior**

Click/tap a note body opens the detail surface without changing persisted position. Populate author, full text, time, reaction chips, and comments. Mount a fresh `createCommentsWidget('message', message.id, message.commentCount)` for the active message. Manage focus: save previously focused note, focus close button on open, close on Escape/backdrop, restore focus on close.

- [ ] **Step 4: Implement quick reactions**

Desktop hover/focus shows the four-button quick bar. On touch, a completed 350 ms long press with no drag movement may expose the bar; once movement enters drag mode, suppress reaction activation. `reactToGuestMessage` updates the in-memory reaction counts and visual chip state without refetching the board.

- [ ] **Step 5: Implement admin session controls**

Reuse `getSession`, `login`, `logout` from `src/lib/moments-api.ts`. Admin mode shows delete for any note and persistent position controls for legacy notes. Admin delete uses existing `deleteGuestMessage(id)` with credentials; do not store/admin-token data in localStorage.

- [ ] **Step 6: Implement live synchronization and locks**

Track `lastSyncCursor` from initial list. While `document.visibilityState === 'visible'`, schedule one 15-second timer. On tick, call `fetchGuestMessagePage({ since: lastSyncCursor, limit: 100 })`.

Maintain:

```ts
const interactionLocks = new Set<string>();
const deferredRemote = new Map<string, GuestMessage>();
```

If a polled update targets a locked message, store it in `deferredRemote`. New unlocked notes insert with `.sticky-note--new`. When a drag/edit lock ends, reconcile any deferred server version without discarding a just-confirmed author save. On hidden state, clear timer; on visible state, sync immediately then restart timer.

- [ ] **Step 7: Implement failure UX**

- Initial fetch failure: keep corkboard visible, show retry button.
- Poll failure: keep current board and retry at next scheduled tick; no alert.
- `429`: display `操作太频繁，请稍后再试`.
- Owned PATCH 401/403: clear stale ownership via client helper and remove edit/delete controls.
- Create/edit failure: preserve input values.

- [ ] **Step 8: Run GREEN**

```bash
node --test tests/message-board-page.test.mjs tests/message-board-layout.test.mjs
npm run build
```

- [ ] **Step 9: Commit Task 7**

```bash
git add src/components/MessageBoard.astro src/lib/message-board-controller.ts src/styles/message-board.css tests/message-board-page.test.mjs
git commit -m "feat: add sticky board interactions and live sync"
```

---

### Task 8: Finish visual parity, accessibility, homepage compatibility, docs, and full verification

**Files:**
- Modify: `src/styles/message-board.css`
- Modify: `src/components/RecentMessagesWidget.astro`
- Modify: `tests/message-board-page.test.mjs`
- Modify: `danmaku-api/README.md`
- Verify: `package.json`, `danmaku-api/package.json`

**Interfaces:**
- No new runtime API surface; this task closes acceptance criteria and deployment documentation.

- [ ] **Step 1: Add RED visual/accessibility compatibility contracts**

```js
test('corkboard styling supports themes and reduced motion', () => {
  const css = read('src/styles/message-board.css');
  assert.match(css, /--message-cork/);
  assert.match(css, /data-note-color="yellow"/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /html\[data-reduce-motion="true"\]/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*message-drawer/);
});

test('homepage recent messages keeps the original array API contract', () => {
  const recent = read('src/components/RecentMessagesWidget.astro');
  assert.match(recent, /fetchGuestMessages\(\)/);
  assert.match(recent, /item\.userId/);
  assert.match(recent, /item\.text/);
  assert.match(recent, /item\.createdAt/);
});
```

- [ ] **Step 2: Run RED if any acceptance styling/hooks are still missing**

```bash
node --test tests/message-board-page.test.mjs
```

- [ ] **Step 3: Finish the visual system**

Implement cork texture with layered CSS gradients only; do not add a stock image dependency. Define low-saturation paper tokens for five colors in light and dark modes, readable text tokens, pin/tape pseudo-elements, and subtle board inset depth.

Use these motion timings:

- attach: 240 ms;
- drag lift/drop: 160 ms;
- quick reaction bar: 140 ms;
- drawer/sheet: 180 ms.

Under either reduced-motion mechanism set animation/transition duration to `0.01ms` or disable the transform animation entirely, and never rely on motion to communicate state.

- [ ] **Step 4: Finish responsive/accessibility behavior**

At <=720 px, drawer becomes bottom sheet (`inset: auto 0 0`, max-height around 78dvh). Keep note controls keyboard focusable, give quick-reaction buttons aria-labels, keep close buttons explicit, and ensure drag is never the only way to open details.

The stage may horizontally scroll on narrow screens because its minimum width is 720 px, but the page itself must not acquire uncontrolled horizontal overflow outside `.message-board-viewport`.

- [ ] **Step 5: Adjust homepage wording without changing data flow**

Keep `fetchGuestMessages()` unchanged. Change only user-facing placeholder/more copy to fit the new metaphor, e.g. `正在读取最近贴上的便签…` and `去留言板看看 →`. Do not render draggable notes in the sidebar.

- [ ] **Step 6: Update Worker deployment docs**

In `danmaku-api/README.md`, correct endpoint examples to the actual `wrangler.jsonc` values (`https://api.lidure22.xyz`, site `https://lidure22.xyz`) and add the exact migration/deploy sequence:

```bash
cd danmaku-api
npm ci
npm run check
npm test
npx wrangler d1 migrations apply lidure-danmaku --remote
npm run deploy
```

Document that migration `0008_sticky_message_board.sql` must be applied before deploying the frontend that expects note columns/reaction routes. Do not put secrets or real admin credentials in the README.

- [ ] **Step 7: Run full local verification**

```bash
npm --prefix danmaku-api run check
npm --prefix danmaku-api test
npm run check
npm run test:site
npm run build
npm test
```

Expected: all pass.

- [ ] **Step 8: Manual browser acceptance pass before merge**

With local Worker + Astro dev servers running, verify exactly these behaviors:

1. Existing legacy messages render as stable notes after repeated reloads.
2. New note creates with selected color and attach animation.
3. Same browser can edit/recolor/delete its new note.
4. A different/incognito browser can drag that note locally but reload restores server position.
5. Author drag persists after reload and sends only one PATCH on release.
6. Touch scroll works before 350 ms hold; long press activates drag.
7. Clicking note opens desktop right drawer; narrow viewport uses bottom sheet.
8. Comments still create/load.
9. `❤️ 😂 ✨ 👍` add/switch/remove correctly.
10. A second browser posting a new note appears in the first browser after at most one 15-second poll.
11. Polling does not move a note currently being dragged/edited.
12. Admin can delete any note, including legacy notes.
13. Light, dark, and reduced-motion modes stay readable and usable.
14. Homepage recent-message widget still renders recent entries.

- [ ] **Step 9: Commit Task 8**

```bash
git add src/styles/message-board.css src/components/RecentMessagesWidget.astro tests/message-board-page.test.mjs danmaku-api/README.md
git commit -m "polish: finish sticky message board experience"
```

---

## Final Integration / Release Order

The repository PR may be reviewed and merged after the complete test suite is green, but production activation has a backend-first dependency. Apply D1 migration `0008`, deploy the Worker, smoke-test `/api/messages` and `/api/message-reactions`, then deploy/merge the frontend if the hosting flow does not deploy the two parts together. Never deploy frontend code that requires sticky columns before the remote D1 migration and Worker route changes are live.

Recommended smoke checks after Worker deployment:

```bash
curl -sS 'https://api.lidure22.xyz/api/messages?limit=1'
curl -i -X OPTIONS 'https://api.lidure22.xyz/api/messages' -H 'Origin: https://lidure22.xyz'
```

The first response must contain `items`, `now`, and `nextCursor`; each returned item must still include `id`, `userId`, `text`, and `createdAt` plus `note`. The OPTIONS response must allow `GET,POST,PATCH,DELETE,OPTIONS` for the production site origin.
