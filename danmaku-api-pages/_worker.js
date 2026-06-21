/**
 * Danmaku + Moments API — Cloudflare Pages Advanced Mode Worker
 * Deploy to: danmaku-api.pages.dev
 * Bindings: DB (D1), BUCKET (R2), ALLOWED_ORIGINS (env var), ADMIN_TOKEN (env var)
 */

const MAX_TEXT_LENGTH = 60;
const MAX_TRACK_LENGTH = 160;
const MAX_LIMIT = 300;
const RATE_LIMIT_WINDOW_MS = 60000;
const RATE_LIMIT_MAX = 8;
const PUBLIC_WRITE_RATE_LIMIT_MAX = 6;

/* ===== Moments constants ===== */
const MOMENT_MAX_TEXT = 2000;
const MOMENT_MAX_IMAGES = 9;
const MOMENT_CATEGORIES = ['游戏', '音乐', '生活', '吐槽'];
const MOMENT_IMAGE_MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const GUEST_MESSAGE_MAX_TEXT = 800;
const COMMENT_MAX_TEXT = 500;
const USER_ID_MAX_LENGTH = 32;
const REACTION_EMOJIS = ['❤️', '😂', '😭', '👍', '👎', '✨', '🔥', '🥰', '👏', '😮', '🤔', '🎉', '💯', '😍', '😎', '🥺', '😡', '😴', '🙏', '💪', '🌟', '🍀', '🫶', '😆', '🤯', '😱', '😢', '🤣', '🤩', '🙌', '👌', '😋', '😇', '🤗', '😤', '😐', '😵', '😳', '🤓', '👀', '💔', '⚡', '🏆', '🎁', '🍻', '☕', '🌈', '💤'];
const COMMENT_REACTION_EMOJIS = REACTION_EMOJIS;
const MOMENT_REACTION_EMOJIS = REACTION_EMOJIS;

export default {
  async fetch(request, env) {
    try {
      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders(request, env) });
      }

      const url = new URL(request.url);

      /* --- Danmaku routes --- */
      if (url.pathname === '/api/danmaku') {
        if (request.method === 'GET') return handleDanmakuList(url, request, env);
        if (request.method === 'POST') return handleDanmakuCreate(request, env);
        if (request.method === 'DELETE') return handleDanmakuDelete(request, env);
        return json({ error: 'Method not allowed' }, 405, request, env);
      }

      /* --- Moments routes --- */
      if (url.pathname === '/api/moments') {
        if (request.method === 'GET') return handleMomentsList(url, request, env);
        if (request.method === 'POST') return requireAdmin(request, env, function() { return handleMomentsCreate(request, env); });
        if (request.method === 'PUT') return requireAdmin(request, env, function() { return handleMomentsUpdate(request, env); });
        if (request.method === 'DELETE') return requireAdmin(request, env, function() { return handleMomentsDelete(request, env); });
        return json({ error: 'Method not allowed' }, 405, request, env);
      }

      if (url.pathname === '/api/moments/upload') {
        if (request.method === 'POST') return requireAdmin(request, env, function() { return handleMomentsUpload(request, env); });
        return json({ error: 'Method not allowed' }, 405, request, env);
      }

      if (url.pathname === '/api/moment-reactions') {
        if (request.method === 'POST') return handleMomentReactionCreate(request, env);
        return json({ error: 'Method not allowed' }, 405, request, env);
      }

      if (url.pathname === '/api/messages') {
        if (request.method === 'GET') return handleMessagesList(url, request, env);
        if (request.method === 'POST') return handleMessagesCreate(request, env);
        return json({ error: 'Method not allowed' }, 405, request, env);
      }

      if (url.pathname === '/api/comments') {
        if (request.method === 'GET') return handleCommentsList(url, request, env);
        if (request.method === 'POST') return handleCommentsCreate(request, env);
        if (request.method === 'DELETE') return requireAdmin(request, env, function() { return handleCommentsDelete(request, env); });
        return json({ error: 'Method not allowed' }, 405, request, env);
      }

      if (url.pathname === '/api/comment-reactions') {
        if (request.method === 'POST') return handleCommentReactionCreate(request, env);
        return json({ error: 'Method not allowed' }, 405, request, env);
      }

      return json({ error: 'Not found' }, 404, request, env);
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', message: 'Unhandled error', error: String(error) }));
      return json({ error: 'Internal server error' }, 500, request, env);
    }
  }
};

