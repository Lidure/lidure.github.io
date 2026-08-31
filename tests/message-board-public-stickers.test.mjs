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
const boardCssSource = readOptional('../src/styles/message-board.css');
const overlayCssSource = readOptional('../src/styles/overlay-layers.css');
const workerSource = readOptional('../danmaku-api/src/index.ts');
const stickerWorkerSource = readOptional('../danmaku-api/src/message-stickers.ts');
const removalMigrationSource = readOptional('../danmaku-api/migrations/0010_remove_retired_message_stickers.sql');

const NEW_CHARACTER_STICKERS = [
  'nekoha-shizuku-wave-01',
  'nekoha-shizuku-hug-01',
  'nekoha-shizuku-cheer-01',
  'nachoneko-love-01',
  'nachoneko-peek-01',
  'nachoneko-pizza-01',
];

const EXPANDED_STICKERS = [
  'nekoha-shizuku-04',
  'nekoha-shizuku-05',
  'nekoha-shizuku-06',
  'nekoha-shizuku-07',
  'nachoneko-cry-02',
  'nachoneko-angry-02',
  'nachoneko-donut-02',
  'nachoneko-sorry-02',
  'pochacco-play-02',
  'pochacco-kawaii-03',
  'pochacco-fun-04',
  'pochacco-friends-05',
  'journal-sparkles-01',
  'journal-blossom-01',
];

const CATEGORY_COUNTS = {
  sanrio: 54,
  'nekoha-shizuku': 24,
  nachoneko: 24,
  journal: 10,
};

test('public sticker catalog is isolated from the API client', () => {
  assert.match(catalogSource, /MESSAGE_STICKER_CATALOG/);
  assert.match(catalogSource, /hello-kitty-01/);
  assert.match(catalogSource, /kuromi-01/);
  assert.match(apiSource, /message_sticker_owner_token_v1/);
  assert.match(apiSource, /X-Message-Sticker-Owner/);
  assert.doesNotMatch(apiSource, /ownerToken=.*URLSearchParams/);
});

