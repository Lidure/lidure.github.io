import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/moments.astro');
const pins = read('src/components/MomentsPinControls.astro');

test('moments v2 retires the PR 43 journal enhancer', () => {
  assert.doesNotMatch(pins, /installMomentsJournalEnhancer/);
  assert.doesNotMatch(pins, /moments-journal\.css/);
  assert.equal(existsSync(new URL('../src/lib/moments-journal-enhancer.mjs', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/styles/moments-journal.css', import.meta.url)), false);
});

test('core moments behavior hooks stay present while the presentation changes', () => {
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
});
