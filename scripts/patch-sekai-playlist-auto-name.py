from pathlib import Path
import re

p = Path('src/components/SekaiPlayer.astro')
s = p.read_text(encoding='utf-8')


def once(old, new, label):
    global s
    if old not in s:
        raise SystemExit('missing pattern: ' + label)
    s = s.replace(old, new, 1)


once(
    'placeholder="歌单名称（可选，默认自动命名）"',
    'placeholder="歌单名称（可选，默认读取原歌单名）"',
    'playlist name placeholder'
)

once(
    "fetchMetingPlaylist(playlistId, 'netease', function(tracks, error) {",
    "fetchMetingPlaylist(playlistId, 'netease', function(tracks, error, remotePlaylistName) {",
    'netease callback signature'
)
once(
    "addOnlineTracks(tracks, 'netease', playlistId, playlistName);",
    "addOnlineTracks(tracks, 'netease', playlistId, playlistName, remotePlaylistName);",
    'netease remote name arg'
)
once(
    "fetchMetingPlaylist(playlistId, 'qq', function(tracks, error) {",
    "fetchMetingPlaylist(playlistId, 'qq', function(tracks, error, remotePlaylistName) {",
    'qq callback signature'
)
once(
    "addOnlineTracks(tracks, 'qq', playlistId, playlistName);",
    "addOnlineTracks(tracks, 'qq', playlistId, playlistName, remotePlaylistName);",
    'qq remote name arg'
)

once(
    'function addOnlineTracks(tracks, platform, playlistId, playlistName) {',
    'function addOnlineTracks(tracks, platform, playlistId, playlistName, remotePlaylistName) {',
    'addOnlineTracks signature'
)
once(
    "var resolvedName = playlistName || (previousPlaylist && previousPlaylist.playlistName) || (platformName + '歌单 · ' + playlistId);",
    "var resolvedName = playlistName || (previousPlaylist && previousPlaylist.playlistName) || remotePlaylistName || (platformName + '歌单 · ' + playlistId);",
    'resolved playlist name priority'
)

pattern = re.compile(r"  function fetchMetingPlaylist\(playlistId, platform, callback\) \{.*?\n  function normalizeMetingSong\(song\) \{", re.S)
if not pattern.search(s):
    raise SystemExit('missing pattern: fetchMetingPlaylist block')

replacement = r'''  function extractPlaylistDisplayName(data) {
    if (!data || typeof data !== 'object') return '';
    var candidates = [
      data.playlistName,
      data.name,
      data.title,
      data.dissname,
      data.playlist && (data.playlist.name || data.playlist.title || data.playlist.dissname),
      data.data && (data.data.playlistName || data.data.name || data.data.title || data.data.dissname),
      data.data && data.data.playlist && (data.data.playlist.name || data.data.playlist.title || data.data.playlist.dissname),
      data.result && (data.result.playlistName || data.result.name || data.result.title || data.result.dissname),
      data.result && data.result.playlist && (data.result.playlist.name || data.result.playlist.title || data.result.playlist.dissname)
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (typeof candidates[i] === 'string' && candidates[i].trim()) return candidates[i].trim();
    }
    return '';
  }

  function fetchPlaylistDisplayName(playlistId, platform) {
    var PROXY = 'https://music-proxy-3e4.pages.dev/api/';
    var endpoint = platform === 'qq' ? 'qq-playlist' : 'netease-playlist';
    var fetchOpts = {};
    if (platform === 'netease') {
      var neCookie = '';
      try { neCookie = localStorage.getItem('netease_cookie') || ''; } catch(e) {}
      if (!neCookie && neCookieInput) neCookie = neCookieInput.value.trim();
      if (neCookie) {
        fetchOpts.method = 'POST';
        fetchOpts.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        fetchOpts.body = 'cookie=' + encodeURIComponent(neCookie);
      }
    }

    var lookup = fetch(PROXY + endpoint + '?id=' + encodeURIComponent(playlistId), fetchOpts)
      .then(function(response) {
        if (!response.ok) return '';
        return response.json();
      })
      .then(function(data) { return extractPlaylistDisplayName(data); })
      .catch(function() { return ''; });

    var timeout = new Promise(function(resolve) {
      setTimeout(function() { resolve(''); }, 1800);
    });
    return Promise.race([lookup, timeout]);
  }

  function fetchMetingPlaylist(playlistId, platform, callback) {
    var remoteNamePromise = fetchPlaylistDisplayName(playlistId, platform);
    var server = platform === 'qq' ? 'tencent' : 'netease';
    var url = METING_API + '?server=' + encodeURIComponent(server) + '&type=playlist&id=' + encodeURIComponent(playlistId) + '&br=2000';
    fetch(url).then(function(response) {
      if (!response.ok) throw new Error('Meting API HTTP ' + response.status);
      return response.json();
    }).then(function(data) {
      if (!Array.isArray(data) || !data.length) throw new Error('歌单为空或接口未返回歌曲');
      var tracks = data.map(normalizeMetingSong);
      return remoteNamePromise.then(function(remotePlaylistName) {
        callback(tracks, null, remotePlaylistName || '');
      });
    }).catch(function(error) {
      callback(null, 'Meting API 请求失败: ' + error.message, '');
    });
  }

  function normalizeMetingSong(song) {'''

s = pattern.sub(replacement, s, count=1)
p.write_text(s, encoding='utf-8')
print('patched', p)
