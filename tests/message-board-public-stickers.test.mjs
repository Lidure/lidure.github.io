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
const removalMigrationSource = readOptional('../danmaku-api/migrations/0010_remove_retired_message_stickers.sql');

test('public sticker catalog is isolated from the API client', () => {
  assert.match(catalogSource, /MESSAGE_STICKER_CATALOG/);
  assert.match(catalogSource, /hello-kitty-01/);
  assert.match(catalogSource, /kuromi-01/);
  assert.match(apiSource, /message_sticker_owner_token_v1/);
  assert.match(apiSource, /X-Message-Sticker-Owner/);
  assert.doesNotMatch(apiSource, /ownerToken=.*URLSearchParams/);
});

test('retired sticker choices are removed and remaining artwork is served locally', () => {
  assert.doesNotMatch(catalogSource, /\bkey:\s*'cinnamoroll-01'/);
  assert.doesNotMatch(catalogSource, /\bkey:\s*'little-twin-stars-01'/);
  const imageUrls = [...catalogSource.matchAll(/\bimageUrl:\s*'([^']+)'/g)].map((match) => match[1]);
  assert.equal(imageUrls.length, 12, 'expected 12 sticker choices after retiring two entries');
  for (const url of imageUrls) {
    assert.match(url, /^\/assets\/message-stickers\/[a-z0-9-]+\.png$/i, 'sticker art must use a same-origin local path');
    assert.ok(existsSync(new URL(`../public${url}`, import.meta.url)), `missing local sticker asset: ${url}`);
  }
  assert.doesNotMatch(catalogSource, /https?:\/\//, 'public sticker catalog must not hotlink remote images');
});

test('retired sticker rows are removed from D1 so invisible stickers cannot consume the five-sticker quota', () => {
  assert.match(removalMigrationSource, /DELETE\s+FROM\s+message_stickers/i);
  assert.match(removalMigrationSource, /cinnamoroll-01/);
  assert.match(removalMigrationSource, /little-twin-stars-01/);
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
  assert.ok(browserKeys.length >= 10, 'expected a varied public sticker catalog');
  for (const key of browserKeys) {
    assert.match(stickerWorkerSource, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*:`));
  }
  assert.doesNotMatch(stickerWorkerSource, /'cinnamoroll-01'\s*:/);
  assert.doesNotMatch(stickerWorkerSource, /'little-twin-stars-01'\s*:/);
});

test('message board keeps the persistent public sticker house after removing auto-loaded decorations', () => {
  assert.match(boardSource, /import ['"]\.\.\/styles\/message-board-public-stickers\.css['"]/);
  for (const id of ['message-sticker-open', 'message-sticker-panel', 'message-sticker-grid', 'message-sticker-quota', 'message-public-sticker-layer']) {
    assert.match(boardSource, new RegExp(`id="${id}"`));
  }
  assert.match(boardSource, /initMessageStickerBoard/);
  assert.doesNotMatch(boardSource, /initMessageBoardStickers/);
  assert.doesNotMatch(boardSource, /data-board-sticker=/);
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
