import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildDuplicateComparison,
  duplicateDecision,
  rankDuplicateMatches,
} from '../src/lib/gallery-duplicate-check.mjs';

test('exact match blocks while similar matches are ranked for confirmation', () => {
  assert.equal(duplicateDecision([{ exact: true, path: 'gallery/A/1.png' }]).kind, 'exact-block');
  const result = duplicateDecision([
    { exact: false, similarity: 0.91, path: 'gallery/A/2.png' },
    { exact: false, similarity: 0.96, path: 'gallery/A/3.png' },
  ]);
  assert.equal(result.kind, 'confirm-similar');
  assert.equal(result.matches[0].path, 'gallery/A/3.png');
});

test('no matches means upload may proceed', () => {
  assert.deepEqual(duplicateDecision([]), { kind: 'clear', matches: [] });
});

test('ranker is stable by similarity then path', () => {
  const ranked = rankDuplicateMatches([
    { similarity: 0.8, path: 'gallery/A/2.png' },
    { similarity: 0.9, path: 'gallery/A/3.png' },
    { similarity: 0.9, path: 'gallery/A/1.png' },
  ]);
  assert.deepEqual(ranked.map(match => match.path), [
    'gallery/A/1.png',
    'gallery/A/3.png',
    'gallery/A/2.png',
  ]);
});

test('comparison view model contains pending and library metadata without DOM', () => {
  const result = buildDuplicateComparison({
    pending: { name: 'new.png', previewUrl: 'blob:new' },
    matches: [{ path: 'gallery/A/12.png', similarity: 0.95, number: 12 }],
    imageUrlForPath: path => `proxy:${path}`,
  });
  assert.equal(result.pending.imageUrl, 'blob:new');
  assert.equal(result.matches[0].imageUrl, 'proxy:gallery/A/12.png');
  assert.match(result.matches[0].meta, /95\.0%/);
  assert.match(result.matches[0].meta, /#12/);
});
