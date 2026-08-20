import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const player = readFileSync(
  new URL('../src/components/SekaiPlayer.astro', import.meta.url),
  'utf8',
);

test('player search tolerates imported songs without precomputed searchText', () => {
  assert.match(player, /function getSongSearchText\(song\)/);
  assert.match(player, /getSongSearchText\(song\)\.indexOf\(normalizedQuery\)/);
  assert.doesNotMatch(player, /song\.searchText\.indexOf\(normalizedQuery\)/);
});

test('local imports keep active search and tag filters', () => {
  assert.doesNotMatch(
    player,
    /filteredSongs\s*=\s*songs\.slice\(\);\s*renderPlaylist\(\);/,
  );
});
