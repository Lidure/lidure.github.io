from pathlib import Path
import re

path = Path('src/components/SekaiPlayer.astro')
text = path.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'missing pattern: {label}')
    text = text.replace(old, new, 1)

# Import panel: optional playlist name + persistent playlist switcher.
replace_once(
'''        <div class="sekai-online-input-row">\n          <input id="sekaiPlaylistUrl" class="sekai-online-input" type="text" placeholder="粘贴歌单链接或ID" autocomplete="off" />\n          <button id="sekaiPlaylistFetch" class="sekai-online-fetch" type="button">导入</button>\n        </div>''',
'''        <div class="sekai-online-input-row sekai-playlist-name-row">\n          <input id="sekaiPlaylistName" class="sekai-online-input" type="text" placeholder="歌单名称（可选，默认自动命名）" autocomplete="off" />\n        </div>\n        <div class="sekai-online-input-row">\n          <input id="sekaiPlaylistUrl" class="sekai-online-input" type="text" placeholder="粘贴歌单链接或ID" autocomplete="off" />\n          <button id="sekaiPlaylistFetch" class="sekai-online-fetch" type="button">导入</button>\n        </div>''',
'online name input')

replace_once(
'''      <div class="sekai-playlist-label">\n        <span>播放列表</span>''',
'''      <div id="sekaiImportedPlaylists" class="sekai-imported-playlists" aria-label="已导入歌单"></div>\n\n      <div class="sekai-playlist-label">\n        <span>播放列表</span>''',
'imported playlist switcher')

# Compact chips matching the existing dark/glass player language.
replace_once(
'''/* ===== Online Import Panel ===== */''',
'''/* ===== Imported Playlist Switcher ===== */\n.sekai-imported-playlists {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 5px;\n  padding: 1px 2px 2px;\n  flex-shrink: 0;\n}\n.sekai-imported-playlists:empty { display: none; }\n:global(.sekai-imported-playlist-chip) {\n  display: inline-flex;\n  align-items: center;\n  min-width: 0;\n  border: 1px solid rgba(255,255,255,0.1);\n  border-radius: 9px;\n  background: rgba(255,255,255,0.045);\n  overflow: hidden;\n}\n:global(.sekai-imported-playlist-chip.active) {\n  border-color: rgba(30,216,255,0.32);\n  background: linear-gradient(135deg,rgba(30,216,255,0.12),rgba(255,93,168,0.1));\n}\n:global(.sekai-imported-playlist-select),\n:global(.sekai-imported-playlist-delete) {\n  border: 0;\n  background: transparent;\n  color: rgba(255,255,255,0.64);\n  font: inherit;\n  cursor: pointer;\n}\n:global(.sekai-imported-playlist-select) {\n  max-width: 158px;\n  padding: 6px 8px;\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n  font-size: .68rem;\n  font-weight: 700;\n}\n:global(.sekai-imported-playlist-chip.active .sekai-imported-playlist-select) { color: rgba(255,255,255,0.95); }\n:global(.sekai-imported-playlist-delete) {\n  align-self: stretch;\n  padding: 0 7px;\n  border-left: 1px solid rgba(255,255,255,0.08);\n  font-size: .8rem;\n}\n:global(.sekai-imported-playlist-delete:hover) { color: #ff7c9f; background: rgba(255,93,168,0.08); }\n\n/* ===== Online Import Panel ===== */''',
'playlist chip styles')

# State/filter variables.
replace_once(
'''  var query = '';\n  var tagFilter = 'all';\n  var savedState = readState();''',
'''  var query = '';\n  var tagFilter = 'all';\n  var activeImportedPlaylist = 'all';\n  var savedState = readState();''',
'active playlist state')

# Restore metadata. Old imports are grouped instead of discarded.
replace_once(
'''            onlineId: t.onlineId || null,\n            sourceUrl: t.sourceUrl || '',\n            audioState: t.sourceUrl ? 'ready' : 'unknown',''',
'''            onlineId: t.onlineId || null,\n            playlistKey: t.playlistKey || ('legacy_' + t.source),\n            playlistId: t.playlistId || '',\n            playlistName: t.playlistName || (t.source === 'netease' ? '旧版导入 · 网易云' : (t.source === 'qq' ? '旧版导入 · QQ音乐' : '旧版导入')),\n            sourceUrl: t.sourceUrl || '',\n            audioState: t.sourceUrl ? 'ready' : 'unknown',''',
'restore playlist metadata')

