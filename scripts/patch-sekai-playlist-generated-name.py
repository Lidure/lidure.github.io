from pathlib import Path

p = Path('src/components/SekaiPlayer.astro')
s = p.read_text(encoding='utf-8')
old = """    var platformName = platform === 'netease' ? '网易云' : 'QQ音乐';
    var previousPlaylist = songs.find(function(s) { return s.playlistKey === playlistKey; });
    var resolvedName = playlistName || (previousPlaylist && previousPlaylist.playlistName) || remotePlaylistName || (platformName + '歌单 · ' + playlistId);"""
new = """    var platformName = platform === 'netease' ? '网易云' : 'QQ音乐';
    var generatedFallbackName = platformName + '歌单 · ' + playlistId;
    var previousPlaylist = songs.find(function(s) { return s.playlistKey === playlistKey; });
    var previousCustomName = previousPlaylist && previousPlaylist.playlistName !== generatedFallbackName
      ? previousPlaylist.playlistName
      : '';
    var resolvedName = playlistName || previousCustomName || remotePlaylistName || generatedFallbackName;"""
if old not in s:
    raise SystemExit('name-resolution block not found')
p.write_text(s.replace(old, new, 1), encoding='utf-8')
print('patched', p)
