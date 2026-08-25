import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('journal enhancer is integrated without replacing moments page behavior', () => {
  const page = read('src/pages/moments.astro');
  const controls = read('src/components/MomentsPinControls.astro');
  const enhancer = read('src/lib/moments-journal-enhancer.mjs');
  const css = read('src/styles/moments-journal.css');

  assert.match(controls, /installMomentsJournalEnhancer/);
  assert.match(controls, /moments-journal\.css/);
  assert.match(enhancer, /export function getMomentDateKey/);
  assert.match(enhancer, /export function getTodayDateKey/);
  assert.match(enhancer, /moments-journal-header/);
  assert.match(enhancer, /moments-film-strip/);
  assert.match(enhancer, /moment-date-chapter/);
  assert.match(enhancer, /is-text-only/);
  assert.match(enhancer, /is-single-media/);
  assert.match(enhancer, /is-multi-media/);
  assert.match(css, /\.moments-journal-header/);
  assert.match(css, /\.moments-film-strip/);
  assert.match(css, /\.moment-date-chapter/);
  assert.match(css, /\.moment-card\.is-single-media/);
  assert.match(css, /\.moment-card\.is-multi-media/);
  assert.match(css, /@media \(max-width:\s*720px\)/);
  assert.match(css, /backdrop-filter:\s*none/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /var\(--card-opacity-percent/);

  for (const hook of [
    'id="publish-toggle"',
    'id="publish-box"',
    'id="publish-form"',
    'id="image-input"',
    'id="image-previews"',
    'id="moments-session-status"',
    'id="moment-lightbox"',
  ]) assert.match(page, new RegExp(hook));

  assert.match(page, /renderMomentReactions\(moment/);
  assert.match(page, /setupLightboxForNewCards\(\)/);
  assert.match(page, /deleteMomentViaApi/);
  assert.match(page, /uploadToR2/);
  assert.match(page, /MOMENT_REACTIONS_API_URL/);
  assert.match(page, /createCommentsWidget\(['"]moment['"]/);
  assert.match(page, /applyScopedStyles\(card\)/);
});

test('today key uses local calendar fields rather than UTC slicing', async () => {
  const mod = await import('../src/lib/moments-journal-enhancer.mjs');
  const localLate = new Date(2026, 7, 25, 23, 55, 0);
  assert.equal(mod.getTodayDateKey(localLate), '2026-08-25');
  assert.equal(mod.getMomentDateKey(localLate), '2026-08-25');
});
