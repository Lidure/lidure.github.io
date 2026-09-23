import { parseGalleryManifest } from './gallery-data.mjs';

export const GALLERY_CATALOG_URL =
  'https://airigallery.lidure22.xyz/__gallery-catalog';
// Compatibility alias for callers that still use the old constant name.
export const GALLERY_MANIFEST_URL = GALLERY_CATALOG_URL;

const CACHE_KEY = 'lidure_gallery_catalog_v1';
const FRESH_MS = 5 * 60 * 1000;
const MAX_STALE_MS = 24 * 60 * 60 * 1000;

function readCache(storage) {
  try {
    const raw = storage?.getItem?.(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Number.isFinite(parsed?.savedAt)) return null;
    parseGalleryManifest(parsed.payload);
    return parsed;
  } catch {
    return null;
  }
}

export function clearGalleryManifestCache(storage) {
  try {
    storage?.removeItem?.(CACHE_KEY);
  } catch {}
}

export async function loadGalleryManifest({
  fetchImpl = fetch,
  storage = sessionStorage,
  now = Date.now,
  forceRefresh = false,
  signal = null,
} = {}) {
  const cached = readCache(storage);
  const age = cached ? now() - cached.savedAt : Infinity;

  if (!forceRefresh && cached && age <= FRESH_MS) {
    return {
      categories: parseGalleryManifest(cached.payload),
      source: 'cache',
      stale: false,
    };
  }

  try {
    const response = await fetchImpl(GALLERY_CATALOG_URL, {
      signal,
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new Error(`图库目录请求失败：HTTP ${response.status}`);
    }
    const payload = await response.json();
    const categories = parseGalleryManifest(payload);
    try {
      storage?.setItem?.(CACHE_KEY, JSON.stringify({ savedAt: now(), payload }));
    } catch {}
    return { categories, source: 'network', stale: false };
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    if (cached && age <= MAX_STALE_MS) {
      return {
        categories: parseGalleryManifest(cached.payload),
        source: 'stale-cache',
        stale: true,
      };
    }
    throw error;
  }
}
