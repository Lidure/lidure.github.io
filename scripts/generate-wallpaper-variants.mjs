import { mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WALLPAPER_DIR = path.join(ROOT, 'public', 'assets', 'wallpapers');
const OUTPUT_DIR = path.join(WALLPAPER_DIR, 'generated');
const WIDTHS = [640, 960, 1280, 1920];
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

function outputStem(filename) {
  const extension = path.extname(filename);
  const stem = filename.slice(0, -extension.length);
  return stem
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'wallpaper';
}

async function generateVariants(filename) {
  const input = path.join(WALLPAPER_DIR, filename);
  const stem = outputStem(filename);

  await Promise.all(
    WIDTHS.map(async (width) => {
      const output = path.join(OUTPUT_DIR, `${stem}-${width}.webp`);
      await sharp(input)
        .rotate()
        .resize({ width })
        .webp({ quality: 82, effort: 4 })
        .toFile(output);
    }),
  );
}

await rm(OUTPUT_DIR, { recursive: true, force: true });
await mkdir(OUTPUT_DIR, { recursive: true });

const entries = await readdir(WALLPAPER_DIR, { withFileTypes: true });
const images = entries
  .filter((entry) => entry.isFile() && IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
  .map((entry) => entry.name);

await Promise.all(images.map(generateVariants));
console.log(`Generated ${images.length * WIDTHS.length} responsive wallpaper variants from ${images.length} images.`);
