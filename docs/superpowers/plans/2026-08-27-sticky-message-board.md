# Sticky Message Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/messages` with a shared corkboard-style sticky-note wall that preserves all existing messages/comments, adds browser-bound anonymous ownership, persistent author moves/edits/deletes, message reactions, collision-aware placement, mobile long-press drag, and 15-second live polling.

**Architecture:** Keep `guest_messages` as the canonical D1 store. Extend the deployed Cloudflare Worker with sticky metadata, ownership verification, reactions, incremental sync, and backward-compatible message responses. In Astro, keep API/storage concerns in `public-interactions.ts`, pure layout math in an executable `.mjs` module, DOM behavior in a focused controller, and markup/styles in a dedicated `MessageBoard.astro` + CSS file.

**Tech Stack:** Astro 6.4.4, TypeScript 5.8.3, browser DOM APIs, Node `node:test`, Cloudflare Workers + D1, Vitest 2.1.8.

**Spec:** `docs/superpowers/specs/2026-08-27-sticky-message-board-design.md`

## Global Constraints

- Preserve every existing `guest_messages` row and existing comments with `target_type = 'message'`.
- Legacy messages never receive author tokens; ordinary visitors may move them only locally. Admin may persistently move/delete them.
- New ownership is browser-bound only; no accounts, edit codes, or recovery flow.
- Existing homepage callers must still receive `id`, `userId`, `text`, `createdAt` from `/api/messages`.
- Keep public message text at 800 characters, matching the existing page/legacy public contract.
- Note sizes are only `small | medium | large`; colors are only `yellow | pink | blue | green | purple`.
- Logical board width is 1200 units. Footprints: small `220x180`, medium `270x220`, large `330x260`.
- Size thresholds: `<=64` chars small, `65..220` medium, `>=221` large.
- Allow light overlap up to 22% of the smaller note footprint; correct larger overlap only on create/drop.
- Resting rotation is server/stable only and remains inside `[-4deg, 4deg]`; users never persist arbitrary rotation.
- Do not persist z-index.
- Poll exactly every 15,000 ms while the page is visible; no WebSockets.
- Touch drag starts after 350 ms and cancels before activation if movement exceeds 8 px so page scroll remains normal.
- Quick message reactions are exactly `❤️`, `😂`, `✨`, `👍` in v1.
- Respect `prefers-reduced-motion` and `html[data-reduce-motion="true"]`.
- `danmaku-api/src/index.ts` with `danmaku-api/wrangler.jsonc` is the deployed Worker path. Do not implement this feature in legacy `danmaku-api-pages/_worker.js`.

## File Map

- Create `danmaku-api/migrations/0008_sticky_message_board.sql` — sticky columns + `message_reactions`.
- Create `danmaku-api/src/message-board.ts` — Worker-side pure constants, token crypto, normalization, placement helpers, row mapping.
- Modify `danmaku-api/src/index.ts` — `/api/messages` GET/POST/PATCH/DELETE, `/api/message-reactions`, D1 aggregation/cleanup.
- Create `danmaku-api/tests/messages.test.ts` — Worker contracts.
- Modify `src/lib/public-interactions.ts` — sticky types, page/incremental reads, local author/reaction state, owned mutations.
- Create `src/lib/message-board-layout.mjs` — DOM-free browser layout/collision functions.
- Create `tests/message-board-layout.test.mjs` — executable layout tests.
- Create `src/components/MessageBoard.astro` — board/composer/drawer/admin shell.
- Create `src/lib/message-board-controller.ts` — board lifecycle, rendering, gestures, composer, drawer, comments, polling.
- Create `src/styles/message-board.css` — cork/paper visuals, theme, motion, responsive sheet.
- Replace `src/pages/messages.astro` — minimal BaseLayout + MessageBoard mount.
- Modify `src/components/RecentMessagesWidget.astro` — wording only; preserve fetch contract.
- Create `tests/message-board-page.test.mjs` — source contracts for page/controller/accessibility.
- Modify `package.json` — include the two new root tests.
- Modify `danmaku-api/README.md` — migration/deploy order and actual `lidure22.xyz` endpoints.

---

### Task 1: Add the D1 schema and Worker-side sticky-note primitives

**Files:**
- Create: `danmaku-api/migrations/0008_sticky_message_board.sql`
- Create: `danmaku-api/src/message-board.ts`
- Create: `danmaku-api/tests/messages.test.ts`

**Interfaces produced:**

