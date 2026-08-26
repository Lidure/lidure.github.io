import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/moments.astro');
const pins = read('src/components/MomentsPinControls.astro');
const helpersUrl = new URL('../src/lib/moments-life-wall.mjs', import.meta.url);

test('moments v2 retires the PR 43 journal enhancer', () => {
  assert.doesNotMatch(pins, /installMomentsJournalEnhancer/);
  assert.doesNotMatch(pins, /moments-journal\.css/);
  assert.equal(existsSync(new URL('../src/lib/moments-journal-enhancer.mjs', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/styles/moments-journal.css', import.meta.url)), false);
});

test('life wall classification is deterministic', async () => {
  const { classifyMomentLayout } = await import(helpersUrl.href + `?t=${Date.now()}`);
  assert.equal(classifyMomentLayout({ text: '今天有点困', imageCount: 0, videoCount: 0 }), 'whisper');
  assert.equal(classifyMomentLayout({ text: '这是一段明显超过三十二个字符的普通碎碎念内容，用来确认它会进入普通文字布局而不是短句布局。', imageCount: 0, videoCount: 0 }), 'text');
  assert.equal(classifyMomentLayout({ imageCount: 1 }), 'photo-one');
  assert.equal(classifyMomentLayout({ imageCount: 2 }), 'photo-two');
  assert.equal(classifyMomentLayout({ imageCount: 3 }), 'photo-three');
  assert.equal(classifyMomentLayout({ imageCount: 4 }), 'gallery');
  assert.equal(classifyMomentLayout({ imageCount: 2, videoCount: 1 }), 'video');
});

test('date helpers use the local calendar day', async () => {
  const { getMomentDateKey, getMomentDayParts } = await import(helpersUrl.href + `?d=${Date.now()}`);
  const local = new Date(2026, 7, 25, 23, 30, 0);
  assert.equal(getMomentDateKey(local), '2026-08-25');
  assert.deepEqual(getMomentDayParts(local), {
    key: '2026-08-25',
    dateLabel: '08 / 25',
    weekdayLabel: 'TUE',
    machineDate: '2026-08-25',
  });
});

test('moments owns a quiet bannerless life-wall entrance', () => {
  assert.match(page, /showBanner=\{false\}/);
  assert.doesNotMatch(page, /showTime=\{true\}/);
  assert.match(page, /class="moments-wall-head"/);
  assert.match(page, /class="controls-bar moments-wall-filter"/);
  assert.match(page, /class="fab moments-compose-trigger"/);
  assert.match(page, /今天想记点什么？/);
  assert.match(page, /moments-life-wall\.css/);
  assert.doesNotMatch(page, /hero-stats/);
  assert.doesNotMatch(page, /hero-bubbles/);
  assert.doesNotMatch(page, /✨ Moments/);
  assert.doesNotMatch(page, /<style>/);
});

test('feed renderer owns date groups and deterministic content variants', () => {
  assert.match(page, /function buildMomentDayGroup/);
  assert.match(page, /className = 'moment-day'/);
  assert.match(page, /getMomentDayParts\(/);
  assert.match(page, /getMomentDateKey\(/);
  assert.match(page, /classifyMomentLayout\(/);
  for (const variant of ['whisper', 'text', 'photo-one', 'photo-two', 'photo-three', 'gallery', 'video']) {
    assert.match(page, new RegExp(`moment--\\$\\{layout\\}`));
    assert.match(read('src/styles/moments-life-wall.css'), new RegExp(`moment--${variant}`));
  }
  assert.match(page, /function applyMomentFilter/);
  assert.match(page, /moments:pin-order-changed/);
});

test('moment reaction controls keep accessible names after the visual rewrite', () => {
  assert.match(page, /option\.setAttribute\('aria-label', selectedEmoji === emoji \? `取消 \$\{emoji\}` : `贴 \$\{emoji\}`\)/);
  assert.match(page, /reaction\.setAttribute\('aria-label', selectedEmoji === emoji \? `取消 \$\{emoji\}` : `贴 \$\{emoji\}`\)/);
});

test('core moments behavior hooks stay present while the presentation changes', () => {
  for (const hook of [
    'id="publish-toggle"', 'id="publish-box"', 'id="publish-form"', 'id="image-input"',
    'id="image-previews"', 'id="moments-session-status"', 'id="moment-lightbox"',
    'id="manual-poster-input"', 'id="moments-login"', 'id="moments-login-submit"',
  ]) assert.match(page, new RegExp(hook));

  assert.match(page, /renderMomentReactions\(moment/);
  assert.match(page, /setupLightboxForNewCards\(\)/);
  assert.match(page, /deleteMomentViaApi/);
  assert.match(page, /uploadToR2/);
  assert.match(page, /captureVideoPoster/);
  assert.match(page, /MOMENT_REACTIONS_API_URL/);
  assert.match(page, /createCommentsWidget\(['"]moment['"]/);
  assert.match(page, /getSession/);
  assert.match(page, /login\(/);
  assert.match(page, /logout\(/);
});
