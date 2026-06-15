const express = require('express');
const https = require('https');
const http = require('http');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

app.options('*', (req, res) => { res.set(CORS); res.sendStatus(204); });

/* ---------- helpers ---------- */
function fetchJSON(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const opts = { hostname: u.hostname, path: u.pathname + u.search, headers: { 'User-Agent': 'Mozilla/5.0', ...headers } };
    mod.get(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('JSON parse error')); }
      });
    }).on('error', reject);
  });
}

function fetchJSONPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const bodyBuf = Buffer.from(body);
    const opts = {
      hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Content-Length': bodyBuf.length, ...headers },
    };
    const req = mod.request(opts, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

function guessType(p) {
  if (p.endsWith('.mp3')) return 'audio/mpeg';
  if (p.endsWith('.flac')) return 'audio/flac';
  if (p.endsWith('.m4a')) return 'audio/mp4';
  if (p.endsWith('.ogg')) return 'audio/ogg';
  return 'application/octet-stream';
}

/* ---------- QQ playlist ---------- */
app.get('/api/qq-playlist', async (req, res) => {
  res.set(CORS);
  const id = req.query.id;
  if (!id) return res.json({ error: 'missing id' });
  let songList = [];
  try {
    const j = await fetchJSON('https://c6.y.qq.com/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&new_format=1&disstid=' + id + '&format=json', { 'Referer': 'https://y.qq.com/' });
    songList = j?.cdlist?.[0]?.songlist || [];
  } catch(e) {}
  if (!songList.length) {
    try {
      const j2 = await fetchJSON('https://i.y.qq.com/qzone-music/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg?type=1&json=1&utf8=1&onlysong=0&disstid=' + id + '&format=json', { 'Referer': 'https://y.qq.com/' });
      songList = j2?.cdlist?.[0]?.songlist || [];
    } catch(e) {}
  }
  if (!songList.length) return res.json({ tracks: [], error: '歌单不存在或无法访问' });
  const tracks = songList.slice(0, 200).map(t => ({
    id: t.mid || String(t.id), songid: t.id,
    title: t.name || t.songname || '',
    artist: (t.singer || []).map(s => s.name).join(' / '),
    cover: t.album?.mid ? 'https://y.gtimg.cn/music/photo_new/T002R300x300M000' + t.album.mid + '.jpg' : '',
    mediaMid: t.file?.media_mid || t.mid || '',
  }));
  res.json({ tracks, total: songList.length });
});

/* ---------- QQ song URL (vkey with cookie auth) ---------- */
async function handleQQUrl(req, res) {
  res.set(CORS);
  const mids = req.query.mids;
  if (!mids) return res.json({ error: 'missing mids' });
  const midList = mids.split(',');
  const debug = req.query.debug === '1';
  let cookie = req.query.cookie || '';
  if (!cookie && req.body) cookie = req.body.cookie || '';

  let uin = '0', key = '';
  if (cookie) {
    const uinMatch = cookie.match(/(?:^|[\s;])uin=([^;\s]+)/) || cookie.match(/qqmusic_uin=([^;\s]+)/);
    const keyMatch = cookie.match(/qm_keyst=([^;\s]+)/) || cookie.match(/qqmusic_key=([^;\s]+)/);
    if (uinMatch) uin = uinMatch[1];
    if (keyMatch) key = keyMatch[1];
    if (!key && !cookie.includes('=')) key = cookie;
  }

  const guid = String(Math.floor(Math.random() * 9e9) + 1e9);
  const upstreamHeaders = {
    'Referer': 'https://y.qq.com/',
    'Origin': 'https://y.qq.com',
    'Accept': 'application/json, text/plain, */*',
  };
  if (cookie) {
    upstreamHeaders['Cookie'] = cookie.includes('=') ? cookie : ('qm_keyst=' + cookie);
  }

  const reqData = JSON.stringify({
    comm: { ct: 24, cv: 4747474, uin: Number(uin) || 0 },
    req_0: {
      module: 'vkey.GetVkeyServer', method: 'CgiGetVkey',
      param: {
        guid, songmid: midList, songtype: midList.map(() => 0),
        uin: String(uin), loginflag: key ? 1 : 0, platform: 'yqq',
      },
    },
  });
  const apiUrl = 'https://u.y.qq.com/cgi-bin/musicu.fcg?format=json&data=' + encodeURIComponent(reqData);
  let j;
  try { j = await fetchJSON(apiUrl, upstreamHeaders); } catch(e) { return res.json({ error: e.message }); }

  if (debug) {
    return res.json({
      strategy: 'scf_direct',
      parsedUin: uin, hasKey: !!key,
      cookieLength: cookie.length,
      cookiePreview: cookie ? cookie.slice(0, 120) + (cookie.length > 120 ? '...' : '') : '(none)',
      commUin: Number(uin) || 0, guid,
      reqCode: j?.req_0?.code,
      midurlinfo: (j?.req_0?.data?.midurlinfo || []).map(m => ({
        songmid: m.songmid, result: m.result, filename: m.filename, purl: m.purl ? m.purl.slice(0, 80) : ''
      })),
      sip: j?.req_0?.data?.sip,
      msg: j?.req_0?.data?.msg,
    });
  }

  const data = j?.req_0?.data || {};
  const sip = data.sip?.[0] || 'http://aqqmusic.tc.qq.com/';
  const urls = (data.midurlinfo || []).map(m => {
    const purl = m.purl || '';
    if (!purl && m.filename && key) return { mid: m.songmid, url: sip + m.filename };
    return { mid: m.songmid, url: purl ? (sip + purl) : '' };
  });
  res.json({ urls, authed: !!key });
}
app.post('/api/qq-url', handleQQUrl);
app.get('/api/qq-url', handleQQUrl);

/* ---------- NetEase playlist (with cookie support) ---------- */
async function handleNeteasePlaylist(req, res) {
  res.set(CORS);
  const id = req.query.id;
  if (!id) return res.json({ error: 'missing id' });
  let cookie = req.query.cookie || '';
  if (!cookie && req.body) cookie = req.body.cookie || '';
  const debug = req.query.debug === '1';

  const upstreamHeaders = {
    'Referer': 'https://music.163.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
  if (cookie) {
    upstreamHeaders['Cookie'] = cookie.includes('=') ? cookie : ('MUSIC_U=' + cookie);
  }

  let j = null;
  const apis = [
    'https://music.163.com/api/v6/playlist/detail?id=' + id + '&n=10000&s=0',
    'https://music.163.com/api/playlist/detail?id=' + id,
  ];

  for (const api of apis) {
    try {
      const result = await fetchJSON(api, upstreamHeaders);
      if (debug) {
        return res.json({
          debug: true,
          apiUsed: api,
          code: result?.code,
          msg: result?.message || result?.msg || '',
          hasCookie: !!cookie,
          cookiePreview: cookie ? cookie.slice(0, 80) + '...' : '(none)',
          hasPlaylist: !!result?.playlist,
          tracksCount: result?.playlist?.tracks?.length || 0,
          trackIdsCount: result?.playlist?.trackIds?.length || 0,
        });
      }
      if (result?.playlist?.tracks?.length > 0) { j = result; break; }
      // If we got trackIds but no tracks, try to get song details separately
      if (result?.playlist?.trackIds?.length > 0 && !result?.playlist?.tracks?.length) {
        const songIds = result.playlist.trackIds.slice(0, 200).map(t => t.id);
        try {
          const detailRes = await fetchJSON(
            'https://music.163.com/api/v3/song/detail?c=' + encodeURIComponent(JSON.stringify(songIds.map(id => ({id})))) + '&n=10000',
            upstreamHeaders
          );
          if (detailRes?.songs?.length > 0) {
            j = { playlist: { tracks: detailRes.songs, name: result.playlist.name } };
            break;
          }
        } catch(e) {}
      }
      j = null;
    } catch(e) { j = null; }
  }

  if (!j?.playlist?.tracks) return res.json({ tracks: [], error: '歌单不存在或无法访问（私密歌单需要提供网易云Cookie）' });
  const tracks = j.playlist.tracks.slice(0, 200).map(t => ({
    id: t.id, title: t.name,
    artist: (t.ar || []).map(a => a.name).join(' / '),
    cover: t.al?.picUrl ? t.al.picUrl + '?param=200y200' : '',
  }));
  res.json({ tracks, total: j.playlist.tracks.length, name: j.playlist.name || '' });
}
app.post('/api/netease-playlist', handleNeteasePlaylist);
app.get('/api/netease-playlist', handleNeteasePlaylist);

/* ---------- NetEase song URLs (with cookie support) ---------- */
async function handleNeteaseUrl(req, res) {
  res.set(CORS);
  const ids = req.query.ids;
  if (!ids) return res.json({ error: 'missing ids' });
  let cookie = req.query.cookie || '';
  if (!cookie && req.body) cookie = req.body.cookie || '';

  const upstreamHeaders = {
    'Referer': 'https://music.163.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };
  if (cookie) {
    upstreamHeaders['Cookie'] = cookie.includes('=') ? cookie : ('MUSIC_U=' + cookie);
  }

  try {
    const j = await fetchJSON('https://music.163.com/api/song/enhance/player/url/v1?ids=[' + ids + ']&level=exhigh&encodeType=mp3', upstreamHeaders);
    let urls = (j.data || []).map(d => ({ id: d.id, url: d.url || '' }));
    const missing = urls.filter(u => !u.url).map(u => u.id);
    if (missing.length > 0) {
      try {
        const j2 = await fetchJSON('https://music.163.com/api/song/enhance/player/url?ids=[' + missing.join(',') + ']&br=320000', upstreamHeaders);
        const fb = {};
        (j2.data || []).forEach(d => { if (d.url) fb[d.id] = d.url; });
        urls = urls.map(u => ({ id: u.id, url: u.url || fb[u.id] || '' }));
      } catch(e) {}
    }
    res.json({ urls });
  } catch(e) { res.json({ error: e.message }); }
}
app.post('/api/netease-url', handleNeteaseUrl);
app.get('/api/netease-url', handleNeteaseUrl);

/* ---------- Asset proxy ---------- */
app.get('/api/asset', (req, res) => {
  res.set(CORS);
  const path = req.query.path;
  if (!path) return res.status(400).json({ error: 'missing path' });
  const url = 'https://storage.sekai.best/sekai-jp-assets' + path;
  https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, upstream => {
    res.set('Content-Type', guessType(path));
    res.set('Cache-Control', 'public, max-age=31536000');
    res.set('Accept-Ranges', 'bytes');
    upstream.pipe(res);
  }).on('error', e => res.status(502).json({ error: e.message }));
});

/* ---------- Health check ---------- */
app.get('/', (req, res) => { res.set(CORS); res.json({ ok: true, msg: 'music-proxy SCF v2' }); });

/* ---------- Start ---------- */
const port = process.env.SCF_PORT || process.env.PORT || 9000;
app.listen(port, () => console.log('music-proxy-scf listening on', port));
module.exports = app;
