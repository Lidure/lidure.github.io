const UPSTREAM = 'https://storage.sekai.best/sekai-jp-assets';

/* ================================================================
 *  Compact MD5 (needed for QQ Music API sign)
 * ================================================================ */
function md5(string) {
  function rh(n) {
    var j, s = '';
    for (j = 0; j <= 3; j++) s += String.fromCharCode((n >> (j * 8 + 4)) & 0x0f, (n >> (j * 8)) & 0x0f);
    return s;
  }
  function ad(x, y) { var l = (x & 0xffff) + (y & 0xffff); return (((x >> 16) + (y >> 16) + (l >> 16)) << 16) | (l & 0xffff); }
  function rl(n, c) { return (n << c) | (n >>> (32 - c)); }
  function cm(q, a, b, x, s, t) { return ad(rl(ad(ad(a, q), ad(x, t)), s), b); }
  function ff(a, b, c, d, x, s, t) { return cm((b & c) | ((~b) & d), a, b, x, s, t); }
  function gg(a, b, c, d, x, s, t) { return cm((b & d) | (c & (~d)), a, b, x, s, t); }
  function hh(a, b, c, d, x, s, t) { return cm(b ^ c ^ d, a, b, x, s, t); }
  function ii(a, b, c, d, x, s, t) { return cm(c ^ (b | (~d)), a, b, x, s, t); }
  function c2s(b) {
    var s = '', i;
    for (i = 0; i < b.length; i++) s += String.fromCharCode(b[i] & 0xff, (b[i] >> 8) & 0xff, (b[i] >> 16) & 0xff, (b[i] >> 24) & 0xff);
    return s;
  }
  function s2b(s) {
    var b = [], i, n = s.length;
    for (i = 0; i < n; i += 4) b.push(
      (s.charCodeAt(i) & 0xff) | ((s.charCodeAt(i + 1) & 0xff) << 8) |
      ((s.charCodeAt(i + 2) & 0xff) << 16) | ((s.charCodeAt(i + 3) & 0xff) << 24)
    );
    return b;
  }
  var n = string.length, state = [1732584193, -271733879, -1732584194, 271733878], i;
  var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  var blk = s2b(string + String.fromCharCode(0x80));
  var len = blk.length;
  for (i = 16; i < len; i += 16) {
    var a = state[0], b = state[1], c = state[2], d = state[3];
    a = ff(a, b, c, d, blk[i + 0], 7, -680876936); d = ff(d, a, b, c, blk[i + 1], 12, -389564586);
    c = ff(c, d, a, b, blk[i + 2], 17, 606105819); b = ff(b, c, d, a, blk[i + 3], 22, -1044525330);
    a = ff(a, b, c, d, blk[i + 4], 7, -176418897); d = ff(d, a, b, c, blk[i + 5], 12, 1200080426);
    c = ff(c, d, a, b, blk[i + 6], 17, -1473231341); b = ff(b, c, d, a, blk[i + 7], 22, -45705983);
    a = ff(a, b, c, d, blk[i + 8], 7, 1770035416); d = ff(d, a, b, c, blk[i + 9], 12, -1958414417);
    c = ff(c, d, a, b, blk[i + 10], 17, -42063); b = ff(b, c, d, a, blk[i + 11], 22, -1990404162);
    a = ff(a, b, c, d, blk[i + 12], 7, 1804603682); d = ff(d, a, b, c, blk[i + 13], 12, -40341101);
    c = ff(c, d, a, b, blk[i + 14], 17, -1502002290); b = ff(b, c, d, a, blk[i + 15], 22, 1236535329);
    a = gg(a, b, c, d, blk[i + 1], 5, -165796510); d = gg(d, a, b, c, blk[i + 6], 9, -1069501632);
    c = gg(c, d, a, b, blk[i + 11], 14, 643717713); b = gg(b, c, d, a, blk[i + 0], 20, -373897302);
    a = gg(a, b, c, d, blk[i + 5], 5, -701558691); d = gg(d, a, b, c, blk[i + 10], 9, 38016083);
    c = gg(c, d, a, b, blk[i + 15], 14, -660478335); b = gg(b, c, d, a, blk[i + 4], 20, -405537848);
    a = gg(a, b, c, d, blk[i + 9], 5, 568446438); d = gg(d, a, b, c, blk[i + 14], 9, -1019803690);
    c = gg(c, d, a, b, blk[i + 3], 14, -187363961); b = gg(b, c, d, a, blk[i + 8], 20, 1163531501);
    a = gg(a, b, c, d, blk[i + 13], 5, -1444681467); d = gg(d, a, b, c, blk[i + 2], 9, -51403784);
    c = gg(c, d, a, b, blk[i + 7], 14, 1735328473); b = gg(b, c, d, a, blk[i + 12], 20, -1926607734);
    a = hh(a, b, c, d, blk[i + 5], 4, -378558); d = hh(d, a, b, c, blk[i + 8], 11, -2022574463);
    c = hh(c, d, a, b, blk[i + 11], 16, 1839030562); b = hh(b, c, d, a, blk[i + 14], 23, -35309556);
    a = hh(a, b, c, d, blk[i + 1], 4, -1530992060); d = hh(d, a, b, c, blk[i + 4], 11, 1272893353);
    c = hh(c, d, a, b, blk[i + 7], 16, -155497632); b = hh(b, c, d, a, blk[i + 10], 23, -1094730640);
    a = hh(a, b, c, d, blk[i + 13], 4, 681279174); d = hh(d, a, b, c, blk[i + 0], 11, -358537222);
    c = hh(c, d, a, b, blk[i + 3], 16, -722521979); b = hh(b, c, d, a, blk[i + 6], 23, 76029189);
    a = hh(a, b, c, d, blk[i + 9], 4, -640364487); d = hh(d, a, b, c, blk[i + 12], 11, -421815835);
    c = hh(c, d, a, b, blk[i + 15], 16, 530742520); b = hh(b, c, d, a, blk[i + 2], 23, -995338651);
    a = ii(a, b, c, d, blk[i + 0], 6, -198630844); d = ii(d, a, b, c, blk[i + 7], 10, 1126891415);
    c = ii(c, d, a, b, blk[i + 14], 15, -1416354905); b = ii(b, c, d, a, blk[i + 5], 21, -57434055);
    a = ii(a, b, c, d, blk[i + 12], 6, 1700485571); d = ii(d, a, b, c, blk[i + 3], 10, -1894986606);
    c = ii(c, d, a, b, blk[i + 10], 15, -1051523); b = ii(b, c, d, a, blk[i + 1], 21, -2054922799);
    a = ii(a, b, c, d, blk[i + 8], 6, 1873313359); d = ii(d, a, b, c, blk[i + 15], 10, -30611744);
    c = ii(c, d, a, b, blk[i + 6], 15, -1560198380); b = ii(b, c, d, a, blk[i + 13], 21, 1309151649);
    a = ii(a, b, c, d, blk[i + 4], 6, -145523070); d = ii(d, a, b, c, blk[i + 11], 10, -1120210379);
    c = ii(c, d, a, b, blk[i + 2], 15, 718787259); b = ii(b, c, d, a, blk[i + 9], 21, -343485551);
    state[0] = ad(a, state[0]); state[1] = ad(b, state[1]); state[2] = ad(c, state[2]); state[3] = ad(d, state[3]);
  }
  // handle remaining bytes
  for (i = 0; i < 16; i++) tail[i] = 0;
  var rem = n % 64;
  if (rem >= 56) {
    // need extra block
    var blk2 = s2b(string);
    for (i = 0; i < Math.floor(rem / 4); i++) tail[i] = blk2[blk2.length - Math.floor(rem / 4) + i] || 0;
    if (rem % 4) tail[Math.floor(rem / 4)] = blk2[blk2.length - 1] || 0;
  }
  // simplified: handle last block inline
  var lastStart = Math.floor(n / 64) * 64;
  for (i = 0; i < 16; i++) tail[i] = 0;
  var lastBlock = s2b(string.substring(lastStart));
  for (i = 0; i < lastBlock.length; i++) tail[i] = lastBlock[i];
  tail[Math.floor((n - lastStart) / 4)] |= 0x80 << ((n - lastStart) % 4 * 8);
  tail[14] = n * 8;
  tail[15] = 0;
  var a2 = state[0], b2 = state[1], c2 = state[2], d2 = state[3];
  a2 = ff(a2, b2, c2, d2, tail[0], 7, -680876936); d2 = ff(d2, a2, b2, c2, tail[1], 12, -389564586);
  c2 = ff(c2, d2, a2, b2, tail[2], 17, 606105819); b2 = ff(b2, c2, d2, a2, tail[3], 22, -1044525330);
  a2 = ff(a2, b2, c2, d2, tail[4], 7, -176418897); d2 = ff(d2, a2, b2, c2, tail[5], 12, 1200080426);
  c2 = ff(c2, d2, a2, b2, tail[6], 17, -1473231341); b2 = ff(b2, c2, d2, a2, tail[7], 22, -45705983);
  a2 = ff(a2, b2, c2, d2, tail[8], 7, 1770035416); d2 = ff(d2, a2, b2, c2, tail[9], 12, -1958414417);
  c2 = ff(c2, d2, a2, b2, tail[10], 17, -42063); b2 = ff(b2, c2, d2, a2, tail[11], 22, -1990404162);
  a2 = ff(a2, b2, c2, d2, tail[12], 7, 1804603682); d2 = ff(d2, a2, b2, c2, tail[13], 12, -40341101);
  c2 = ff(c2, d2, a2, b2, tail[14], 17, -1502002290); b2 = ff(b2, c2, d2, a2, tail[15], 22, 1236535329);
  a2 = gg(a2, b2, c2, d2, tail[1], 5, -165796510); d2 = gg(d2, a2, b2, c2, tail[6], 9, -1069501632);
  c2 = gg(c2, d2, a2, b2, tail[11], 14, 643717713); b2 = gg(b2, c2, d2, a2, tail[0], 20, -373897302);
  a2 = gg(a2, b2, c2, d2, tail[5], 5, -701558691); d2 = gg(d2, a2, b2, c2, tail[10], 9, 38016083);
  c2 = gg(c2, d2, a2, b2, tail[15], 14, -660478335); b2 = gg(b2, c2, d2, a2, tail[4], 20, -405537848);
  a2 = gg(a2, b2, c2, d2, tail[9], 5, 568446438); d2 = gg(d2, a2, b2, c2, tail[14], 9, -1019803690);
  c2 = gg(c2, d2, a2, b2, tail[3], 14, -187363961); b2 = gg(b2, c2, d2, a2, tail[8], 20, 1163531501);
  a2 = gg(a2, b2, c2, d2, tail[13], 5, -1444681467); d2 = gg(d2, a2, b2, c2, tail[2], 9, -51403784);
  c2 = gg(c2, d2, a2, b2, tail[7], 14, 1735328473); b2 = gg(b2, c2, d2, a2, tail[12], 20, -1926607734);
  a2 = hh(a2, b2, c2, d2, tail[5], 4, -378558); d2 = hh(d2, a2, b2, c2, tail[8], 11, -2022574463);
  c2 = hh(c2, d2, a2, b2, tail[11], 16, 1839030562); b2 = hh(b2, c2, d2, a2, tail[14], 23, -35309556);
  a2 = hh(a2, b2, c2, d2, tail[1], 4, -1530992060); d2 = hh(d2, a2, b2, c2, tail[4], 11, 1272893353);
  c2 = hh(c2, d2, a2, b2, tail[7], 16, -155497632); b2 = hh(b2, c2, d2, a2, tail[10], 23, -1094730640);
  a2 = hh(a2, b2, c2, d2, tail[13], 4, 681279174); d2 = hh(d2, a2, b2, c2, tail[0], 11, -358537222);
  c2 = hh(c2, d2, a2, b2, tail[3], 16, -722521979); b2 = hh(b2, c2, d2, a2, tail[6], 23, 76029189);
  a2 = hh(a2, b2, c2, d2, tail[9], 4, -640364487); d2 = hh(d2, a2, b2, c2, tail[12], 11, -421815835);
  c2 = hh(c2, d2, a2, b2, tail[15], 16, 530742520); b2 = hh(b2, c2, d2, a2, tail[2], 23, -995338651);
  a2 = ii(a2, b2, c2, d2, tail[0], 6, -198630844); d2 = ii(d2, a2, b2, c2, tail[7], 10, 1126891415);
  c2 = ii(c2, d2, a2, b2, tail[14], 15, -1416354905); b2 = ii(b2, c2, d2, a2, tail[5], 21, -57434055);
  a2 = ii(a2, b2, c2, d2, tail[12], 6, 1700485571); d2 = ii(d2, a2, b2, c2, tail[3], 10, -1894986606);
  c2 = ii(c2, d2, a2, b2, tail[10], 15, -1051523); b2 = ii(b2, c2, d2, a2, tail[1], 21, -2054922799);
  a2 = ii(a2, b2, c2, d2, tail[8], 6, 1873313359); d2 = ii(d2, a2, b2, c2, tail[15], 10, -30611744);
  c2 = ii(c2, d2, a2, b2, tail[6], 15, -1560198380); b2 = ii(b2, c2, d2, a2, tail[13], 21, 1309151649);
  a2 = ii(a2, b2, c2, d2, tail[4], 6, -145523070); d2 = ii(d2, a2, b2, c2, tail[11], 10, -1120210379);
  c2 = ii(c2, d2, a2, b2, tail[2], 15, 718787259); b2 = ii(b2, c2, d2, a2, tail[9], 21, -343485551);
  state[0] = ad(a2, state[0]); state[1] = ad(b2, state[1]); state[2] = ad(c2, state[2]); state[3] = ad(d2, state[3]);
  return rh(state[0]) + rh(state[1]) + rh(state[2]) + rh(state[3]);
}

