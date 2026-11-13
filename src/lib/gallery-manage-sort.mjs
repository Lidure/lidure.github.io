/**
 * Sort the management gallery globally, before pagination.
 *
 * The GitHub file tree does not expose per-image upload dates. "time" modes
 * therefore use global numeric image IDs as an upload-order approximation.
 * Do not label these as exact timestamps in the UI.
 */
export const MANAGE_SORT_MODES = Object.freeze([
  'time_desc', 'time_asc', 'index_desc', 'index_asc', 'name_asc', 'name_desc',
]);

const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
const lexical = new Intl.Collator('zh-CN', { numeric: false, sensitivity: 'base' });

export function galleryImageIndex(image) {
  const filename = String(image?.filename || image?.path?.split('/').pop() || '');
  const stem = filename.replace(/\.[^.]+$/, '');
  return /^\d+$/.test(stem) ? Number(stem) : null;
}

export function sortManagedImages(images, mode = 'time_desc') {
  const sortMode = MANAGE_SORT_MODES.includes(mode) ? mode : 'time_desc';
  const direction = sortMode.endsWith('_asc') ? 1 : -1;
  return [...images].sort((a, b) => {
    if (sortMode.startsWith('name_')) {
      const byName = direction * lexical.compare(a.filename || '', b.filename || '');
      return byName || collator.compare(a.path || '', b.path || '');
    }
    // Global numerical IDs are not necessarily dates: migration, renumbering
    // and copied images may invalidate this approximate upload chronology.
    const an = galleryImageIndex(a);
    const bn = galleryImageIndex(b);
    if (an === null && bn !== null) return 1;
    if (an !== null && bn === null) return -1;
    if (an !== null && bn !== null && an !== bn) return direction * (an - bn);
    return collator.compare(a.path || '', b.path || '');
  });
}