/* ===========================
 *  Admin auth middleware
 * =========================== */
function requireAdmin(request, env, handler) {
  var adminToken = env.ADMIN_TOKEN || '';
  if (!adminToken) {
    return json({ error: 'Admin not configured' }, 503, request, env);
  }
  var auth = request.headers.get('Authorization') || '';
  var token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token || token !== adminToken) {
    return json({ error: 'Unauthorized' }, 401, request, env);
  }
  return handler();
}

/* ===========================
 *  Danmaku handlers (existing)
 * =========================== */
async function handleDanmakuList(url, request, env) {
  var track = normalizeTrack(url.searchParams.get('track'));
  if (!track) return json({ error: 'Missing track' }, 400, request, env);

  var since = Math.max(0, parseInt(url.searchParams.get('since') || '0', 10) || 0);
  var requestedLimit = parseInt(url.searchParams.get('limit') || String(MAX_LIMIT), 10);
  var limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : MAX_LIMIT));

  var result = await env.DB.prepare(
    'SELECT id, track, text, time, color, created_at FROM danmaku WHERE track = ? AND created_at > ? ORDER BY time ASC, created_at ASC LIMIT ?'
  ).bind(track, since, limit).all();

  return json({
    items: (result.results || []).map(toClientItem),
    now: Date.now()
  }, 200, request, env);
}

async function handleDanmakuCreate(request, env) {
  var contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Expected application/json' }, 415, request, env);
  }

  var body = await readJsonBody(request);
  var track = normalizeTrack(body.track);
  var text = normalizeText(body.text);
  var time = normalizeTime(body.time);
  var color = normalizeColor(body.color);

  if (!track || !text || time == null) {
    return json({ error: 'Invalid danmaku' }, 400, request, env);
  }

  var ipHash = await hashClient(request);
  var now = Date.now();
  var recent = await env.DB.prepare(
    'SELECT COUNT(*) AS count FROM danmaku WHERE ip_hash = ? AND created_at > ?'
  ).bind(ipHash, now - RATE_LIMIT_WINDOW_MS).first();

  if ((recent && recent.count || 0) >= RATE_LIMIT_MAX) {
    return json({ error: 'Too many danmaku' }, 429, request, env);
  }

  var item = {
    id: crypto.randomUUID(),
    track: track,
    text: text,
    time: time,
    color: color,
    createdAt: now
  };

  await env.DB.prepare(
    'INSERT INTO danmaku (id, track, text, time, color, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(item.id, item.track, item.text, item.time, item.color, ipHash, item.createdAt).run();

  return json({ item: item }, 201, request, env);
}

async function handleDanmakuDelete(request, env) {
  var contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Expected application/json' }, 415, request, env);
  }

  var body = await readJsonBody(request);
  var id = typeof body.id === 'string' ? body.id.trim() : '';
  var track = normalizeTrack(body.track);
  var text = normalizeText(body.text);

  if (!track && !id) {
    return json({ error: 'Missing id or track' }, 400, request, env);
  }

  if (id) {
    var existing = await env.DB.prepare(
      'SELECT id FROM danmaku WHERE id = ? LIMIT 1'
    ).bind(id).first();
    if (existing) {
      await env.DB.prepare('DELETE FROM danmaku WHERE id = ?').bind(id).run();
      return json({ deleted: true, byId: true }, 200, request, env);
    }
  }
  if (track && text) {
    await env.DB.prepare(
      'DELETE FROM danmaku WHERE track = ? AND text = ?'
    ).bind(track, text).run();
    return json({ deleted: true, byText: true }, 200, request, env);
  }

  return json({ deleted: false }, 404, request, env);
}

/* ===========================
 *  Moments handlers (NEW)
 * =========================== */
