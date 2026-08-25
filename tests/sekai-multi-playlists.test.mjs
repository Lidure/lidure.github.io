import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/SekaiPlayer.astro', import.meta.url), 'utf8');

test('online import UI supports naming and switching imported playlists', () => {
  assert.match(source, /id="sekaiPlaylistName"/);
  assert.match(source, /id="sekaiImportedPlaylists"/);
  assert.match(source, /function renderImportedPlaylists\s*\(/);
  assert.match(source, /activeImportedPlaylist/);
});

test('different playlists from the same platform coexist instead of replacing each other', () => {
  assert.doesNotMatch(source, /songs\s*=\s*songs\.filter\(function\(s\)\s*\{\s*return s\.source !== platform;\s*\}\);/);
  assert.match(source, /function addOnlineTracks\(tracks, platform, playlistId, playlistName\)/);
  assert.match(source, /playlistKey\s*=\s*platform\s*\+\s*':'\s*\+\s*playlistId/);
  assert.match(source, /s\.playlistKey !== playlistKey/);
});

test('playlist metadata is persisted and legacy imports are migrated into named groups', () => {
  assert.match(source, /playlistKey:\s*t\.playlistKey\s*\|\|\s*\('legacy_'\s*\+\s*t\.source\)/);
  assert.match(source, /playlistName:\s*t\.playlistName\s*\|\|/);
  assert.match(source, /playlistKey:\s*s\.playlistKey\s*\|\|\s*''/);
  assert.match(source, /playlistId:\s*s\.playlistId\s*\|\|\s*''/);
  assert.match(source, /playlistName:\s*s\.playlistName\s*\|\|\s*''/);
});

test('playlist filter and delete operate on playlist identity rather than platform', () => {
  assert.match(source, /matchesPlaylist\s*=\s*activeImportedPlaylist === 'all'/);
  assert.match(source, /function deleteImportedPlaylist\(playlistKey\)/);
  assert.match(source, /s\.playlistKey !== playlistKey/);
});

test('online import passes playlist id and chosen name into the import operation', () => {
  assert.match(source, /playlistNameInput\.value\.trim\(\)/);
  assert.match(source, /addOnlineTracks\(tracks, 'netease', playlistId, playlistName\)/);
  assert.match(source, /addOnlineTracks\(tracks, 'qq', playlistId, playlistName\)/);
});
