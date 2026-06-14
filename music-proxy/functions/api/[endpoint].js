const UPSTREAM = 'https://storage.sekai.best/sekai-jp-assets';

/* ================================================================
 *  Main request handler
 * ================================================================ */
export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const endpoint = context.params.endpoint;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ---- Music asset caching ----
    if (endpoint === 'asset') {
      const path = searchParams.get('path');
      if (!path) return new Response(JSON.stringify({ error: 'missing path' }), { status: 400, headers: corsHeaders });

      const r2Key = 'assets' + path;
      const bucket = context.env.MUSIC_BUCKET;
      const rangeHeader = context.request.headers.get('Range');

      if (bucket && !rangeHeader) {
        const cached = await bucket.get(r2Key);
        if (cached) {
          const headers = new Headers(corsHeaders);
          headers.set('Content-Type', cached.httpMetadata?.contentType || guessType(path));
          headers.set('Cache-Control', 'public, max-age=31536000');
          headers.set('Accept-Ranges', 'bytes');
          headers.set('X-Cache', 'HIT');
          return new Response(cached.body, { headers });
        }
      }

      const upstreamUrl = UPSTREAM + path;
      const fetchHeaders = { 'User-Agent': 'Mozilla/5.0' };
      if (rangeHeader) fetchHeaders['Range'] = rangeHeader;
      const upstreamRes = await fetch(upstreamUrl, { headers: fetchHeaders });

      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        return new Response(JSON.stringify({ error: 'upstream ' + upstreamRes.status }), { status: upstreamRes.status, headers: corsHeaders });
      }

      const contentType = upstreamRes.headers.get('Content-Type') || guessType(path);
      if (bucket && !rangeHeader && upstreamRes.status === 200) {
        context.waitUntil(
          (async () => {
            try { await bucket.put(r2Key, upstreamRes.clone().body, { httpMetadata: { contentType } }); }
            catch (e) { console.error('R2 cache write failed:', e); }
          })()
        );
      }

      const responseHeaders = new Headers(corsHeaders);
      responseHeaders.set('Content-Type', contentType);
      responseHeaders.set('Accept-Ranges', 'bytes');
      responseHeaders.set('Cache-Control', 'public, max-age=31536000');
      responseHeaders.set('X-Cache', 'MISS');
      const contentRange = upstreamRes.headers.get('Content-Range');
      const contentLength = upstreamRes.headers.get('Content-Length');
      if (contentRange) responseHeaders.set('Content-Range', contentRange);
      if (contentLength) responseHeaders.set('Content-Length', contentLength);
      return new Response(upstreamRes.body, { status: upstreamRes.status, headers: responseHeaders });
    }

    // ---- NetEase playlist ----
    if (endpoint === 'netease-playlist') {
      const id = searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ error: 'missing id' }), { status: 400, headers: corsHeaders });
      const apis = [
        'https://music.163.com/api/v6/playlist/detail?id=' + id + '&n=10000',
        'https://music.163.com/api/playlist/detail?id=' + id,
      ];
      let j = null;
      for (const api of apis) {
        try {
          const r = await fetch(api, {
            headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'Referer': 'https://music.163.com/' },
          });
          j = await r.json();
          if (j.playlist && j.playlist.tracks && j.playlist.tracks.length > 0) break;
          j = null;
        } catch(e) { j = null; }
      }
      if (!j || !j.playlist || !j.playlist.tracks) {
        return new Response(JSON.stringify({ tracks: [], error: '歌单不存在或无法访问' }), { headers: corsHeaders });
      }
      const tracks = j.playlist.tracks.slice(0, 200).map(t => ({
        id: t.id, title: t.name,
        artist: (t.ar || []).map(a => a.name).join(' / '),
        cover: t.al?.picUrl ? t.al.picUrl + '?param=200y200' : '',
      }));
      return new Response(JSON.stringify({ tracks, total: j.playlist.tracks.length }), { headers: corsHeaders });
    }

    // ---- NetEase song URLs ----
    if (endpoint === 'netease-url') {
      const ids = searchParams.get('ids');
      if (!ids) return new Response(JSON.stringify({ error: 'missing ids' }), { status: 400, headers: corsHeaders });
      // Try multiple bitrate strategies
      const r = await fetch('https://music.163.com/api/song/enhance/player/url/v1?ids=[' + ids + ']&level=exhigh&encodeType=mp3', {
        headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'Referer': 'https://music.163.com/' },
      });
      const j = await r.json();
      let urls = (j.data || []).map(d => ({ id: d.id, url: d.url || '' }));
      // Fallback: try legacy API for songs that got null URLs
      const missingIds = urls.filter(u => !u.url).map(u => u.id);
      if (missingIds.length > 0) {
        try {
          const r2 = await fetch('https://music.163.com/api/song/enhance/player/url?ids=[' + missingIds.join(',') + ']&br=320000', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://music.163.com/' },
          });
          const j2 = await r2.json();
          const fallbackMap = {};
          (j2.data || []).forEach(d => { if (d.url) fallbackMap[d.id] = d.url; });
          urls = urls.map(u => ({ id: u.id, url: u.url || fallbackMap[u.id] || '' }));
        } catch(e) {}
      }
      return new Response(JSON.stringify({ urls }), { headers: corsHeaders });
    }

    // ---- QQ playlist (c6 API — confirmed working) ----
    if (endpoint === 'qq-playlist') {
      const id = searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ error: 'missing id' }), { status: 400, headers: corsHeaders });

      let songList = [];

      // Strategy 1: c6.y.qq.com (confirmed working for ID 3685995882)
      try {
        const r = await fetch('https://c6.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&new_format=1&disstid=' + id + '&format=json', {
          headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://y.qq.com/' },
        });
        const j = await r.json();
        songList = j?.cdlist?.[0]?.songlist || [];
      } catch(e) {}

      // Strategy 2: i.y.qq.com fallback
      if (!songList.length) {
        try {
          const r2 = await fetch('https://i.y.qq.com/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&disstid=' + id + '&format=json', {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://y.qq.com/' },
          });
          const j2 = await r2.json();
          songList = j2?.cdlist?.[0]?.songlist || [];
        } catch(e) {}
      }

      // Strategy 3: new u.y.qq.com API fallback
      if (!songList.length) {
        try {
          const reqData = JSON.stringify({
            comm: { cv: 4747474, ct: 24, format: 'json', inCharset: 'UTF-8', outCharset: 'UTF-8', uin: 0 },
            req_1: {
              module: 'music.srfDissInfo.aiDissInfo', method: 'uniform_get_Dissinfo',
              param: { disstid: Number(id), enc_host_uin: '', tag: 1, userinfo: 1, song_begin: 0, song_num: 200 },
            },
          });
          const r3 = await fetch('https://u.y.qq.com/cgi-bin/musics.fcg?format=json&data=' + encodeURIComponent(reqData), {
            headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://y.qq.com/' },
          });
          const j3 = await r3.json();
          songList = j3?.req_1?.data?.songlist || [];
        } catch(e) {}
      }

      if (!songList.length) {
        return new Response(JSON.stringify({ tracks: [], error: '歌单不存在或无法访问' }), { headers: corsHeaders });
      }

      const tracks = songList.slice(0, 200).map(t => ({
        id: t.mid || String(t.id),
        songid: t.id,
        title: t.name || t.songname || '',
        artist: (t.singer || []).map(s => s.name).join(' / '),
        cover: t.album?.mid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + t.album.mid + '.jpg' : '',
        mediaMid: t.file?.media_mid || t.mid || '',
      }));
      return new Response(JSON.stringify({ tracks, total: songList.length }), { headers: corsHeaders });
    }

    // ---- QQ song URL fetching (with cookie auth) ----
    if (endpoint === 'qq-url') {
      // Support both GET and POST (POST body for cookie to avoid encoding issues)
      const mids = searchParams.get('mids');
      if (!mids) return new Response(JSON.stringify({ error: 'missing mids' }), { status: 400, headers: corsHeaders });
      const midList = mids.split(',');
      const debug = searchParams.get('debug') === '1';

      let cookie = searchParams.get('cookie') || '';
      // Also accept cookie from POST body (avoids URL encoding issues)
      if (!cookie && context.request.method === 'POST') {
        try {
          const body = await context.request.text();
          const bodyParams = new URLSearchParams(body);
          cookie = bodyParams.get('cookie') || '';
        } catch(e) {}
      }

      // Parse uin and key from cookie (support both old and new field names)
      // Old: qqmusic_uin, qqmusic_key | New: uin, qm_keyst
      let uin = '0';
      let key = '';
      if (cookie) {
        // Try new field names first, then old
        const uinMatch = cookie.match(/(?:^|[\s;])uin=([^;\s]+)/) || cookie.match(/qqmusic_uin=([^;\s]+)/);
        const keyMatch = cookie.match(/qm_keyst=([^;\s]+)/) || cookie.match(/qqmusic_key=([^;\s]+)/);
        if (uinMatch) uin = uinMatch[1];
        if (keyMatch) key = keyMatch[1];
        if (!key && !cookie.includes('=')) key = cookie;
      }

      const guid = String(Math.floor(Math.random() * 9000000000) + 1000000000);

      const reqData = JSON.stringify({
        comm: { ct: 19, cv: 1845, uin: Number(uin) || 0 },
        req_0: {
          module: 'vkey.GetVkeyServer', method: 'CgiGetVkey',
          param: {
            guid: guid, songmid: midList, songtype: midList.map(() => 0),
            uin: uin, loginflag: key ? 1 : 0, platform: '20',
          },
        },
      });

      // Forward the FULL cookie to QQ Music (not just uin+key)
      const fetchHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Referer': 'https://y.qq.com/',
        'Origin': 'https://y.qq.com',
        'Accept': 'application/json, text/plain, */*',
      };
      if (cookie) {
        fetchHeaders['Cookie'] = cookie.includes('=') ? cookie : ('qm_keyst=' + cookie);
      }

      const apiUrl = 'https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=' + encodeURIComponent(reqData);
      const r = await fetch(apiUrl, { headers: fetchHeaders });
      let j = await r.json();
      let strategy = 'musicu_get';

      // If GET returned 104003 with filename but no purl, try POST with musics.fcg
      const hasFilename = j?.req_0?.data?.midurlinfo?.some(m => m.filename && !m.purl);
      if (hasFilename && key) {
        try {
          const postReqData = JSON.stringify({
            comm: { ct: 23, cv: 5070023, uin: Number(uin) || 0 },
            req_0: {
              module: 'vkey.GetVkeyServer', method: 'CgiGetVkey',
              param: {
                guid: guid, songmid: midList, songtype: midList.map(() => 0),
                uin: String(uin), loginflag: 1, platform: 'yqq',
                filename: midList.map(m => {
                  const info = j?.req_0?.data?.midurlinfo?.find(x => x.songmid === m);
                  return info?.filename || ('M500' + m + '.mp3');
                }),
              },
            },
          });
          const postHeaders = { ...fetchHeaders, 'Content-Type': 'application/x-www-form-urlencoded' };
          const r2 = await fetch('https://u.y.qq.com/cgi-bin/musics.fcg?format=json', {
            method: 'POST', headers: postHeaders,
            body: 'data=' + encodeURIComponent(postReqData),
          });
          const j2 = await r2.json();
          if (j2?.req_0?.data?.midurlinfo?.some(m => m.purl)) {
            j = j2;
            strategy = 'musics_post';
          }
        } catch(e) {}
      }

      if (debug) {
        return new Response(JSON.stringify({
          strategy: strategy,
          parsedUin: uin,
          hasKey: !!key,
          cookieLength: cookie.length,
          cookiePreview: cookie ? cookie.slice(0, 120) + (cookie.length > 120 ? '...' : '') : '(none)',
          commUin: Number(uin) || 0,
          guid: guid,
          reqCode: j?.req_0?.code,
          midurlinfo: (j?.req_0?.data?.midurlinfo || []).map(m => ({
            songmid: m.songmid, result: m.result, filename: m.filename, purl: m.purl ? m.purl.slice(0, 80) : ''
          })),
          sip: j?.req_0?.data?.sip,
          msg: j?.req_0?.data?.msg,
        }), { headers: corsHeaders });
      }

      const data = j?.req_0?.data || {};
      const sip = data.sip?.[0] || 'http://aqqmusic.tc.qq.com/';
      const midifList = data.midurlinfo || [];
      const urls = midifList.map(m => {
        const purl = m.purl || '';
        if (!purl && m.filename && key) {
          return { mid: m.songmid, url: sip + m.filename };
        }
        return { mid: m.songmid, url: purl ? (sip + purl) : '' };
      });
      return new Response(JSON.stringify({ urls, authed: !!key }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
}

function guessType(path) {
  if (path.endsWith('.mp3')) return 'audio/mpeg';
  if (path.endsWith('.flac')) return 'audio/flac';
  if (path.endsWith('.wav')) return 'audio/wav';
  if (path.endsWith('.ogg')) return 'audio/ogg';
  if (path.endsWith('.webp')) return 'image/webp';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.json')) return 'application/json';
  return 'application/octet-stream';
}
