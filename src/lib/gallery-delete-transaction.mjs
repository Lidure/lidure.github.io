const TRANSIENT_STATUSES = new Set([0, 429, 500, 502, 503, 504]);
const REF_CONFLICT_STATUSES = new Set([409, 422]);

function transactionError(message, code) {
  return Object.assign(new Error(message), { code });
}

function transientRequestError(error) {
  return error?.retryable === true
    || error?.status == null
    || TRANSIENT_STATUSES.has(Number(error.status));
}

async function safeObjectRequest(request, method, path, options, sleep) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await request(method, path, options);
    } catch (error) {
      lastError = error;
      if (!transientRequestError(error) || attempt === 2) throw error;
      const delay = error?.retryAfterMs ?? (250 * (2 ** attempt));
      await sleep(Math.min(10_000, Math.max(0, delay)));
    }
  }
  throw lastError;
}

const defaultSleep = delay => new Promise(resolve => setTimeout(resolve, delay));

export async function commitGitHubDeleteTransaction({
  owner,
  repo,
  branch = 'main',
  request,
  imagePath,
  manifest,
  sleep = defaultSleep,
}) {
  if (!owner || !repo || typeof request !== 'function' || !imagePath) {
    throw new Error('GitHub 删除事务配置不完整');
  }
  if (!manifest?.path || typeof manifest.contentBase64 !== 'string') {
    throw new Error('感知查重索引内容缺失');
  }

  const api = `/repos/${owner}/${repo}`;
  const refPath = `${api}/git/ref/heads/${encodeURIComponent(branch)}`;
  const updateRefPath = `${api}/git/refs/heads/${encodeURIComponent(branch)}`;

  async function readBase() {
    const ref = await safeObjectRequest(request, 'GET', refPath, {}, sleep);
    const headSha = ref?.data?.object?.sha;
    if (!headSha) throw new Error('无法获取 GitHub 分支 HEAD');
    const commit = await safeObjectRequest(request, 'GET', `${api}/git/commits/${headSha}`, {}, sleep);
    const treeSha = commit?.data?.tree?.sha;
    if (!treeSha) throw new Error('无法获取 GitHub 基础 tree');
    const treeResult = await safeObjectRequest(
      request, 'GET', `${api}/git/trees/${treeSha}`, { params: { recursive: '1' } }, sleep,
    );
    if (treeResult?.data?.truncated) throw new Error('GitHub 文件树被截断，为避免误删已拒绝操作');
    const tree = treeResult?.data?.tree;
    if (!Array.isArray(tree)) throw new Error('GitHub 文件树响应无效，为避免误删已拒绝操作');
    const image = tree.find(entry => entry?.type === 'blob' && entry.path === imagePath);
    if (!image) throw transactionError(`图片已不存在：${imagePath}`, 'IMAGE_NOT_FOUND');
    const manifestSha = tree.find(entry => entry?.type === 'blob' && entry.path === manifest.path)?.sha || null;
    if (manifest.expectedSha && manifestSha !== manifest.expectedSha) {
      throw transactionError('远端感知查重索引已变化，请同步后重试', 'MANIFEST_CONFLICT');
    }
    return { headSha, treeSha, manifestSha };
  }

  const base = await readBase();
  const manifestBlob = await safeObjectRequest(
    request,
    'POST',
    `${api}/git/blobs`,
    { body: { content: manifest.contentBase64, encoding: 'base64' } },
    sleep,
  );
  const newManifestSha = manifestBlob?.data?.sha;
  if (!newManifestSha) throw new Error('感知查重索引 Blob 创建失败');

  const treeEntries = [
    { path: imagePath, mode: '100644', type: 'blob', sha: null },
    { path: manifest.path, mode: '100644', type: 'blob', sha: newManifestSha },
  ];

  async function createCommit(currentBase) {
    const treeResult = await safeObjectRequest(request, 'POST', `${api}/git/trees`, {
      body: { base_tree: currentBase.treeSha, tree: treeEntries },
    }, sleep);
    const newTreeSha = treeResult?.data?.sha;
    if (!newTreeSha) throw new Error('GitHub tree 创建失败');
    const commit = await request('POST', `${api}/git/commits`, {
      body: {
        message: `Delete ${imagePath}`,
        tree: newTreeSha,
        parents: [currentBase.headSha],
      },
    });
    const commitSha = commit?.data?.sha;
    if (!commitSha) throw new Error('GitHub commit 创建失败');
    return commitSha;
  }

  async function verifyUncertainRef(commitSha) {
    try {
      const ref = await safeObjectRequest(request, 'GET', refPath, {}, sleep);
      const currentHead = ref?.data?.object?.sha;
      if (!currentHead) return false;
      if (currentHead === commitSha) return true;
      const commit = await safeObjectRequest(request, 'GET', `${api}/git/commits/${currentHead}`, {}, sleep);
      const treeSha = commit?.data?.tree?.sha;
      if (!treeSha) return false;
      const treeResult = await safeObjectRequest(
        request, 'GET', `${api}/git/trees/${treeSha}`, { params: { recursive: '1' } }, sleep,
      );
      if (treeResult?.data?.truncated) return false;
      const entries = new Map((treeResult?.data?.tree || []).map(entry => [entry.path, entry.sha]));
      return !entries.has(imagePath) && entries.get(manifest.path) === newManifestSha;
    } catch {
      return false;
    }
  }

  async function updateRef(commitSha) {
    return request('PATCH', updateRefPath, { body: { sha: commitSha, force: false } });
  }

  let commitSha = await createCommit(base);
  try {
    await updateRef(commitSha);
  } catch (error) {
    if (REF_CONFLICT_STATUSES.has(Number(error?.status))) {
      const refreshed = await readBase();
      if (refreshed.manifestSha !== base.manifestSha) {
        throw transactionError('远端感知查重索引已变化，请同步后重试', 'MANIFEST_CONFLICT');
      }
      commitSha = await createCommit(refreshed);
      try {
        await updateRef(commitSha);
      } catch (retryError) {
        if (transientRequestError(retryError) && await verifyUncertainRef(commitSha)) return { commitSha };
        throw retryError;
      }
    } else if (transientRequestError(error) && await verifyUncertainRef(commitSha)) {
      return { commitSha };
    } else {
      throw error;
    }
  }
  return { commitSha };
}
