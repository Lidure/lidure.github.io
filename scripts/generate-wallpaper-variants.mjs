import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WALLPAPER_DIR = path.join(ROOT, 'public', 'assets', 'wallpapers');
const OUTPUT_DIR = path.join(WALLPAPER_DIR, 'generated');
const WIDTHS = [640, 960, 1280, 1920];
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);
const DEFAULT_WALLPAPER = 'blog-default-night-moon.avif';
const DEFAULT_WALLPAPER_SOURCE_PARTS = [
  'part-00.b64',
  'part-01.b64',
  'part-02.b64',
  'part-03.b64',
  'part-04.b64',
  'part-05.b64',
];
const DEFAULT_WALLPAPER_BASE64_LENGTH = 33344;
const DEFAULT_WALLPAPER_BYTES_LENGTH = 25006;
const DEFAULT_WALLPAPER_SHA256 = 'fbd25f20146be78ebc549281626618265f5cd52de1c4ffeebc690b76dc95a13a';

async function restoreDefaultWallpaper() {
  const encoded = (await Promise.all(
    DEFAULT_WALLPAPER_SOURCE_PARTS.map((filename) =>
      readFile(path.join(ROOT, 'scripts', 'wallpaper-source', filename), 'utf8'),
    ),
  )).join('').trim();

  if (encoded.length !== DEFAULT_WALLPAPER_BASE64_LENGTH) {
    throw new Error(`Default wallpaper base64 length mismatch: expected ${DEFAULT_WALLPAPER_BASE64_LENGTH}, got ${encoded.length}`);
  }

  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length !== DEFAULT_WALLPAPER_BYTES_LENGTH) {
    throw new Error(`Default wallpaper byte length mismatch: expected ${DEFAULT_WALLPAPER_BYTES_LENGTH}, got ${bytes.length}`);
  }

  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== DEFAULT_WALLPAPER_SHA256) {
    throw new Error(`Default wallpaper SHA-256 mismatch: expected ${DEFAULT_WALLPAPER_SHA256}, got ${sha256}`);
  }

  await mkdir(WALLPAPER_DIR, { recursive: true });
  await writeFile(path.join(WALLPAPER_DIR, DEFAULT_WALLPAPER), bytes);
}

await restoreDefaultWallpaper();

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
