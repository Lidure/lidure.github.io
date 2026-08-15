import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../dist/${path}`, import.meta.url), 'utf8');
const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('search embeds parseable post data without a runtime jsonData reference', () => {
  const html = read('search/index.html');
  assert.doesNotMatch(html, /\$\{jsonData\}/);

  const match = html.match(
    /<script id="__SEARCH_DATA" type="application\/json">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, 'search data script should be present');

  const posts = JSON.parse(match[1]);
  assert.ok(posts.some((post) => post.title.includes('光流')));
});

test('public URLs use the final domain and include social metadata', () => {
  const sitemap = read('sitemap-index.xml');
  const home = read('index.html');

  assert.match(sitemap, /https:\/\/lidure\.xyz\/sitemap-0\.xml/);
  assert.match(home, /rel="canonical" href="https:\/\/lidure\.xyz\/"/);
  assert.match(home, /property="og:title"/);
});

test('source configuration uses final public domains and no stale publishing defaults', () => {
  const files = [
    'astro.config.mjs',
    'src/layouts/BaseLayout.astro',
    'src/pages/rss.xml.ts',
    'src/lib/moments-api.ts',
    'src/lib/public-interactions.ts',
    'src/pages/moments.astro',
    'src/pages/player.astro',
    'danmaku-api/wrangler.jsonc',
    '.github/workflows/deploy.yml',
    'AGENTS.md',
    'README.md',
    'danmaku-api/README.md',
  ];
  const combined = files.map((file) => readSource(file)).join('\n');
  const envExample = readSource('.env.example').replace(/\r\n/g, '\n').trim();

  assert.equal(
    envExample,
    [
      'PUBLIC_MOMENTS_API=https://api.lidure.xyz/api',
      'PUBLIC_MEDIA_BASE_URL=https://media.lidure.xyz',
    ].join('\n'),
  );
  assert.doesNotMatch(combined, /danmaku\.lidure22\.xyz|PUBLIC_R2_|PUBLIC_DANMAKU_API|lidure22\.xyz/);
  assert.match(combined, /https:\/\/lidure\.xyz/);
  assert.match(combined, /https:\/\/api\.lidure\.xyz\/api/);
  assert.match(combined, /https:\/\/media\.lidure\.xyz/);
  assert.match(combined, /PUBLIC_MOMENTS_API/);
  assert.match(combined, /PUBLIC_MEDIA_BASE_URL/);
});

test('optical-flow article has one h1 and no unparsed inline delimiters', () => {
  const html = read('posts/视觉光流公式推导与文献/index.html');
  const prose = html.match(/<div class="prose">([\s\S]*?)<\/div>\s*<section\b/)?.[1];

  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.ok(prose, 'article body should be present');
  assert.doesNotMatch(prose, /\\\(/);
});

test('optimized identity assets are used and remain small', () => {
  const home = read('index.html');

  assert.match(home, /\/p0-256\.webp/);
  assert.match(home, /\/favicon-32\.png/);
  assert.ok(statSync(new URL('../public/p0-256.webp', import.meta.url)).size < 100_000);
  assert.ok(statSync(new URL('../public/favicon-32.png', import.meta.url)).size < 50_000);
});

test('rendered background configuration starts with a static image', () => {
  const home = read('index.html');
  const match = home.match(/data-defaults="([^"]+)"/);
  assert.ok(match, 'background defaults should be rendered');

  const defaults = JSON.parse(
    match[1].replaceAll('&quot;', '"').replaceAll('&amp;', '&'),
  );
  assert.match(defaults[0], /\.(?:jpe?g|png|webp)$/i);
  assert.ok(defaults.some((source) => /\.mp4$/i.test(source)));
});

test('rendered moments management controls are hidden by default', () => {
  const html = read('moments/index.html');
  const publishButton = html.match(/<button\b[^>]*id="publish-toggle"[^>]*>/)?.[0];
  const publishPanel = html.match(/<div\b[^>]*id="publish-box"[^>]*>/)?.[0];

  assert.ok(publishButton, 'publish toggle should exist');
  assert.match(publishButton, /data-admin-only/);
  assert.match(publishButton, /\bhidden\b/);
  assert.ok(publishPanel, 'publish panel should exist');
  assert.match(publishPanel, /data-admin-only/);
  assert.match(publishPanel, /\bhidden\b/);
});

test('moments page exposes the API hook and local controls', () => {
  const moments = read('moments/index.html');

  assert.match(moments, /data-moments-api/);
  assert.match(moments, /id="moments-retry"/);
  assert.match(moments, /id="moments-login"/);
  assert.match(moments, /id="moments-session-status"/);
  assert.match(moments, /id="moments-logout"/);
  assert.doesNotMatch(moments, /id="token-input"|name="adminToken"|moments_admin_token|Authorization|Bearer|PUBLIC_R2_SECRET_ACCESS_KEY|AWS_SECRET/);
});

test('moments publishing UI accepts videos and requires selectable posters', () => {
  const moments = read('moments/index.html');
  const momentsPage = readSource('src/pages/moments.astro');
  const posterHelper = readSource('src/lib/video-poster.ts');

  assert.match(moments, /accept="image\/\*,video\/mp4,video\/webm"/);
  assert.match(moments, /id="video-poster-range"/);
  assert.match(moments, /id="manual-poster-input"/);
  assert.match(momentsPage, /captureVideoPoster/);
  assert.match(momentsPage, /kind:\s*'video'/);
  assert.match(momentsPage, /kind:\s*'poster'/);
  assert.match(momentsPage, /VIDEO_CORS_REQUIRED/);
  assert.match(momentsPage, /posterRequired|requiresPoster|posterBlob/);
  assert.match(posterHelper, /loadedmetadata/);
  assert.match(posterHelper, /seeked/);
  assert.match(posterHelper, /crossOrigin\s*=\s*'anonymous'/);
  assert.match(posterHelper, /SecurityError/);
  assert.match(posterHelper, /VIDEO_CORS_REQUIRED/);
});

test('moments video poster generation ignores stale async captures', () => {
  const momentsPage = readSource('src/pages/moments.astro');

  assert.match(momentsPage, /posterGenerationId\?:\s*number/);
  assert.match(momentsPage, /function invalidateVideoPosterGeneration/);
  assert.match(momentsPage, /function isCurrentVideoPosterGeneration/);
  assert.match(momentsPage, /selectedImages\.includes\(item\)/);
  assert.match(momentsPage, /!signal\.aborted/);
  assert.match(momentsPage, /const posterPreviewUrl = URL\.createObjectURL\(blob\)/);
  assert.match(
    momentsPage,
    /if \(!isCurrentVideoPosterGeneration\(item, generationId\)\) \{\s*URL\.revokeObjectURL\(posterPreviewUrl\);\s*return;\s*\}/s,
  );
  assert.match(momentsPage, /invalidateVideoPosterGeneration\(item\)/);
});

test('moments browser code uses the session API client for management', () => {
  const apiClient = readSource('src/lib/moments-api.ts');
  const r2Upload = readSource('src/lib/r2-upload.ts');
  const momentsPage = readSource('src/pages/moments.astro');
  const publicInteractions = readSource('src/lib/public-interactions.ts');

  for (const exportedName of [
    'fetchMoments',
    'login',
    'logout',
    'getSession',
    'uploadMomentMedia',
    'createMoment',
    'deleteMoment',
  ]) {
    assert.match(apiClient, new RegExp(`export async function ${exportedName}\\b`));
  }

  assert.match(apiClient, /PUBLIC_MOMENTS_API/);
  assert.match(apiClient, /credentials:\s*'include'/);
  assert.match(apiClient, /REQUEST_TIMEOUT_MS\s*=\s*8_000/);
  assert.match(apiClient, /AUTH_REQUIRED|AUTH_FORBIDDEN|PAYLOAD_TOO_LARGE|RATE_LIMITED|SERVER_ERROR|NETWORK_ERROR|TIMEOUT/);

  assert.match(r2Upload, /uploadMomentMedia/);
  assert.doesNotMatch(r2Upload, /adminToken|Authorization|Bearer|PUBLIC_R2_SECRET_ACCESS_KEY|AWS_SECRET/);

  assert.match(momentsPage, /from '\.\.\/lib\/moments-api'/);
  assert.doesNotMatch(momentsPage, /ADMIN_TOKEN_KEY|localStorage\.getItem\(['"]moments_admin_token|Authorization|Bearer/);

  assert.match(publicInteractions, /credentials:\s*'include'/);
  assert.match(publicInteractions, /AUTH_REQUIRED/);
  assert.doesNotMatch(publicInteractions, /PUBLIC_ADMIN_TOKEN_KEY|Authorization|Bearer|window\.prompt/);
});

test('moment delete controls follow the authenticated session', () => {
  const momentsPage = readSource('src/pages/moments.astro');

  assert.match(momentsPage, /adminMode\s*=\s*authenticated/);
  assert.match(momentsPage, /if \(currentMoments\.length > 0\) syncMoments\(currentMoments\)/);
  assert.doesNotMatch(momentsPage, /adminMode\s*=\s*new URLSearchParams\(window\.location\.search\)/);
});

test('guestbook exposes authenticated message deletion controls', () => {
  const messagesPage = readSource('src/pages/messages.astro');
  const interactions = readSource('src/lib/public-interactions.ts');
  const worker = readSource('danmaku-api/src/index.ts');

  assert.match(messagesPage, /getSession/);
  assert.match(messagesPage, /login/);
  assert.match(messagesPage, /deleteGuestMessage/);
  assert.match(messagesPage, /message-delete/);
  assert.match(interactions, /export async function deleteGuestMessage/);
  assert.match(worker, /request\.method === "DELETE"\) return handleMessagesDelete/);
  assert.match(worker, /async function handleMessagesDelete/);
  assert.match(worker, /requireSession\(request, env\)/);
});

test('hero slideshow uses explicit saved video posters instead of black canvas fallback', () => {
  const hero = readSource('src/components/HeroSlideshow.astro');

  assert.match(hero, /crossOrigin\s*=\s*'anonymous'/);
  assert.match(hero, /loadedmetadata/);
  assert.match(hero, /seeked/);
  assert.match(hero, /requestAnimationFrame/);
  assert.match(hero, /hero_settings/);
  assert.match(hero, /posters/);
  assert.match(hero, /poster-needed|VIDEO_CORS_REQUIRED|needs-poster/);
  assert.doesNotMatch(hero, /fillRect\([^)]*0,\s*0/);
});

test('moments api preserves distinct 401 auth worker codes', () => {
  const apiClient = readSource('src/lib/moments-api.ts');

  assert.match(apiClient, /'AUTH_REQUIRED'/);
  assert.match(apiClient, /'AUTH_INVALID'/);
  assert.match(apiClient, /'AUTH_EXPIRED'/);
  assert.match(
    apiClient,
    /workerCode === 'AUTH_REQUIRED'\s*\|\|\s*workerCode === 'AUTH_INVALID'\s*\|\|\s*workerCode === 'AUTH_EXPIRED'/,
  );
  assert.doesNotMatch(
    apiClient,
    /workerCode\.startsWith\('AUTH_'\)\s*\?\s*'AUTH_REQUIRED'/,
  );
});

test('Astro swaps clean page-scoped media while preserving persistent background media', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  const hero = readSource('src/components/HeroSlideshow.astro');

  assert.match(layout, /astro:before-swap/);
  assert.match(layout, /video\[data-page-media\], audio\[data-page-media\]/);
  assert.match(layout, /:not\(\[data-persistent-media\]\)/);
  assert.match(layout, /\.pause\(\)/);
  assert.match(layout, /removeAttribute\(['"]src['"]\)/);
  assert.match(layout, /\.load\(\)/);

  assert.match(hero, /id="slideshowVideo"[^>]*data-persistent-media/s);
  assert.match(hero, /id="media-preview-video"[^>]*data-page-media/s);
});

test('persistent layout scripts initialize through astro page-load with data guards', () => {
  const hero = readSource('src/components/HeroSlideshow.astro');
  const greeting = readSource('src/components/Greeting.astro');

  assert.match(hero, /function initHeroSlideshow/);
  assert.match(hero, /AbortController/);
  assert.match(hero, /dataset\.heroSlideshowInitialized/);
  assert.match(hero, /document\.addEventListener\(['"]astro:page-load['"], initHeroSlideshow\)/);
  assert.doesNotMatch(hero, /DOMContentLoaded/);

  assert.match(greeting, /function initGreeting/);
  assert.match(greeting, /dataset\.greetingInitialized/);
  assert.match(greeting, /window\.__greetingPageLoadBound/);
  assert.match(greeting, /if\s*\(!window\.__greetingPageLoadBound\)/);
  assert.match(greeting, /document\.addEventListener\(['"]astro:page-load['"], initGreeting\)/);
  assert.doesNotMatch(greeting, /DOMContentLoaded/);
});

test('layout mounts the sakura particle layer and uses visible flower glyphs', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  const particles = readSource('src/components/SekaiParticles.astro');

  assert.match(layout, /import SekaiParticles from ['"]\.\.\/components\/SekaiParticles\.astro['"]/);
  assert.match(layout, /<SekaiParticles\s*\/>/);
  assert.match(particles, /var emojis = \['🌸'/);
  assert.match(particles, /'🌺'\]/);
});

test('sakura particles use the approved flowers and natural drift parameters', () => {
  const particles = readSource('src/components/SekaiParticles.astro');

  assert.match(particles, /var emojis = \['\\u\{1F338\}', '\\u\{1F4AE\}', '❀'\]/);
  assert.match(particles, /windAmplitude/);
  assert.match(particles, /rotateStart/);
  assert.match(particles, /MAX_PETALS = 24/);
});

test('QQ playlist imports normalize ids and report unavailable audio links', () => {
  const player = readSource('src/components/SekaiPlayer.astro');

  assert.match(player, /var QQ_URL_BATCH_SIZE = 10/);
  assert.match(player, /u\.mid \|\| u\.songmid \|\| u\.song_mid \|\| u\.id/);
  assert.match(player, /authed/);
  assert.match(player, /qqCookieRow/);
  assert.match(player, /hasQQPlaybackCookie/);
  assert.match(player, /uin.*qm_keyst|qm_keyst.*uin/);
});

test('online playlist imports resolve audio URLs on demand', () => {
  const player = readSource('src/components/SekaiPlayer.astro');

  assert.match(player, /function fetchMetingSongUrl\(/);
  assert.match(player, /audioState/);
  assert.match(player, /fetchMetingSongUrl\(.*currentSong/);
  assert.doesNotMatch(player, /fetchQQUrls\(tracks/);
});

test('online playlist imports use a unified Meting-compatible adapter', () => {
  const player = readSource('src/components/SekaiPlayer.astro');

  assert.match(player, /PUBLIC_METING_API/);
  assert.match(player, /type=playlist/);
  assert.match(player, /server.*tencent/);
  assert.match(player, /song\.title \|\| song\.name/);
  assert.match(player, /song\.author \|\| song\.artist/);
  assert.match(readSource('.env.example'), /PUBLIC_METING_API=/);
  assert.doesNotMatch(player, /fetchQQPlaylist\(/);
  assert.doesNotMatch(player, /fetchNeteasePlaylist\(/);
});

test('Busuanzi refresh always supplies its JSONP endpoint after navigation', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');

  assert.match(layout, /bszCaller\.fetch\(busuanziRequestUrl/);
  assert.doesNotMatch(layout, /bszCaller\.fetch\(\)/);
  assert.match(layout, /jsonpCallback=BusuanziCallback/);
});

test('background video degrades safely on navigation visibility and reduced motion', () => {
  const hero = readSource('src/components/HeroSlideshow.astro');

  assert.match(hero, /prefersReducedMotion/);
  assert.match(hero, /visibilitychange/);
  assert.match(hero, /document\.hidden/);
  assert.match(hero, /videoEl\.pause\(\)/);
});

test('background videos recover playback when browsers emit ended despite loop', () => {
  const hero = readSource('src/components/HeroSlideshow.astro');

  assert.match(hero, /videoEl\.onended/);
  assert.match(hero, /videoEl\.currentTime\s*=\s*0/);
  assert.match(hero, /videoEl\.play\(\)/);
});

test('moments single-item query aliases the legacy images column', () => {
  const moments = readSource('danmaku-api/src/moments.ts');

  assert.match(moments, /m\.images AS legacy_images/);
});