function qqSign(data) {
  var raw = 'CinnamonBun' + data + 'F(Zo6Ll9Vw';
  var hash = md5(raw);
  return 'zzb' + hash.toLowerCase();
}

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

    // ---- QQ song URL fetching ----
    if (endpoint === 'qq-url') {
      const mids = searchParams.get('mids');
      if (!mids) return new Response(JSON.stringify({ error: 'missing mids' }), { status: 400, headers: corsHeaders });
      const midList = mids.split(',');

      // Use musicu.fcg with req_0 (unsigned, confirmed returning code 0)
      const reqData = JSON.stringify({
        comm: { ct: 19, cv: 1845 },
        req_0: {
          module: 'vkey.GetVkeyServer', method: 'CgiGetVkey',
          param: {
            guid: '10000', songmid: midList, songtype: midList.map(() => 0),
            uin: '0', loginflag: 1, platform: '20',
          },
        },
      });

      const apiUrl = 'https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=' + encodeURIComponent(reqData);
      const r = await fetch(apiUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://y.qq.com/' },
      });
      const j = await r.json();

      const data = j?.req_0?.data || {};
      const sip = data.sip?.[0] || 'http://aqqmusic.tc.qq.com/';
      const midifList = data.midurlinfo || [];
      const urls = midifList.map(m => {
        const purl = m.purl || '';
        // If purl is empty but filename exists, construct URL (may not always work)
        if (!purl && m.filename) {
          return { mid: m.songmid, url: sip + m.filename };
        }
        return { mid: m.songmid, url: purl ? (sip + purl) : '' };
      });
      return new Response(JSON.stringify({ urls }), { headers: corsHeaders });
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
