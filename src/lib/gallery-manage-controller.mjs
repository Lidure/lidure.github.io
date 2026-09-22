import { loadGalleryManifest } from './gallery-manifest-client.mjs';
import { galleryProxyUrl, paginate } from './gallery-data.mjs';
import {
  GALLERY_BRANCH,
  GALLERY_INDEX_PATH,
  GALLERY_REPOSITORY,
  isSafeManagedCategory,
  isSafeManagedImagePath,
} from './gallery-manage-config.mjs';
import { createGalleryGitHubClient } from './gallery-github-client.mjs';
import { prepareGalleryFile } from './gallery-image-hash.mjs';
import {
  addIndexEntries,
  parseGalleryIndex,
  planUploadPaths,
  removeIndexEntry,
  serializeGalleryIndex,
} from './gallery-index-transaction.mjs';
import {
  CLOUD_PROXY_BLOB_THRESHOLD_BYTES,
  CLOUD_PROXY_MAX_RAW_BYTES,
  createLargeUploadClient,
} from './gallery-large-upload-client.mjs';
import {
  GITHUB_MAX_BLOB_BYTES,
  commitGitHubUploadTransaction,
  exactRemoteMatch,
  similarRemoteMatches,
} from './gallery-upload-transaction.mjs';
import { commitGitHubDeleteTransaction } from './gallery-delete-transaction.mjs';

const PAGE_SIZE = 24;
const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

export function createTokenSession() {
  let token = '';
  return {
    get() { return token; },
    set(nextToken) { token = String(nextToken || '').trim(); },
    clear() { token = ''; },
  };
}

function encodeBytesBase64(bytes) {
  let output = '';
  const block = 24 * 1024;
  for (let offset = 0; offset < bytes.length; offset += block) {
    const part = bytes.subarray(offset, Math.min(bytes.length, offset + block));
    let binary = '';
    for (let i = 0; i < part.length; i++) binary += String.fromCharCode(part[i]);
    output += btoa(binary);
  }
  return output;
}

async function fileToBase64(file) {
  return encodeBytesBase64(new Uint8Array(await file.arrayBuffer()));
}

function utf8ToBase64(text) {
  return encodeBytesBase64(new TextEncoder().encode(text));
}

