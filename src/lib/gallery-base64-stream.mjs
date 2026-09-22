const ENCODER = new TextEncoder();
const BASE64_BLOCK_BYTES = 3 * 8192;

function bytesToBase64(bytes) {
  let output = '';
  for (let offset = 0; offset < bytes.length; offset += BASE64_BLOCK_BYTES) {
    const part = bytes.subarray(offset, Math.min(bytes.length, offset + BASE64_BLOCK_BYTES));
    let binary = '';
    for (let i = 0; i < part.length; i++) binary += String.fromCharCode(part[i]);
    output += btoa(binary);
  }
  return output;
}

function mergeCarry(carry, chunk) {
  if (!carry.length) return chunk;
  const merged = new Uint8Array(carry.length + chunk.length);
  merged.set(carry, 0);
  merged.set(chunk, carry.length);
  return merged;
}

export function createBase64UploadStream(source) {
  if (!source || typeof source.getReader !== 'function') throw new Error('图片流不可用');
  const reader = source.getReader();
  let carry = new Uint8Array(0);
  let finished = false;
  return new ReadableStream({
    async pull(controller) {
      if (finished) return;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            if (carry.length) controller.enqueue(ENCODER.encode(bytesToBase64(carry)));
            controller.close();
            finished = true;
            return;
          }
          const incoming = value instanceof Uint8Array ? value : new Uint8Array(value);
          const merged = mergeCarry(carry, incoming);
          const complete = merged.length - (merged.length % 3);
          if (complete) controller.enqueue(ENCODER.encode(bytesToBase64(merged.subarray(0, complete))));
          carry = merged.slice(complete);
          if (controller.desiredSize != null && controller.desiredSize <= 0) return;
        }
      } catch (error) {
        finished = true;
        controller.error(error);
      }
    },
    cancel(reason) {
      finished = true;
      return reader.cancel(reason).catch(() => {});
    },
  });
}