# Persist metadata with imported tracks.
replace_once(
'''          source: s.source,\n          onlineId: s.onlineId || null,\n          sourceUrl: s.sourceUrl || '' ''',
'''          source: s.source,\n          onlineId: s.onlineId || null,\n          playlistKey: s.playlistKey || '',\n          playlistId: s.playlistId || '',\n          playlistName: s.playlistName || '',\n          sourceUrl: s.sourceUrl || '' ''',
'persist playlist metadata')

# Filter by selected imported playlist and keep chip UI in sync.
replace_once(
'''    filteredSongs = songs.filter(function(song) {\n      var matchesTag = tagFilter === 'all' || song.tags.indexOf(tagFilter) >= 0;\n      var matchesQuery = !normalizedQuery || getSongSearchText(song).indexOf(normalizedQuery) >= 0;\n      return matchesTag && matchesQuery;\n    });\n    renderedCount = BATCH_SIZE;\n    renderPlaylist();''',
'''    filteredSongs = songs.filter(function(song) {\n      var matchesPlaylist = activeImportedPlaylist === 'all' || song.playlistKey === activeImportedPlaylist;\n      var matchesTag = tagFilter === 'all' || song.tags.indexOf(tagFilter) >= 0;\n      var matchesQuery = !normalizedQuery || getSongSearchText(song).indexOf(normalizedQuery) >= 0;\n      return matchesPlaylist && matchesTag && matchesQuery;\n    });\n    renderedCount = BATCH_SIZE;\n    renderImportedPlaylists();\n    renderPlaylist();''',
'playlist-aware filtering')

# DOM references for new controls.
replace_once(
'''  var playlistUrlInput = document.getElementById('sekaiPlaylistUrl');\n  var playlistFetchBtn = document.getElementById('sekaiPlaylistFetch');\n  var onlineStatus = document.getElementById('sekaiOnlineStatus');''',
'''  var playlistNameInput = document.getElementById('sekaiPlaylistName');\n  var playlistUrlInput = document.getElementById('sekaiPlaylistUrl');\n  var playlistFetchBtn = document.getElementById('sekaiPlaylistFetch');\n  var onlineStatus = document.getElementById('sekaiOnlineStatus');\n  var importedPlaylistsEl = document.getElementById('sekaiImportedPlaylists');''',
'playlist dom refs')

# Pass playlist identity/name through both platform imports.
replace_once(
'''      var playlistId = extractPlaylistId(raw, selectedPlatform);\n      if (!playlistId) { onlineStatus.textContent = '无法识别歌单ID，请检查输入'; onlineStatus.className = 'sekai-online-status error'; return; }\n\n      playlistFetchBtn.disabled = true;''',
'''      var playlistId = extractPlaylistId(raw, selectedPlatform);\n      if (!playlistId) { onlineStatus.textContent = '无法识别歌单ID，请检查输入'; onlineStatus.className = 'sekai-online-status error'; return; }\n      var playlistName = playlistNameInput ? playlistNameInput.value.trim() : '';\n\n      playlistFetchBtn.disabled = true;''',
'capture playlist name')

replace_once("          addOnlineTracks(tracks, 'netease');", "          addOnlineTracks(tracks, 'netease', playlistId, playlistName);", 'netease import args')
replace_once("          addOnlineTracks(tracks, 'qq');", "          addOnlineTracks(tracks, 'qq', playlistId, playlistName);", 'qq import args')

# Replace platform-overwriting import with playlist-identity update + management helpers.
pattern = re.compile(r"  function addOnlineTracks\(tracks, platform\) \{.*?\n  function deleteSong\(songId\) \{", re.S)
match = pattern.search(text)
if not match:
    raise SystemExit('missing pattern: addOnlineTracks block')