```ts
export type MessageNoteSize = 'small' | 'medium' | 'large';
export type MessageNoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'purple';
export type OccupiedNote = { x: number; y: number; size: MessageNoteSize };
export type MessageNoteMeta = { color: MessageNoteColor; size: MessageNoteSize; x: number; y: number; rotation: number; legacy: boolean };

export const MESSAGE_REACTION_EMOJIS: readonly ['❤️', '😂', '✨', '👍'];
export function classifyMessageNoteSize(text: string): MessageNoteSize;
export function normalizeMessageNoteColor(value: unknown): MessageNoteColor | '';
export function deriveLegacyNoteMeta(id: string, text: string): MessageNoteMeta;
export function chooseMessagePlacement(seed: string, size: MessageNoteSize, occupied: OccupiedNote[]): { x: number; y: number };
export function createAuthorToken(): string;
export function hashAuthorToken(token: string): Promise<string>;
export function verifyAuthorToken(token: string, expectedHash: string): Promise<boolean>;
```

- [ ] **Step 1: Write the migration RED test**

Create `danmaku-api/tests/messages.test.ts` beginning with:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

const migration = readFileSync(new URL('../migrations/0008_sticky_message_board.sql', import.meta.url), 'utf8');

describe('sticky message schema', () => {
  it('adds sticky metadata and one reaction row per visitor/message', () => {
    for (const column of ['note_color', 'note_size', 'pos_x', 'pos_y', 'rotation', 'author_token_hash', 'updated_at']) {
      expect(migration).toMatch(new RegExp(`ALTER TABLE guest_messages ADD COLUMN ${column}`));
    }
    expect(migration).toMatch(/CREATE TABLE IF NOT EXISTS message_reactions/);
    expect(migration).toMatch(/PRIMARY KEY \(message_id, ip_hash\)/);
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
npm --prefix danmaku-api test -- --run tests/messages.test.ts
```

Expected: FAIL because migration 0008 does not exist.

- [ ] **Step 3: Create migration 0008**

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

- [ ] **Step 4: Add RED helper tests**

```ts
import {
  MESSAGE_REACTION_EMOJIS,
  classifyMessageNoteSize,
  createAuthorToken,
  deriveLegacyNoteMeta,
  hashAuthorToken,
  verifyAuthorToken,
} from '../src/message-board';

it('uses the approved size boundaries', () => {
  expect(classifyMessageNoteSize('a'.repeat(64))).toBe('small');
  expect(classifyMessageNoteSize('a'.repeat(65))).toBe('medium');
  expect(classifyMessageNoteSize('a'.repeat(220))).toBe('medium');
  expect(classifyMessageNoteSize('a'.repeat(221))).toBe('large');
});

it('derives stable legacy metadata without ownership', () => {
  const a = deriveLegacyNoteMeta('legacy-1', '旧留言');
  const b = deriveLegacyNoteMeta('legacy-1', '旧留言');
  expect(a).toEqual(b);
  expect(a.legacy).toBe(true);
  expect(a.rotation).toBeGreaterThanOrEqual(-4);
  expect(a.rotation).toBeLessThanOrEqual(4);
});

it('creates a secret token and verifies only its hash', async () => {
  const token = createAuthorToken();
  const hash = await hashAuthorToken(token);
  expect(token.length).toBeGreaterThanOrEqual(32);
  expect(hash).not.toContain(token);
  await expect(verifyAuthorToken(token, hash)).resolves.toBe(true);
  await expect(verifyAuthorToken(`${token}x`, hash)).resolves.toBe(false);
});

it('keeps the quick-reaction set bounded', () => {
  expect(MESSAGE_REACTION_EMOJIS).toEqual(['❤️', '😂', '✨', '👍']);
});
```

- [ ] **Step 5: Verify RED again**

Same command; expected failure because `src/message-board.ts` is missing.

- [ ] **Step 6: Implement `message-board.ts`**

Use FNV-1a 32-bit hashing for deterministic seeds. `deriveLegacyNoteMeta()` picks one approved color, size from text, rotation in `[-4,4]`, and a stable seed position. `chooseMessagePlacement(seed, size, occupied)` samples 24 deterministic candidates across the current lowest occupied band, scores edge penalty + overlap, accepts <=22% overlap, and if none pass extends search downward by 320 logical units.

Generate author tokens from 32 cryptographically random bytes using `crypto.getRandomValues`, encode URL-safe base64, hash with SHA-256 to lowercase hex, and compare hashes in constant-time style without early exit.

- [ ] **Step 7: Verify GREEN**

```bash
npm --prefix danmaku-api test -- --run tests/messages.test.ts
npm --prefix danmaku-api run check
```

- [ ] **Step 8: Commit**

```bash
git add danmaku-api/migrations/0008_sticky_message_board.sql danmaku-api/src/message-board.ts danmaku-api/tests/messages.test.ts
git commit -m "feat: add sticky message board domain model"
```

---

### Task 2: Upgrade the deployed Worker message API

**Files:**
- Modify: `danmaku-api/src/index.ts`
- Modify: `danmaku-api/tests/messages.test.ts`

**API contract:**

```text
GET    /api/messages?limit=80&before=<createdAt>&since=<cursor>
POST   /api/messages  { userId, text, noteColor }
PATCH  /api/messages  { id, authorToken?, text?, noteColor?, posX?, posY? }
DELETE /api/messages  { id, authorToken? }
POST   /api/message-reactions { messageId, emoji, previousEmoji? }
```

`GET` returns `{ items, now, nextCursor, nextBefore }`. `POST` returns `{ item, authorToken }`. Every item keeps legacy homepage fields and adds `updatedAt?`, `commentCount`, `reactions`, `note`.

- [ ] **Step 1: Add RED list tests**

Use the `makeDb(handler)`/`makeBoundStatement()` style from `danmaku-api/tests/auth.test.ts` and add:

```ts
it('keeps homepage fields and adds note metadata/cursors', async () => {
  const db = makeDb((sql) => sql.includes('FROM guest_messages')
    ? makeBoundStatement({ all: vi.fn().mockResolvedValue({ results: [{
        id: 'old-1', user_id: '旅人', text: '你好', created_at: 1000,
        note_color: null, note_size: null, pos_x: null, pos_y: null,
        rotation: null, author_token_hash: null, updated_at: null,
      }] }) })
    : makeBoundStatement());
  const response = await worker.fetch(new Request('https://example.com/api/messages?limit=80'), makeEnv({ DB: db }));
  const body = await response.json();
  expect(body.items[0]).toMatchObject({ id: 'old-1', userId: '旅人', text: '你好', createdAt: 1000, note: expect.any(Object) });
  expect(body).toMatchObject({ now: expect.any(Number), nextCursor: expect.any(Number) });
});

it('uses updated_at/created_at for incremental sync', async () => {
  const seen: string[] = [];
  const db = makeDb((sql) => { seen.push(sql); return makeBoundStatement(); });
  await worker.fetch(new Request('https://example.com/api/messages?since=1234'), makeEnv({ DB: db }));
  expect(seen.join('\n')).toContain('COALESCE(updated_at, created_at) > ?');
});
```

- [ ] **Step 2: Run RED**

```bash
npm --prefix danmaku-api test -- --run tests/messages.test.ts
```

- [ ] **Step 3: Implement backward-compatible GET**

Capture `const syncCursor = Date.now()` **before** querying so a write that happens after the read starts cannot be skipped by the next poll. Parse:

```ts
const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 80));
const since = Math.max(0, Number(url.searchParams.get('since')) || 0);
const before = Math.max(0, Number(url.searchParams.get('before')) || 0);
```

Use `COALESCE(updated_at, created_at) > ?` for `since`, `created_at < ?` for `before`, otherwise newest-first. Fetch explicit sticky columns. Attach comment counts and message-reaction counts in grouped queries, not one query per item. Null legacy metadata becomes deterministic note metadata through `deriveLegacyNoteMeta`. Return `nextCursor: syncCursor`; return `nextBefore` only when the page is full.

When multiple legacy items in a page collide severely, resolve them in stable `createdAt,id` order with `chooseMessagePlacement()` against an in-memory occupied list before serializing. This changes no DB ownership field and remains deterministic for the same loaded page/order.

- [ ] **Step 4: Add RED creation/ownership tests**

```ts
it('returns the plaintext author token once but never inserts it', async () => {
  const writes: unknown[][] = [];
  const db = makeDb((sql, args) => {
    if (sql.startsWith('INSERT INTO guest_messages')) writes.push(args);
    return makeBoundStatement();
  });
  const response = await worker.fetch(new Request('https://example.com/api/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userId: 'A', text: 'hello', noteColor: 'pink' }),
  }), makeEnv({ DB: db }));
  const body = await response.json();
  expect(response.status).toBe(201);
  expect(body.authorToken).toEqual(expect.any(String));
  expect(body.item.note.color).toBe('pink');
  expect(JSON.stringify(writes)).not.toContain(body.authorToken);
});

it('rejects a wrong author token', async () => {
  const correctHash = await hashAuthorToken('correct-token');
  const db = makeDb((sql) => sql.includes('SELECT author_token_hash')
    ? makeBoundStatement({ first: vi.fn().mockResolvedValue({ author_token_hash: correctHash }) })
    : makeBoundStatement());
  const response = await worker.fetch(new Request('https://example.com/api/messages', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'm1', authorToken: 'wrong-token', posX: 100, posY: 200 }),
  }), makeEnv({ DB: db }));
  expect(response.status).toBe(403);
  await expect(response.json()).resolves.toMatchObject({ code: 'MESSAGE_FORBIDDEN' });
});
```

- [ ] **Step 5: Implement POST/PATCH/DELETE**

On POST: normalize ID/text, enforce 800 chars, normalize requested color or choose from `deriveLegacyNoteMeta(id,text).color`, calculate size, read up to 200 recent occupied notes, call `chooseMessagePlacement(id, size, occupied)`, generate token/hash, insert metadata + `updated_at=now`, return token once.

On PATCH: only accept text/color/x/y. Recompute size from text; clamp x to `[0, 1200-footprintWidth]`, y to `>=0`; never accept rotation/z-index. Authorization order: valid author token first; otherwise valid admin session; otherwise 403. Legacy null-token rows therefore require admin.

On DELETE: same authorization order. Delete message reactions, comment reactions for child comments, comments, then guest message.

- [ ] **Step 6: Add RED reaction tests**

Test `❤️` inserts/replaces one `(message_id, ip_hash)` row, posting the same emoji as `previousEmoji` removes it, and an unsupported emoji returns 400.

- [ ] **Step 7: Implement `/api/message-reactions`**

Validate message existence, validate against the four approved emoji, hash client IP/UA with existing `hashClient`, delete the current row, reinsert unless toggling off, aggregate counts, return `{ reactions, selectedEmoji }`.

- [ ] **Step 8: Run full Worker GREEN**

```bash
npm --prefix danmaku-api test -- --run tests/messages.test.ts
npm --prefix danmaku-api test
npm --prefix danmaku-api run check
```

- [ ] **Step 9: Commit**

```bash
git add danmaku-api/src/index.ts danmaku-api/tests/messages.test.ts
git commit -m "feat: add owned sticky message API"
```

---

### Task 3: Extend the browser API/storage contract

**Files:**
- Modify: `src/lib/public-interactions.ts`
- Create: `tests/message-board-page.test.mjs`

**Interfaces produced:**

```ts
export type MessageNoteMeta = { color: 'yellow'|'pink'|'blue'|'green'|'purple'; size: 'small'|'medium'|'large'; x: number; y: number; rotation: number; legacy: boolean };
export type GuestMessage = { id: string; userId: string; text: string; createdAt: number; updatedAt?: number; commentCount?: number; reactions?: Record<string, number>; note: MessageNoteMeta };
export type GuestMessagePage = { items: GuestMessage[]; now: number; nextCursor: number; nextBefore?: number };
export type GuestMessagePatch = { text?: string; noteColor?: MessageNoteMeta['color']; posX?: number; posY?: number };

