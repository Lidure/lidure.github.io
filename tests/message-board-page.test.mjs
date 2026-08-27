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
  assert.match(api, /clearStoredGuestMessageAuthorToken/);
});
