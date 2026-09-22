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

function defaultSleep(delay) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

async function safeRequest(request, method, path, options, sleep) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await request(method, path, options);
    } catch (error) {
      lastError = error;
      if (!transientRequestError(error) || attempt === 2) throw error;
      await sleep(Math.min(10_000, Math.max(0, error?.retryAfterMs ?? (250 * (2 ** attempt)))));
    }
  }
  throw lastError;
}

export async function commitGitHubDeleteTransaction({
  owner,
  repo,
  branch = 'main',
  request,
  imagePath,
  manifest,
  sleep = defaultSleep,
}) {
  if (!owner || !repo || typeof request !== 'function') throw new Error('GitHub 删除事务配置不完整');
  if (!imagePath || !manifest?.path || typeof manifest.contentBase64 !== 'string') {
    throw new Error('图库删除事务描述不完整');
  }

  const api = `/repos/${owner}/${repo}`;
  const refPath = `${api}/git/ref/heads/${encodeURIComponent(branch)}`;
  const updateRefPath = `${api}/git/refs/heads/${encodeURIComponent(branch)}`;

  async function readBase() {
    const ref = await safeRequest(request, 'GET', refPath, {}, sleep);
    const headSha = ref?.data?.object?.sha;
    if (!headSha) throw new Error('无法获取 GitHub 分支 HEAD');
    const commit = await safeRequest(request, 'GET', `${api}/git/commits/${headSha}`, {}, sleep);
    const treeSha = commit?.data?.tree?.sha;
    if (!treeSha) throw new Error('无法获取 GitHub 基础 tree');
    const treeResult = await safeRequest(
      request,
      'GET',
      `${api}/git/trees/${treeSha}`,
      { params: { recursive: '1' } },
      sleep,
    );
    if (treeResult?.data?.truncated || !Array.isArray(treeResult?.data?.tree)) {
      throw new Error('GitHub 文件树无效，为避免误删已拒绝操作');
    }
    const tree = treeResult.data.tree;
    const imageEntry = tree.find(entry => entry?.type === 'blob' && entry.path === imagePath);
    if (!imageEntry) throw transactionError(`目标图片不存在：${imagePath}`, 'IMAGE_NOT_FOUND');
    const manifestSha = tree.find(entry => entry?.type === 'blob' && entry.path === manifest.path)?.sha || null;
    if (manifest.expectedSha != null && manifestSha !== manifest.expectedSha) {
      throw transactionError('远端感知查重索引已变化，请同步后重试', 'MANIFEST_CONFLICT');
    }
    return { headSha, treeSha, manifestSha };
  }

  async function buildEntries() {
    const blobResult = await safeRequest(
      request,
      'POST',
      `${api}/git/blobs`,
      { body: { content: manifest.contentBase64, encoding: 'base64' } },
      sleep,
    );
    const manifestBlobSha = blobResult?.data?.sha;
    if (!manifestBlobSha) throw new Error('图库索引 blob 创建失败');
    return [
      { path: imagePath, mode: '100644', type: 'blob', sha: null },
      { path: manifest.path, mode: '100644', type: 'blob', sha: manifestBlobSha },
    ];
  }

  const base = await readBase();
  const entries = await buildEntries();

  async function createCommit(currentBase) {
    const treeResult = await safeRequest(request, 'POST', `${api}/git/trees`, {
      body: { base_tree: currentBase.treeSha, tree: entries },
    }, sleep);
    const newTreeSha = treeResult?.data?.sha;
    if (!newTreeSha) throw new Error('GitHub 删除 tree 创建失败');
    const commitResult = await request('POST', `${api}/git/commits`, {
      body: {
        message: `Delete ${imagePath}`,
        tree: newTreeSha,
        parents: [currentBase.headSha],
      },
    });
    const commitSha = commitResult?.data?.sha;
    if (!commitSha) throw new Error('GitHub 删除 commit 创建失败');
    return commitSha;
  }

  async function verifyUncertainRef(commitSha) {
    try {
      const ref = await safeRequest(request, 'GET', refPath, {}, sleep);
      const currentHead = ref?.data?.object?.sha;
      if (!currentHead) return false;
      if (currentHead === commitSha) return true;
      const commit = await safeRequest(request, 'GET', `${api}/git/commits/${currentHead}`, {}, sleep);
      const treeSha = commit?.data?.tree?.sha;
      if (!treeSha) return false;
      const treeResult = await safeRequest(request, 'GET', `${api}/git/trees/${treeSha}`, { params: { recursive: '1' } }, sleep);
      if (treeResult?.data?.truncated || !Array.isArray(treeResult?.data?.tree)) return false;
      const currentEntries = new Map(treeResult.data.tree.map(entry => [entry.path, entry.sha]));
      return !currentEntries.has(imagePath)
        && currentEntries.get(manifest.path) === entries[1].sha;
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
