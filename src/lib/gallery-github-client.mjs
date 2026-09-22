import { GALLERY_BRANCH, GALLERY_REPOSITORY, githubApi } from './gallery-manage-config.mjs';

function safeMessage(code) {
  return ({
    auth: 'GitHub Token 无效或已过期',
    permission: '当前 Token 没有图库写入权限',
    'rate-limit': 'GitHub API 请求次数已达到限制，请稍后重试',
    conflict: '远端图库刚刚发生变化，请同步后重试',
    network: '无法连接 GitHub，请检查网络后重试',
    other: 'GitHub 请求失败，请稍后重试',
  })[code] || 'GitHub 请求失败';
}

export function classifyGitHubFailure(status, headers, body) {
  const remaining = headers?.get?.('x-ratelimit-remaining');
  const message = String(body?.message || '');
  if (status === 401) return 'auth';
  if (status === 429 || remaining === '0' || /rate limit/i.test(message)) return 'rate-limit';
  if (status === 403) return 'permission';
  if (status === 409 || status === 422) return 'conflict';
  return 'other';
}

function galleryError(code, status = 0) {
  return Object.assign(new Error(safeMessage(code)), { code, status });
}

export function createGalleryGitHubClient({ fetchImpl = fetch, token = '' } = {}) {
  const credential = String(token || '').trim();

  async function request(method, path, options = {}) {
    let url;
    if (/^https?:\/\//i.test(path)) {
      url = new URL(path);
    } else if (path.startsWith('/repos/')) {
      url = new URL(`https://api.github.com${path}`);
    } else {
      url = new URL(githubApi(path));
    }
    for (const [name, value] of Object.entries(options.params || {})) {
      if (value != null) url.searchParams.set(name, String(value));
    }
    const headers = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(credential ? { Authorization: `Bearer ${credential}` } : {}),
      ...(options.headers || {}),
    };
    let init = { method, headers, signal: options.signal };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init = { ...init, body: JSON.stringify(options.body) };
    }
    let response;
    try {
      response = await fetchImpl(url.toString(), init);
    } catch {
      throw galleryError('network');
    }
    let data = null;
    if (response.status !== 204) {
      try { data = await response.json(); } catch { data = null; }
    }
    if (!response.ok) {
      const code = classifyGitHubFailure(response.status, response.headers, data);
      const error = galleryError(code, response.status);
      const retryAfter = Number(response.headers.get('retry-after') || 0);
      if (retryAfter > 0) error.retryAfterMs = Math.min(10_000, retryAfter * 1000);
      error.retryable = code === 'rate-limit' || response.status >= 500;
      throw error;
    }
    return { data, status: response.status, headers: response.headers };
  }

  async function validateWriteAccess() {
    if (!credential) throw galleryError('auth', 401);
    const { data } = await request('GET', '');
    const canWrite = data?.permissions?.push === true || data?.permissions?.admin === true;
    if (!canWrite) throw galleryError('permission', 403);
    return { canWrite: true, repository: GALLERY_REPOSITORY, branch: GALLERY_BRANCH };
  }

  async function getBranchSnapshot({ signal } = {}) {
    const ref = await request('GET', `/git/ref/heads/${encodeURIComponent(GALLERY_BRANCH)}`, { signal });
    const headSha = ref.data?.object?.sha;
    if (!headSha) throw galleryError('other');
    const commit = await request('GET', `/git/commits/${headSha}`, { signal });
    const treeSha = commit.data?.tree?.sha;
    if (!treeSha) throw galleryError('other');
    const tree = await request('GET', `/git/trees/${treeSha}`, { params: { recursive: '1' }, signal });
    if (tree.data?.truncated || !Array.isArray(tree.data?.tree)) throw galleryError('other');
    return { headSha, treeSha, tree: tree.data.tree };
  }

  async function getContent(path, { signal } = {}) {
    const encoded = String(path).split('/').map(encodeURIComponent).join('/');
    return request('GET', `/contents/${encoded}`, { params: { ref: GALLERY_BRANCH }, signal });
  }

  return {
    request,
    validateWriteAccess,
    getBranchSnapshot,
    getContent,
  };
}
