import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const api = read('src/lib/public-interactions.ts');

test('public message client supports sticky pages and anonymous ownership', () => {
  for (const symbol of ['MessageNoteMeta', 'GuestMessagePage', 'GuestMessagePatch', 'fetchGuestMessagePage', 'updateOwnedGuestMessage', 'deleteOwnedGuestMessage', 'hasGuestMessageOwnership', 'reactToGuestMessage']) {
    assert.match(api, new RegExp(symbol));
  }
  assert.match(api, /guest_message_author_tokens_v1/);
  assert.match(api, /public_message_reactions_v1/);
});

test('legacy homepage helper stays compatible with the paged message client', () => {
  assert.match(api, /fetchGuestMessagePage\(\{\s*limit:\s*80\s*\}\)/);
  assert.match(api, /return\s*\(await fetchGuestMessagePage\(\{\s*limit:\s*80\s*\}\)\)\.items/);
});

test('owned mutations clear stale browser ownership after authorization rejection', () => {
  assert.match(api, /status\s*===\s*401\s*\|\|\s*[^\n]*status\s*===\s*403/);
  assert.match(api, /setGuestMessageAuthorToken\(messageId,\s*''\)/);
});

test('messages page delegates to a dedicated board', () => {
  const page = read('src/pages/messages.astro');
  assert.match(page, /import MessageBoard from ['"]\.\.\/components\/MessageBoard\.astro['"]/);
  assert.match(page, /<MessageBoard\s*\/>/);
  assert.doesNotMatch(page, /messages-layout/);
  assert.doesNotMatch(page, /function renderMessages/);
});

test('board exposes the approved interactive surfaces', () => {
  const board = read('src/components/MessageBoard.astro');
  const controller = read('src/lib/message-board-controller.ts');
  for (const id of ['message-board-root','message-board-stage','message-compose-open','message-composer','message-drawer','message-admin']) {
    assert.match(board, new RegExp(`id="${id}"`));
  }
  assert.match(controller, /export function initMessageBoard/);
  assert.match(controller, /fetchGuestMessagePage/);
  assert.match(controller, /computeBoardHeight/);
});

test('controller persists only owned drops and keeps a server-confirmed rollback point', () => {
  const controller = read('src/lib/message-board-controller.ts');
  assert.match(controller, /createGuestMessage/);
  assert.match(controller, /updateOwnedGuestMessage/);
  assert.match(controller, /deleteOwnedGuestMessage/);
  assert.match(controller, /hasGuestMessageOwnership/);
  assert.match(controller, /correctDroppedPosition/);
  assert.match(controller, /serverConfirmed/);
});

test('details reuse comments and expose approved reactions', () => {
  const board = read('src/components/MessageBoard.astro');
  const controller = read('src/lib/message-board-controller.ts');
  assert.match(controller, /createCommentsWidget\(['"]message['"]/);
  assert.match(controller, /reactToGuestMessage/);
  for (const emoji of ['❤️','😂','✨','👍']) assert.match(board + controller, new RegExp(emoji));
});

test('live sync uses 15s polling, visibility pause, and interaction locks', () => {
  const controller = read('src/lib/message-board-controller.ts');
  assert.match(controller, /const MESSAGE_POLL_MS = 15_000/);
  assert.match(controller, /visibilitychange/);
  assert.match(controller, /fetchGuestMessagePage\(\{[^}]*since/);
  assert.match(controller, /interactionLocks/);
  assert.match(controller, /deferredRemote/);
});

test('admin session remains distinct from anonymous ownership', () => {
  const controller = read('src/lib/message-board-controller.ts');
  assert.match(controller, /getSession/);
  assert.match(controller, /login/);
  assert.match(controller, /logout/);
  assert.match(controller, /deleteGuestMessage/);
  assert.match(controller, /method:\s*['"]PATCH['"]/);
  assert.match(controller, /credentials:\s*['"]include['"]/);
});

test('open detail drawer refreshes immediately when admin state changes', () => {
  const controller = read('src/lib/message-board-controller.ts');
  assert.match(controller, /drawer\.dataset\.messageId\s*=\s*message\.id/);
  assert.match(controller, /const id = drawer\.dataset\.messageId/);
  assert.match(controller, /if \(message\) openDrawer\(message, false\)/);
});

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
