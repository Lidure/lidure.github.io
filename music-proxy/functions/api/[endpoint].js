const UPSTREAM = 'https://storage.sekai.best/sekai-jp-assets';
const CACHE_TTL = 3600; // 1 hour

export async function onRequest(context) {
  const { searchParams } = new URL(context.request.url);
  const endpoint = context.params.endpoint;

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Music asset caching: /api/asset?path=/music/long/xxx/xxx.mp3
    if (endpoint === 'asset') {
      const path = searchParams.get('path');
      if (!path) return new Response(JSON.stringify({ error: 'missing path' }), { status: 400, headers: corsHeaders });

      const r2Key = 'assets' + path;
      const bucket = context.env.MUSIC_BUCKET;

      // Forward Range header for audio seeking
      const rangeHeader = context.request.headers.get('Range');

      // Try R2 cache first (only for non-range requests)
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

      // Fetch from upstream (with Range support)
      const upstreamUrl = UPSTREAM + path;
      const fetchHeaders = { 'User-Agent': 'Mozilla/5.0' };
      if (rangeHeader) fetchHeaders['Range'] = rangeHeader;

      const upstreamRes = await fetch(upstreamUrl, { headers: fetchHeaders });

      if (!upstreamRes.ok && upstreamRes.status !== 206) {
        return new Response(JSON.stringify({ error: 'upstream ' + upstreamRes.status }), { status: upstreamRes.status, headers: corsHeaders });
      }

      const contentType = upstreamRes.headers.get('Content-Type') || guessType(path);

      // Cache full response to R2 in background (only non-range)
      if (bucket && !rangeHeader && upstreamRes.status === 200) {
        context.waitUntil(
          (async () => {
            try {
              await bucket.put(r2Key, upstreamRes.clone().body, {
                httpMetadata: { contentType },
              });
            } catch (e) {
              console.error('R2 cache write failed:', e);
            }
          })()
        );
      }

      const responseHeaders = new Headers(corsHeaders);
      responseHeaders.set('Content-Type', contentType);
      responseHeaders.set('Accept-Ranges', 'bytes');
      responseHeaders.set('Cache-Control', 'public, max-age=31536000');
      responseHeaders.set('X-Cache', 'MISS');

      // Forward Content-Range and Content-Length for range responses
      const contentRange = upstreamRes.headers.get('Content-Range');
      const contentLength = upstreamRes.headers.get('Content-Length');
      if (contentRange) responseHeaders.set('Content-Range', contentRange);
      if (contentLength) responseHeaders.set('Content-Length', contentLength);

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: responseHeaders,
      });
    }

    // NetEase playlist
    if (endpoint === 'netease-playlist') {
      const id = searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ error: 'missing id' }), { status: 400, headers: corsHeaders });
      const apis = [
        'https://music.163.com/api/playlist/detail?id=' + id,
        'https://music.163.com/api/v6/playlist/detail?id=' + id + '&n=100000',
      ];
      let j = null;
      for (const api of apis) {
        try {
          const r = await fetch(api, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://music.163.com/' } });
          j = await r.json();
          if (j.playlist && j.playlist.tracks && j.playlist.tracks.length > 0) break;
        } catch(e) {}
      }
      if (!j || !j.playlist || !j.playlist.tracks) {
        return new Response(JSON.stringify({ tracks: [], error: '歌单不存在或无法访问' }), { headers: corsHeaders });
      }
      const tracks = j.playlist.tracks.slice(0, 100).map(t => ({
        id: t.id, title: t.name, artist: (t.ar||[]).map(a=>a.name).join(' / '),
        cover: t.al?.picUrl ? t.al.picUrl+'?param=200y200' : '',
      }));
      return new Response(JSON.stringify({ tracks }), { headers: corsHeaders });
    }

    // NetEase song URLs
    if (endpoint === 'netease-url') {
      const ids = searchParams.get('ids');
      if (!ids) return new Response(JSON.stringify({ error: 'missing ids' }), { status: 400, headers: corsHeaders });
      const r = await fetch('https://music.163.com/api/song/enhance/player/url?ids=['+ids+']&br=320000', {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://music.163.com/' },
      });
      const j = await r.json();
      const urls = (j.data||[]).map(d=>({id:d.id, url:d.url}));
      return new Response(JSON.stringify({ urls }), { headers: corsHeaders });
    }

    // QQ playlist
    if (endpoint === 'qq-playlist') {
      const id = searchParams.get('id');
      if (!id) return new Response(JSON.stringify({ error: 'missing id' }), { status: 400, headers: corsHeaders });
      const apis = [
        'https://c.y.qq.com/v8/fcg-bin/fcg_v8_playlist_cp.fcg?disstid='+id+'&type=1&json=1&utf8=1&onlysong=0&new_format=1&format=json&platform=jqspa498&needNewCode=0',
        'https://c.y.qq.com/fcgi-bin/fcg_music_express_mobile3.fcg?format=json&cid=205361747&songlist=1&disstid='+id+'&onlysong=0',
      ];
      let sl = [];
      for (const api of apis) {
        try {
          const r = await fetch(api, { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://y.qq.com/' } });
          const j = await r.json();
          sl = j.data?.cdlist?.[0]?.songlist || j.data?.list || [];
          if (sl.length > 0) break;
        } catch(e) {}
      }
      const tracks = sl.slice(0,100).map(t=>({
        id: t.songid||t.mid, title: t.songname||t.name,
        artist: (t.singer||[]).map(s=>s.name).join(' / '),
        cover: t.album?.mid ? 'https://y.qq.com/music/photo_new/T002R300x300M000'+t.album.mid+'.jpg' : '',
      }));
      return new Response(JSON.stringify({ tracks }), { headers: corsHeaders });
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
