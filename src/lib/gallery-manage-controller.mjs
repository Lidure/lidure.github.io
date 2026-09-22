import { loadGalleryManifest } from './gallery-manifest-client.mjs';
import { galleryProxyUrl } from './gallery-data.mjs';
import { createGalleryGitHubClient } from './gallery-github-client.mjs';
import {
  buildManagedCategories,
  normalizeRemoteTree,
  pageManagedItems,
  publicCategoriesToManagedItems,
} from './gallery-manage-model.mjs';
import {
  createUploadItem,
  markUploadFailure,
  transitionUploadItem,
} from './gallery-upload-queue.mjs';
import { createGalleryManageDialog } from './gallery-manage-dialog-controller.mjs';
import { prepareGalleryFile } from './gallery-image-hash.mjs';
import {
  GALLERY_INDEX_PATH,
  addIndexEntries,
  parseGalleryIndex,
  planUploadPaths,
  removeIndexEntry,
  serializeGalleryIndex,
} from './gallery-index-transaction.mjs';
import {
  GITHUB_MAX_BLOB_BYTES,
  commitGitHubUploadTransaction,
  exactRemoteMatch,
  similarRemoteMatches,
} from './gallery-upload-transaction.mjs';
import { commitGitHubDeleteTransaction } from './gallery-delete-transaction.mjs';
import { LARGE_UPLOAD_MAX_BYTES, uploadLargeGalleryBlob } from './gallery-large-upload-client.mjs';

const PAGE_SIZE = 24;
const LARGE_UPLOAD_THRESHOLD = 4 * 1024 * 1024;

