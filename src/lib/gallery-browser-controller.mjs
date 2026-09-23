import {
  galleryPageSizeForWidth,
  galleryProxyUrl,
  nextPagePrefetchCandidates,
  paginate,
  remapGalleryPage,
} from './gallery-data.mjs';
import {
  clearGalleryManifestCache,
  loadGalleryManifest,
} from './gallery-manifest-client.mjs';

function textButton(doc, label, onClick, options = {}) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (options.className) button.className = options.className;
  if (options.disabled) button.disabled = true;
  if (options.current) button.setAttribute('aria-current', 'page');
  button.addEventListener('click', onClick);
  return button;
}

export function initGalleryBrowser(root, options = {}) {
  if (!root) return () => {};

  const doc = root.ownerDocument || document;
  const win = doc.defaultView || window;
  const fetchImpl = options.fetchImpl || win.fetch.bind(win);
  const storage = options.storage || win.sessionStorage;
  const loadManifest = options.loadManifest || loadGalleryManifest;
  const clearCache = options.clearCache || clearGalleryManifestCache;

  const tabs = root.querySelector('#gallery-category-tabs');
  const grid = root.querySelector('#gallery-grid');
  const pager = root.querySelector('#gallery-pager');
  const refresh = root.querySelector('#gallery-refresh');
  const notice = root.querySelector('#gallery-notice');
  if (!tabs || !grid || !pager || !refresh || !notice) return () => {};

  const state = {
    categories: [],
    category: '',
    page: 1,
    pageSize: galleryPageSizeForWidth(win.innerWidth),
    loading: false,
    disposed: false,
  };

  let abortController = new AbortController();
  let idleHandle = null;
  let idleFallback = null;
  let resizeTimer = null;
  const preloads = new Set();
  const imageRetryTimers = new Set();

  function setNotice(message = '', kind = '') {
    notice.textContent = message;
    notice.dataset.kind = kind;
    notice.hidden = !message;
  }

  function currentCategory() {
    return state.categories.find((entry) => entry.category === state.category) || state.categories[0] || null;
  }

  function cancelPrefetch() {
    if (idleHandle != null && typeof win.cancelIdleCallback === 'function') {
      win.cancelIdleCallback(idleHandle);
    }
    if (idleFallback != null) win.clearTimeout(idleFallback);
    idleHandle = null;
    idleFallback = null;
    preloads.clear();
  }

  function cancelImageRetries() {
    for (const timer of imageRetryTimers) win.clearTimeout(timer);
    imageRetryTimers.clear();
  }

  function scheduleImageRetry(callback, delay = 320) {
    const timer = win.setTimeout(() => {
      imageRetryTimers.delete(timer);
      callback();
    }, delay);
    imageRetryTimers.add(timer);
  }

  function scheduleNextPagePrefetch(images) {
    cancelPrefetch();
    const candidates = nextPagePrefetchCandidates(images, state.page, state.pageSize, 2);
    if (!candidates.length) return;

    const preload = () => {
      idleHandle = null;
      idleFallback = null;
      if (state.disposed) return;
      for (const item of candidates) {
        const image = new win.Image();
        preloads.add(image);
        const release = () => preloads.delete(image);
        image.addEventListener('load', release, { once: true });
        image.addEventListener('error', release, { once: true });
        image.decoding = 'async';
        image.src = galleryProxyUrl(item.path);
      }
    };

    if (typeof win.requestIdleCallback === 'function') {
      idleHandle = win.requestIdleCallback(preload, { timeout: 1500 });
    } else {
      idleFallback = win.setTimeout(preload, 1500);
    }
  }

  function renderTabs() {
    tabs.replaceChildren();
    for (const entry of state.categories) {
      const button = textButton(
        doc,
        `${entry.category} · ${entry.images.length}`,
        () => {
          if (state.category === entry.category) return;
          state.category = entry.category;
          state.page = 1;
          render();
        },
        {
          className: 'gallery-category-tab',
          current: state.category === entry.category,
        },
      );
      button.dataset.category = entry.category;
      tabs.append(button);
    }
  }

  function makeImageTile(item, absoluteIndex, index, images) {
    const tile = doc.createElement('button');
    tile.type = 'button';
    tile.className = 'gallery-tile';
    tile.dataset.galleryPath = item.path;
    tile.setAttribute('aria-label', `打开 ${item.filename}`);

    const img = doc.createElement('img');
    img.alt = item.filename;
    img.loading = index === 0 ? 'eager' : 'lazy';
    img.decoding = 'async';
    const sourceUrl = galleryProxyUrl(item.path);

    const meta = doc.createElement('span');
    meta.className = 'gallery-tile-meta';
    meta.textContent = item.filename;

    const fallback = doc.createElement('span');
    fallback.className = 'gallery-tile-fallback';
    fallback.hidden = true;
    fallback.setAttribute('aria-hidden', 'true');

    const fallbackIcon = doc.createElement('span');
    fallbackIcon.className = 'gallery-tile-fallback-icon';
    fallbackIcon.textContent = '↻';

    const fallbackTitle = doc.createElement('span');
    fallbackTitle.className = 'gallery-tile-fallback-title';
    fallbackTitle.textContent = '暂时无法加载';

    const fallbackFilename = doc.createElement('span');
    fallbackFilename.className = 'gallery-tile-fallback-filename';
    fallbackFilename.textContent = item.filename;

    const fallbackHint = doc.createElement('span');
    fallbackHint.className = 'gallery-tile-fallback-hint';
    fallbackHint.textContent = '点击重试';

    fallback.append(fallbackIcon, fallbackTitle, fallbackFilename, fallbackHint);

    let automaticRetryUsed = false;

    function showFallback(title, hint) {
      fallbackTitle.textContent = title;
      fallbackHint.textContent = hint;
      fallback.hidden = false;
    }

    function showLoaded() {
      tile.classList.remove('is-error', 'is-retrying');
      img.hidden = false;
      fallback.hidden = true;
      tile.setAttribute('aria-label', `打开 ${item.filename}`);
    }

    function showError() {
      tile.classList.remove('is-retrying');
      tile.classList.add('is-error');
      img.hidden = true;
      showFallback('暂时无法加载', '点击重试');
      tile.setAttribute('aria-label', `重试加载 ${item.filename}`);
    }

    function retryImage(automatic = false) {
      tile.classList.remove('is-error');
      tile.classList.add('is-retrying');
      img.hidden = true;
      showFallback('正在重新加载…', automatic ? '网络波动，正在自动重试' : '正在重新请求图片');
      tile.setAttribute('aria-label', `正在重试 ${item.filename}`);
      scheduleImageRetry(() => {
        if (state.disposed || !tile.isConnected) return;
        img.src = `${sourceUrl}${sourceUrl.includes('?') ? '&' : '?'}retry=${Date.now()}`;
      });
    }

    img.addEventListener('load', showLoaded);
    img.addEventListener('error', () => {
      if (!automaticRetryUsed) {
        automaticRetryUsed = true;
        retryImage(true);
        return;
      }
      showError();
    });

    tile.addEventListener('click', () => {
      if (tile.classList.contains('is-retrying')) return;
      if (tile.classList.contains('is-error')) {
        retryImage(false);
        return;
      }
      tile.dispatchEvent(new CustomEvent('gallery:image-open', {
        bubbles: true,
        detail: { index: absoluteIndex, images },
      }));
    });

    tile.append(img, fallback, meta);
    img.src = sourceUrl;
    return tile;
  }

  function renderGrid(entry) {
    cancelImageRetries();
    grid.replaceChildren();
    if (!entry || !entry.images.length) {
      const empty = doc.createElement('p');
      empty.className = 'gallery-empty';
      empty.textContent = '这个分类暂时还没有图片。';
      grid.append(empty);
      return;
    }

    const pageData = paginate(entry.images, state.page, state.pageSize);
    state.page = pageData.page;
    pageData.items.forEach((item, index) => {
      const absoluteIndex = (pageData.page - 1) * state.pageSize + index;
      grid.append(makeImageTile(item, absoluteIndex, index, entry.images));
    });
    scheduleNextPagePrefetch(entry.images);
  }

  function renderPager(entry) {
    pager.replaceChildren();
    const pageData = paginate(entry?.images || [], state.page, state.pageSize);
    state.page = pageData.page;

    const go = (page) => {
      state.page = page;
      render();
      root.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    };

    pager.append(
      textButton(doc, '首页', () => go(1), { disabled: pageData.page <= 1 }),
      textButton(doc, '上一页', () => go(pageData.page - 1), { disabled: pageData.page <= 1 }),
    );

    const status = doc.createElement('span');
    status.className = 'gallery-page-status';
    status.textContent = `${pageData.page} / ${pageData.totalPages}`;
    pager.append(status);

    pager.append(
      textButton(doc, '下一页', () => go(pageData.page + 1), { disabled: pageData.page >= pageData.totalPages }),
      textButton(doc, '末页', () => go(pageData.totalPages), { disabled: pageData.page >= pageData.totalPages }),
    );
  }

  function render() {
    if (state.disposed) return;
    const entry = currentCategory();
    renderTabs();
    renderGrid(entry);
    renderPager(entry);
  }

  async function load({ forceRefresh = false } = {}) {
    if (state.loading || state.disposed) return;
    state.loading = true;
    refresh.disabled = true;
    setNotice('正在加载图库…', 'loading');

    abortController.abort();
    abortController = new AbortController();

    try {
      const result = await loadManifest({
        fetchImpl,
        storage,
        forceRefresh,
        signal: abortController.signal,
      });
      if (state.disposed) return;
      state.categories = result.categories;
      if (!state.categories.some((entry) => entry.category === state.category)) {
        state.category = state.categories[0]?.category || '';
        state.page = 1;
      }
      if (result.stale) {
        setNotice('网络连接异常，当前显示最近缓存的图库。', 'stale');
      } else {
        setNotice('');
      }
      render();
    } catch (error) {
      if (error?.name === 'AbortError' || state.disposed) return;
      tabs.replaceChildren();
      grid.replaceChildren();
      pager.replaceChildren();
      setNotice(`图库加载失败：${error?.message || '未知错误'}`, 'error');
    } finally {
      state.loading = false;
      refresh.disabled = false;
    }
  }

  function onRefresh() {
    clearCache(storage);
    load({ forceRefresh: true });
  }

  function onResize() {
    if (resizeTimer != null) win.clearTimeout(resizeTimer);
    resizeTimer = win.setTimeout(() => {
      resizeTimer = null;
      if (state.disposed) return;
      const nextPageSize = galleryPageSizeForWidth(win.innerWidth);
      if (nextPageSize === state.pageSize) return;
      state.page = remapGalleryPage(state.page, state.pageSize, nextPageSize);
      state.pageSize = nextPageSize;
      render();
    }, 120);
  }

  refresh.addEventListener('click', onRefresh);
  win.addEventListener('resize', onResize);
  load();

  return function cleanupGalleryBrowser() {
    if (state.disposed) return;
    state.disposed = true;
    refresh.removeEventListener('click', onRefresh);
    win.removeEventListener('resize', onResize);
    if (resizeTimer != null) win.clearTimeout(resizeTimer);
    resizeTimer = null;
    abortController.abort();
    cancelPrefetch();
    cancelImageRetries();
  };
}
