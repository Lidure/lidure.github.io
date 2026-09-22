import { isSafeManagedCategory, isSafeManagedImagePath } from './gallery-manage-config.mjs';

export const GALLERY_INDEX_PATH = 'gallery/gallery_index.json';

const EXTENSIONS = new Set(['.bmp', '.gif', '.jpeg', '.jpg', '.jfif', '.png', '.tif', '.tiff', '.webp']);

function extensionOf(name) {
  const value = String(name || '');
  const dot = value.lastIndexOf('.');
  if (dot <= 0) throw new Error(`不支持的图片文件名：${value || '未命名文件'}`);
  const ext = value.slice(dot).toLowerCase();
  if (!EXTENSIONS.has(ext)) throw new Error(`不支持的图片格式：${ext}`);
  return ext;
}

function imageNumber(path) {
  if (!isSafeManagedImagePath(path)) return 0;
  const file = path.split('/').pop() || '';
  const stem = file.slice(0, file.lastIndexOf('.'));
  return /^\d+$/.test(stem) ? Number(stem) : 0;
}

export function parseGalleryIndex(payload) {
  const files = payload?.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('图库感知索引格式无效');
  const result = {};
  for (const [path, hash] of Object.entries(files)) {
    if (!isSafeManagedImagePath(path)) continue;
    if (typeof hash !== 'string' || !/^[0-9a-f]+$/i.test(hash)) continue;
    result[path] = hash.toLowerCase();
  }
  return result;
}

export function serializeGalleryIndex(index) {
  const safe = {};
  for (const [path, hash] of Object.entries(index || {})) {
    if (isSafeManagedImagePath(path) && typeof hash === 'string' && /^[0-9a-f]+$/i.test(hash)) {
      safe[path] = hash.toLowerCase();
    }
  }
  return JSON.stringify({ files: safe }, null, 2) + '\n';
}

export function nextGlobalImageNumber(tree) {
  let max = 0;
  for (const entry of tree || []) {
    if (entry?.type && entry.type !== 'blob') continue;
    max = Math.max(max, imageNumber(entry?.path));
  }
  return max + 1;
}

export function planUploadPaths(tree, category, files) {
  if (!isSafeManagedCategory(category)) throw new Error('分类名称无效');
  let number = nextGlobalImageNumber(tree);
  return (files || []).map(file => {
    const extension = extensionOf(file?.name);
    const path = `gallery/${category}/${number}${extension}`;
    number += 1;
    return { file, path };
  });
}

export function addIndexEntries(index, planned) {
  const next = { ...(index || {}) };
  for (const item of planned || []) {
    if (!isSafeManagedImagePath(item?.path) || typeof item?.perceptualHash !== 'string') {
      throw new Error('待写入的图库索引项无效');
    }
    next[item.path] = item.perceptualHash.toLowerCase();
  }
  return next;
}

export function removeIndexEntry(index, path) {
  const next = { ...(index || {}) };
  delete next[path];
  return next;
}
