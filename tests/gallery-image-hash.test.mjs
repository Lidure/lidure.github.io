import assert from 'node:assert/strict';
import test from 'node:test';

import { gitBlobSha, perceptualHash, prepareGalleryFile } from '../src/lib/gallery-image-hash.mjs';

test('gitBlobSha matches Git blob object framing', async () => {
  const file = new Blob(['hello'], { type: 'image/png' });
  assert.equal(await gitBlobSha(file), 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0');
});

test('perceptual hash preserves the legacy 9x8 dHash contract', async () => {
  const pixels = Uint8Array.from({ length: 72 }, (_, i) => i);
  const value = await perceptualHash(new Blob(['x']), { readGray9x8: async () => pixels });
  assert.match(value, /^[0-9a-f]{16}$/);
  assert.equal(value.length, 16);
  assert.equal(value, '0000000000000000');
});

test('decode failure is categorized and never becomes a fake perceptual hash', async () => {
  await assert.rejects(
    perceptualHash(new Blob(['x']), { readGray9x8: async () => { throw new Error('decode'); } }),
    error => error?.code === 'IMAGE_DECODE_FAILED',
  );
});

test('prepareGalleryFile returns one identity for exact and perceptual checks', async () => {
  const file = new Blob(['hello'], { type: 'image/png' });
  Object.defineProperty(file, 'name', { value: 'hello.png' });
  const prepared = await prepareGalleryFile(file, {
    readGray9x8: async () => Uint8Array.from({ length: 72 }, (_, i) => i),
  });
  assert.equal(prepared.signature, prepared.blobSha);
  assert.equal(prepared.blobSha, 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0');
  assert.match(prepared.perceptualHash, /^[0-9a-f]{16}$/);
});