export function hasGuestMessageOwnership(id: string): boolean;
export async function fetchGuestMessagePage(options?: { limit?: number; before?: number; since?: number }): Promise<GuestMessagePage>;
export async function fetchGuestMessages(): Promise<GuestMessage[]>;
export async function createGuestMessage(userId: string, text: string, noteColor: MessageNoteMeta['color']): Promise<GuestMessage>;
export async function updateOwnedGuestMessage(id: string, patch: GuestMessagePatch): Promise<GuestMessage>;
export async function deleteOwnedGuestMessage(id: string): Promise<void>;
export async function reactToGuestMessage(messageId: string, emoji: string): Promise<{reactions: Record<string,number>; selectedEmoji: string}>;
```

- [ ] **Step 1: Write RED source contracts**

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const api = read('src/lib/public-interactions.ts');

test('public message client supports sticky pages and anonymous ownership', () => {
  for (const symbol of ['MessageNoteMeta', 'fetchGuestMessagePage', 'updateOwnedGuestMessage', 'deleteOwnedGuestMessage', 'hasGuestMessageOwnership', 'reactToGuestMessage']) {
    assert.match(api, new RegExp(symbol));
  }
  assert.match(api, /guest_message_author_tokens_v1/);
  assert.match(api, /public_message_reactions_v1/);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/message-board-page.test.mjs
```