export function createSyncGenerationGate() {
  let generation = 0;
  return {
    next() { return ++generation; },
    isCurrent(value) { return value === generation; },
  };
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToUtf8(value) {
  const binary = atob(String(value || '').replace(/\s+/g, ''));
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
}

async function fileToBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function stateLabel(item) {
  const labels = {
    waiting: '等待上传',
    checking: '正在查重',
    confirming: '等待确认',
    uploading: '正在上传',
    committing: '正在提交',
    success: '上传成功',
    failed: item?.error?.message || '上传失败',
  };
  return labels[item?.state] || item?.state || '';
}

function formatError(error) {
  const code = error?.code;
  if (code === 'auth') return 'GitHub Token 无效或已过期，请重新连接。';
  if (code === 'permission') return '当前 Token 没有图库写入权限。';
  if (code === 'rate-limit') return 'GitHub API 请求频率已达上限，请稍后再试。';
  if (code === 'conflict' || code === 'MANIFEST_CONFLICT' || code === 'GLOBAL_NUMBER_CONFLICT') {
    return '远端图库刚刚发生变化，请同步后重试。';
  }
  return String(error?.message || '操作失败，请重试。');
}

export function initGalleryManageController(root) {
  if (!root) return () => {};
  const doc = root.ownerDocument || document;
  const win = doc.defaultView || window;
  const dialogRoot = doc.getElementById('gallery-manage-dialog');
  if (!dialogRoot) return () => {};
  const dialog = createGalleryManageDialog(dialogRoot);

  const statusEl = root.querySelector('#gallery-manage-status');
  const connectButton = root.querySelector('#gallery-manage-connect');
  const disconnectButton = root.querySelector('#gallery-manage-disconnect');
  const syncButton = root.querySelector('#gallery-manage-sync');
  const categorySelect = root.querySelector('#gallery-manage-category');
  const newCategoryInput = root.querySelector('#gallery-manage-new-category');
  const dropzone = root.querySelector('#gallery-manage-dropzone');
  const fileInput = root.querySelector('#gallery-manage-file-input');
  const uploadButton = root.querySelector('#gallery-manage-upload');
  const queueEl = root.querySelector('#gallery-manage-queue');
  const categoriesEl = root.querySelector('#gallery-manage-categories');
  const gridEl = root.querySelector('#gallery-manage-grid');
  const pagerEl = root.querySelector('#gallery-manage-pager');
  const countEl = root.querySelector('#gallery-manage-count');

  if (!statusEl || !connectButton || !disconnectButton || !syncButton || !categorySelect
    || !newCategoryInput || !dropzone || !fileInput || !uploadButton || !queueEl
    || !categoriesEl || !gridEl || !pagerEl || !countEl) return () => {};

  let token = '';
  let client = null;
  let connected = false;
  let disposed = false;
  let items = [];
  let currentCategory = '';
  let currentPage = 1;
  let queue = [];
  let activeAbort = null;
  const syncGate = createSyncGenerationGate();

  function setStatus(state, title, detail = '') {
    statusEl.dataset.state = state;
    statusEl.replaceChildren();
    const dot = doc.createElement('span');
    dot.className = 'gallery-manage-status-dot';
    dot.setAttribute('aria-hidden', 'true');
    const strong = doc.createElement('strong');
    strong.textContent = title;
    const text = doc.createElement('span');
    text.textContent = detail;
    statusEl.append(dot, strong, text);
  }

  function renderConnection() {
    connectButton.hidden = connected;
    disconnectButton.hidden = !connected;
  }

  function renderCategorySelect(categories) {
    const previous = categorySelect.value;
    categorySelect.replaceChildren();
    const placeholder = doc.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '选择分类…';
    categorySelect.append(placeholder);
    for (const category of categories) {
      const option = doc.createElement('option');
      option.value = category.name;
      option.textContent = `${category.name} (${category.count})`;
      categorySelect.append(option);
    }
    if ([...categorySelect.options].some(option => option.value === previous)) categorySelect.value = previous;
  }

  function renderCategories() {
    const categories = buildManagedCategories(items);
    renderCategorySelect(categories);
    categoriesEl.replaceChildren();
    const all = doc.createElement('button');
    all.type = 'button';
    all.textContent = `全部 ${items.length}`;
    all.classList.toggle('is-active', !currentCategory);
    all.addEventListener('click', () => {
      currentCategory = '';
      currentPage = 1;
      renderLibrary();
    });
    categoriesEl.append(all);
    for (const category of categories) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = `${category.name} ${category.count}`;
      button.classList.toggle('is-active', currentCategory === category.name);
      button.addEventListener('click', () => {
        currentCategory = category.name;
        currentPage = 1;
        renderLibrary();
      });
      categoriesEl.append(button);
    }
  }

  function renderPager(page) {
    pagerEl.replaceChildren();
    if (page.totalPages <= 1) return;
    const previous = doc.createElement('button');
    previous.type = 'button';
    previous.textContent = '‹';
    previous.disabled = page.page <= 1;
    previous.setAttribute('aria-label', '上一页');
    const label = doc.createElement('span');
    label.textContent = `${page.page} / ${page.totalPages}`;
    const next = doc.createElement('button');
    next.type = 'button';
    next.textContent = '›';
    next.disabled = page.page >= page.totalPages;
    next.setAttribute('aria-label', '下一页');
    previous.addEventListener('click', () => { currentPage--; renderLibrary(); });
    next.addEventListener('click', () => { currentPage++; renderLibrary(); });
    pagerEl.append(previous, label, next);
  }

  function renderGrid(page) {
    gridEl.replaceChildren();
    if (!page.items.length) {
      const empty = doc.createElement('div');
      empty.className = 'gallery-manage-empty';
      empty.textContent = '这个分类暂时没有图片。';
      gridEl.append(empty);
      return;
    }
    for (const item of page.items) {
      const card = doc.createElement('article');
      card.className = 'gallery-manage-image-card';
      card.dataset.path = item.path;
      const img = doc.createElement('img');
      img.src = item.imageUrl || galleryProxyUrl(item.path);
      img.alt = item.filename;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.addEventListener('error', () => {
        img.alt = `${item.filename} 加载失败`;
        card.classList.add('is-error');
      }, { once: true });
      const actions = doc.createElement('div');
      actions.className = 'gallery-manage-image-actions';
      const preview = doc.createElement('button');
      preview.type = 'button';
      preview.className = 'gallery-manage-image-action';
      preview.textContent = '预览';
      preview.addEventListener('click', () => dialog.previewImage(item, preview));
      actions.append(preview);
      if (connected) {
        const del = doc.createElement('button');
        del.type = 'button';
        del.className = 'gallery-manage-image-action is-delete';
        del.textContent = '删除';
        del.addEventListener('click', () => requestDelete(item, del));
        actions.append(del);
      }
      card.append(img, actions);
      gridEl.append(card);
    }
  }

  function renderLibrary() {
    const page = pageManagedItems(items, currentCategory, currentPage, PAGE_SIZE);
    currentPage = page.page;
    countEl.textContent = currentCategory
      ? `${currentCategory} · ${page.totalItems} 张`
      : `共 ${items.length} 张图片 · ${buildManagedCategories(items).length} 个分类`;
    renderCategories();
    renderGrid(page);
    renderPager(page);
  }

  function updateQueueItem(id, updater) {
    queue = queue.map(item => item.id === id ? updater(item) : item);
  }

  function revokeQueueItem(item) {
    if (item?.previewUrl?.startsWith('blob:')) {
      try { URL.revokeObjectURL(item.previewUrl); } catch {}
    }
  }

  function renderQueue() {
    queueEl.replaceChildren();
    if (!queue.length) {
      const empty = doc.createElement('div');
      empty.className = 'gallery-manage-empty-small';
      empty.textContent = '还没有待上传图片';
      queueEl.append(empty);
      uploadButton.disabled = true;
      return;
    }
    for (const item of queue) {
      const row = doc.createElement('article');
      row.className = 'gallery-manage-queue-item';
      const img = doc.createElement('img');
      img.className = 'gallery-manage-queue-thumb';
      img.src = item.previewUrl || '';
      img.alt = item.file?.name || '待上传图片';
      const copy = doc.createElement('div');
      copy.className = 'gallery-manage-queue-copy';
      const name = doc.createElement('strong');
      name.className = 'gallery-manage-queue-name';
      name.textContent = item.file?.name || '图片';
      const status = doc.createElement('span');
      status.className = `gallery-manage-queue-state${item.state === 'failed' ? ' is-error' : ''}`;
      status.textContent = stateLabel(item);
      copy.append(name, status);
      const action = doc.createElement('button');
      action.type = 'button';
      action.className = 'gallery-manage-button is-quiet';
      if (item.state === 'failed' && item.error?.retryable) {
        action.textContent = '重试';
        action.addEventListener('click', () => {
          updateQueueItem(item.id, current => transitionUploadItem(current, 'waiting'));
          renderQueue();
        });
      } else if (item.state === 'waiting') {
        action.textContent = '移除';
        action.addEventListener('click', () => {
          revokeQueueItem(item);
          queue = queue.filter(current => current.id !== item.id);
          renderQueue();
        });
      } else {
        action.textContent = '—';
        action.disabled = true;
      }
      row.append(img, copy, action);
      queueEl.append(row);
    }
    uploadButton.disabled = !queue.some(item => item.state === 'waiting') || !connected;
  }

  async function syncPublic(forceRefresh = false) {
    const generation = syncGate.next();
    activeAbort?.abort();
    activeAbort = new AbortController();
    setStatus('busy', '正在同步', '从公开索引读取图库…');
    try {
      const result = await loadGalleryManifest({ forceRefresh, signal: activeAbort.signal });
      if (disposed || !syncGate.isCurrent(generation)) return;
      items = publicCategoriesToManagedItems(result.categories);
      renderLibrary();
      setStatus('readonly', '只读模式', result.stale ? '正在使用最近一次缓存；写操作需要连接 GitHub。' : '可浏览图库；上传和删除需要临时连接 GitHub。');
    } catch (error) {
      if (error?.name === 'AbortError' || disposed || !syncGate.isCurrent(generation)) return;
      setStatus('error', '同步失败', formatError(error));
    }
  }

  async function readRemoteSnapshot() {
    if (!client) throw Object.assign(new Error('请先连接 GitHub'), { code: 'auth' });
    const ref = await client.request('GET', '/git/ref/heads/main');
    const headSha = ref.data?.object?.sha;
    if (!headSha) throw new Error('无法读取 main 分支 HEAD');
    const commit = await client.request('GET', `/git/commits/${headSha}`);
    const treeSha = commit.data?.tree?.sha;
    if (!treeSha) throw new Error('无法读取 GitHub tree');
    const treeResponse = await client.request('GET', `/git/trees/${treeSha}`, { params: { recursive: '1' } });
    if (treeResponse.data?.truncated || !Array.isArray(treeResponse.data?.tree)) {
      throw new Error('GitHub 文件树不完整，为避免误操作已停止同步');
    }
    const manifestEntry = treeResponse.data.tree.find(entry => entry?.type === 'blob' && entry.path === GALLERY_INDEX_PATH);
    const contents = await client.request('GET', `/contents/${GALLERY_INDEX_PATH}`, { params: { ref: 'main' } });
    const payload = JSON.parse(base64ToUtf8(contents.data?.content || ''));
    return {
      headSha,
      tree: treeResponse.data.tree,
      manifestSha: manifestEntry?.sha || contents.data?.sha || null,
      index: parseGalleryIndex(payload),
      managedItems: normalizeRemoteTree(treeResponse.data.tree),
    };
  }

  async function syncAuthenticated() {
    const generation = syncGate.next();
    setStatus('busy', '正在同步', '正在读取 GitHub 最新文件树…');
    try {
      const snapshot = await readRemoteSnapshot();
      if (disposed || !syncGate.isCurrent(generation)) return null;
      items = snapshot.managedItems;
      renderLibrary();
      setStatus('connected', '已连接 GitHub', '远端状态已同步，上传与删除已启用。');
      return snapshot;
    } catch (error) {
      if (disposed || !syncGate.isCurrent(generation)) return null;
      setStatus('error', 'GitHub 同步失败', formatError(error));
      throw error;
    }
  }

  async function onConnect() {
    const enteredToken = await dialog.requestToken(connectButton);
    if (!enteredToken || disposed) return;
    setStatus('busy', '正在连接', '正在验证固定图库的写入权限…');
    try {
      const candidate = createGalleryGitHubClient({ token: enteredToken });
      await candidate.validateWriteAccess();
      token = enteredToken;
      client = candidate;
      connected = true;
      renderConnection();
      renderQueue();
      await syncAuthenticated();
    } catch (error) {
      token = '';
      client = null;
      connected = false;
      renderConnection();
      renderQueue();
      setStatus('error', '连接失败', formatError(error));
    }
  }

  async function onDisconnect() {
    token = '';
    client = null;
    connected = false;
    renderConnection();
    renderQueue();
    await syncPublic(true);
  }

  function selectedCategory() {
    return String(newCategoryInput.value || '').trim() || String(categorySelect.value || '').trim();
  }

  async function addFiles(fileList) {
    const category = selectedCategory();
    if (!category) {
      setStatus('error', '请选择分类', '请选择已有分类，或先输入一个新分类名称。');
      return;
    }
    if (category === '.' || category === '..' || category.includes('/') || category.includes('\\')) {
      setStatus('error', '分类名称无效', '分类名称不能包含斜杠或路径片段。');
      return;
    }
    for (const file of [...(fileList || [])]) {
      if (!String(file.type || '').startsWith('image/')) continue;
      if (file.size > GITHUB_MAX_BLOB_BYTES) {
        setStatus('error', '文件过大', `${file.name || '图片'} 超过 GitHub 单文件 100 MiB 限制。`);
        continue;
      }
      const item = createUploadItem(file, category);
      item.previewUrl = URL.createObjectURL(file);
      queue.push(item);
    }
    renderQueue();
  }

  async function prepareItem(item, snapshot) {
    updateQueueItem(item.id, current => transitionUploadItem(current, 'checking'));
    renderQueue();
    const prepared = await prepareGalleryFile(item.file);
    updateQueueItem(item.id, current => ({ ...current, ...prepared }));
    const exact = exactRemoteMatch(snapshot.tree, prepared.blobSha, item.category);
    if (exact) {
      await dialog.confirmSimilarity({
        candidate: { file: item.file, previewUrl: item.previewUrl },
        matches: [{
          path: exact.path,
          imageUrl: galleryProxyUrl(exact.path),
          meta: `完全重复 · ${exact.path}`,
        }],
      }, uploadButton);
      updateQueueItem(item.id, current => markUploadFailure(current, {
        code: 'EXACT_DUPLICATE', message: `完全重复：${exact.path}`, retryable: false,
      }));
      renderQueue();
      return null;
    }
    const similar = similarRemoteMatches(snapshot.index, prepared.perceptualHash, item.category);
    if (similar.length) {
      updateQueueItem(item.id, current => transitionUploadItem(current, 'confirming'));
      renderQueue();
      const proceed = await dialog.confirmSimilarity({
        candidate: { file: item.file, previewUrl: item.previewUrl },
        matches: similar.map(match => ({
          ...match,
          imageUrl: galleryProxyUrl(match.path),
          meta: `#${match.number || '?'} · 相似度 ${(match.similarity * 100).toFixed(1)}%`,
        })),
      }, uploadButton);
      if (!proceed) {
        updateQueueItem(item.id, current => markUploadFailure(current, {
          code: 'SIMILAR_SKIPPED', message: '已跳过相似图片', retryable: true,
        }));
        renderQueue();
        return null;
      }
    }
    return { ...item, ...prepared };
  }

  async function uploadCategory(category, candidates) {
    let snapshot = await readRemoteSnapshot();
    items = snapshot.managedItems;
    const approved = [];
    for (const candidate of candidates) {
      try {
        const prepared = await prepareItem(candidate, snapshot);
        if (prepared) approved.push(prepared);
      } catch (error) {
        updateQueueItem(candidate.id, current => markUploadFailure(current, {
          code: error?.code || 'prepare', message: formatError(error), retryable: error?.code !== 'IMAGE_DECODE_FAILED',
        }));
        renderQueue();
      }
    }
    if (!approved.length) return;

    const plans = planUploadPaths(snapshot.tree, category, approved.map(item => item.file));
    const planned = plans.map((plan, index) => ({ ...plan, item: approved[index], perceptualHash: approved[index].perceptualHash }));
    const nextIndex = addIndexEntries(snapshot.index, planned);
    const manifestContentBase64 = utf8ToBase64(serializeGalleryIndex(nextIndex));

    for (const plan of planned) {
      updateQueueItem(plan.item.id, current => transitionUploadItem(current, 'uploading', {
        blobSha: plan.item.blobSha,
        perceptualHash: plan.item.perceptualHash,
      }));
    }
    renderQueue();

    try {
      const transaction = await commitGitHubUploadTransaction({
        owner: 'Lidure',
        repo: 'airi-gallery-images',
        branch: 'main',
        request: (method, path, options = {}) => client.request(method, path, options),
        items: planned.map(plan => ({
          path: plan.path,
          size: plan.item.file.size,
          expectedBlobSha: plan.item.blobSha,
          loadContentBase64: () => fileToBase64(plan.item.file),
          createBlob: plan.item.file.size >= LARGE_UPLOAD_THRESHOLD && plan.item.file.size <= LARGE_UPLOAD_MAX_BYTES
            ? async () => {
              const sha = await uploadLargeGalleryBlob(plan.item.file, { token });
              if (sha !== plan.item.blobSha) {
                throw Object.assign(new Error(`大图片完整性校验失败：${plan.path}`), { code: 'BLOB_INTEGRITY' });
              }
              return sha;
            }
            : undefined,
        })),
        manifest: { path: GALLERY_INDEX_PATH, contentBase64: manifestContentBase64 },
        onProgress: (completed, total) => {
          if (completed < total) return;
          for (const plan of planned) {
            updateQueueItem(plan.item.id, current => current.state === 'uploading'
              ? transitionUploadItem(current, 'committing') : current);
          }
          renderQueue();
        },
      });
      if (!transaction?.commitSha) throw new Error('GitHub 提交未返回 commit SHA');
      const verified = await syncAuthenticated();
      const remotePaths = new Set((verified?.managedItems || items).map(item => item.path));
      for (const plan of planned) {
        if (!remotePaths.has(plan.path)) throw Object.assign(new Error(`远端未确认：${plan.path}`), { code: 'VERIFY_FAILED' });
        updateQueueItem(plan.item.id, current => transitionUploadItem(current, 'success', { remotePath: plan.path }));
      }
      renderQueue();
    } catch (error) {
      for (const plan of planned) {
        updateQueueItem(plan.item.id, current => current.state === 'success' ? current : markUploadFailure(current, {
          code: error?.code || 'upload', message: formatError(error), retryable: error?.retryable !== false,
        }));
      }
      renderQueue();
      setStatus('error', '上传失败', formatError(error));
    }
  }

  async function onUpload() {
    if (!connected || !client || !token) {
      await onConnect();
      if (!connected) return;
    }
    uploadButton.disabled = true;
    const waiting = queue.filter(item => item.state === 'waiting');
    const groups = new Map();
    for (const item of waiting) {
      if (!groups.has(item.category)) groups.set(item.category, []);
      groups.get(item.category).push(item);
    }
    for (const [category, candidates] of groups) {
      if (disposed) break;
      await uploadCategory(category, candidates);
    }
    renderQueue();
  }

  async function requestDelete(item, invoker) {
    if (!connected || !client) return;
    const confirmed = await dialog.confirmDelete(item, invoker);
    if (!confirmed || disposed) return;
    setStatus('busy', '正在删除', `${item.category} / ${item.filename}`);
    try {
      const snapshot = await readRemoteSnapshot();
      if (!snapshot.managedItems.some(remote => remote.path === item.path)) {
        await syncAuthenticated();
        return;
      }
      const nextIndex = removeIndexEntry(snapshot.index, item.path);
      await commitGitHubDeleteTransaction({
        owner: 'Lidure', repo: 'airi-gallery-images', branch: 'main',
        request: (method, path, options = {}) => client.request(method, path, options),
        imagePath: item.path,
        manifest: {
          path: GALLERY_INDEX_PATH,
          contentBase64: utf8ToBase64(serializeGalleryIndex(nextIndex)),
          expectedSha: snapshot.manifestSha,
        },
      });
      const verified = await syncAuthenticated();
      if ((verified?.managedItems || items).some(remote => remote.path === item.path)) {
        throw Object.assign(new Error('删除提交后远端仍存在该图片，请同步后重试'), { code: 'VERIFY_FAILED' });
      }
      setStatus('connected', '删除完成', `${item.filename} 已从远端图库移除。`);
    } catch (error) {
      setStatus('error', '删除失败', formatError(error));
    }
  }

  function onDropzoneClick() { fileInput.click(); }
  function onDragOver(event) { event.preventDefault(); dropzone.classList.add('is-dragover'); }
  function onDragLeave() { dropzone.classList.remove('is-dragover'); }
  function onDrop(event) {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    addFiles(event.dataTransfer?.files || []);
  }
  function onFilesChanged() {
    const files = [...(fileInput.files || [])];
    fileInput.value = '';
    addFiles(files);
  }
  function onSync() { return connected ? syncAuthenticated() : syncPublic(true); }

  connectButton.addEventListener('click', onConnect);
  disconnectButton.addEventListener('click', onDisconnect);
  syncButton.addEventListener('click', onSync);
  uploadButton.addEventListener('click', onUpload);
  dropzone.addEventListener('click', onDropzoneClick);
  dropzone.addEventListener('dragover', onDragOver);
  dropzone.addEventListener('dragleave', onDragLeave);
  dropzone.addEventListener('drop', onDrop);
  fileInput.addEventListener('change', onFilesChanged);

  renderConnection();
  renderQueue();
  syncPublic(false);

  return function cleanupGalleryManageController() {
    if (disposed) return;
    disposed = true;
    token = '';
    client = null;
    connected = false;
    activeAbort?.abort();
    for (const item of queue) revokeQueueItem(item);
    queue = [];
    connectButton.removeEventListener('click', onConnect);
    disconnectButton.removeEventListener('click', onDisconnect);
    syncButton.removeEventListener('click', onSync);
    uploadButton.removeEventListener('click', onUpload);
    dropzone.removeEventListener('click', onDropzoneClick);
    dropzone.removeEventListener('dragover', onDragOver);
    dropzone.removeEventListener('dragleave', onDragLeave);
    dropzone.removeEventListener('drop', onDrop);
    fileInput.removeEventListener('change', onFilesChanged);
    dialog.destroy();
  };
}
