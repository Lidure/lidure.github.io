const DEFAULT_DANMAKU_API_BASE = 'https://danmaku.lidure22.xyz/api';
const MOMENTS_UPLOAD_PATH = '/moments/upload';

export type MomentImageUploadOptions = {
  adminToken: string;
  apiBase?: string;
};

function getApiBase(apiBase?: string) {
  const base = (apiBase || import.meta.env.PUBLIC_DANMAKU_API || DEFAULT_DANMAKU_API_BASE).trim();
  return base.replace(/\/$/, '');
}

async function readResponseError(res: Response) {
  const data = await res.json().catch(() => ({}));
  return typeof data.error === 'string' ? data.error : `API 错误 (${res.status})`;
}

/**
 * Upload a moments image through the API proxy.
 * The proxy stores the file in R2 and returns a public path.
 */
export async function uploadToR2(file: File, options: MomentImageUploadOptions): Promise<string> {
  const adminToken = options.adminToken.trim();
  if (!adminToken) {
    throw new Error('请先填写管理密钥');
  }

  const formData = new FormData();
  formData.append('file', file, file.name);

  const endpoint = `${getApiBase(options.apiBase)}${MOMENTS_UPLOAD_PATH}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${adminToken}`,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await readResponseError(res));
  }

  const data = await res.json().catch(() => ({}));
  const url = typeof data.url === 'string' ? data.url.trim() : '';
  if (!url) {
    throw new Error('上传成功，但未返回图片地址');
  }

  return url;
}