async function handleMomentsList(url, request, env) {
  var category = url.searchParams.get('category') || '';
  var limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '200', 10) || 200));

  var sql, stmt;
  if (category && MOMENT_CATEGORIES.indexOf(category) >= 0) {
    sql = 'SELECT id, date, category, text, link, images, created_at FROM moments WHERE category = ? ORDER BY date DESC, created_at DESC LIMIT ?';
    stmt = env.DB.prepare(sql).bind(category, limit);
  } else {
    sql = 'SELECT id, date, category, text, link, images, created_at FROM moments ORDER BY date DESC, created_at DESC LIMIT ?';
    stmt = env.DB.prepare(sql).bind(limit);
  }

  var result = await stmt.all();
  var items = (result.results || []).map(toMomentItem);
  await attachMomentReactions(env, items);

  return json({
    items: items,
    now: Date.now()
  }, 200, request, env);
}

async function handleMomentsCreate(request, env) {
  var contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Expected application/json' }, 415, request, env);
  }

  var body = await readJsonBody(request);
  var date = typeof body.date === 'string' ? body.date.trim() : '';
  var category = typeof body.category === 'string' ? body.category.trim() : '';
  var text = typeof body.text === 'string' ? body.text.trim() : '';
  var link = typeof body.link === 'string' ? body.link.trim() : '';
  var images = Array.isArray(body.images) ? body.images.filter(function(s) { return typeof s === 'string'; }).slice(0, MOMENT_MAX_IMAGES) : [];

  if (!date || !category || !text) {
    return json({ error: 'Missing required fields: date, category, text' }, 400, request, env);
  }
  if (MOMENT_CATEGORIES.indexOf(category) < 0) {
    return json({ error: 'Invalid category' }, 400, request, env);
  }
  if (text.length > MOMENT_MAX_TEXT) {
    text = text.slice(0, MOMENT_MAX_TEXT);
  }

  var id = crypto.randomUUID();
  var now = Date.now();
  var imagesJson = JSON.stringify(images);

  await env.DB.prepare(
    'INSERT INTO moments (id, date, category, text, link, images, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, date, category, text, link, imagesJson, now).run();

  return json({
    item: { id: id, date: date, category: category, text: text, link: link, images: images, createdAt: now }
  }, 201, request, env);
}

async function handleMomentsUpdate(request, env) {
  var contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Expected application/json' }, 415, request, env);
  }

  var body = await readJsonBody(request);
  var id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return json({ error: 'Missing id' }, 400, request, env);

  var existing = await env.DB.prepare('SELECT * FROM moments WHERE id = ? LIMIT 1').bind(id).first();
  if (!existing) return json({ error: 'Not found' }, 404, request, env);

  var date = typeof body.date === 'string' ? body.date.trim() : existing.date;
  var category = typeof body.category === 'string' ? body.category.trim() : existing.category;
  var text = typeof body.text === 'string' ? body.text.trim() : existing.text;
  var link = body.link !== undefined ? (typeof body.link === 'string' ? body.link.trim() : '') : (existing.link || '');
  var images = Array.isArray(body.images) ? body.images.filter(function(s) { return typeof s === 'string'; }).slice(0, MOMENT_MAX_IMAGES) : JSON.parse(existing.images || '[]');

  if (MOMENT_CATEGORIES.indexOf(category) < 0) {
    return json({ error: 'Invalid category' }, 400, request, env);
  }
  if (text.length > MOMENT_MAX_TEXT) text = text.slice(0, MOMENT_MAX_TEXT);

  var imagesJson = JSON.stringify(images);
  await env.DB.prepare(
    'UPDATE moments SET date = ?, category = ?, text = ?, link = ?, images = ? WHERE id = ?'
  ).bind(date, category, text, link, imagesJson, id).run();

  return json({
    item: { id: id, date: date, category: category, text: text, link: link, images: images }
  }, 200, request, env);
}

