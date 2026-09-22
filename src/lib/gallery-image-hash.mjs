function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer), value => value.toString(16).padStart(2, '0')).join('');
}

export async function gitBlobSha(file) {
  if (!file || typeof file.size !== 'number') throw new Error('图片文件无效');
  const header = new TextEncoder().encode(`blob ${file.size}\0`);
  const bytes = await new Blob([header, file]).arrayBuffer();
  const digest = await globalThis.crypto.subtle.digest('SHA-1', bytes);
  return bytesToHex(digest);
}

function makeCanvas(width, height) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }
  throw new Error('当前环境不支持图片像素读取');
}

async function defaultReadGray9x8(blob) {
  if (typeof createImageBitmap !== 'function') throw new Error('当前浏览器不支持图片解码');
  let bitmap;
  try {
    try {
      bitmap = await createImageBitmap(blob, {
        resizeWidth: 9,
        resizeHeight: 8,
        resizeQuality: 'pixelated',
      });
    } catch {
      bitmap = await createImageBitmap(blob);
    }
    const canvas = makeCanvas(9, 8);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('无法创建图片画布');
    context.drawImage(bitmap, 0, 0, 9, 8);
    const rgba = context.getImageData(0, 0, 9, 8).data;
    const gray = new Uint8Array(72);
    for (let index = 0; index < 72; index++) {
      const offset = index * 4;
      gray[index] = Math.round(
        rgba[offset] * 0.299 + rgba[offset + 1] * 0.587 + rgba[offset + 2] * 0.114,
      );
    }
    return gray;
  } finally {
    try { bitmap?.close?.(); } catch {}
  }
}

export async function perceptualHash(file, deps = {}) {
  const readGray9x8 = deps.readGray9x8 || defaultReadGray9x8;
  let pixels;
  try {
    pixels = await readGray9x8(file);
  } catch (cause) {
    const error = new Error('图片解码失败，无法安全执行相似图片检查', { cause });
    error.code = 'IMAGE_DECODE_FAILED';
    throw error;
  }
  if (!(pixels instanceof Uint8Array) || pixels.length !== 72) {
    const error = new Error('图片像素数据无效');
    error.code = 'IMAGE_DECODE_FAILED';
    throw error;
  }
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | (pixels[y * 9 + x] < pixels[y * 9 + x + 1] ? 1n : 0n);
    }
  }
  return bits.toString(16).padStart(16, '0');
}

export async function prepareGalleryFile(file, deps = {}) {
  const blobSha = await gitBlobSha(file);
  const perceptualHashValue = await perceptualHash(file, deps);
  return {
    signature: blobSha,
    blobSha,
    perceptualHash: perceptualHashValue,
  };
}
