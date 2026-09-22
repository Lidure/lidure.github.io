import { galleryProxyUrl, paginate } from './gallery-data.mjs';
import { isSafeManagedImagePath } from './gallery-manage-config.mjs';

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

function fromPath(path, extra = {}) {
  const [, category, filename] = path.split('/');
  return {
    path,
    category,
    filename,
    imageUrl: galleryProxyUrl(path),
    ...extra,
  };
}

export function normalizeRemoteTree(tree) {
  return (tree || [])
    .filter(entry => (!entry?.type || entry.type === 'blob') && isSafeManagedImagePath(entry?.path))
    .map(entry => fromPath(entry.path, {
      ...(entry.sha ? { sha: entry.sha } : {}),
      ...(Number.isFinite(Number(entry.size)) ? { size: Number(entry.size) } : {}),
    }))
    .sort((a, b) => collator.compare(a.category, b.category) || collator.compare(a.filename, b.filename));
}

export function publicCategoriesToManagedItems(categories) {
  return (categories || []).flatMap(group => (group.images || []).map(image => fromPath(image.path)));
}

export function buildManagedCategories(items) {
  const counts = new Map();
  for (const item of items || []) counts.set(item.category, (counts.get(item.category) || 0) + 1);
  return [...counts.entries()]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([name, count]) => ({ name, count }));
}

export function pageManagedItems(items, category = '', page = 1, pageSize = 24) {
  const selected = category ? (items || []).filter(item => item.category === category) : (items || []);
  const sorted = [...selected].sort((a, b) => collator.compare(a.filename, b.filename));
  return paginate(sorted, page, pageSize);
}

export function reconcileDelete(items, path, remotePaths) {
  if (remotePaths?.has(path)) return [...items];
  return (items || []).filter(item => item.path !== path);
}
