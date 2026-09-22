import { GALLERY_CLOUD_ORIGIN, GALLERY_REPOSITORY } from './gallery-manage-config.mjs';
import { createBase64UploadStream } from './gallery-base64-stream.mjs';

export const CLOUD_PROXY_BLOB_THRESHOLD_BYTES = 4 * 1024 * 1024;
export const CLOUD_PROXY_MAX_RAW_BYTES = 64 * 1024 * 1024;

const LARGE_UPLOAD_URL = `${GALLERY_CLOUD_ORIGIN}/__gallery-github-blob/${GALLERY_REPOSITORY}`;

function fallbackEncodeFile(file) {
  return file.arrayBuffer().then((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const block = 24 * 1024;
    for (let i = 0; i < bytes.length; i += block) {
      const part = bytes.subarray(i, Math.min(bytes.length, i + block));
      binary += String.fromCharCode(...part);
    }
    return btoa(binary);
  });
}

function supportsRequestStreams() {
  try {
    let accessed = false;
    new Request('https://example.invalid', {
      method: 'POST',
      body: new ReadableStream(),
      get duplex() {
        accessed = true;
        return 'half';
      },
    });
    return accessed;
  } catch {
    return false;
  }
}

export function createLargeUploadClient({ fetchImpl = fetch, encodeFile = fallbackEncodeFile } = {}) {
  async function upload(file, token) {
    const credential = String(token || '').trim();
    if (!credential) throw Object.assign(new Error('请先连接 GitHub'), { code: 'auth' });
    if (!file || !Number.isFinite(file.size) || file.size <= 0) throw new Error('上传文件无效');
    if (file.size > CLOUD_PROXY_MAX_RAW_BYTES) throw new Error('大图片稳定上传通道单图上限为 64 MiB');

    const canStream = typeof file.stream === 'function' && supportsRequestStreams();
    const body = canStream ? createBase64UploadStream(file.stream()) : await encodeFile(file);
    let response;
    try {
      response = await fetchImpl(LARGE_UPLOAD_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${credential}`,
          'Content-Type': 'text/plain',
          'X-Gallery-Blob-Size': String(file.size),
          'X-Gallery-Content-Encoding': 'base64',
        },
        body,
        ...(canStream ? { duplex: 'half' } : {}),
      });
    } catch {
      throw Object.assign(new Error('大图片上传网络连接失败'), { code: 'network', retryable: true });
    }
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok) {
      const code = response.status === 401 ? 'auth'
        : response.status === 403 ? 'permission'
          : response.status === 429 || response.headers.get('x-ratelimit-remaining') === '0' ? 'rate-limit'
            : 'upload';
      const error = Object.assign(new Error(data?.message || `大图片上传失败：HTTP ${response.status}`), {
        code,
        status: response.status,
        retryable: response.status === 429 || response.status >= 500,
      });
      throw error;
    }
    const sha = data?.sha;
    if (!sha) throw new Error('大图片上传成功但未返回 Git Blob SHA');
    return sha;
  }

  return { upload };
}
