import { readFile, writeFile } from 'node:fs/promises';

const heroPath = new URL('../src/components/HeroSlideshow.astro', import.meta.url);
let source = await readFile(heroPath, 'utf8');

function replaceOnce(before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Patch target not found: ${label}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  `];\n\nconst DEFAULT_INTERVAL = 15000;`,
  `];\n\nconst WALLPAPER_WIDTHS = [640, 960, 1280, 1920];\n\nfunction wallpaperVariantStem(src: string) {\n  const filename = src.split('/').pop() || 'wallpaper';\n  const dot = filename.lastIndexOf('.');\n  const stem = dot > 0 ? filename.slice(0, dot) : filename;\n  return stem\n    .replace(/[^A-Za-z0-9_-]+/g, '-')\n    .replace(/^-+|-+$/g, '') || 'wallpaper';\n}\n\nconst defaultImageSrcsets = Object.fromEntries(\n  defaultImages\n    .filter((src) => /^\\/assets\\/wallpapers\\/.+\\.(?:jpe?g|png|webp|avif)$/i.test(src))\n    .map((src) => [\n      src,\n      WALLPAPER_WIDTHS\n        .map((width) =>\n          '/assets/wallpapers/generated/' +\n          wallpaperVariantStem(src) +\n          '-' + width + '.webp ' + width + 'w'\n        )\n        .join(', '),\n    ]),\n);\n\nconst DEFAULT_INTERVAL = 15000;`,
  'frontmatter responsive source map',
);

replaceOnce(
  `  data-defaults={JSON.stringify(defaultImages)}\n  data-default-interval={String(DEFAULT_INTERVAL)}`,
  `  data-defaults={JSON.stringify(defaultImages)}\n  data-srcset={JSON.stringify(defaultImageSrcsets)}\n  data-sizes="100vw"\n  data-default-interval={String(DEFAULT_INTERVAL)}`,
  'container responsive data',
);

replaceOnce(
  `    var defaults = JSON.parse(container.dataset.defaults || '[]');\n    var defInterval = parseInt(container.dataset.defaultInterval || '15000', 10);`,
  `    var defaults = JSON.parse(container.dataset.defaults || '[]');\n    var defaultImageSrcsets = {};\n    try { defaultImageSrcsets = JSON.parse(container.dataset.srcset || '{}'); } catch (e) {}\n    var defaultImageSizes = container.dataset.sizes || '100vw';\n    var responsiveImagePreloads = Object.create(null);\n    var defInterval = parseInt(container.dataset.defaultInterval || '15000', 10);`,
  'runtime responsive source map',
);

replaceOnce(
  `    function allImages() {\n      var custom = state.images.filter(function(src) {\n        return defaults.indexOf(src) === -1;\n      });\n      return defaults.concat(custom);\n    }\n\n    function save() {`,
  `    function allImages() {\n      var custom = state.images.filter(function(src) {\n        return defaults.indexOf(src) === -1;\n      });\n      return defaults.concat(custom);\n    }\n\n    function prepareWallpaperImage(src, priority, sizesOverride) {\n      var img = new Image();\n      var srcset = defaultImageSrcsets[src];\n      if (srcset) {\n        img.srcset = srcset;\n        img.sizes = sizesOverride || defaultImageSizes;\n      }\n      img.decoding = 'async';\n      if (priority === 'high') img.setAttribute('fetchpriority', 'high');\n      else if (priority === 'low') img.setAttribute('fetchpriority', 'low');\n      img.src = src;\n      return img;\n    }\n\n    function prefetchNextImage(index) {\n      if (_destroyed || !state.autoplay) return;\n      var imgs = allImages();\n      if (imgs.length < 2) return;\n      var nextSrc = imgs[(index + 1) % imgs.length];\n      if (!nextSrc || isVideo(nextSrc) || responsiveImagePreloads[nextSrc]) return;\n\n      responsiveImagePreloads[nextSrc] = true;\n      var warmImage = function() {\n        if (_destroyed) return;\n        var img = prepareWallpaperImage(nextSrc, 'low');\n        responsiveImagePreloads[nextSrc] = img;\n        img.onerror = function() { delete responsiveImagePreloads[nextSrc]; };\n      };\n\n      if ('requestIdleCallback' in window) {\n        window.requestIdleCallback(warmImage, { timeout: 4000 });\n      } else {\n        window.setTimeout(warmImage, 1500);\n      }\n    }\n\n    function save() {`,
  'responsive image helpers',
);

replaceOnce(
  `          var img = document.createElement('img');\n          img.src = src;\n          img.alt = '';\n          img.loading = 'lazy';`,
  `          var img = prepareWallpaperImage(src, 'low', '(max-width: 480px) 140px, 200px');\n          img.alt = '';\n          img.loading = 'lazy';`,
  'media library responsive thumbnails',
);

replaceOnce(
  `      if (isVideo(src)) {\n        showSlide(src);\n      } else {\n        var img = new Image();\n        img.onload = function() {\n          if (!_destroyed) {\n            showSlide(img.src);\n            if (imgs.length > 1) {\n              var nextSrc = imgs[(index + 1) % imgs.length];\n              scheduleVideoPreload(nextSrc);\n            }\n          }\n        };\n        img.onerror = function() {\n          if (!_destroyed && imgs.length > 1) {\n            idx = (idx + 1) % imgs.length;\n            loadAt(idx);\n          }\n        };\n        img.src = src;\n      }`,
  `      if (isVideo(src)) {\n        showSlide(src);\n      } else {\n        var img = prepareWallpaperImage(src, 'high');\n        img.onload = function() {\n          if (!_destroyed) {\n            showSlide(img.currentSrc || img.src || src);\n            if (imgs.length > 1) {\n              var nextSrc = imgs[(index + 1) % imgs.length];\n              scheduleVideoPreload(nextSrc);\n              prefetchNextImage(index);\n            }\n          }\n        };\n        img.onerror = function() {\n          if (!_destroyed && imgs.length > 1) {\n            idx = (idx + 1) % imgs.length;\n            loadAt(idx);\n          }\n        };\n      }`,
  'active image loading',
);

await writeFile(heroPath, source);
console.log('Applied Firefly-style responsive wallpaper loading patch.');
