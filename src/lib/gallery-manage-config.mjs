const IMAGE_EXTENSIONS = new Set(['.bmp', '.gif', '.jpeg', '.jpg', '.jfif', '.png', '.tif', '.tiff', '.webp']);

export const GALLERY_REPOSITORY = 'Lidure/airi-gallery-images';
export const GALLERY_BRANCH = 'main';
export const GALLERY_ROOT = 'gallery';
export const GITHUB_API_ROOT = `https://api.github.com/repos/${GALLERY_REPOSITORY}`;

export function githubApi(path = '') {
  const suffix = String(path || '');
  return `${GITHUB_API_ROOT}${suffix.startsWith('/') ? suffix : `/${suffix}`}`;
}

export function parseManagedImagePath(path) {
  if (typeof path !== 'string' || !path || path.includes('\\')) return null;
  const parts = path.split('/');
  if (parts.length !== 3 || parts[0] !== GALLERY_ROOT) return null;
  if (parts.some(part => !part || part === '.' || part === '..')) return null;
  const category = parts[1];
  const filename = parts[2];
  if (filename.startsWith('.airi-renumber-')) return null;
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return null;
  const extension = filename.slice(dot).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return null;
  return { path, category, filename, extension };
}

export function isSafeManagedImagePath(path) {
  return Boolean(parseManagedImagePath(path));
}
