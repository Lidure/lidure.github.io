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

test('drop keeps the dragged DOM node continuous until persistence settles', () => {
  const controller = read('src/lib/message-board-controller.ts');
  const css = read('src/styles/message-board.css');
  const match = controller.match(/async function finalizeDrop\([\s\S]*?\n  function bindNote/);
  assert.ok(match, 'finalizeDrop should remain an isolated controller step');
  const drop = match[0];
  const persistenceIndex = drop.search(/const saved\s*=/);
  assert.ok(persistenceIndex > 0, 'finalizeDrop should persist owned/admin positions');
  const beforePersistence = drop.slice(0, persistenceIndex);
  assert.doesNotMatch(beforePersistence, /renderAll\(\)/, 'drop must not destroy and recreate the dragged note before PATCH settles');
  assert.match(beforePersistence, /updateNoteElementPosition\(/, 'drop should update the existing note element in place');
  assert.match(css, /\.sticky-note\.dragging\s*\{[\s\S]*?transition:\s*none/, 'dragging transform must be fully pointer-synchronous');
});

test('a stale deferred poll snapshot cannot overwrite a newer local drop save', () => {
  const controller = read('src/lib/message-board-controller.ts');
  assert.match(controller, /function isRemoteMessageNewer\(/);
  assert.match(controller, /if \(!current \|\| isRemoteMessageNewer\(current, deferred\)\)/);
});

test('portaled composer keeps the sticky-note paper palette in light and dark themes', () => {
  const board = read('src/components/MessageBoard.astro');
  const css = read('src/styles/message-board.css');
  const palette = read('src/styles/message-board-palette.css');
  assert.match(board, /import ['"]\.\.\/styles\/message-board-palette\.css['"]/);
  for (const token of ['yellow', 'pink', 'blue', 'green', 'purple']) {
    assert.match(palette, new RegExp(`\\.message-composer-backdrop[\\s\\S]*--message-paper-${token}:`));
    assert.match(palette, new RegExp(`html\\[data-theme="dark"\\][\\s\\S]*\\.message-composer-backdrop[\\s\\S]*--message-paper-${token}:`));
    assert.match(css, new RegExp(`message-color-choice\\[data-note-color-choice="${token}"\\][^}]*background:\\s*var\\(--message-paper-${token}\\)`));
  }
});

test('color picker rebuilds interactive swatches on controller remount', () => {
  const controller = read('src/lib/message-board-controller.ts');
  const match = controller.match(/function buildColorOptions\(\) \{[\s\S]*?\n  \}/);
  assert.ok(match, 'buildColorOptions should be present');
  const build = match[0];
  assert.doesNotMatch(build, /childElementCount\) return/, 'existing swatches may have aborted listeners after Astro remount');
  assert.match(build, /replaceChildren\(\)/, 'remount should discard stale swatches before rebinding listeners');
  assert.match(build, /addEventListener\(['"]click['"][\s\S]*setSelectedColor\(color\)/, 'fresh swatches must bind selection clicks');
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

test('message board uses draggable third-party image stickers and persists their positions', () => {
  const board = read('src/components/MessageBoard.astro');
  const stickers = read('src/styles/message-board-stickers.css');

  assert.match(board, /import ['"]\.\.\/styles\/message-board-stickers\.css['"]/);
  for (const name of ['dog', 'flower', 'star', 'tape']) {
    assert.match(board, new RegExp(`data-board-sticker="${name}"`));
  }
  const stickerImages = board.match(/<img[\s\S]*?data-sticker-image[\s\S]*?>/g) || [];
  assert.ok(stickerImages.length >= 4, 'all board decorations should be third-party image stickers');
  assert.doesNotMatch(board, /message-board-pixel-flower/);
  assert.doesNotMatch(board, /message-board-sticker-doodle/);
  assert.doesNotMatch(board, /message-board-sticker-sprout/);
  assert.match(board, /const STICKER_STORAGE_KEY = ['"]message_board_sticker_positions_v2['"]/);
  assert.match(board, /localStorage\.getItem\(STICKER_STORAGE_KEY\)/);
  assert.match(board, /localStorage\.setItem\(STICKER_STORAGE_KEY/);
  assert.match(board, /pointerdown/);
  assert.match(board, /pointermove/);
  assert.match(board, /pointerup/);
  assert.match(board, /setPointerCapture/);
  assert.match(board, /releasePointerCapture/);
  assert.match(stickers, /\.message-board-sticker-button\s*\{[\s\S]*?cursor:\s*grab/);
  assert.match(stickers, /\.message-board-sticker-button\.is-dragging\s*\{[\s\S]*?cursor:\s*grabbing/);
  assert.match(stickers, /touch-action:\s*none/);
});

test('sticker hover never overrides drag positioning and no drag hint is rendered', () => {
  const board = read('src/components/MessageBoard.astro');
  const legacyCss = read('src/styles/message-board.css');
  const stickerCss = read('src/styles/message-board-stickers.css');

  assert.doesNotMatch(board, /message-board-sticker-caption/);
  assert.doesNotMatch(board, />\s*可以拖我\s*</);
  assert.doesNotMatch(legacyCss, /\.message-board-sticker--dog/);
  assert.doesNotMatch(legacyCss, /\.message-board-sticker--flower/);
  assert.doesNotMatch(legacyCss, /\.message-board-sticker-button/);
  assert.match(stickerCss, /\.message-board-sticker-button\s*\{[\s\S]*transform:\s*translate3d\(var\(--sticker-x\),\s*var\(--sticker-y\),\s*0\)/);
  const hoverBlock = stickerCss.match(/\.message-board-sticker-button:hover,\s*\.message-board-sticker-button:focus-visible\s*\{([^}]*)\}/);
  assert.ok(hoverBlock, 'sticker hover block should remain present');
  assert.doesNotMatch(hoverBlock[1], /transform:/, 'hover must never overwrite the transform used for drag positioning');
});

test('homepage keeps the array message API contract', () => {
  const recent = read('src/components/RecentMessagesWidget.astro');
  assert.match(recent, /fetchGuestMessages\(\)/);
  assert.match(recent, /item\.userId/);
  assert.match(recent, /item\.text/);
  assert.match(recent, /item\.createdAt/);
});
