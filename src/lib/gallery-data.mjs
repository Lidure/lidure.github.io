const IMAGE_EXTENSIONS = new Set([
  '.bmp', '.gif', '.jpeg', '.jpg', '.jfif', '.png', '.tif', '.tiff', '.webp',
]);

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });

function normalizeGalleryImagePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\\')) return null;
  const parts = path.split('/');
  if (parts.length !== 3 || parts[0] !== 'gallery') return null;
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  const filename = parts[2];
  if (filename.startsWith('.airi-renumber-')) return null;
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return null;
  const extension = filename.slice(dot).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return null;
  return { path, category: parts[1], filename, extension };
}

export function parseGalleryManifest(payload) {
  const files = payload?.files;
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new Error('图库索引格式无效');
  }

  const grouped = new Map();
  for (const path of Object.keys(files)) {
    const image = normalizeGalleryImagePath(path);
    if (!image) continue;
    if (!grouped.has(image.category)) grouped.set(image.category, []);
    grouped.get(image.category).push(image);
  }

  return [...grouped.entries()]
    .sort(([a], [b]) => collator.compare(a, b))
    .map(([category, images]) => ({
      category,
      images: images.sort((a, b) => collator.compare(a.filename, b.filename)),
    }));
}

export function paginate(items, page, pageSize) {
  const size = Number.isFinite(Number(pageSize)) ? Math.max(1, Math.trunc(pageSize)) : 24;
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / size));
  const current = Math.min(totalPages, Math.max(1, Math.trunc(Number(page) || 1)));
  const start = (current - 1) * size;
  return {
    page: current,
    pageSize: size,
    totalPages,
    totalItems,
    items: items.slice(start, start + size),
  };
}

export function galleryProxyUrl(path) {
  return 'https://airigallery.lidure22.xyz/__gallery-image/'
    + path.split('/').map(encodeURIComponent).join('/');
}

export function isGifPath(path) {
  return /\.gif$/i.test(path);
}

export function nextPagePrefetchCandidates(allItems, page, pageSize, limit = 2) {
  const next = paginate(allItems, Number(page) + 1, pageSize);
  if (next.page <= Number(page)) return [];
  return next.items
    .filter((item) => !isGifPath(item.path))
    .slice(0, Math.max(0, Number(limit) || 0));
}
