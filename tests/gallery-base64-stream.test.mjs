import assert from 'node:assert/strict';
import test from 'node:test';
import { createBase64UploadStream } from '../src/lib/gallery-base64-stream.mjs';

async function readText(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let value = '';
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    value += decoder.decode(chunk.value, { stream: true });
  }
  value += decoder.decode();
  return value;
}

test('streamed Base64 stays correct across arbitrary input chunk boundaries', async () => {
  const chunks = [
    Uint8Array.from([0]),
    Uint8Array.from([1, 2]),
    Uint8Array.from([3, 4, 5, 6]),
    Uint8Array.from([250, 251]),
  ];
  const expectedBytes = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
  const input = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  assert.equal(await readText(createBase64UploadStream(input)), expectedBytes.toString('base64'));
});

test('streamed Base64 pads one- and two-byte tails correctly', async () => {
  for (const bytes of [Uint8Array.from([1]), Uint8Array.from([1, 2])]) {
    const input = new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
    assert.equal(await readText(createBase64UploadStream(input)), Buffer.from(bytes).toString('base64'));
  }
});
