const IMAGE_SUFFIXES = new Set(['.bmp', '.gif', '.jpeg', '.jpg', '.jfif', '.png', '.tif', '.tiff', '.webp']);
export const GALLERY_INDEX_PATH = 'gallery/gallery_index.json';

function imageExtension(name) {
  const fileName = String(name || '').split('/').pop() || '';
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : '';
}

function numericImageNumber(path) {
  const parts = String(path || '').split('/');
  if (parts.length !== 3 || parts[0] !== 'gallery') return 0;
  const ext = imageExtension(parts[2]);
  if (!IMAGE_SUFFIXES.has(ext)) return 0;
  const stem = parts[2].slice(0, -ext.length);
  return /^\d+$/.test(stem) ? Number(stem) : 0;
}

function assertSafeCategory(category) {
  const value = String(category || '').trim();
  if (!value || value === '.' || value === '..' || value.includes('/') || value.includes('\\')) {
    throw new Error('分类名称无效');
  }
  return value;
}

export function parseGalleryIndex(payload) {
  const raw = payload && typeof payload === 'object' && payload.files && typeof payload.files === 'object'
    ? payload.files
    : payload;
  const result = {};
  for (const [path, hash] of Object.entries(raw || {})) {
    if (typeof path !== 'string' || typeof hash !== 'string') continue;
    result[path] = hash;
  }
  return result;
}

export function serializeGalleryIndex(index) {
  const files = Object.fromEntries(Object.entries(index || {}).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify({ files }, null, 2)}\n`;
}

export function nextGlobalImageNumber(tree) {
  let max = 0;
  for (const entry of tree || []) {
    if (entry?.type && entry.type !== 'blob') continue;
    max = Math.max(max, numericImageNumber(entry?.path));
  }
  return max + 1;
}

export function planUploadPaths(tree, category, files) {
  const safeCategory = assertSafeCategory(category);
  let next = nextGlobalImageNumber(tree);
  return (files || []).map(file => {
    const ext = imageExtension(file?.name);
    if (!IMAGE_SUFFIXES.has(ext)) throw new Error(`不支持的图片类型：${file?.name || ''}`);
    const number = next++;
    return { file, number, path: `gallery/${safeCategory}/${number}${ext}` };
  });
}

export function addIndexEntries(index, plannedUploads) {
  const next = { ...(index || {}) };
  for (const item of plannedUploads || []) {
    if (!item?.path || typeof item.perceptualHash !== 'string') continue;
    next[item.path] = item.perceptualHash;
  }
  return next;
}

export function removeIndexEntry(index, path) {
  const next = { ...(index || {}) };
  delete next[path];
  return next;
}
