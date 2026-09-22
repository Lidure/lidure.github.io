const LARGE_UPLOAD_URL = 'https://airigallery.lidure22.xyz/__gallery-github-blob/Lidure/airi-gallery-images';
const MAX_RAW_BYTES = 64 * 1024 * 1024;
const BASE64_BLOCK_BYTES = 3 * 8192;
const ENCODER = new TextEncoder();

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

export function createBase64FileStream(source) {
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
            finished = true;
            controller.close();
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

function uploadError(status, headers) {
  let code = 'large-upload';
  let retryable = false;
  if (status === 401) code = 'auth';
  else if (status === 403) code = headers?.get?.('x-ratelimit-remaining') === '0' ? 'rate-limit' : 'permission';
  else if (status === 429) { code = 'rate-limit'; retryable = true; }
  else if (status >= 500) retryable = true;
  const message = ({
    auth: 'GitHub Token 无效或已过期',
    permission: 'GitHub 拒绝大图片上传权限',
    'rate-limit': 'GitHub API 请求额度已用尽，请稍后重试',
  })[code] || `大图片上传失败：HTTP ${status}`;
  const error = Object.assign(new Error(message), { code, status, retryable });
  const retryAfter = Number(headers?.get?.('retry-after') || 0);
  if (retryAfter > 0) error.retryAfterMs = Math.min(10_000, retryAfter * 1000);
  return error;
}

export async function uploadLargeBlob({ file, token, fetchImpl = fetch }) {
  if (!token) throw Object.assign(new Error('大图片上传需要 GitHub Token'), { code: 'auth' });
  if (!file || !Number.isSafeInteger(Number(file.size)) || Number(file.size) <= 0) {
    throw new Error('大图片文件大小无效');
  }
  if (Number(file.size) > MAX_RAW_BYTES) throw new Error('Cloud 稳定上传通道单图上限为 64 MiB');
  if (typeof file.stream !== 'function') throw new Error('当前浏览器不支持流式图片上传');

  const body = createBase64FileStream(file.stream());
  let response;
  try {
    response = await fetchImpl(LARGE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
        'X-Gallery-Blob-Size': String(file.size),
        'X-Gallery-Content-Encoding': 'base64',
      },
      body,
      duplex: 'half',
    });
  } catch {
    throw Object.assign(new Error('大图片上传网络连接失败'), {
      code: 'network', status: 0, retryable: true,
    });
  }
  let data = null;
  try { data = await response.json(); } catch {}
  if (!response.ok) throw uploadError(response.status, response.headers);
  if (!data?.sha) throw Object.assign(new Error('大图片上传未返回 Git Blob SHA'), { code: 'invalid-response' });
  return { sha: data.sha };
}
