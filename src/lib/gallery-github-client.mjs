import { GALLERY_REPOSITORY, githubApi } from './gallery-manage-config.mjs';

function sanitizeMessage(message, token) {
  const raw = String(message || 'GitHub 请求失败');
  return token ? raw.split(token).join('[redacted]') : raw;
}

function makeError(code, message, { status = 0, retryable = false, retryAfterMs = 0 } = {}) {
  return Object.assign(new Error(message), { code, status, retryable, retryAfterMs });
}

function classifyError(response, body, token) {
  const status = Number(response.status || 0);
  const remaining = response.headers.get('x-ratelimit-remaining');
  const rawMessage = sanitizeMessage(body?.message || `GitHub 请求失败：HTTP ${status}`, token);
  if (status === 401) return makeError('auth', 'GitHub Token 无效或已过期', { status });
  if (status === 403 && remaining === '0') {
    const reset = Number(response.headers.get('x-ratelimit-reset') || 0);
    return makeError('rate-limit', 'GitHub API 请求频率已达上限，请稍后重试', {
      status, retryable: true, retryAfterMs: reset ? Math.max(0, reset * 1000 - Date.now()) : 0,
    });
  }
  if (status === 403) return makeError('permission', '当前 Token 没有图库写入权限', { status });
  if (status === 409 || status === 422) return makeError('conflict', rawMessage, { status, retryable: true });
  if (status === 429 || status >= 500) return makeError('network', rawMessage, { status, retryable: true });
  return makeError('github', rawMessage, { status });
}

function fixedRepoRelativePath(path) {
  const raw = String(path || '');
  const prefix = `/repos/${GALLERY_REPOSITORY}`;
  if (raw === prefix) return '';
  if (raw.startsWith(`${prefix}/`)) return raw.slice(prefix.length);
  if (raw.startsWith('/repos/')) throw makeError('scope', '拒绝访问非固定图库仓库');
  return raw;
}

export function createGalleryGitHubClient({ fetchImpl = fetch, token = '' } = {}) {
  if (!token) throw makeError('auth', 'GitHub Token 不能为空');

  async function request(method, path, options = {}) {
    const relativePath = fixedRepoRelativePath(path);
    const url = new URL(githubApi(relativePath));
    for (const [key, value] of Object.entries(options.params || {})) url.searchParams.set(key, value);
    const headers = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    };
    const init = { method, headers, signal: options.signal || undefined };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(options.body);
    }
    let response;
    try {
      response = await fetchImpl(url.toString(), init);
    } catch (cause) {
      throw makeError('network', '网络连接失败，请检查网络后重试', { retryable: true, status: 0, cause });
    }
    let data = null;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok) throw classifyError(response, data, token);
    return { data, response };
  }

  async function validateWriteAccess() {
    const { data } = await request('GET', '');
    if (data?.permissions?.push !== true) {
      throw makeError('permission', '当前 Token 可以访问仓库，但没有 push 权限', { status: 403 });
    }
    return { canWrite: true };
  }

  return {
    request,
    validateWriteAccess,
    async getBranchHead() {
      const result = await request('GET', '/git/ref/heads/main');
      return result.data;
    },
  };
}
