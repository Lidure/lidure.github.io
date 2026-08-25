import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/components/SekaiPlayer.astro', import.meta.url), 'utf8');

test('online playlist import can read the remote playlist display name', () => {
  assert.match(source, /function fetchPlaylistDisplayName\s*\(/);
  assert.match(source, /function extractPlaylistDisplayName\s*\(/);
  assert.match(source, /dissname/);
  assert.match(source, /playlist\.name/);
});

test('remote playlist name is passed into both NetEase and QQ imports', () => {
  assert.match(source, /function fetchMetingPlaylist\(playlistId, platform, callback\)[\s\S]*fetchPlaylistDisplayName/);
  assert.match(source, /callback\(tracks, null, remotePlaylistName(?:\s*\|\|\s*'')?\)/);
  assert.match(source, /function\(tracks, error, remotePlaylistName\)/);
  assert.match(source, /addOnlineTracks\(tracks, 'netease', playlistId, playlistName, remotePlaylistName\)/);
  assert.match(source, /addOnlineTracks\(tracks, 'qq', playlistId, playlistName, remotePlaylistName\)/);
});

test('playlist naming keeps manual and true custom names ahead of the remote default', () => {
  assert.match(source, /function addOnlineTracks\(tracks, platform, playlistId, playlistName, remotePlaylistName\)/);
  assert.match(source, /var generatedFallbackName = platformName \+ '歌单 · ' \+ playlistId/);
  assert.match(source, /var previousCustomName = previousPlaylist && previousPlaylist\.playlistName !== generatedFallbackName[\s\S]*previousPlaylist\.playlistName/);
  assert.match(source, /playlistName \|\| previousCustomName \|\| remotePlaylistName \|\| generatedFallbackName/);
});

test('old generated platform/id names can upgrade to the remote playlist name', () => {
  assert.match(source, /previousPlaylist\.playlistName !== generatedFallbackName/);
  assert.doesNotMatch(source, /playlistName \|\| \(previousPlaylist && previousPlaylist\.playlistName\) \|\| remotePlaylistName/);
});

test('name input explains that the original playlist name is used by default', () => {
  assert.match(source, /placeholder="歌单名称（可选，默认读取原歌单名）"/);
});
