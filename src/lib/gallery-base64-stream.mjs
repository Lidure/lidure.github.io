const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function encodeTriples(bytes) {
  let output = '';
  for (let i = 0; i + 2 < bytes.length; i += 3) {
    const value = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    output += BASE64[(value >> 18) & 63]
      + BASE64[(value >> 12) & 63]
      + BASE64[(value >> 6) & 63]
      + BASE64[value & 63];
  }
  return output;
}

function encodeRemainder(bytes) {
  if (bytes.length === 1) {
    const value = bytes[0] << 16;
    return `${BASE64[(value >> 18) & 63]}${BASE64[(value >> 12) & 63]}==`;
  }
  if (bytes.length === 2) {
    const value = (bytes[0] << 16) | (bytes[1] << 8);
    return `${BASE64[(value >> 18) & 63]}${BASE64[(value >> 12) & 63]}${BASE64[(value >> 6) & 63]}=`;
  }
  return '';
}

export function createBase64UploadStream(byteStream) {
  const reader = byteStream.getReader();
  const encoder = new TextEncoder();
  let carry = new Uint8Array(0);

  return new ReadableStream({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        if (carry.length) controller.enqueue(encoder.encode(encodeRemainder(carry)));
        controller.close();
        return;
      }
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      const joined = new Uint8Array(carry.length + chunk.length);
      joined.set(carry);
      joined.set(chunk, carry.length);
      const completeLength = joined.length - (joined.length % 3);
      if (completeLength) controller.enqueue(encoder.encode(encodeTriples(joined.subarray(0, completeLength))));
      carry = joined.slice(completeLength);
    },
    async cancel(reason) {
      try { await reader.cancel(reason); } catch {}
    },
  });
}