function base64ToUtf8(value) {
  const clean = String(value || '').replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function normalizeRemoteTree(tree) {
  const grouped = new Map();
  for (const entry of tree || []) {
    if (entry?.type !== 'blob' || !isSafeManagedImagePath(entry.path)) continue;
    const [root, category, filename] = entry.path.split('/');
    if (root !== 'gallery') continue;
    if (!grouped.has(category)) grouped.set(category, []);
    grouped.get(category).push({
      path: entry.path,
      category,
      filename,
      sha: entry.sha || '',
      size: Number(entry.size || 0),
    });
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => collator.compare(left, right))
    .map(([category, images]) => ({
      category,
      images: images.sort((left, right) => collator.compare(left.filename, right.filename)),
    }));
}

function flatImages(categories) {
  return (categories || []).flatMap(category => category.images || []);
}

function formatSize(bytes) {
  const value = Number(bytes || 0);
  if (!value) return '';
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KiB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

export function initGalleryManage(root, {
  manifestLoader = loadGalleryManifest,
  tokenSession = createTokenSession(),
  githubClientFactory = createGalleryGitHubClient,
  largeUploadClient = createLargeUploadClient(),
} = {}) {
  if (!root) return () => {};
  const doc = root.ownerDocument || document;
  const win = doc.defaultView || window;
  const status = root.querySelector('#gallery-manage-status');
  const count = root.querySelector('#gallery-manage-count');
  const connectButton = root.querySelector('#gallery-manage-connect');
  const syncButton = root.querySelector('#gallery-manage-sync');
  const categoryNav = root.querySelector('#gallery-manage-categories');
  const grid = root.querySelector('#gallery-manage-grid');
  const pager = root.querySelector('#gallery-manage-pager');
  const categorySelect = root.querySelector('#gallery-manage-category-select');
  const categoryNew = root.querySelector('#gallery-manage-category-new');
  const dropzone = root.querySelector('#gallery-manage-dropzone');
  const fileInput = root.querySelector('#gallery-manage-file-input');
  const uploadQueue = root.querySelector('#gallery-manage-upload-queue');
  const uploadStart = root.querySelector('#gallery-manage-upload-start');
  const writeChip = root.querySelector('#gallery-manage-write-chip');
  const dialog = root.querySelector('#gallery-manage-dialog');
  const dialogCard = dialog?.querySelector('.gallery-manage-dialog-card');
  const dialogTitle = root.querySelector('#gallery-manage-dialog-title');
  const dialogBody = root.querySelector('#gallery-manage-dialog-body');

  if (!status || !count || !connectButton || !syncButton || !categoryNav || !grid || !pager
    || !categorySelect || !categoryNew || !dropzone || !fileInput || !uploadQueue || !uploadStart
    || !writeChip || !dialog || !dialogCard || !dialogTitle || !dialogBody) return () => {};

  const state = {
    categories: [],
    selectedCategory: '',
    page: 1,
    connected: false,
    client: null,
    remoteTree: [],
    galleryIndex: {},
    manifestSha: null,
    queue: [],
    busy: false,
    syncGeneration: 0,
    dialogResolve: null,
    dialogInvoker: null,
  };
  let disposed = false;
  const abortController = new AbortController();
  const cleanups = [];

  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  function setStatus(text, kind = '') {
    status.textContent = text;
    root.dataset.status = kind;
  }

  function setBusy(value) {
    state.busy = Boolean(value);
    syncButton.disabled = state.busy;
    connectButton.disabled = state.busy;
    updateWriteControls();
  }

  function updateWriteControls() {
    const writable = state.connected && !state.busy;
    categorySelect.disabled = !writable;
    categoryNew.disabled = !writable;
    dropzone.disabled = !writable;
    uploadStart.disabled = !writable || !state.queue.some(item => item.status === '等待' || item.status === '失败');
    writeChip.textContent = state.connected ? '已连接 · 可写入' : '连接后可用';
    connectButton.textContent = state.connected ? '断开 GitHub' : '连接 GitHub';
  }

  function updateCounts() {
    const total = flatImages(state.categories).length;
    count.textContent = `${state.categories.length} 个分类 · ${total} 张图片`;
  }

  function currentImages() {
    if (!state.selectedCategory) return flatImages(state.categories);
    return state.categories.find(item => item.category === state.selectedCategory)?.images || [];
  }

  function renderCategorySelect() {
    const current = categorySelect.value;
    categorySelect.replaceChildren();
    const placeholder = doc.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '选择已有分类';
    categorySelect.append(placeholder);
    for (const category of state.categories) {
      const option = doc.createElement('option');
      option.value = category.category;
      option.textContent = `${category.category} (${category.images.length})`;
      categorySelect.append(option);
    }
    if ([...categorySelect.options].some(option => option.value === current)) categorySelect.value = current;
  }

  function renderCategories() {
    categoryNav.replaceChildren();
    const choices = [
      { category: '', label: '全部', count: flatImages(state.categories).length },
      ...state.categories.map(item => ({ category: item.category, label: item.category, count: item.images.length })),
    ];
    for (const choice of choices) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'gallery-manage-category';
      button.classList.toggle('is-active', state.selectedCategory === choice.category);
      button.setAttribute('aria-pressed', state.selectedCategory === choice.category ? 'true' : 'false');
      const label = doc.createElement('span');
      label.textContent = choice.label;
      const badge = doc.createElement('small');
      badge.textContent = String(choice.count);
      button.append(label, badge);
      button.addEventListener('click', () => {
        state.selectedCategory = choice.category;
        state.page = 1;
        renderAll();
      });
      categoryNav.append(button);
    }
  }

  function openPreview(image, invoker) {
    state.dialogInvoker = invoker || null;
    dialogTitle.textContent = image.filename;
    dialogBody.replaceChildren();
    const wrap = doc.createElement('div');
    wrap.className = 'gallery-manage-preview';
    const img = doc.createElement('img');
    img.src = galleryProxyUrl(image.path);
    img.alt = image.filename;
    const meta = doc.createElement('p');
    meta.textContent = `${image.category} · ${image.filename}`;
    wrap.append(img, meta);
    dialogBody.append(wrap);
    showDialog();
  }

  function createImageCard(image) {
    const card = doc.createElement('article');
    card.className = 'gallery-manage-card';
    card.dataset.galleryPath = image.path;

    const thumb = doc.createElement('button');
    thumb.type = 'button';
    thumb.className = 'gallery-manage-thumb';
    thumb.setAttribute('aria-label', `预览 ${image.filename}`);
    const img = doc.createElement('img');
    img.src = galleryProxyUrl(image.path);
    img.alt = image.filename;
    img.loading = 'lazy';
    img.decoding = 'async';
    const failed = doc.createElement('span');
    failed.className = 'gallery-manage-thumb-error';
    failed.textContent = '加载失败 · 点击重试';
    failed.hidden = true;
    img.addEventListener('error', () => {
      img.hidden = true;
      failed.hidden = false;
    });
    thumb.addEventListener('click', () => {
      if (img.hidden) {
        failed.hidden = true;
        img.hidden = false;
        img.src = `${galleryProxyUrl(image.path)}?retry=${Date.now()}`;
        return;
      }
      openPreview(image, thumb);
    });
    thumb.append(img, failed);

    const footer = doc.createElement('footer');
    const text = doc.createElement('div');
    const name = doc.createElement('strong');
    name.textContent = image.filename;
    const meta = doc.createElement('span');
    meta.textContent = [image.category, formatSize(image.size)].filter(Boolean).join(' · ');
    text.append(name, meta);
    const actions = doc.createElement('div');
    actions.className = 'gallery-manage-card-actions';
    const preview = doc.createElement('button');
    preview.type = 'button';
    preview.textContent = '预览';
    preview.addEventListener('click', () => openPreview(image, preview));
    actions.append(preview);
    if (state.connected) {
      const remove = doc.createElement('button');
      remove.type = 'button';
      remove.className = 'is-danger';
      remove.textContent = '删除';
      remove.addEventListener('click', () => requestDelete(image, remove));
      actions.append(remove);
    }
    footer.append(text, actions);
    card.append(thumb, footer);
    return card;
  }

  function renderGrid() {
    grid.replaceChildren();
    const page = paginate(currentImages(), state.page, PAGE_SIZE);
    state.page = page.page;
    if (!page.items.length) {
      const empty = doc.createElement('div');
      empty.className = 'gallery-manage-empty';
      empty.textContent = '这个分类暂时没有图片。';
      grid.append(empty);
    } else {
      for (const image of page.items) grid.append(createImageCard(image));
    }
    pager.replaceChildren();
    if (page.totalPages > 1) {
      const previous = doc.createElement('button');
      previous.type = 'button';
      previous.textContent = '← 上一页';
      previous.disabled = page.page <= 1;
      const label = doc.createElement('span');
      label.textContent = `${page.page} / ${page.totalPages}`;
      const next = doc.createElement('button');
      next.type = 'button';
      next.textContent = '下一页 →';
      next.disabled = page.page >= page.totalPages;
      previous.addEventListener('click', () => { state.page -= 1; renderGrid(); });
      next.addEventListener('click', () => { state.page += 1; renderGrid(); });
      pager.append(previous, label, next);
    }
  }

  function renderAll() {
    if (state.selectedCategory && !state.categories.some(item => item.category === state.selectedCategory)) {
      state.selectedCategory = '';
      state.page = 1;
    }
    updateCounts();
    renderCategorySelect();
    renderCategories();
    renderGrid();
    updateWriteControls();
  }

  function renderQueue() {
    uploadQueue.replaceChildren();
    for (const item of state.queue) {
      const row = doc.createElement('article');
      row.className = 'gallery-manage-queue-item';
      const image = doc.createElement('img');
      if (item.previewUrl) image.src = item.previewUrl;
      image.alt = '';
      const copy = doc.createElement('div');
      const name = doc.createElement('strong');
      name.textContent = item.file?.name || '图片';
      const detail = doc.createElement('span');
      detail.textContent = `${item.status}${item.error ? ` · ${item.error}` : ''}`;
      copy.append(name, detail);
      const remove = doc.createElement('button');
      remove.type = 'button';
      remove.textContent = '移除';
      remove.disabled = state.busy || item.status === '上传';
      remove.addEventListener('click', () => {
        try { URL.revokeObjectURL(item.previewUrl); } catch {}
        state.queue = state.queue.filter(candidate => candidate !== item);
        renderQueue();
        updateWriteControls();
      });
      row.append(image, copy, remove);
      uploadQueue.append(row);
    }
    updateWriteControls();
  }

  function showDialog() {
    dialog.hidden = false;
    doc.documentElement.classList.add('gallery-manage-dialog-open');
    queueMicrotask(() => dialogCard.focus());
  }

  function closeDialog(value = null) {
    if (dialog.hidden) return;
    dialog.hidden = true;
    doc.documentElement.classList.remove('gallery-manage-dialog-open');
    dialogBody.replaceChildren();
    const resolve = state.dialogResolve;
    const invoker = state.dialogInvoker;
    state.dialogResolve = null;
    state.dialogInvoker = null;
    if (resolve) resolve(value);
    queueMicrotask(() => invoker?.focus?.());
  }

  function dialogPromise(title, builder, invoker = null) {
    if (state.dialogResolve) closeDialog(null);
    state.dialogInvoker = invoker;
    dialogTitle.textContent = title;
    dialogBody.replaceChildren();
    return new Promise(resolve => {
      state.dialogResolve = resolve;
      builder(dialogBody, resolveValue => closeDialog(resolveValue));
      showDialog();
    });
  }

  function promptToken(invoker) {
    return dialogPromise('连接 GitHub', (body, finish) => {
      const copy = doc.createElement('p');
      copy.className = 'gallery-manage-dialog-copy';
      copy.textContent = 'Token 只保存在当前页面内存中；刷新、离开或断开连接后立即清空。';
      const label = doc.createElement('label');
      label.className = 'gallery-manage-field';
      const labelText = doc.createElement('span');
      labelText.textContent = 'GitHub Token';
      const input = doc.createElement('input');
      input.type = 'password';
      input.autocomplete = 'off';
      input.placeholder = 'github_pat_…';
      label.append(labelText, input);
      const actions = doc.createElement('div');
      actions.className = 'gallery-manage-dialog-actions';
      const cancel = doc.createElement('button');
      cancel.type = 'button';
      cancel.className = 'gallery-manage-button is-ghost';
      cancel.textContent = '取消';
      const submit = doc.createElement('button');
      submit.type = 'button';
      submit.className = 'gallery-manage-button';
      submit.textContent = '连接';
      cancel.addEventListener('click', () => finish(null));
      submit.addEventListener('click', () => finish(input.value.trim() || null));
      input.addEventListener('keydown', event => {
        if (event.key === 'Enter') finish(input.value.trim() || null);
      });
      actions.append(cancel, submit);
      body.append(copy, label, actions);
      queueMicrotask(() => input.focus());
    }, invoker);
  }

  function confirmDelete(image, invoker) {
    return dialogPromise('确认删除图片', (body, finish) => {
      const preview = doc.createElement('div');
      preview.className = 'gallery-manage-delete-preview';
      const img = doc.createElement('img');
      img.src = galleryProxyUrl(image.path);
      img.alt = image.filename;
      const copy = doc.createElement('div');
      const title = doc.createElement('strong');
      title.textContent = image.filename;
      const meta = doc.createElement('span');
      meta.textContent = `分类：${image.category}`;
      copy.append(title, meta);
      preview.append(img, copy);
      const note = doc.createElement('p');
      note.className = 'gallery-manage-dialog-copy';
      note.textContent = '图片与感知查重索引会在同一次 GitHub commit 中删除。';
      const actions = doc.createElement('div');
      actions.className = 'gallery-manage-dialog-actions';
      const cancel = doc.createElement('button');
      cancel.type = 'button';
      cancel.className = 'gallery-manage-button is-ghost';
      cancel.textContent = '取消';
      const remove = doc.createElement('button');
      remove.type = 'button';
      remove.className = 'gallery-manage-button is-danger';
      remove.textContent = '确认删除';
      cancel.addEventListener('click', () => finish(false));
      remove.addEventListener('click', () => finish(true));
      actions.append(cancel, remove);
      body.append(preview, note, actions);
    }, invoker);
  }

  function reviewDuplicate(item, matches, exact) {
    return dialogPromise(exact ? '发现完全重复图片' : '发现相似图片', (body, finish) => {
      const copy = doc.createElement('p');
      copy.className = 'gallery-manage-dialog-copy';
      copy.textContent = exact
        ? '这张图已经存在于目标分类，因此不会重复上传。'
        : '请对比后决定是否仍然上传。';
      const compare = doc.createElement('div');
      compare.className = 'gallery-manage-compare';
      for (const match of matches.slice(0, 3)) {
        const row = doc.createElement('div');
        row.className = 'gallery-manage-compare-row';
        const library = doc.createElement('figure');
        const existing = doc.createElement('img');
        existing.src = galleryProxyUrl(match.path);
        existing.alt = '库内图片';
        const existingCaption = doc.createElement('figcaption');
        existingCaption.textContent = `库内 · ${match.path.split('/').pop()}${Number.isFinite(match.similarity) ? ` · ${(match.similarity * 100).toFixed(1)}%` : ''}`;
        library.append(existing, existingCaption);
        const candidate = doc.createElement('figure');
        const pending = doc.createElement('img');
        pending.src = item.previewUrl;
        pending.alt = '待上传图片';
        const pendingCaption = doc.createElement('figcaption');
        pendingCaption.textContent = `待上传 · ${item.file.name}`;
        candidate.append(pending, pendingCaption);
        row.append(library, candidate);
        compare.append(row);
      }
      const actions = doc.createElement('div');
      actions.className = 'gallery-manage-dialog-actions';
      if (!exact) {
        const skip = doc.createElement('button');
        skip.type = 'button';
        skip.className = 'gallery-manage-button is-ghost';
        skip.textContent = '跳过';
        const upload = doc.createElement('button');
        upload.type = 'button';
        upload.className = 'gallery-manage-button';
        upload.textContent = '仍然上传';
        skip.addEventListener('click', () => finish(false));
        upload.addEventListener('click', () => finish(true));
        actions.append(skip, upload);
      } else {
        const okay = doc.createElement('button');
        okay.type = 'button';
        okay.className = 'gallery-manage-button';
        okay.textContent = '知道了';
        okay.addEventListener('click', () => finish(false));
        actions.append(okay);
      }
      body.append(copy, compare, actions);
    });
  }

  async function loadPublic(forceRefresh = false) {
    const generation = ++state.syncGeneration;
    setStatus('正在读取公开图库…', 'loading');
    try {
      const result = await manifestLoader({ storage: null, forceRefresh, signal: abortController.signal });
      if (disposed || generation !== state.syncGeneration) return;
      state.categories = result.categories || [];
      renderAll();
      setStatus('只读模式 · 连接 GitHub 后可上传和删除', 'readonly');
    } catch (error) {
      if (disposed || error?.name === 'AbortError' || generation !== state.syncGeneration) return;
      setStatus('图库读取失败，请重试同步', 'error');
    }
  }

  async function syncRemote() {
    if (!state.connected || !state.client) return loadPublic(true);
    const generation = ++state.syncGeneration;
    setStatus('正在同步 GitHub 远端状态…', 'loading');
    const snapshot = await state.client.getBranchSnapshot({ signal: abortController.signal });
    const manifestEntry = snapshot.tree.find(entry => entry?.type === 'blob' && entry.path === GALLERY_INDEX_PATH);
    if (!manifestEntry?.sha) throw new Error('远端图库缺少 gallery_index.json');
    const manifestResponse = await state.client.getContent(GALLERY_INDEX_PATH, { signal: abortController.signal });
    const content = manifestResponse.data?.content;
    if (!content) throw new Error('无法读取远端图库索引');
    const index = parseGalleryIndex(JSON.parse(base64ToUtf8(content)));
    if (disposed || generation !== state.syncGeneration) return;
    state.remoteTree = snapshot.tree;
    state.galleryIndex = index;
    state.manifestSha = manifestEntry.sha;
    state.categories = normalizeRemoteTree(snapshot.tree);
    renderAll();
    setStatus('已连接 GitHub · 远端状态已同步', 'connected');
    return snapshot;
  }

  async function connect() {
    if (state.connected) {
      tokenSession.clear();
      state.connected = false;
      state.client = null;
      state.remoteTree = [];
      state.galleryIndex = {};
      state.manifestSha = null;
      renderAll();
      await loadPublic(true);
      return;
    }
    const token = await promptToken(connectButton);
    if (!token || disposed) return;
    setBusy(true);
    setStatus('正在验证 GitHub 权限…', 'loading');
    tokenSession.set(token);
    const client = githubClientFactory({ token: tokenSession.get() });
    try {
      await client.validateWriteAccess();
      state.client = client;
      state.connected = true;
      setBusy(false);
      renderAll();
      await syncRemote();
    } catch (error) {
      tokenSession.clear();
      state.client = null;
      state.connected = false;
      setBusy(false);
      renderAll();
      setStatus(error?.message || 'GitHub 连接失败', 'error');
    }
  }

  async function addFiles(files) {
    if (!state.connected || state.busy) return;
    const candidates = Array.from(files || []);
    if (!candidates.length) return;
    setBusy(true);
    for (const file of candidates) {
      if (!file?.type?.startsWith('image/')) continue;
      if (file.size > GITHUB_MAX_BLOB_BYTES) {
        state.queue.push({ file, status: '失败', error: '超过 GitHub 单文件 100 MiB 限制', previewUrl: '' });
        continue;
      }
      let previewUrl = '';
      try { previewUrl = URL.createObjectURL(file); } catch {}
      try {
        setStatus(`正在分析 ${file.name}…`, 'loading');
        const prepared = await prepareGalleryFile(file);
        if (state.queue.some(item => item.signature === prepared.signature)) {
          try { URL.revokeObjectURL(previewUrl); } catch {}
          continue;
        }
        state.queue.push({
          file,
          previewUrl,
          status: '等待',
          error: '',
          ...prepared,
        });
      } catch (error) {
        state.queue.push({ file, previewUrl, status: '失败', error: error?.message || '图片分析失败' });
      }
    }
    setBusy(false);
    renderQueue();
    setStatus(state.connected ? '已连接 GitHub · 待上传队列已更新' : '只读模式', state.connected ? 'connected' : 'readonly');
  }

  async function uploadPending() {
    if (!state.connected || !state.client || state.busy) return;
    const category = categoryNew.value.trim() || categorySelect.value;
    if (!isSafeManagedCategory(category)) {
      setStatus('请选择已有分类或输入有效的新分类名称', 'error');
      return;
    }
    const pending = state.queue.filter(item => item.status === '等待' || item.status === '失败');
    if (!pending.length) return;
    setBusy(true);
    try {
      await syncRemote();
      const accepted = [];
      for (const item of pending) {
        if (!item.blobSha || !item.perceptualHash) {
          item.status = '失败';
          item.error = '图片尚未完成分析，请移除后重新选择';
          continue;
        }
        item.status = '查重';
        renderQueue();
        const exact = exactRemoteMatch(state.remoteTree, item.blobSha, category);
        if (exact) {
          item.status = '完全重复';
          await reviewDuplicate(item, [{ ...exact, similarity: 1 }], true);
          continue;
        }
        const similar = similarRemoteMatches(state.galleryIndex, item.perceptualHash, category);
        if (similar.length) {
          item.status = '待确认';
          renderQueue();
          const proceed = await reviewDuplicate(item, similar, false);
          if (!proceed) {
            item.status = '已跳过相似图片';
            continue;
          }
        }
        accepted.push(item);
      }
      if (!accepted.length) {
        renderQueue();
        setStatus('没有需要上传的新图片', 'connected');
        return;
      }

      const pathPlans = planUploadPaths(state.remoteTree, category, accepted.map(item => item.file));
      const planned = pathPlans.map((plan, index) => ({
        ...plan,
        item: accepted[index],
        perceptualHash: accepted[index].perceptualHash,
      }));
      const nextIndex = addIndexEntries(state.galleryIndex, planned);
      const manifestBase64 = utf8ToBase64(serializeGalleryIndex(nextIndex));
      for (const plan of planned) plan.item.status = '上传';
      renderQueue();

      const transaction = await commitGitHubUploadTransaction({
        owner: 'Lidure',
        repo: 'airi-gallery-images',
        branch: GALLERY_BRANCH,
        request: state.client.request,
        items: planned.map(plan => {
          const large = plan.item.file.size >= CLOUD_PROXY_BLOB_THRESHOLD_BYTES
            && plan.item.file.size <= CLOUD_PROXY_MAX_RAW_BYTES;
          const descriptor = {
            path: plan.path,
            size: plan.item.file.size,
            expectedBlobSha: plan.item.blobSha,
            loadContentBase64: () => fileToBase64(plan.item.file),
          };
          if (large) {
            descriptor.createBlob = async () => {
              const sha = await largeUploadClient.upload(plan.item.file, tokenSession.get());
              if (sha !== plan.item.blobSha) throw new Error(`大图片完整性校验失败：${plan.item.file.name}`);
              return sha;
            };
          }
          return descriptor;
        }),
        manifest: { path: GALLERY_INDEX_PATH, contentBase64: manifestBase64 },
        concurrency: planned.some(plan => plan.item.file.size >= CLOUD_PROXY_BLOB_THRESHOLD_BYTES) ? 1 : 2,
        onProgress(completed, total) {
          setStatus(`正在准备远端对象 ${completed} / ${total}…`, 'loading');
        },
      });
      if (!transaction?.commitSha) throw new Error('GitHub 上传事务没有返回 commit');
      for (const item of accepted) item.status = '成功';
      await syncRemote();
      const successful = new Set(accepted);
      for (const item of accepted) {
        try { URL.revokeObjectURL(item.previewUrl); } catch {}
      }
      state.queue = state.queue.filter(item => !successful.has(item));
      renderQueue();
      categoryNew.value = '';
      if ([...categorySelect.options].some(option => option.value === category)) categorySelect.value = category;
      state.selectedCategory = category;
      state.page = 1;
      renderAll();
      setStatus(`上传完成 · ${accepted.length} 张图片已写入图库`, 'connected');
    } catch (error) {
      for (const item of pending) {
        if (['上传', '查重', '待确认'].includes(item.status)) {
          item.status = '失败';
          item.error = error?.message || '上传失败';
        }
      }
      renderQueue();
      setStatus(error?.message || '上传失败，请同步后重试', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function requestDelete(image, invoker) {
    if (!state.connected || !state.client || state.busy) return;
    if (!await confirmDelete(image, invoker)) return;
    setBusy(true);
    try {
      await syncRemote();
      const currentManifestSha = state.manifestSha;
      if (!currentManifestSha) throw new Error('无法确认远端图库索引版本');
      const nextIndex = removeIndexEntry(state.galleryIndex, image.path);
      await commitGitHubDeleteTransaction({
        owner: 'Lidure',
        repo: 'airi-gallery-images',
        branch: GALLERY_BRANCH,
        request: state.client.request,
        imagePath: image.path,
        manifest: {
          path: GALLERY_INDEX_PATH,
          contentBase64: utf8ToBase64(serializeGalleryIndex(nextIndex)),
          expectedSha: currentManifestSha,
        },
      });
      await syncRemote();
      if (state.remoteTree.some(entry => entry?.type === 'blob' && entry.path === image.path)) {
        throw new Error('删除提交后远端仍存在该图片，请同步后重试');
      }
      setStatus(`已删除 ${image.filename}`, 'connected');
    } catch (error) {
      setStatus(error?.message || '删除失败，请重试', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function manualSync() {
    if (state.busy) return;
    setBusy(true);
    try {
      if (state.connected) await syncRemote();
      else await loadPublic(true);
    } catch (error) {
      setStatus(error?.message || '同步失败，请稍后重试', 'error');
    } finally {
      setBusy(false);
    }
  }

  function onDialogKeydown(event) {
    if (dialog.hidden) return;
    if (event.key === 'Escape' && !state.busy) {
      event.preventDefault();
      closeDialog(null);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...dialog.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')]
      .filter(node => !node.hidden);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  listen(connectButton, 'click', connect);
  listen(syncButton, 'click', manualSync);
  listen(dropzone, 'click', () => fileInput.click());
  listen(fileInput, 'change', () => {
    const files = Array.from(fileInput.files || []);
    fileInput.value = '';
    addFiles(files);
  });
  listen(dropzone, 'dragover', event => { event.preventDefault(); dropzone.classList.add('is-dragover'); });
  listen(dropzone, 'dragleave', () => dropzone.classList.remove('is-dragover'));
  listen(dropzone, 'drop', event => {
    event.preventDefault();
    dropzone.classList.remove('is-dragover');
    addFiles(event.dataTransfer?.files || []);
  });
  listen(uploadStart, 'click', uploadPending);
  for (const close of dialog.querySelectorAll('[data-dialog-close]')) {
    listen(close, 'click', () => { if (!state.busy) closeDialog(null); });
  }
  listen(doc, 'keydown', onDialogKeydown);

  updateWriteControls();
  loadPublic(false);

  return () => {
    if (disposed) return;
    disposed = true;
    abortController.abort();
    state.syncGeneration += 1;
    tokenSession.clear();
    closeDialog(null);
    for (const item of state.queue) {
      try { URL.revokeObjectURL(item.previewUrl); } catch {}
    }
    state.queue = [];
    for (const cleanup of cleanups.splice(0)) cleanup();
  };
}
