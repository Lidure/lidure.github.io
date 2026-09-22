import { paginate } from './gallery-data.mjs';
import { parseManagedImagePath } from './gallery-manage-config.mjs';

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

export function normalizeRemoteItems(items) {
  return (Array.isArray(items) ? items : [])
    .filter(item => !item?.type || item.type === 'blob')
    .map(item => {
      const parsed = parseManagedImagePath(item?.path);
      if (!parsed) return null;
      return {
        ...parsed,
        sha: typeof item?.sha === 'string' ? item.sha : '',
        size: Number.isFinite(Number(item?.size)) ? Number(item.size) : 0,
      };
    })
    .filter(Boolean)
    .sort((left, right) => (
      collator.compare(left.category, right.category)
      || collator.compare(left.filename, right.filename)
    ));
}

export function groupManagedItems(items) {
  const grouped = new Map();
  for (const item of items || []) {
    if (!grouped.has(item.category)) grouped.set(item.category, []);
    grouped.get(item.category).push(item);
  }
  return [...grouped.entries()]
    .sort(([left], [right]) => collator.compare(left, right))
    .map(([category, categoryItems]) => ({
      category,
      items: [...categoryItems].sort((left, right) => collator.compare(left.filename, right.filename)),
    }));
}

export function paginateManagedItems(items, page, pageSize = 24) {
  return paginate(Array.isArray(items) ? items : [], page, pageSize);
}

export function reconcileDelete(items, path, remotePaths) {
  const remoteHasPath = remotePaths instanceof Set && remotePaths.has(path);
  if (remoteHasPath) return [...items];
  return (items || []).filter(item => item.path !== path);
}
