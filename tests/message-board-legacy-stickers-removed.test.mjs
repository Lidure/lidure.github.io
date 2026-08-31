import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('message board no longer mounts the legacy remote decoration sticker layer', () => {
  const board = read('src/components/MessageBoard.astro');

  assert.doesNotMatch(board, /message-board-stickers\.css/);
  assert.doesNotMatch(board, /message-board-sticker-layer/);
  assert.doesNotMatch(board, /data-board-sticker=/);
  assert.doesNotMatch(board, /data-sticker-image/);
  assert.doesNotMatch(board, /message_board_sticker_positions_v2/);
  assert.doesNotMatch(board, /initMessageBoardStickers/);
  assert.doesNotMatch(board, /cdn\.jsdelivr\.net\/npm\/openmoji/);
  assert.doesNotMatch(board, /Pochacco-Download-PNG-Image/);

  assert.match(board, /id="message-sticker-open"/);
  assert.match(board, /id="message-public-sticker-layer"/);
  assert.match(board, /initMessageStickerBoard/);
});
