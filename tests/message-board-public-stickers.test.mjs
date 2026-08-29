import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

function readOptional(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
}

const catalogSource = readOptional('../src/lib/message-sticker-catalog.ts');
const apiSource = readOptional('../src/lib/message-sticker-api.ts');
const controllerSource = readOptional('../src/lib/message-sticker-controller.ts');
const boardControllerSource = readOptional('../src/lib/message-board-controller.ts');
const boardSource = readOptional('../src/components/MessageBoard.astro');
const stickerCssSource = readOptional('../src/styles/message-board-public-stickers.css');
const workerSource = readOptional('../danmaku-api/src/index.ts');
const stickerWorkerSource = readOptional('../danmaku-api/src/message-stickers.ts');

test('public sticker catalog is isolated from the API client', () => {
  assert.match(catalogSource, /MESSAGE_STICKER_CATALOG/);
  assert.match(catalogSource, /hello-kitty-01/);
  assert.match(catalogSource, /cinnamoroll-01/);
  assert.match(catalogSource, /kuromi-01/);
  assert.match(apiSource, /message_sticker_owner_token_v1/);
  assert.match(apiSource, /X-Message-Sticker-Owner/);
  assert.doesNotMatch(apiSource, /ownerToken=.*URLSearchParams/);
});

test('public sticker API client exposes the ownership operations', () => {
  for (const symbol of [
    'getOrCreateStickerOwnerToken',
    'fetchMessageStickers',
    'createMessageSticker',
    'updateOwnedMessageSticker',
    'deleteOwnedMessageSticker',
  ]) {
    assert.match(apiSource, new RegExp(`export (?:async )?function ${symbol}`));
  }
});

test('Worker preflight allows the sticker ownership header', () => {
  assert.match(workerSource, /Access-Control-Allow-Headers[\s\S]*X-Message-Sticker-Owner/);
});

test('browser and Worker sticker allow-lists stay in sync', () => {
  const browserKeys = [...catalogSource.matchAll(/\bkey:\s*'([^']+)'/g)].map((match) => match[1]);
  assert.ok(browserKeys.length >= 12, 'expected a varied public sticker catalog');
  for (const key of browserKeys) {
    assert.match(stickerWorkerSource, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*:`));
  }
});

test('message board exposes a persistent sticker house without replacing local decorations', () => {
  assert.match(boardSource, /import ['"]\.\.\/styles\/message-board-public-stickers\.css['"]/);
  for (const id of ['message-sticker-open', 'message-sticker-panel', 'message-sticker-grid', 'message-sticker-quota', 'message-public-sticker-layer']) {
    assert.match(boardSource, new RegExp(`id="${id}"`));
  }
  assert.match(boardSource, /initMessageStickerBoard/);
  assert.match(boardSource, /initMessageBoardStickers/);
});

test('public sticker controller owns placement, mutations, polling, and layer recovery', () => {
  for (const symbol of [
    'fetchMessageStickers',
    'createMessageSticker',
    'updateOwnedMessageSticker',
    'deleteOwnedMessageSticker',
    'updateAdminMessageSticker',
    'deleteAdminMessageSticker',
    'createGestureState',
  ]) {
    assert.match(controllerSource, new RegExp(symbol));
  }
  assert.match(controllerSource, /const MESSAGE_STICKER_POLL_MS = 15_000/);
  assert.match(controllerSource, /visibilitychange/);
  assert.match(controllerSource, /MutationObserver/);
  assert.match(controllerSource, /ensureStickerLayer/);
  assert.match(controllerSource, /placingStickerKey/);
  assert.match(controllerSource, /STICKER_LIMIT_REACHED/);
});

test('admin state reaches the sticker controller through a stable browser event', () => {
  assert.match(boardControllerSource, /message-board-admin-change/);
  assert.match(boardControllerSource, /CustomEvent[\s\S]*authenticated/);
  assert.match(controllerSource, /message-board-admin-change/);
  assert.match(controllerSource, /detail[\s\S]*authenticated/);
});

test('public sticker layer stays below notes and non-manageable stickers do not intercept clicks', () => {
  assert.match(stickerCssSource, /\.message-public-sticker-layer\s*\{[\s\S]*?z-index:\s*4/);
  assert.match(stickerCssSource, /\.sticky-note\s*\{[\s\S]*?z-index:\s*10/);
  assert.match(stickerCssSource, /\.message-public-sticker\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(stickerCssSource, /\.message-public-sticker\.is-manageable\s*\{[\s\S]*?pointer-events:\s*auto/);
});