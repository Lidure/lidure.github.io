import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('moments journal enhancer preserves existing hooks and adds journal structure', () => {
  const page = read('src/pages/moments.astro');
  const enhancer = read('src/components/PageTransitionEnhancer.astro');

  assert.match(page, /id="moments-list"/);
  assert.match(page, /id="publish-toggle"/);
  assert.match(page, /\.pill\[data-category\]/);
  assert.match(enhancer, /moments-journal-header/);
  assert.match(enhancer, /moments-film-strip/);
  assert.match(enhancer, /moments-publish-label/);
  assert.match(enhancer, /moment-date-chapter/);
  assert.match(enhancer, /moment-date-heading/);
  assert.match(enhancer, /is-today/);
  assert.match(enhancer, /is-text-only/);
  assert.match(enhancer, /is-single-media/);
  assert.match(enhancer, /is-multi-media/);
  assert.match(enhancer, /getLocalDateKey/);
  assert.match(enhancer, /MutationObserver/);
  assert.match(enhancer, /prefers-reduced-motion/);
});