async function handleMomentsDelete(request, env) {
  var contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Expected application/json' }, 415, request, env);
  }

  var body = await readJsonBody(request);
  var id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return json({ error: 'Missing id' }, 400, request, env);

  var existing = await env.DB.prepare('SELECT id, images FROM moments WHERE id = ? LIMIT 1').bind(id).first();
  if (!existing) return json({ error: 'Not found' }, 404, request, env);

  // Delete associated images from R2
  if (existing.images && env.BUCKET) {
    try {
      var imgs = JSON.parse(existing.images);
      for (var i = 0; i < imgs.length; i++) {
        var src = imgs[i];
        if (typeof src === 'string' && src.indexOf('/moments/') >= 0) {
          var key = src.replace(/^.*\/moments\//, 'moments/');
          await env.BUCKET.delete(key);
        }
      }
    } catch (e) { /* ignore */ }
  }

  await env.DB.prepare('DELETE FROM moments WHERE id = ?').bind(id).run();
  return json({ deleted: true }, 200, request, env);
}

async function handleMomentReactionCreate(request, env) {
  var contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Expected application/json' }, 415, request, env);
  }

  var body = await readJsonBody(request);
  var momentId = typeof body.momentId === 'string' ? body.momentId.trim() : '';
  var emoji = typeof body.emoji === 'string' ? body.emoji.trim() : '';
  var previousEmoji = typeof body.previousEmoji === 'string' ? body.previousEmoji.trim() : '';
  if (!momentId || MOMENT_REACTION_EMOJIS.indexOf(emoji) < 0) {
    return json({ error: 'Missing momentId or invalid emoji' }, 400, request, env);
  }
  if (previousEmoji && MOMENT_REACTION_EMOJIS.indexOf(previousEmoji) < 0) {
    previousEmoji = '';
  }

  var exists = await env.DB.prepare('SELECT id FROM moments WHERE id = ? LIMIT 1').bind(momentId).first();
  if (!exists) return json({ error: 'Moment not found' }, 404, request, env);

  var ipHash = await hashClient(request);
  var selectedEmoji = '';

  if (previousEmoji === emoji) {
    await env.DB.prepare(
      'DELETE FROM moment_reactions WHERE moment_id = ? AND ip_hash = ?'
    ).bind(momentId, ipHash).run();
  } else {
    var now = Date.now();
    await env.DB.prepare(
      'DELETE FROM moment_reactions WHERE moment_id = ? AND ip_hash = ?'
    ).bind(momentId, ipHash).run();
    await env.DB.prepare(
      'INSERT INTO moment_reactions (moment_id, emoji, ip_hash, created_at) VALUES (?, ?, ?, ?)'
    ).bind(momentId, emoji, ipHash, now).run();
    selectedEmoji = emoji;
  }

  var counts = await getMomentReactionCounts(env, [momentId]);
  return json({ reactions: counts[momentId] || {}, selectedEmoji: selectedEmoji }, 200, request, env);
}

async function handleMomentsUpload(request, env) {
  if (!env.BUCKET) {
    return json({ error: 'R2 bucket not configured' }, 503, request, env);
  }

  var contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    return json({ error: 'Expected multipart/form-data' }, 415, request, env);
  }

  var formData = await request.formData();
  var file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return json({ error: 'Missing file field' }, 400, request, env);
  }

  // Validate file type
  var mimeType = file.type || 'image/png';
  if (!mimeType.startsWith('image/')) {
    return json({ error: 'Only image files allowed' }, 400, request, env);
  }

  // Validate size
  if (file.size > MOMENT_IMAGE_MAX_SIZE) {
    return json({ error: 'File too large (max 5MB)' }, 413, request, env);
  }

  // Generate unique filename
  var ext = mimeType.split('/')[1] || 'png';
  if (ext === 'jpeg') ext = 'jpg';
  var filename = Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  var key = 'moments/' + filename;

  // Upload to R2
  var arrayBuffer = await file.arrayBuffer();
  await env.BUCKET.put(key, arrayBuffer, {
    httpMetadata: { contentType: mimeType }
  });

  // Return the public URL path (assumes R2 is connected to a custom domain or we return the key)
  var imageUrl = '/moments/' + filename;

  return json({ url: imageUrl, key: key }, 201, request, env);
}

/* ===========================
 *  Guest messages + comments
 * =========================== */