- [ ] **Step 3: Implement author and reaction local storage**

Store `{ messageId: authorToken }` under `guest_message_author_tokens_v1`. Store this browser's selected emoji under `public_message_reactions_v1`. Never render tokens into DOM or URLs. If an owned PATCH/DELETE returns 401/403, delete that stale token and expose the error to the controller. Reaction helpers update local selected emoji only after a successful API response.

- [ ] **Step 4: Implement page/incremental reads while preserving homepage**

`fetchGuestMessagePage()` returns the response object. Keep existing caller compatibility exactly as:

```ts
export async function fetchGuestMessages() {
  return (await fetchGuestMessagePage({ limit: 80 })).items;
}
```

- [ ] **Step 5: Implement owned create/update/delete and reactions**

Create sends `noteColor`; on success store returned `authorToken` and return only `item`. PATCH/DELETE read the local token and include it in JSON. Keep existing `deleteGuestMessage(id)` as the admin-session delete path with `credentials:'include'`.

- [ ] **Step 6: Run GREEN**

```bash
node --test tests/message-board-page.test.mjs
npm run check
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/public-interactions.ts tests/message-board-page.test.mjs
git commit -m "feat: add sticky message client API"
```

---

### Task 4: Build an executable pure layout engine

**Files:**
- Create: `src/lib/message-board-layout.mjs`
- Create: `tests/message-board-layout.test.mjs`
- Modify: `package.json`

