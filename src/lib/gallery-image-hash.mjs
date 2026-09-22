function bytesToHex(bytes) {
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}

export async function gitBlobSha(file) {
  if (!file || typeof file.arrayBuffer !== 'function') throw new Error('图片文件无效');
  const header = new TextEncoder().encode(`blob ${file.size}\0`);
  const digest = await crypto.subtle.digest('SHA-1', await new Blob([header, file]).arrayBuffer());
  return bytesToHex(new Uint8Array(digest));
}

async function defaultReadGray8x8(blob) {
  let bitmap;
  try {
    try {
      bitmap = await createImageBitmap(blob, { resizeWidth: 8, resizeHeight: 8, resizeQuality: 'low' });
    } catch {
      bitmap = await createImageBitmap(blob);
    }

    let canvas;
    let context;
    if (typeof OffscreenCanvas === 'function') {
      canvas = new OffscreenCanvas(8, 8);
      context = canvas.getContext('2d', { willReadFrequently: true });
    } else if (typeof document !== 'undefined') {
      canvas = document.createElement('canvas');
      canvas.width = 8;
      canvas.height = 8;
      context = canvas.getContext('2d', { willReadFrequently: true });
    }
    if (!context) throw new Error('当前浏览器无法读取图片像素');
    context.drawImage(bitmap, 0, 0, 8, 8);
    const rgba = context.getImageData(0, 0, 8, 8).data;
    const gray = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      const offset = i * 4;
      gray[i] = Math.round(rgba[offset] * 0.299 + rgba[offset + 1] * 0.587 + rgba[offset + 2] * 0.114);
    }
    return gray;
  } catch {
    throw Object.assign(new Error('无法解码图片进行相似度检查'), { code: 'IMAGE_DECODE_FAILED' });
  } finally {
    try { bitmap?.close?.(); } catch {}
  }
}

export async function perceptualHash(blob, { readGray8x8 = defaultReadGray8x8 } = {}) {
  const pixels = await readGray8x8(blob);
  if (!pixels || pixels.length !== 64) throw Object.assign(new Error('感知哈希像素数据无效'), { code: 'IMAGE_DECODE_FAILED' });
  let total = 0;
  for (const value of pixels) total += Number(value);
  const average = total / 64;
  let bits = 0n;
  for (const value of pixels) {
    bits = (bits << 1n) | (Number(value) >= average ? 1n : 0n);
  }
  return bits.toString(16).padStart(16, '0');
}

export async function prepareGalleryFile(file, deps = {}) {
  const blobSha = await gitBlobSha(file);
  const perceptual = await perceptualHash(file, deps);
  return { signature: blobSha, blobSha, perceptualHash: perceptual };
}