test('sticker house serves exactly 112 local artworks with explicit categories', () => {
  assert.doesNotMatch(catalogSource, /\bkey:\s*'cinnamoroll-01'/);
  assert.doesNotMatch(catalogSource, /\bkey:\s*'little-twin-stars-01'/);
  const imageUrls = [...catalogSource.matchAll(/\bimageUrl:\s*'([^']+)'/g)].map((match) => match[1]);
  assert.equal(imageUrls.length, 112, 'expected the expanded sticker house to contain exactly 112 local choices');
  for (const url of imageUrls) {
    assert.match(url, /^\/assets\/message-stickers\/[a-z0-9-]+\.png$/i, 'sticker art must use a same-origin local path');
    assert.ok(existsSync(new URL(`../public${url}`, import.meta.url)), `missing local sticker asset: ${url}`);
  }
  assert.doesNotMatch(catalogSource, /https?:\/\//, 'public sticker catalog must not hotlink remote images');
  assert.match(catalogSource, /category:\s*MessageStickerCategory/);
  for (const [category, expected] of Object.entries(CATEGORY_COUNTS)) {
    assert.equal(
      (catalogSource.match(new RegExp(`category:\\s*'${category.replace('-', '\\-')}'`, 'g')) || []).length,
      expected,
      `expected ${expected} stickers in ${category}`,
    );
  }
});

test('Sanrio expansion heavily favors Kuromi Cinnamoroll and Pochacco', () => {
  assert.ok((catalogSource.match(/character:\s*'酷洛米'/g) || []).length >= 16, 'expected at least 16 Kuromi stickers');
  assert.ok((catalogSource.match(/character:\s*'大耳狗'/g) || []).length >= 15, 'expected at least 15 Cinnamoroll stickers');
  assert.ok((catalogSource.match(/character:\s*'帕恰狗'/g) || []).length >= 15, 'expected at least 15 Pochacco stickers');
  assert.equal((catalogSource.match(/character:\s*'猫羽雫'/g) || []).length, 24);
  assert.equal((catalogSource.match(/character:\s*'甘城猫猫'/g) || []).length, 24);
  assert.equal((catalogSource.match(/character:\s*'手帐装饰'/g) || []).length, 10);
});

test('existing character sticker choices remain available', () => {
  for (const key of [...NEW_CHARACTER_STICKERS, ...EXPANDED_STICKERS]) {
    assert.match(catalogSource, new RegExp(`key:\\s*'${key}'`), `missing browser sticker ${key}`);
    assert.ok(
      existsSync(new URL(`../public/assets/message-stickers/${key}.png`, import.meta.url)),
      `missing local PNG for ${key}`,
    );
  }
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
  assert.equal(browserKeys.length, 112);
  for (const key of browserKeys) {
    assert.match(stickerWorkerSource, new RegExp(`'${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*:`));
  }
  assert.doesNotMatch(stickerWorkerSource, /'cinnamoroll-01'\s*:/);
  assert.doesNotMatch(stickerWorkerSource, /'little-twin-stars-01'\s*:/);
});

test('sticker house exposes filter tabs for all categories', () => {
  assert.match(boardSource, /id="message-sticker-categories"/);
  assert.match(boardSource, /aria-label="贴纸分类"/);
  for (const category of ['all', 'sanrio', 'nekoha-shizuku', 'nachoneko', 'journal']) {
    assert.match(controllerSource, new RegExp(`['"]${category}['"]`), `missing category ${category}`);
  }
  assert.match(controllerSource, /activeStickerCategory/);
  assert.match(controllerSource, /definition\.category/);
  assert.match(controllerSource, /data-sticker-category/);
  assert.match(stickerCssSource, /\.message-sticker-categories/);
  assert.match(stickerCssSource, /overflow-x:\s*auto/);
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

test('sticker panel escapes board stacking context and uses the global overlay layer', () => {
  assert.match(boardSource, /stickerPanel\.parentElement !== document\.body/);
  assert.match(boardSource, /document\.body\.appendChild\(stickerPanel\)/);
  assert.match(boardSource, /placementBar\.parentElement !== document\.body/);
  assert.match(boardSource, /document\.body\.appendChild\(placementBar\)/);
  assert.match(stickerCssSource, /\.message-sticker-panel\s*\{[\s\S]*?z-index:\s*var\(--layer-overlay\)/);
  assert.match(stickerCssSource, /\.message-sticker-placement-bar\s*\{[\s\S]*?z-index:\s*var\(--layer-overlay\)/);
  assert.match(overlayCssSource, /--layer-decoration:\s*20/);
  assert.match(overlayCssSource, /--layer-overlay:\s*3000/);
});

test('public stickers render above notes while non-manageable stickers stay click-through', () => {
  assert.match(stickerCssSource, /\.message-public-sticker-layer\s*\{[\s\S]*?z-index:\s*50/);
  assert.match(boardCssSource, /\.sticky-note\.dragging\s*\{[\s\S]*?z-index:\s*40/);
  assert.match(stickerCssSource, /\.message-public-sticker\s*\{[\s\S]*?pointer-events:\s*none/);
  assert.match(stickerCssSource, /\.message-public-sticker\.is-manageable\s*\{[\s\S]*?pointer-events:\s*auto/);
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

test('selected manageable stickers expose delete only while direct dragging stays available', () => {
  assert.match(controllerSource, /remove\.textContent = '删除'/);
  assert.doesNotMatch(controllerSource, /拖动整理|拖动管理/);
  assert.match(controllerSource, /bindStickerDrag\(element, sticker, definition\)/);
});

test('admin state reaches the sticker controller through a stable browser event', () => {
  assert.match(boardControllerSource, /message-board-admin-change/);
  assert.match(boardControllerSource, /CustomEvent[\s\S]*authenticated/);
  assert.match(controllerSource, /message-board-admin-change/);
  assert.match(controllerSource, /detail[\s\S]*authenticated/);
});
