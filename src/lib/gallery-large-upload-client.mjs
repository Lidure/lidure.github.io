import { createBase64UploadStream } from './gallery-base64-stream.mjs';

export const LARGE_UPLOAD_URL =
  'https://airigallery.lidure22.xyz/__gallery-github-blob/Lidure/airi-gallery-images';
export const LARGE_UPLOAD_MAX_BYTES = 64 * 1024 * 1024;

function sanitize(message, token) {
  const raw = String(message || '大图片上传失败');
  return token ? raw.split(token).join('[redacted]') : raw;
}

function supportsStreamingRequestUploads() {
  try {
    let duplexAccessed = false;
    const request = new Request(location.origin, {
      method: 'POST',
      body: new ReadableStream(),
      get duplex() {
        duplexAccessed = true;
        return 'half';
      },
    });
    return duplexAccessed && !request.headers.has('Content-Type');
  } catch {
    return false;
  }
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

export async function uploadLargeGalleryBlob(file, {
  token,
  fetchImpl = fetch,
  makeBody = null,
  streaming = supportsStreamingRequestUploads(),
} = {}) {
  if (!token) throw Object.assign(new Error('大图片上传需要 GitHub Token'), { code: 'auth' });
  if (!file || !Number.isFinite(file.size) || file.size <= 0) throw new Error('待上传文件无效');
  if (file.size > LARGE_UPLOAD_MAX_BYTES) {
    throw Object.assign(new Error('Cloud 稳定上传通道单图上限为 64 MiB'), { code: 'size' });
  }

  const bodyFactory = makeBody || (async () => (
    streaming ? createBase64UploadStream(file.stream()) : fileToBase64(file)
  ));
  const body = await bodyFactory(file);
  const init = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain',
      'X-Gallery-Blob-Size': String(file.size),
      'X-Gallery-Content-Encoding': 'base64',
    },
    body,
    ...(streaming ? { duplex: 'half' } : {}),
  };

  let response;
  try {
    response = await fetchImpl(LARGE_UPLOAD_URL, init);
  } catch (cause) {
    throw Object.assign(new Error('大图片上传网络连接失败', { cause }), {
      code: 'network', retryable: true,
    });
  }
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  if (!response.ok) {
    const retryable = response.status === 429 || [500, 502, 503, 504].includes(response.status);
    const retryAfterSeconds = Number(response.headers.get('retry-after') || 0);
    throw Object.assign(new Error(sanitize(data?.message || `大图片上传失败：HTTP ${response.status}`, token)), {
      code: response.status === 401 ? 'auth' : (response.status === 413 ? 'size' : 'large-upload'),
      status: response.status,
      retryable,
      retryAfterMs: retryAfterSeconds > 0 ? Math.min(10_000, retryAfterSeconds * 1000) : 0,
    });
  }
  const sha = data?.sha;
  if (!sha) throw new Error('大图片 Blob 创建成功但未返回 SHA');
  return sha;
}