**Interfaces produced:** `BOARD_LOGICAL_WIDTH`, `NOTE_FOOTPRINTS`, `classifyBoardNoteSize`, `deriveLegacyBoardNote`, `overlapRatio`, `findBestPlacement`, `correctDroppedPosition`, `computeBoardHeight`, `logicalToRenderedPosition`.

- [ ] **Step 1: Write RED executable tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOARD_LOGICAL_WIDTH,
  classifyBoardNoteSize,
  computeBoardHeight,
  correctDroppedPosition,
  deriveLegacyBoardNote,
  overlapRatio,
} from '../src/lib/message-board-layout.mjs';

test('layout contract is deterministic', () => {
  assert.equal(BOARD_LOGICAL_WIDTH, 1200);
  assert.equal(classifyBoardNoteSize('a'.repeat(64)), 'small');
  assert.equal(classifyBoardNoteSize('a'.repeat(65)), 'medium');
  assert.equal(classifyBoardNoteSize('a'.repeat(221)), 'large');
  assert.deepEqual(deriveLegacyBoardNote('x', 'hello'), deriveLegacyBoardNote('x', 'hello'));
});

test('drop correction clamps and removes severe overlap', () => {
  const other = { x: 100, y: 100, size: 'medium' };
  const corrected = correctDroppedPosition({ x: 100, y: 100, size: 'medium' }, [other]);
  assert.ok(corrected.x >= 0 && corrected.y >= 0);
  assert.ok(overlapRatio({ ...corrected, size: 'medium' }, other) <= 0.22);
});

