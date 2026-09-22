import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('gallery lightbox is accessible and prefetches adjacent images only', async () => {
  const [component, controller] = await Promise.all([
    read('src/components/GalleryLightbox.astro'),
    read('src/lib/gallery-lightbox-controller.mjs'),
  ]);
  assert.match(component, /role="dialog"/);
  assert.match(component, /aria-modal="true"/);
  assert.match(component, /gallery-lightbox-close/);
  assert.match(component, /gallery-lightbox-prev/);
  assert.match(component, /gallery-lightbox-next/);
  assert.match(controller, /Escape/);
  assert.match(controller, /ArrowLeft/);
  assert.match(controller, /ArrowRight/);
  assert.match(controller, /touchstart/);
  assert.match(controller, /touchend/);
  assert.match(controller, /previouslyFocused/);
  assert.match(controller, /new win\.Image\(\)/);
  assert.match(controller, /new Set\(\[previousIndex, nextIndex\]\)/);
  assert.doesNotMatch(controller, /images\.forEach\([^)]*new win\.Image/s);
});
