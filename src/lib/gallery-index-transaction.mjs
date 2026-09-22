const IMAGE_EXTENSIONS = new Set(['.bmp', '.gif', '.jpeg', '.jpg', '.jfif', '.png', '.tif', '.tiff', '.webp']);
const HASH_PATTERN = /^[0-9a-f]{16}$/;
const INDEX_ALGORITHM = 'dhash64-nn-white-v1';

export const GALLERY_INDEX_PATH = 'gallery/gallery_index.json';

function safeCategory(category) {
  return typeof category === 'string'
    && category.length > 0
    && category !== '.'
    && category !== '..'
    && !category.includes('/')
    && !category.includes('\\');
}

function numericImageNumber(path) {
  const parts = String(path || '').split('/');
  if (parts.length !== 3 || parts[0] !== 'gallery') return 0;
  const filename = parts[2];
  if (filename.startsWith('.airi-renumber-')) return 0;
  const dot = filename.lastIndexOf('.');
  if (dot <= 0 || !IMAGE_EXTENSIONS.has(filename.slice(dot).toLowerCase())) return 0;
  const stem = filename.slice(0, dot);
  return /^\d+$/.test(stem) ? Number(stem) : 0;
}

function extensionForName(name) {
  const filename = String(name || '');
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) throw new Error(`图片扩展名无效：${filename || '未命名文件'}`);
  const extension = filename.slice(dot).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) throw new Error(`不支持的图片格式：${extension}`);
  return extension;
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
  if (!safeCategory(category)) throw new Error('图库分类名称无效');
  let number = nextGlobalImageNumber(tree);
  return (files || []).map(file => ({
    ...file,
    path: `gallery/${category}/${number++}${extensionForName(file?.name)}`,
  }));
}

export function parseGalleryIndex(payload) {
  const result = {};
  const files = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload.files : null;
  if (!files || typeof files !== 'object' || Array.isArray(files)) return result;
  for (const [path, entry] of Object.entries(files)) {
    const value = typeof entry === 'string' ? entry : entry?.perceptual_hash;
    const hash = String(value || '').toLowerCase();
    if (HASH_PATTERN.test(hash)) result[path] = hash;
  }
  return result;
}

export function serializeGalleryIndex(index) {
  const sorted = Object.entries(index || {})
    .filter(([, value]) => HASH_PATTERN.test(String(value || '').toLowerCase()))
    .sort(([left], [right]) => left.localeCompare(right));
  return JSON.stringify({
    version: 1,
    algorithm: INDEX_ALGORITHM,
    files: Object.fromEntries(sorted.map(([path, hash]) => [path, { perceptual_hash: String(hash).toLowerCase() }])),
  });
}

export function addIndexEntries(index, plannedUploads) {
  const next = { ...(index || {}) };
  for (const item of plannedUploads || []) {
    const hash = String(item?.perceptualHash || '').toLowerCase();
    if (!item?.path || !HASH_PATTERN.test(hash)) throw new Error('上传图片感知哈希无效');
    next[item.path] = hash;
  }
  return next;
}

export function removeIndexEntry(index, path) {
  const next = { ...(index || {}) };
  delete next[path];
  return next;
}
