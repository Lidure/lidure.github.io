export const VISUAL_SETTINGS_KEY = 'hero_settings';

export const DEFAULT_VISUAL_SETTINGS = Object.freeze({
  version: 2,
  enabled: true,
  autoplay: true,
  interval: 15000,
  opacity: 0.45,
  quality: 'high',
  sakura: true,
  wallpaperMode: 'banner',
  backgroundBlur: 6,
  cardOpacity: 0.92,
  bannerGradient: true,
  bannerTitle: true,
  themeHue: 340,
  cardBorder: true,
  cardFollowTheme: false,
  sakuraDensity: 0.65,
  sakuraSpeed: 1,
  reduceMotion: false,
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const finiteOr = (value, fallback) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

export function normalizeVisualSettings(raw = {}) {
  const safeRaw = raw && typeof raw === 'object' ? raw : {};
  const merged = { ...DEFAULT_VISUAL_SETTINGS, ...safeRaw };

  return {
    ...merged,
    version: 2,
    enabled: merged.enabled !== false,
    autoplay: merged.autoplay !== false,
    interval: clamp(finiteOr(merged.interval, 15000), 2000, 20000),
    opacity: clamp(finiteOr(merged.opacity, 0.45), 0, 1),
    quality: ['high', 'medium', 'original'].includes(merged.quality)
      ? merged.quality
      : 'high',
    sakura: merged.sakura === true,
    wallpaperMode: merged.wallpaperMode === 'fullscreen' ? 'fullscreen' : 'banner',
    backgroundBlur: clamp(finiteOr(merged.backgroundBlur, 6), 0, 20),
    cardOpacity: clamp(finiteOr(merged.cardOpacity, 0.92), 0.2, 1),
    bannerGradient: merged.bannerGradient !== false,
    bannerTitle: merged.bannerTitle !== false,
    themeHue: clamp(finiteOr(merged.themeHue, 340), 0, 360),
    cardBorder: merged.cardBorder !== false,
    cardFollowTheme: merged.cardFollowTheme === true,
    sakuraDensity: clamp(finiteOr(merged.sakuraDensity, 0.65), 0, 1),
    sakuraSpeed: clamp(finiteOr(merged.sakuraSpeed, 1), 0.25, 2),
    reduceMotion: merged.reduceMotion === true,
  };
}

export function readVisualSettings(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(VISUAL_SETTINGS_KEY) || '{}');
    return normalizeVisualSettings(parsed);
  } catch {
    return normalizeVisualSettings({});
  }
}

export function applyVisualSettingsToDocument(settings, doc) {
  if (!doc?.documentElement) return settings;

  const normalized = normalizeVisualSettings(settings);
  const root = doc.documentElement;
  root.dataset.wallpaperMode = normalized.wallpaperMode;
  root.dataset.bannerGradient = String(normalized.bannerGradient);
  root.dataset.bannerTitle = String(normalized.bannerTitle);
  root.dataset.cardBorder = String(normalized.cardBorder);
  root.dataset.cardFollowTheme = String(normalized.cardFollowTheme);
  root.dataset.reduceMotion = String(normalized.reduceMotion);
  root.classList.toggle('no-hero-bg', !normalized.enabled);
  root.style.setProperty('--wallpaper-overlay', String(normalized.opacity));
  root.style.setProperty('--wallpaper-blur', `${normalized.backgroundBlur}px`);
  root.style.setProperty('--card-opacity', String(normalized.cardOpacity));
  root.style.setProperty(
    '--card-opacity-percent',
    `${Math.round(normalized.cardOpacity * 100)}%`,
  );
  root.style.setProperty('--theme-hue', String(normalized.themeHue));
  return normalized;
}

export function writeVisualSettings(patch, { storage, doc, target } = {}) {
  const current = readVisualSettings(storage);
  const settings = normalizeVisualSettings({ ...current, ...(patch || {}) });
  storage?.setItem(VISUAL_SETTINGS_KEY, JSON.stringify(settings));
  if (doc) applyVisualSettingsToDocument(settings, doc);

  if (target?.dispatchEvent && typeof CustomEvent !== 'undefined') {
    target.dispatchEvent(
      new CustomEvent('lidure:visual-settings-change', {
        detail: {
          settings,
          changedKeys: Object.keys(patch || {}),
        },
      }),
    );
  }

  return settings;
}
