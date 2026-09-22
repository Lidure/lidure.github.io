function digestToHex(digest) {
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function gitBlobSha(file) {
  if (!(file instanceof Blob)) throw new TypeError('图片文件无效');
  const header = new TextEncoder().encode(`blob ${file.size}\0`);
  const digest = await crypto.subtle.digest('SHA-1', await new Blob([header, file]).arrayBuffer());
  return digestToHex(digest);
}

async function defaultReadGray9x8(blob) {
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    throw new Error('当前环境不支持图片解码');
  }
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
    const canvas = document.createElement('canvas');
    canvas.width = 9;
    canvas.height = 8;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('无法创建图片画布');
    context.imageSmoothingEnabled = false;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, 9, 8);
    context.drawImage(bitmap, 0, 0, 9, 8);
    const data = context.getImageData(0, 0, 9, 8).data;
    const gray = new Uint8Array(72);
    for (let index = 0; index < 72; index++) {
      const offset = index * 4;
      gray[index] = Math.floor((299 * data[offset] + 587 * data[offset + 1] + 114 * data[offset + 2]) / 1000);
    }
    return gray;
  } finally {
    try { bitmap?.close?.(); } catch {}
  }
}

export async function perceptualHash(blob, deps = {}) {
  const readGray9x8 = deps.readGray9x8 || defaultReadGray9x8;
  let gray;
  try {
    gray = await readGray9x8(blob);
  } catch (cause) {
    throw Object.assign(new Error('图片解码失败，无法进行相似查重'), {
      code: 'IMAGE_DECODE_FAILED',
      cause,
    });
  }
  if (!gray || gray.length !== 72) {
    throw Object.assign(new Error('图片哈希像素数据无效'), { code: 'IMAGE_DECODE_FAILED' });
  }
  let bits = 0n;
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = gray[y * 9 + x];
      const right = gray[y * 9 + x + 1];
      bits = (bits << 1n) | (left > right ? 1n : 0n);
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