async function handleMessagesList(url, request, env) {
  var limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10) || 50));
  var result = await env.DB.prepare(
    'SELECT id, user_id, text, created_at FROM guest_messages ORDER BY created_at DESC LIMIT ?'
  ).bind(limit).all();

  var messages = (result.results || []).map(toGuestMessageItem);
  if (!messages.length) {
    return json({ items: [], now: Date.now() }, 200, request, env);
  }

  var ids = messages.map(function(item) { return item.id; });
  var placeholders = ids.map(function() { return '?'; }).join(',');
  var stmt = env.DB.prepare(
    'SELECT target_id, COUNT(*) AS count FROM comments WHERE target_type = ? AND target_id IN (' + placeholders + ') GROUP BY target_id'
  );
  var counts = await stmt.bind(...['message'].concat(ids)).all();
  var countMap = {};
  (counts.results || []).forEach(function(row) { countMap[row.target_id] = row.count || 0; });
  messages.forEach(function(item) { item.commentCount = countMap[item.id] || 0; });

  return json({ items: messages, now: Date.now() }, 200, request, env);
}

async function handleMessagesCreate(request, env) {
  var contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Expected application/json' }, 415, request, env);
  }

  var body = await readJsonBody(request);
  var userId = normalizeUserId(body.userId);
  var text = normalizePublicText(body.text, GUEST_MESSAGE_MAX_TEXT);
  if (!userId || !text) return json({ error: 'Missing userId or text' }, 400, request, env);

  var ipHash = await hashClient(request);
  var now = Date.now();
  var limited = await isPublicWriteLimited(env, ipHash, now, 'guest_messages');
  if (limited) return json({ error: 'Too many messages' }, 429, request, env);

  var item = {
    id: crypto.randomUUID(),
    userId: userId,
    text: text,
    createdAt: now,
    commentCount: 0
  };

  await env.DB.prepare(
    'INSERT INTO guest_messages (id, user_id, text, ip_hash, created_at) VALUES (?, ?, ?, ?, ?)'
  ).bind(item.id, item.userId, item.text, ipHash, item.createdAt).run();

  return json({ item: item }, 201, request, env);
}

async function handleCommentsList(url, request, env) {
  var targetType = normalizeTargetType(url.searchParams.get('targetType'));
  var targetId = typeof url.searchParams.get('targetId') === 'string' ? url.searchParams.get('targetId').trim() : '';
  if (!targetType || !targetId) return json({ error: 'Missing targetType or targetId' }, 400, request, env);

  var limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '80', 10) || 80));
  var result = await env.DB.prepare(
    'SELECT id, target_type, target_id, user_id, text, created_at FROM comments WHERE target_type = ? AND target_id = ? ORDER BY created_at ASC LIMIT ?'
  ).bind(targetType, targetId, limit).all();

  var comments = (result.results || []).map(toCommentItem);
  await attachCommentReactions(env, comments);

  return json({
    items: comments,
    now: Date.now()
  }, 200, request, env);
}

async function handleCommentsCreate(request, env) {
  var contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Expected application/json' }, 415, request, env);
  }

  var body = await readJsonBody(request);
  var targetType = normalizeTargetType(body.targetType);
  var targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';
  var userId = normalizeUserId(body.userId);
  var text = normalizePublicText(body.text, COMMENT_MAX_TEXT);
  if (!targetType || !targetId || !userId || !text) {
    return json({ error: 'Missing targetType, targetId, userId or text' }, 400, request, env);
  }

  var exists = await targetExists(env, targetType, targetId);
  if (!exists) return json({ error: 'Target not found' }, 404, request, env);

  var ipHash = await hashClient(request);
  var now = Date.now();
  var limited = await isPublicWriteLimited(env, ipHash, now, 'comments');
  if (limited) return json({ error: 'Too many comments' }, 429, request, env);

  var item = {
    id: crypto.randomUUID(),
    targetType: targetType,
    targetId: targetId,
    userId: userId,
    text: text,
    createdAt: now
  };

  await env.DB.prepare(
    'INSERT INTO comments (id, target_type, target_id, user_id, text, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(item.id, item.targetType, item.targetId, item.userId, item.text, ipHash, item.createdAt).run();

  return json({ item: item }, 201, request, env);
}

