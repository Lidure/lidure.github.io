const IMAGE_SUFFIXES = new Set(['.bmp', '.gif', '.jpeg', '.jpg', '.jfif', '.png', '.tif', '.tiff', '.webp']);

export const GALLERY_REPOSITORY = 'Lidure/airi-gallery-images';
export const GALLERY_BRANCH = 'main';
export const GALLERY_ROOT = 'gallery';
export const GITHUB_API_ROOT = `https://api.github.com/repos/${GALLERY_REPOSITORY}`;

export function githubApi(path = '') {
  const suffix = String(path || '');
  if (!suffix) return GITHUB_API_ROOT;
  return `${GITHUB_API_ROOT}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

export function isSafeManagedImagePath(path) {
  if (typeof path !== 'string' || path.includes('\\')) return false;
  const parts = path.split('/');
  if (parts.length !== 3 || parts[0] !== GALLERY_ROOT) return false;
  if (parts.some(part => !part || part === '.' || part === '..')) return false;
  if (parts[2].toLowerCase().startsWith('.airi-renumber-')) return false;
  const dot = parts[2].lastIndexOf('.');
  return dot >= 0 && IMAGE_SUFFIXES.has(parts[2].slice(dot).toLowerCase());
}
