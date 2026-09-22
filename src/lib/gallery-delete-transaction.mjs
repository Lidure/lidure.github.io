const REF_CONFLICT_STATUSES = new Set([409, 422]);
const TRANSIENT_STATUSES = new Set([0, 429, 500, 502, 503, 504]);

function transactionError(message, code) {
  return Object.assign(new Error(message), { code });
}

function transient(error) {
  return error?.retryable === true || error?.status == null || TRANSIENT_STATUSES.has(Number(error.status));
}

async function safeRequest(request, method, path, options, sleep) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await request(method, path, options);
    } catch (error) {
      last = error;
      if (!transient(error) || attempt === 2) throw error;
      await sleep(Math.min(10_000, error?.retryAfterMs ?? (250 * (2 ** attempt))));
    }
  }
  throw last;
}

export async function commitGitHubDeleteTransaction({
  owner,
  repo,
  branch = 'main',
  request,
  imagePath,
  manifest,
  sleep = (delay) => new Promise(resolve => setTimeout(resolve, delay)),
}) {
  if (!owner || !repo || typeof request !== 'function' || !imagePath) throw new Error('删除事务配置不完整');
  if (!manifest?.path || typeof manifest.contentBase64 !== 'string') throw new Error('图库索引内容缺失');

  const api = `/repos/${owner}/${repo}`;
  const refPath = `${api}/git/ref/heads/${encodeURIComponent(branch)}`;
  const updateRefPath = `${api}/git/refs/heads/${encodeURIComponent(branch)}`;

  async function readBase() {
    const ref = await safeRequest(request, 'GET', refPath, {}, sleep);
    const headSha = ref?.data?.object?.sha;
    const commit = await safeRequest(request, 'GET', `${api}/git/commits/${headSha}`, {}, sleep);
    const treeSha = commit?.data?.tree?.sha;
    const treeResult = await safeRequest(request, 'GET', `${api}/git/trees/${treeSha}`, { params: { recursive: '1' } }, sleep);
    if (treeResult?.data?.truncated || !Array.isArray(treeResult?.data?.tree)) throw new Error('远端文件树无效，已拒绝删除');
    const tree = treeResult.data.tree;
    const image = tree.find(entry => entry?.type === 'blob' && entry.path === imagePath);
    if (!image) throw transactionError('目标图片已不存在，请同步图库', 'IMAGE_MISSING');
    const manifestSha = tree.find(entry => entry?.type === 'blob' && entry.path === manifest.path)?.sha || null;
    if (manifest.expectedSha && manifestSha !== manifest.expectedSha) {
      throw transactionError('远端感知索引已变化，请同步后重试', 'MANIFEST_CONFLICT');
    }
    return { headSha, treeSha, manifestSha };
  }

  async function buildCommit(base) {
    const blob = await safeRequest(request, 'POST', `${api}/git/blobs`, {
      body: { content: manifest.contentBase64, encoding: 'base64' },
    }, sleep);
    const manifestBlobSha = blob?.data?.sha;
    if (!manifestBlobSha) throw new Error('图库索引 Blob 创建失败');
    const entries = [
      { path: imagePath, mode: '100644', type: 'blob', sha: null },
      { path: manifest.path, mode: '100644', type: 'blob', sha: manifestBlobSha },
    ];
    const tree = await safeRequest(request, 'POST', `${api}/git/trees`, {
      body: { base_tree: base.treeSha, tree: entries },
    }, sleep);
    const newTreeSha = tree?.data?.sha;
    if (!newTreeSha) throw new Error('删除事务 tree 创建失败');
    const commit = await request('POST', `${api}/git/commits`, {
      body: { message: `Delete ${imagePath}`, tree: newTreeSha, parents: [base.headSha] },
    });
    if (!commit?.data?.sha) throw new Error('删除事务 commit 创建失败');
    return { commitSha: commit.data.sha, entries };
  }

  async function verify(commitSha) {
    try {
      const ref = await safeRequest(request, 'GET', refPath, {}, sleep);
      if (ref?.data?.object?.sha === commitSha) return true;
      const commit = await safeRequest(request, 'GET', `${api}/git/commits/${ref?.data?.object?.sha}`, {}, sleep);
      const tree = await safeRequest(request, 'GET', `${api}/git/trees/${commit?.data?.tree?.sha}`, { params: { recursive: '1' } }, sleep);
      const entries = tree?.data?.tree || [];
      const imageStillExists = entries.some(entry => entry?.type === 'blob' && entry.path === imagePath);
      const manifestEntry = entries.find(entry => entry?.type === 'blob' && entry.path === manifest.path);
      return !imageStillExists && Boolean(manifestEntry?.sha);
    } catch {
      return false;
    }
  }

  const base = await readBase();
  let built = await buildCommit(base);
  try {
    await request('PATCH', updateRefPath, { body: { sha: built.commitSha, force: false } });
    return { commitSha: built.commitSha };
  } catch (error) {
    if (REF_CONFLICT_STATUSES.has(Number(error?.status))) {
      const refreshed = await readBase();
      if (refreshed.manifestSha !== base.manifestSha) throw transactionError('远端感知索引已变化，请同步后重试', 'MANIFEST_CONFLICT');
      built = await buildCommit(refreshed);
      try {
        await request('PATCH', updateRefPath, { body: { sha: built.commitSha, force: false } });
        return { commitSha: built.commitSha };
      } catch (retryError) {
        if (transient(retryError) && await verify(built.commitSha)) return { commitSha: built.commitSha };
        throw retryError;
      }
    }
    if (transient(error) && await verify(built.commitSha)) return { commitSha: built.commitSha };
    throw error;
  }
}
