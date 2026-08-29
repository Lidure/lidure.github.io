import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

function readOptional(relativePath) {
  const url = new URL(relativePath, import.meta.url);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
}

const catalogSource = readOptional('../src/lib/message-sticker-catalog.ts');
const apiSource = readOptional('../src/lib/message-sticker-api.ts');
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