test('board height keeps a bottom buffer', () => {
  assert.ok(computeBoardHeight([{ x: 0, y: 900, size: 'small' }]) >= 1300);
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/message-board-layout.test.mjs
```

- [ ] **Step 3: Implement pure layout functions**

Use the exact global constants. `correctDroppedPosition()` first clamps bounds; if overlap <=22%, keep the user's location. Otherwise test nearby offsets in 24-unit rings until a legal location is found. `computeBoardHeight()` returns `max(720, max(y+footprintHeight)+220)`. `logicalToRenderedPosition()` scales by `renderedWidth/1200`; CSS will keep the stage at least 720px wide on narrow screens rather than inventing a different random layout.

- [ ] **Step 4: Register root tests**

Add `tests/message-board-layout.test.mjs tests/message-board-page.test.mjs` to `test:site` in `package.json`.

- [ ] **Step 5: Run GREEN**

```bash
node --test tests/message-board-layout.test.mjs tests/message-board-page.test.mjs
npm run test:site
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/message-board-layout.mjs tests/message-board-layout.test.mjs package.json
git commit -m "feat: add sticky message layout engine"
```

---

### Task 5: Replace the old page with the corkboard shell and initial rendering

**Files:**
- Create: `src/components/MessageBoard.astro`
- Create: `src/lib/message-board-controller.ts`
- Create: `src/styles/message-board.css`
- Replace: `src/pages/messages.astro`
- Modify: `tests/message-board-page.test.mjs`

**Stable DOM hooks:** `message-board-root`, `message-board-viewport`, `message-board-stage`, `message-board-status`, `message-board-count`, `message-compose-open`, `message-composer`, `message-drawer`, `message-admin`.

- [ ] **Step 1: Add RED architecture tests**

```js
const page = read('src/pages/messages.astro');
const board = read('src/components/MessageBoard.astro');
const controller = read('src/lib/message-board-controller.ts');

test('messages page delegates to a dedicated board', () => {
  assert.match(page, /import MessageBoard from ['"]\.\.\/components\/MessageBoard\.astro['"]/);
  assert.match(page, /<MessageBoard\s*\/>/);
  assert.doesNotMatch(page, /messages-layout/);
  assert.doesNotMatch(page, /function renderMessages/);
});

test('board exposes the approved interactive surfaces', () => {
  for (const id of ['message-board-root','message-board-stage','message-compose-open','message-composer','message-drawer','message-admin']) {
    assert.match(board, new RegExp(`id="${id}"`));
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

- [ ] **Step 3: Create `MessageBoard.astro`**

Build one header + `贴一张便签` button, corkboard viewport/stage, hidden composer dialog, hidden detail drawer, and collapsed admin panel. The stage uses `role="region" aria-label="公共留言板"`; composer/drawer use dialog semantics, labelled headings, close buttons, and `aria-live="polite"` status.

Import `../styles/message-board.css` and bind lifecycle:

```ts
import { initMessageBoard } from '../lib/message-board-controller';
const w = window as typeof window & { __messageBoardCleanup?: () => void; __messageBoardBound?: boolean };
function mount() { w.__messageBoardCleanup?.(); w.__messageBoardCleanup = initMessageBoard(); }
if (!w.__messageBoardBound) {
  w.__messageBoardBound = true;
  document.addEventListener('astro:page-load', mount);
  document.addEventListener('astro:before-swap', () => w.__messageBoardCleanup?.());
}
mount();
```

- [ ] **Step 4: Replace `messages.astro`**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import MessageBoard from '../components/MessageBoard.astro';
---
<BaseLayout title="留言板 | 搁浅 的小窝" description="在公共留言板贴下一张便签。" bannerTitle="留言板" bannerSubtitle="路过的话，就贴下一张便签吧。">
  <MessageBoard />
</BaseLayout>
```

- [ ] **Step 5: Implement initial controller loading/rendering**

Fetch `{limit:100}`; keep `Map<string,GuestMessage>` state; render one keyboard-focusable `.sticky-note` per item; set `data-message-id`, `data-note-size`, `data-note-color`, and CSS variables for x/y/rotation. Recompute stage height. If `nextBefore` exists, expose `加载更早的便签` at the board bottom and append older pages without re-randomizing already-rendered notes.

- [ ] **Step 6: Add first-pass board CSS**

Use CSS gradient cork texture only, five paper tokens, three dimensions, subtle pin/tape decoration, and `.message-board-viewport{overflow-x:auto}` with stage `min-width:720px`. No old two-column/list/card styles remain.

- [ ] **Step 7: Run GREEN/build**

```bash
node --test tests/message-board-page.test.mjs
npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/components/MessageBoard.astro src/lib/message-board-controller.ts src/styles/message-board.css src/pages/messages.astro tests/message-board-page.test.mjs
git commit -m "feat: render messages as a shared corkboard"
```

---

### Task 6: Add composer, browser ownership, edit/delete, and tested drag decisions

**Files:**
- Create: `src/lib/message-board-gesture.mjs`
- Create: `tests/message-board-gesture.test.mjs`
- Modify: `src/components/MessageBoard.astro`
- Modify: `src/lib/message-board-controller.ts`
- Modify: `src/styles/message-board.css`
- Modify: `tests/message-board-page.test.mjs`
- Modify: `package.json`

**Gesture interface:**

```js
createGestureState({ pointerType, startX, startY, now })
updateGesture(state, { x, y, now })
finishGesture(state, { x, y, now })
```

The pure module returns decisions (`scroll`, `waiting`, `drag-start`, `drag-move`, `drop`) and never performs network I/O. This gives automated coverage for the 350ms/8px rule; controller alone decides whether a `drop` is author/admin-persisted.

- [ ] **Step 1: Write RED gesture tests**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { createGestureState, updateGesture } from '../src/lib/message-board-gesture.mjs';

test('mouse begins drag immediately', () => {
  const state = createGestureState({ pointerType:'mouse', startX:0, startY:0, now:0 });
  assert.equal(state.phase, 'dragging');
});

test('touch movement before 350ms yields scroll intent', () => {
  const state = createGestureState({ pointerType:'touch', startX:0, startY:0, now:0 });
  const next = updateGesture(state, { x:0, y:12, now:100 });
  assert.equal(next.decision, 'scroll');
});

test('touch hold reaches drag after 350ms without movement', () => {
  const state = createGestureState({ pointerType:'touch', startX:0, startY:0, now:0 });
  const next = updateGesture(state, { x:2, y:2, now:351 });
  assert.equal(next.decision, 'drag-start');
});
```

- [ ] **Step 2: Run RED**

```bash
node --test tests/message-board-gesture.test.mjs
```

- [ ] **Step 3: Implement gesture module and register test**

Use exact constants `HOLD_MS=350`, `CANCEL_DISTANCE=8`. Add this test to `package.json` `test:site`.

- [ ] **Step 4: Add RED controller contracts for create/edit/persistence**

```js
test('controller only persists owned/admin drops and keeps drafts on failure', () => {
  assert.match(controller, /createGuestMessage/);
  assert.match(controller, /updateOwnedGuestMessage/);
  assert.match(controller, /deleteOwnedGuestMessage/);
  assert.match(controller, /hasGuestMessageOwnership/);
  assert.match(controller, /correctDroppedPosition/);
  assert.match(controller, /serverConfirmed/);
});
```

- [ ] **Step 5: Implement composer create/edit**

Create mode pre-fills stored user ID, randomly preselects one of five colors, max text 800. On failure keep ID/text/color untouched. On success insert returned note with `.sticky-note--new`. Edit mode appears only for locally-owned note or admin; ordinary author edits text/color only, and server response controls recalculated size/rotation.

- [ ] **Step 6: Implement pointer dragging**

Use `message-board-gesture.mjs` decisions. Mouse/pen captures immediately; touch waits. While dragging, modify local CSS position only. On drop: run `correctDroppedPosition`, update local state, then issue exactly one PATCH if `hasGuestMessageOwnership(id)` or `adminMode`; otherwise keep the temporary location only in this browser. Save each persisted note's `serverConfirmed:{x,y}` before drag and restore it if PATCH fails.

- [ ] **Step 7: Implement owned delete**

Owned notes call `deleteOwnedGuestMessage`; admin will use admin delete in Task 7. Remove note from maps/DOM only after server success.

- [ ] **Step 8: Run GREEN**

```bash
node --test tests/message-board-gesture.test.mjs tests/message-board-layout.test.mjs tests/message-board-page.test.mjs
npm run build
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/message-board-gesture.mjs tests/message-board-gesture.test.mjs src/components/MessageBoard.astro src/lib/message-board-controller.ts src/styles/message-board.css tests/message-board-page.test.mjs package.json
git commit -m "feat: add sticky note composing and drag ownership"
```

---

### Task 7: Add drawer/comments, reactions, admin, polling, and interaction locks

**Files:**
- Modify: `src/components/MessageBoard.astro`
- Modify: `src/lib/message-board-controller.ts`
- Modify: `src/styles/message-board.css`
- Modify: `tests/message-board-page.test.mjs`

- [ ] **Step 1: Add RED contracts**

```js
test('details reuse comments and expose approved reactions', () => {
  assert.match(controller, /createCommentsWidget\(['"]message['"]/);
  assert.match(controller, /reactToGuestMessage/);
  for (const emoji of ['❤️','😂','✨','👍']) assert.match(board + controller, new RegExp(emoji));
});

test('live sync uses 15s polling, visibility pause, and locks', () => {
  assert.match(controller, /const MESSAGE_POLL_MS = 15_000/);
  assert.match(controller, /visibilitychange/);
  assert.match(controller, /fetchGuestMessagePage\(\{[^}]*since/);
  assert.match(controller, /interactionLocks/);
  assert.match(controller, /deferredRemote/);
});

test('admin session remains distinct from anonymous ownership', () => {
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

- [ ] **Step 3: Implement desktop drawer/mobile sheet behavior**

Click/tap note body opens details without moving it. Populate full text, user, time, reaction counts, ownership/admin actions; mount a fresh `createCommentsWidget('message', id, commentCount)`. Save prior focus, focus close button, close on Escape/backdrop, restore focus.

- [ ] **Step 4: Implement quick reactions**

Desktop hover/focus reveals four buttons. Touch long press may reveal the bar only if the gesture never transitions into drag. Use `reactToGuestMessage`; update counts and selected local emoji in-place without full refetch.

- [ ] **Step 5: Implement admin session**

Reuse `getSession/login/logout` from `moments-api.ts`. Admin can delete any note using existing credentialed `deleteGuestMessage`, and admin drag release persists even legacy notes through PATCH without author token because the Worker session path authorizes it.

- [ ] **Step 6: Implement polling and interaction locks**

```ts
const MESSAGE_POLL_MS = 15_000;
const interactionLocks = new Set<string>();
const deferredRemote = new Map<string, GuestMessage>();
```

Keep `lastSyncCursor` from successful reads. Visible tab: poll `{since:lastSyncCursor,limit:100}`; hidden tab: clear timer; visible again: sync immediately then restart. New unlocked notes animate in. Remote changes to dragging/editing/open-owned mutations go into `deferredRemote` and reconcile after local operation completes.

- [ ] **Step 7: Implement failure behavior**

Initial fetch failure keeps corkboard visible + retry button. Poll errors are silent and retried later. 429 maps to `操作太频繁，请稍后再试`. Author 401/403 clears stale ownership and hides owned controls. Create/edit retains draft. Failed drag save restores `serverConfirmed` position.

- [ ] **Step 8: Run GREEN/build**

```bash
node --test tests/message-board-page.test.mjs tests/message-board-layout.test.mjs tests/message-board-gesture.test.mjs
npm run build
```

- [ ] **Step 9: Commit**

```bash
git add src/components/MessageBoard.astro src/lib/message-board-controller.ts src/styles/message-board.css tests/message-board-page.test.mjs
git commit -m "feat: add sticky board interactions and live sync"
```

---

### Task 8: Finish visuals, accessibility, homepage compatibility, docs, and full verification

**Files:**
- Modify: `src/styles/message-board.css`
- Modify: `src/components/RecentMessagesWidget.astro`
- Modify: `tests/message-board-page.test.mjs`
- Modify: `danmaku-api/README.md`

- [ ] **Step 1: Add RED theme/accessibility contracts**

```js
test('corkboard supports dark theme, mobile sheet, and reduced motion', () => {
  const css = read('src/styles/message-board.css');
  assert.match(css, /--message-cork/);
  assert.match(css, /data-note-color="yellow"/);
  assert.match(css, /html\[data-theme="dark"\]/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*message-drawer/);
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /html\[data-reduce-motion="true"\]/);
});

test('homepage keeps the array message API contract', () => {
  const recent = read('src/components/RecentMessagesWidget.astro');
  assert.match(recent, /fetchGuestMessages\(\)/);
  assert.match(recent, /item\.userId/);
  assert.match(recent, /item\.text/);
  assert.match(recent, /item\.createdAt/);
});
```

- [ ] **Step 2: Run RED if finishing hooks/styles are absent**

```bash
node --test tests/message-board-page.test.mjs
```

- [ ] **Step 3: Finish cork/paper visual language**

Use layered CSS gradients only for cork grain. Define low-saturation light/dark paper colors, readable text/shadows, subtle pins/tape. Timing tokens: attach 240ms, drag lift/drop 160ms, quick bar 140ms, drawer/sheet 180ms. Reduced-motion disables transform animation and nonessential transitions.

- [ ] **Step 4: Finish responsive/accessibility behavior**

At `max-width:720px`, drawer is bottom sheet (`inset:auto 0 0`, max-height about `78dvh`). All note bodies and reaction buttons are keyboard reachable, reaction buttons have aria-labels, dialogs manage focus, and details are always available without drag. Horizontal overflow is contained inside `.message-board-viewport` only.

- [ ] **Step 5: Adjust homepage wording only**

Keep `fetchGuestMessages()` and its item fields untouched. Change copy to the new metaphor, e.g. `正在读取最近贴上的便签…` and `去留言板看看 →`. Do not create a second draggable corkboard in the sidebar.

- [ ] **Step 6: Update Worker docs and release order**

Correct README endpoint examples to actual config: `https://api.lidure22.xyz`, site `https://lidure22.xyz`, media through current config. Add:

```bash
cd danmaku-api
npm ci
npm run check
npm test
npx wrangler d1 migrations apply lidure-danmaku --remote
npm run deploy
```

State explicitly: migration 0008 must be applied before frontend production code that expects sticky columns/routes. Never place secrets or admin credentials in docs/logs.

- [ ] **Step 7: Run complete verification**

```bash
npm --prefix danmaku-api run check
npm --prefix danmaku-api test
npm run check
npm run test:site
npm run build
npm test
```

Expected: all pass.

- [ ] **Step 8: Manual local browser acceptance**

Run Worker + Astro dev servers and verify: legacy positions stable across reload; new create/color; same-browser edit/recolor/delete; incognito drag is temporary; author drag persists with one PATCH on drop; mobile scroll then 350ms drag; right drawer vs mobile bottom sheet; comments work; four reactions toggle/switch; second-browser new note appears within one poll; polling does not overwrite active drag/edit; admin deletes/moves legacy; light/dark/reduced-motion readable; homepage recent messages still render.

- [ ] **Step 9: Commit**

```bash
git add src/styles/message-board.css src/components/RecentMessagesWidget.astro tests/message-board-page.test.mjs danmaku-api/README.md
git commit -m "polish: finish sticky message board experience"
```

---

## Production Activation Order

Repository implementation and review can complete first, but production activation is backend-first:

1. Run the complete local suites.
2. Apply D1 migration `0008_sticky_message_board.sql` remotely.
3. Deploy the Worker from `danmaku-api`.
4. Smoke-test `GET /api/messages` and CORS/PATCH route availability.
5. Deploy/merge the frontend after the Worker is live.

Smoke checks:

```bash
curl -sS 'https://api.lidure22.xyz/api/messages?limit=1'
curl -i -X OPTIONS 'https://api.lidure22.xyz/api/messages' -H 'Origin: https://lidure22.xyz'
```

The GET response must contain `items`, `now`, `nextCursor`; each item must preserve `id`, `userId`, `text`, `createdAt` and include `note`. OPTIONS must allow `GET,POST,PATCH,DELETE,OPTIONS` for the production origin.