replacement = r'''  function getImportedPlaylistGroups() {
    var groups = {};
    songs.forEach(function(song) {
      if (!song.playlistKey) return;
      if (!groups[song.playlistKey]) {
        groups[song.playlistKey] = {
          key: song.playlistKey,
          name: song.playlistName || song.playlistKey,
          platform: song.source || '',
          count: 0
        };
      }
      groups[song.playlistKey].count++;
    });
    return Object.keys(groups).map(function(key) { return groups[key]; });
  }

  function renderImportedPlaylists() {
    if (!importedPlaylistsEl) return;
    importedPlaylistsEl.innerHTML = '';
    var groups = getImportedPlaylistGroups();
    if (!groups.length) {
      activeImportedPlaylist = 'all';
      return;
    }
    if (activeImportedPlaylist !== 'all' && !groups.some(function(group) { return group.key === activeImportedPlaylist; })) {
      activeImportedPlaylist = 'all';
    }

    var allChip = document.createElement('span');
    allChip.className = 'sekai-imported-playlist-chip' + (activeImportedPlaylist === 'all' ? ' active' : '');
    var allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'sekai-imported-playlist-select';
    allBtn.textContent = '全部';
    allBtn.addEventListener('click', function() {
      activeImportedPlaylist = 'all';
      applyFilters();
    });
    allChip.appendChild(allBtn);
    importedPlaylistsEl.appendChild(allChip);

    groups.forEach(function(group) {
      var chip = document.createElement('span');
      chip.className = 'sekai-imported-playlist-chip' + (activeImportedPlaylist === group.key ? ' active' : '');
      var select = document.createElement('button');
      select.type = 'button';
      select.className = 'sekai-imported-playlist-select';
      select.title = group.name + ' · ' + group.count + ' 首';
      select.textContent = group.name + ' · ' + group.count;
      select.addEventListener('click', function() {
        activeImportedPlaylist = group.key;
        applyFilters();
      });
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'sekai-imported-playlist-delete';
      remove.title = '删除歌单「' + group.name + '」';
      remove.setAttribute('aria-label', remove.title);
      remove.textContent = '×';
      remove.addEventListener('click', function(event) {
        event.stopPropagation();
        if (confirm('确定删除歌单「' + group.name + '」及其中 ' + group.count + ' 首歌曲？')) {
          deleteImportedPlaylist(group.key);
        }
      });
      chip.appendChild(select);
      chip.appendChild(remove);
      importedPlaylistsEl.appendChild(chip);
    });
  }

  function deleteImportedPlaylist(playlistKey) {
    if (!playlistKey) return;
    if (currentSong && currentSong.playlistKey === playlistKey) {
      audio.pause();
      currentSong = null;
      currentVocal = null;
      isPlaying = false;
      updateNowPlaying();
    }
    songs = songs.filter(function(s) { return s.playlistKey !== playlistKey; });
    if (activeImportedPlaylist === playlistKey) activeImportedPlaylist = 'all';
    applyFilters();
  }

  function addOnlineTracks(tracks, platform, playlistId, playlistName) {
    var added = 0, skipped = 0;
    var playlistKey = platform + ':' + playlistId;
    var platformName = platform === 'netease' ? '网易云' : 'QQ音乐';
    var resolvedName = playlistName || (platformName + '歌单 · ' + playlistId);
    var existed = songs.some(function(s) { return s.playlistKey === playlistKey; });

    // Re-importing the same playlist updates that playlist only. Other imported
    // playlists from the same platform remain untouched.
    songs = songs.filter(function(s) { return s.playlistKey !== playlistKey; });
    tracks.forEach(function(track) {
      var audioUrl = track.url || '';
      if (!audioUrl && platform !== 'qq') { skipped++; return; }
      songs.push({
        id: platform + '_' + playlistId + '_' + track.id,
        title: track.title,
        composer: track.artist || (platform === 'netease' ? '网易云音乐' : 'QQ音乐'),
        jacketBundle: track.cover || null,
        source: platform,
        tags: ['imported'],
        onlineId: track.id,
        playlistKey: playlistKey,
        playlistId: String(playlistId),
        playlistName: resolvedName,
        sourceUrl: audioUrl,
        audioState: audioUrl ? 'ready' : 'unknown',
        vocals: [{ id: platform + '_vocal', name: track.artist || '未知', sourceUrl: audioUrl }]
      });
      added++;
    });
    activeImportedPlaylist = playlistKey;
    applyFilters();
    if (playlistNameInput) playlistNameInput.value = '';

    var actionText = existed ? '已更新歌单「' + resolvedName + '」：' : '已导入歌单「' + resolvedName + '」：';
    if (platform === 'qq' && added > 0) {
      var noUrl = tracks.filter(function(t) { return !t.url; }).length;
      onlineStatus.textContent = actionText + added + ' 首' + (noUrl > 0 ? '（' + noUrl + ' 首暂无播放链接）' : '');
      onlineStatus.className = 'sekai-online-status';
    } else if (skipped > 0) {
      onlineStatus.textContent = actionText + added + ' 首，' + skipped + ' 首无版权/不可用已跳过';
      onlineStatus.className = 'sekai-online-status';
    } else {
      onlineStatus.textContent = actionText + added + ' 首';
      onlineStatus.className = 'sekai-online-status';
    }
  }

  function deleteSong(songId) {'''
text = text[:match.start()] + replacement + text[match.end():]

# Clearing all imports resets playlist filter too.
replace_once(
'''  function clearImported() {\n    songs = songs.filter(function(s) { return !s.source || s.source === 'sekai'; });''',
'''  function clearImported() {\n    songs = songs.filter(function(s) { return !s.source || s.source === 'sekai'; });\n    activeImportedPlaylist = 'all';''',
'clear playlist filter')

path.write_text(text, encoding='utf-8')
print('patched', path)
