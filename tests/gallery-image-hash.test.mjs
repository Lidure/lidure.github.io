import assert from 'node:assert/strict';
import test from 'node:test';
import { gitBlobSha, perceptualHash, prepareGalleryFile } from '../src/lib/gallery-image-hash.mjs';

test('gitBlobSha uses exact Git blob framing', async () => {
  const file = new Blob(['hello'], { type: 'image/png' });
  assert.equal(await gitBlobSha(file), 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0');
});

test('perceptualHash returns a deterministic 64-bit dHash from injected 9x8 grayscale pixels', async () => {
  const pixels = new Uint8Array(72);
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 9; x++) pixels[y * 9 + x] = x * 10;
  }
  const hash = await perceptualHash(new Blob(['x']), { readGray9x8: async () => pixels });
  assert.equal(hash, 'ffffffffffffffff');
});

test('decode failure is categorized and never silently bypasses duplicate checks', async () => {
  await assert.rejects(
    perceptualHash(new Blob(['bad']), { readGray9x8: async () => { throw new Error('decode'); } }),
    error => error.code === 'IMAGE_DECODE_FAILED',
  );
});

test('prepareGalleryFile returns signature, Git blob SHA and perceptual hash', async () => {
  const file = new Blob(['hello'], { type: 'image/png' });
  Object.defineProperty(file, 'name', { value: 'hello.png' });
  const pixels = Uint8Array.from({ length: 72 }, (_, i) => i % 9);
  const result = await prepareGalleryFile(file, { readGray9x8: async () => pixels });
  assert.equal(result.signature, result.blobSha);
  assert.match(result.blobSha, /^[0-9a-f]{40}$/);
  assert.match(result.perceptualHash, /^[0-9a-f]{16}$/);
});
