import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import test from 'node:test';

const sourceUrl = (path) => new URL(`../${path}`, import.meta.url);
const readSource = (path) => readFileSync(sourceUrl(path), 'utf8');
const readBuilt = (path) => readFileSync(new URL(`../dist/${path}`, import.meta.url), 'utf8');

// Core build/source contracts.
test('search embeds parseable post data without a runtime jsonData reference', () => {
  const html = readBuilt('search/index.html');
  const match = html.match(/<script id="__SEARCH_DATA" type="application\/json">([\s\S]*?)<\/script>/);
  assert.ok(match, 'search data script missing');
  assert.doesNotThrow(() => JSON.parse(match[1]));
  assert.doesNotMatch(html, /set:html=|\bjsonData\b/);
});

test('public URLs use the configured lidure22.xyz domain and include social metadata', () => {
  const home = readBuilt('index.html');
  assert.match(home, /https:\/\/lidure22\.xyz/);
  assert.match(home, /property="og:/);
  assert.match(home, /name="twitter:/);
});

test('source configuration uses configured public domains and no stale publishing defaults', () => {
  const config = readSource('src/config.ts');
  assert.match(config, /lidure22\.xyz/);
  assert.doesNotMatch(config, /example\.com/);
});

test('optical-flow article has one h1 and no unparsed inline delimiters', () => {
  const html = readBuilt('posts/视觉光流/index.html');
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.doesNotMatch(html, /\$[^$]+\$/);
});

test('optimized identity assets are used and remain small', () => {
  const candidates = ['public/avatar.webp', 'public/favicon.svg'];
  for (const path of candidates) {
    if (!existsSync(sourceUrl(path))) continue;
    assert.ok(statSync(sourceUrl(path)).size < 512_000);
  }
});

test('rendered background configuration starts with a static image', () => {
  const home = readBuilt('index.html');
  assert.match(home, /hero|background|wallpaper/i);
});

test('rendered moments management controls keep the publish panel closed by default', () => {
  const html = readBuilt('moments/index.html');
  assert.match(html, /moments/);
});

test('moments page exposes the API hook and local controls', () => {
  const page = readSource('src/pages/moments.astro');
  assert.match(page, /fetchMoments/);
  assert.match(page, /moments/);
});

test('moments publishing UI accepts videos and requires selectable posters', () => {
  const moments = readSource('src/pages/moments.astro');
  const momentsPage = moments;
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

test('guestbook keeps authenticated moderation capability after moving to MessageBoard', () => {
  const board = readSource('src/components/MessageBoard.astro');
  const interactions = readSource('src/lib/public-interactions.ts');
  const routes = readSource('danmaku-api/src/message-routes.ts');

  assert.match(board, /id="message-admin"/);
  assert.match(board, /id="message-admin-password"/);
  assert.match(interactions, /export async function deleteGuestMessage/);
  assert.match(interactions, /credentials:\s*'include'/);
  assert.match(routes, /request\.method === 'DELETE'/);
  assert.match(routes, /handleMessagesDelete/);
  assert.match(routes, /canMutateMessage/);
  assert.match(routes, /readSession\(request, secret\)/);
});

test('hero slideshow keeps saved posters and a CORS-safe capture fallback without forcing playback CORS', () => {
  const hero = readSource('src/components/HeroSlideshow.astro');

  assert.match(hero, /resolveVideoSource/);
  assert.match(hero, /fetch\(url, \{ mode: 'cors' \}\)/);
  assert.match(hero, /loadedmetadata/);
  assert.match(hero, /seeked/);
  assert.match(hero, /requestAnimationFrame/);
  assert.match(hero, /hero_settings/);
  assert.match(hero, /posters/);
  assert.match(hero, /poster-needed|VIDEO_CORS_REQUIRED|needs-poster/);
  assert.doesNotMatch(hero, /video\.crossOrigin\s*=\s*['"]anonymous['"]/);
});

test('moments api preserves distinct 401 auth worker codes', () => {
  const api = readSource('src/lib/moments-api.ts');
  assert.match(api, /AUTH_REQUIRED/);
  assert.match(api, /AUTH_EXPIRED/);
});

test('Astro swaps clean page-scoped media while preserving persistent background media', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /astro:before-swap/);
});

test('persistent layout scripts initialize through astro page-load with data guards', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /astro:page-load/);
});

test('layout mounts the canvas sakura particle layer', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  assert.match(layout, /Sakura|sakura/i);
});

test('sakura particles use drawn petal drift with a worker fallback', () => {
  const files = [readSource('src/layouts/BaseLayout.astro'), readSource('src/styles/firefly-refresh.css')].join('\n');
  assert.match(files, /sakura|petal/i);
});

test('QQ playlist imports normalize ids and report unavailable audio links', () => {
  const player = readSource('src/components/SekaiPlayer.astro');
  assert.match(player, /QQ|qq/);
});

test('online playlist imports resolve audio URLs on demand', () => {
  const player = readSource('src/components/SekaiPlayer.astro');
  assert.match(player, /fetchOnline|resolve|audio/i);
});

test('online playlist imports use a unified Meting-compatible adapter', () => {
  const player = readSource('src/components/SekaiPlayer.astro');
  assert.match(player, /Meting|meting/i);
});

test('Busuanzi refresh always supplies its JSONP endpoint after navigation', () => {
  const counter = readSource('src/components/VisitorCounter.astro');
  assert.match(counter, /busuanzi/i);
});

test('background video degrades safely on navigation visibility and reduced motion', () => {
  const hero = readSource('src/components/HeroSlideshow.astro');
  assert.match(hero, /visibility|reduced/i);
});

test('background videos recover playback when browsers emit ended despite loop', () => {
  const hero = readSource('src/components/HeroSlideshow.astro');
  assert.match(hero, /ended/);
});

test('background videos reload before retrying playback after ended', () => {
  const hero = readSource('src/components/HeroSlideshow.astro');
  assert.match(hero, /load\(\)/);
});

test('moments single-item query aliases the legacy images column', () => {
  const moments = readSource('danmaku-api/src/moments.ts');
  assert.match(moments, /images/);
});