async function handleCommentsDelete(request, env) {
  var contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Expected application/json' }, 415, request, env);
  }

  var body = await readJsonBody(request);
  var id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) return json({ error: 'Missing id' }, 400, request, env);

  var existing = await env.DB.prepare('SELECT id FROM comments WHERE id = ? LIMIT 1').bind(id).first();
  if (!existing) return json({ error: 'Comment not found' }, 404, request, env);

  await env.DB.prepare('DELETE FROM comment_reactions WHERE comment_id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM comments WHERE id = ?').bind(id).run();
  return json({ deleted: true }, 200, request, env);
}

async function handleCommentReactionCreate(request, env) {
  var contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return json({ error: 'Expected application/json' }, 415, request, env);
  }

  var body = await readJsonBody(request);
  var commentId = typeof body.commentId === 'string' ? body.commentId.trim() : '';
  var emoji = typeof body.emoji === 'string' ? body.emoji.trim() : '';
  var previousEmoji = typeof body.previousEmoji === 'string' ? body.previousEmoji.trim() : '';
  if (!commentId || COMMENT_REACTION_EMOJIS.indexOf(emoji) < 0) {
    return json({ error: 'Missing commentId or invalid emoji' }, 400, request, env);
  }
  if (previousEmoji && COMMENT_REACTION_EMOJIS.indexOf(previousEmoji) < 0) {
    previousEmoji = '';
  }

  var exists = await env.DB.prepare('SELECT id FROM comments WHERE id = ? LIMIT 1').bind(commentId).first();
  if (!exists) return json({ error: 'Comment not found' }, 404, request, env);

  var ipHash = await hashClient(request);
  var selectedEmoji = '';

  if (previousEmoji === emoji) {
    await env.DB.prepare(
      'DELETE FROM comment_reactions WHERE comment_id = ? AND ip_hash = ?'
    ).bind(commentId, ipHash).run();
  } else {
    var now = Date.now();
    await env.DB.prepare(
      'DELETE FROM comment_reactions WHERE comment_id = ? AND ip_hash = ?'
    ).bind(commentId, ipHash).run();
    await env.DB.prepare(
      'INSERT INTO comment_reactions (comment_id, emoji, ip_hash, created_at) VALUES (?, ?, ?, ?)'
    ).bind(commentId, emoji, ipHash, now).run();
    selectedEmoji = emoji;
  }

  var counts = await getCommentReactionCounts(env, [commentId]);
  return json({ reactions: counts[commentId] || {}, selectedEmoji: selectedEmoji }, 200, request, env);
}

/* ===========================
 *  Helpers (shared)
 * =========================== */
async function readJsonBody(request) {
  try {
    var body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  } catch (e) {
    return {};
  }
}

function normalizeTrack(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_TRACK_LENGTH) : '';
}

function normalizeText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT_LENGTH) : '';
}

function normalizeTime(value) {
  var time = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(time) || time < 0 || time > 60 * 60 * 6) return null;
  return Math.round(time * 100) / 100;
}

function normalizeColor(value) {
  if (typeof value !== 'string') return null;
  var color = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : null;
}

function normalizeUserId(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, USER_ID_MAX_LENGTH);
}

function normalizePublicText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().slice(0, maxLength);
}

function normalizeTargetType(value) {
  return value === 'moment' || value === 'message' ? value : '';
}

async function isPublicWriteLimited(env, ipHash, now, tableName) {
  var sql = tableName === 'comments'
    ? 'SELECT COUNT(*) AS count FROM comments WHERE ip_hash = ? AND created_at > ?'
    : 'SELECT COUNT(*) AS count FROM guest_messages WHERE ip_hash = ? AND created_at > ?';
  var recent = await env.DB.prepare(sql).bind(ipHash, now - RATE_LIMIT_WINDOW_MS).first();
  return (recent && recent.count || 0) >= PUBLIC_WRITE_RATE_LIMIT_MAX;
}

