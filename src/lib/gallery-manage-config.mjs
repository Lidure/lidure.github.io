const IMAGE_SUFFIXES = new Set([
  '.bmp', '.gif', '.jpeg', '.jpg', '.jfif', '.png', '.tif', '.tiff', '.webp',
]);

export const GALLERY_REPOSITORY = 'Lidure/airi-gallery-images';
export const GALLERY_BRANCH = 'main';
export const GALLERY_ROOT = 'gallery';
export const GALLERY_INDEX_PATH = 'gallery/gallery_index.json';
export const GITHUB_API_ROOT = `https://api.github.com/repos/${GALLERY_REPOSITORY}`;
export const GALLERY_CLOUD_ORIGIN = 'https://airigallery.lidure22.xyz';

export function githubApi(path = '') {
  const suffix = String(path || '');
  if (!suffix) return GITHUB_API_ROOT;
  return `${GITHUB_API_ROOT}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

export function isSafeManagedCategory(category) {
  const value = String(category || '').trim();
  return Boolean(value)
    && value !== '.'
    && value !== '..'
    && !value.includes('/')
    && !value.includes('\\')
    && !value.includes('\0');
}

export function isSafeManagedImagePath(path) {
  if (typeof path !== 'string' || path.includes('\\')) return false;
  const parts = path.split('/');
  if (parts.length !== 3 || parts[0] !== GALLERY_ROOT || !isSafeManagedCategory(parts[1])) return false;
  const fileName = parts[2];
  if (!fileName || fileName === '.' || fileName === '..' || fileName.startsWith('.airi-renumber-')) return false;
  const dot = fileName.lastIndexOf('.');
  return dot > 0 && IMAGE_SUFFIXES.has(fileName.slice(dot).toLowerCase());
}
