import { GALLERY_BRANCH, GITHUB_API_ROOT, githubApi } from './gallery-manage-config.mjs';

function safeMessage(code) {
  return ({
    auth: 'GitHub Token 无效或已过期',
    permission: '当前 GitHub Token 没有图库写入权限',
    'rate-limit': 'GitHub API 请求额度已用尽，请稍后重试',
    'ref-conflict': '远端分支已变化，请同步图库后重试',
    network: '无法连接 GitHub，请检查网络后重试',
    'not-found': 'GitHub 图库资源不存在',
  })[code] || 'GitHub 请求失败';
}

export function classifyGitHubError(response, body = null) {
  const status = Number(response?.status || 0);
  const remaining = response?.headers?.get?.('x-ratelimit-remaining');
  let code = 'github';
  let retryable = false;
  if (status === 401) code = 'auth';
  else if (status === 403 && remaining === '0') code = 'rate-limit';
  else if (status === 403) code = 'permission';
  else if (status === 404) code = 'not-found';
  else if (status === 409 || status === 422) code = 'ref-conflict';
  else if (status === 429 || status >= 500) {
    code = status === 429 ? 'rate-limit' : 'github';
    retryable = true;
  }
  const error = Object.assign(new Error(safeMessage(code)), { code, status, retryable });
  const retryAfter = Number(response?.headers?.get?.('retry-after') || 0);
  if (retryAfter > 0) error.retryAfterMs = Math.min(10_000, retryAfter * 1000);
  return error;
}

function networkError() {
  return Object.assign(new Error(safeMessage('network')), {
    code: 'network',
    status: 0,
    retryable: true,
  });
}

export function createGalleryGitHubClient({ fetchImpl = fetch, token = '' } = {}) {
  let currentToken = String(token || '');

  function headers(extra = {}) {
    return {
      Accept: 'application/vnd.github+json',
      ...(currentToken ? { Authorization: `Bearer ${currentToken}` } : {}),
      'X-GitHub-Api-Version': '2022-11-28',
      ...extra,
    };
  }

  function resolveUrl(path, params) {
    const raw = String(path || '');
    const url = raw.startsWith('https://api.github.com/')
      ? new URL(raw)
      : raw.startsWith('/repos/')
        ? new URL(`https://api.github.com${raw}`)
        : new URL(githubApi(raw));
    for (const [key, value] of Object.entries(params || {})) {
      if (value != null) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async function request(method, path, options = {}) {
    const url = resolveUrl(path, options.params);
    const init = { method, headers: headers() };
    if (options.signal) init.signal = options.signal;
    if (options.body !== undefined) {
      init.headers = headers({ 'Content-Type': 'application/json' });
      init.body = JSON.stringify(options.body);
    }
    let response;
    try {
      response = await fetchImpl(url, init);
    } catch {
      throw networkError();
    }
    let data = null;
    const text = await response.text();
    if (text) {
      try { data = JSON.parse(text); } catch { data = { message: text }; }
    }
    if (!response.ok) throw classifyGitHubError(response, data);
    return { status: response.status, data, headers: response.headers };
  }

  return {
    request,
    setToken(value) { currentToken = String(value || ''); },
    clearToken() { currentToken = ''; },
    async validateWriteAccess() {
      if (!currentToken) throw Object.assign(new Error(safeMessage('auth')), { code: 'auth', status: 401 });
      const result = await request('GET', GITHUB_API_ROOT);
      if (result.data?.permissions && result.data.permissions.push === false) {
        throw Object.assign(new Error(safeMessage('permission')), { code: 'permission', status: 403 });
      }
      return true;
    },
    async getBranchHead() {
      const result = await request('GET', `/git/ref/heads/${encodeURIComponent(GALLERY_BRANCH)}`);
      return result.data?.object?.sha || '';
    },
    async getTree(treeSha) {
      const result = await request('GET', `/git/trees/${encodeURIComponent(treeSha)}`, { params: { recursive: '1' } });
      if (result.data?.truncated) throw Object.assign(new Error('GitHub 文件树被截断'), { code: 'truncated-tree' });
      return result.data?.tree || [];
    },
    async createBlob(contentBase64) {
      const result = await request('POST', '/git/blobs', { body: { content: contentBase64, encoding: 'base64' } });
      return result.data?.sha || '';
    },
    async createTree(baseTreeSha, entries) {
      const result = await request('POST', '/git/trees', { body: { base_tree: baseTreeSha, tree: entries } });
      return result.data?.sha || '';
    },
    async createCommit(message, treeSha, parentSha) {
      const result = await request('POST', '/git/commits', { body: { message, tree: treeSha, parents: [parentSha] } });
      return result.data?.sha || '';
    },
    async updateRef(commitSha) {
      return request('PATCH', `/git/refs/heads/${encodeURIComponent(GALLERY_BRANCH)}`, { body: { sha: commitSha, force: false } });
    },
    async getContentSha(path) {
      const encoded = String(path).split('/').map(encodeURIComponent).join('/');
      const result = await request('GET', `/contents/${encoded}`, { params: { ref: GALLERY_BRANCH } });
      return result.data?.sha || '';
    },
    async deletePath(path, message) {
      const sha = await this.getContentSha(path);
      const encoded = String(path).split('/').map(encodeURIComponent).join('/');
      return request('DELETE', `/contents/${encoded}`, { body: { message, sha, branch: GALLERY_BRANCH } });
    },
  };
}