async function targetExists(env, targetType, targetId) {
  var tableName = targetType === 'moment' ? 'moments' : 'guest_messages';
  var sql = tableName === 'moments'
    ? 'SELECT id FROM moments WHERE id = ? LIMIT 1'
    : 'SELECT id FROM guest_messages WHERE id = ? LIMIT 1';
  return !!(await env.DB.prepare(sql).bind(targetId).first());
}

async function hashClient(request) {
  var ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  var ua = request.headers.get('User-Agent') || '';
  var data = new TextEncoder().encode(ip + '|' + ua);
  var digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), function(byte) { return byte.toString(16).padStart(2, '0'); }).join('');
}

function toClientItem(row) {
  return {
    id: row.id,
    track: row.track,
    text: row.text,
    time: row.time,
    color: row.color || undefined,
    createdAt: row.created_at
  };
}

function toMomentItem(row) {
  var images = [];
  try { images = JSON.parse(row.images || '[]'); } catch (e) {}
  return {
    id: row.id,
    date: row.date,
    category: row.category,
    text: row.text,
    link: row.link || undefined,
    images: images,
    createdAt: row.created_at,
    reactions: {}
  };
}

function toGuestMessageItem(row) {
  return {
    id: row.id,
    userId: row.user_id,
    text: row.text,
    createdAt: row.created_at,
    commentCount: 0
  };
}

function toCommentItem(row) {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    userId: row.user_id,
    text: row.text,
    createdAt: row.created_at,
    reactions: {}
  };
}

async function attachCommentReactions(env, comments) {
  if (!comments.length) return;
  var ids = comments.map(function(comment) { return comment.id; });
  var counts = await getCommentReactionCounts(env, ids);
  comments.forEach(function(comment) {
    comment.reactions = counts[comment.id] || {};
  });
}

async function getCommentReactionCounts(env, commentIds) {
  if (!commentIds.length) return {};
  var placeholders = commentIds.map(function() { return '?'; }).join(',');
  var result = await env.DB.prepare(
    'SELECT comment_id, emoji, COUNT(*) AS count FROM comment_reactions WHERE comment_id IN (' + placeholders + ') GROUP BY comment_id, emoji'
  ).bind(...commentIds).all();
  var counts = {};
  (result.results || []).forEach(function(row) {
    if (!counts[row.comment_id]) counts[row.comment_id] = {};
    counts[row.comment_id][row.emoji] = row.count || 0;
  });
  return counts;
}

async function attachMomentReactions(env, moments) {
  if (!moments.length) return;
  var ids = moments.map(function(moment) { return moment.id; });
  var counts = await getMomentReactionCounts(env, ids);
  moments.forEach(function(moment) {
    moment.reactions = counts[moment.id] || {};
  });
}

async function getMomentReactionCounts(env, momentIds) {
  if (!momentIds.length) return {};
  var placeholders = momentIds.map(function() { return '?'; }).join(',');
  var result = await env.DB.prepare(
    'SELECT moment_id, emoji, COUNT(*) AS count FROM moment_reactions WHERE moment_id IN (' + placeholders + ') GROUP BY moment_id, emoji'
  ).bind(...momentIds).all();
  var counts = {};
  (result.results || []).forEach(function(row) {
    if (!counts[row.moment_id]) counts[row.moment_id] = {};
    counts[row.moment_id][row.emoji] = row.count || 0;
  });
  return counts;
}

function corsHeaders(request, env) {
  var headers = new Headers();
  var origin = request.headers.get('Origin') || '';
  var allowedOrigins = (env.ALLOWED_ORIGINS || env.ALLOWED_ORIGIN || '*')
    .split(',')
    .map(function(v) { return v.trim(); })
    .filter(Boolean);
  var allowAll = allowedOrigins.indexOf('*') >= 0;
  var fallbackOrigin = allowedOrigins[0] || '*';
  headers.set('Access-Control-Allow-Origin', allowAll ? '*' : (origin && allowedOrigins.indexOf(origin) >= 0 ? origin : fallbackOrigin));
  headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  return headers;
}

function json(payload, status, request, env) {
  var headers = corsHeaders(request, env);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(payload), { status: status, headers: headers });
}
