import { loadGalleryManifest } from './gallery-manifest-client.mjs';

export function createTokenSession() {
  let token = '';
  return {
    get() { return token; },
    set(nextToken) { token = String(nextToken || '').trim(); },
    clear() { token = ''; },
  };
}

export function initGalleryManage(root, {
  manifestLoader = loadGalleryManifest,
  tokenSession = createTokenSession(),
} = {}) {
  if (!root) return () => {};
  const status = root.querySelector('#gallery-manage-status');
  const grid = root.querySelector('#gallery-manage-grid');
  const count = root.querySelector('#gallery-manage-count');
  let disposed = false;
  const abortController = new AbortController();

  async function load() {
    status.textContent = '正在读取图库…';
    try {
      const result = await manifestLoader({
        storage: null,
        forceRefresh: true,
        signal: abortController.signal,
      });
      if (disposed) return;
      const categories = result.categories || [];
      const total = categories.reduce((sum, category) => sum + (category.files?.length || 0), 0);
      count.textContent = `${categories.length} 个分类 · ${total} 张图片`;
      grid.replaceChildren();
      status.textContent = '只读模式 · 连接 GitHub 后可上传和删除';
    } catch (error) {
      if (disposed || error?.name === 'AbortError') return;
      status.textContent = '图库读取失败，请稍后重试';
    }
  }

  load();

  return () => {
    disposed = true;
    abortController.abort();
    tokenSession.clear();
  };
}
