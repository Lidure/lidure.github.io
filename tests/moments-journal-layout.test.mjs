import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/moments.astro');
const baseLayout = read('src/layouts/BaseLayout.astro');
const pins = read('src/components/MomentsPinControls.astro');
const snapshotBridge = read('src/components/MomentsSnapshotPreviewBridge.astro');
const css = read('src/styles/moments-life-wall.css');
const followupCss = read('src/styles/article-moments-followup.css');
const notebookCssUrl = new URL('../src/styles/moments-notebook-refresh.css', import.meta.url);
const notebookCss = existsSync(notebookCssUrl) ? readFileSync(notebookCssUrl, 'utf8') : '';
const helpersUrl = new URL('../src/lib/moments-life-wall.mjs', import.meta.url);

test('legacy journal enhancer stays retired', () => {
  assert.doesNotMatch(pins, /installMomentsJournalEnhancer/);
  assert.equal(existsSync(new URL('../src/lib/moments-journal-enhancer.mjs', import.meta.url)), false);
});

test('layout classification and local date helpers stay deterministic', async () => {
  const { classifyMomentLayout, getMomentDateKey, getMomentDayParts } = await import(helpersUrl.href + `?t=${Date.now()}`);
  assert.equal(classifyMomentLayout({ text: '今天有点困' }), 'whisper');
  assert.equal(classifyMomentLayout({ imageCount: 1 }), 'photo-one');
  assert.equal(classifyMomentLayout({ imageCount: 2 }), 'photo-two');
  assert.equal(classifyMomentLayout({ imageCount: 3 }), 'photo-three');
  assert.equal(classifyMomentLayout({ imageCount: 4 }), 'gallery');
  assert.equal(classifyMomentLayout({ videoCount: 1 }), 'video');
  const local = new Date(2026, 7, 25, 23, 30);
  assert.equal(getMomentDateKey(local), '2026-08-25');
  assert.equal(getMomentDayParts(local).dateLabel, '08 / 25');
});

test('bannerless Moments keeps all core interaction hooks', () => {
  assert.match(page, /showBanner=\{false\}/);
  for (const hook of ['publish-toggle', 'publish-box', 'publish-form', 'image-input', 'image-previews', 'moments-session-status', 'moment-lightbox', 'moments-login']) {
    assert.match(page, new RegExp(`id="${hook}"`));
  }
  assert.match(page, /renderMomentReactions\(moment/);
  assert.match(page, /createCommentsWidget\(['"]moment['"]/);
  assert.match(page, /uploadToR2/);
  assert.match(page, /captureVideoPoster/);
  assert.match(page, /deleteMomentViaApi/);
});

test('Moments enhancement uses a wide three-column notebook canvas with compact side gutters', () => {
  for (const className of ['moments-page-grid', 'moments-side--left', 'moments-main-column', 'moments-side--right']) {
    assert.match(pins, new RegExp(className));
  }
  for (const hook of ['moments-side-total', 'moments-side-month', 'moments-side-categories', 'moments-side-gallery']) {
    assert.match(pins, new RegExp(hook));
  }
  assert.match(pins, /function ensureMomentsCompanionShell\(/);
  assert.match(pins, /function syncMomentsCompanions\(/);
  assert.match(pins, /data-side-category/);
  assert.match(followupCss, /body\.layout-standard:has\(\.moments-shell\)\s+\.standard-content\s*\{[\s\S]*width:\s*min\(100%,\s*112rem\)[\s\S]*max-width:\s*112rem/);
  assert.match(followupCss, /\.moments-shell\s*\{[\s\S]*width:\s*100%\s*!important[\s\S]*max-width:\s*none\s*!important/);
  assert.match(followupCss, /\.moments-page-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(12\.5rem,\s*14rem\)\s+minmax\(0,\s*1fr\)\s+minmax\(12\.5rem,\s*14rem\)[\s\S]*gap:\s*clamp\(1rem,\s*1\.4vw,\s*1\.5rem\)/);
  assert.match(followupCss, /\.moments-main-column\s*\{[\s\S]*width:\s*100%/);
  assert.match(followupCss, /\.moment-card\s*\{[\s\S]*width:\s*100%\s*!important[\s\S]*max-width:\s*none\s*!important/);
  assert.match(followupCss, /\.moment--photo-one[\s\S]*\.moment--text\s*\{[\s\S]*max-width:\s*none\s*!important/);
  assert.match(notebookCss, /@media \(max-width:\s*1280px\)[\s\S]*\.moments-side\s*\{\s*display:\s*none/);
});

test('Moments paper notes keep coherent material in light and dark themes', () => {
  assert.match(baseLayout, /moments-notebook-refresh\.css/);
  assert.match(notebookCss, /--moment-paper:/);
  assert.match(notebookCss, /--moment-paper-border:/);
  assert.match(notebookCss, /\.moments-list\s*\{[\s\S]*repeating-linear-gradient/);
  assert.match(notebookCss, /\.moment-card\s*\{[\s\S]*background:[\s\S]*var\(--moment-paper\)/);
  assert.match(notebookCss, /\.moment--whisper\s*\{[\s\S]*background:[\s\S]*var\(--sticky-paper\)/);
  assert.match(notebookCss, /html\[data-theme="dark"\][\s\S]*--notebook-paper:\s*#[0-9a-fA-F]{6}/);
  assert.match(notebookCss, /html\[data-theme="dark"\][\s\S]*--moment-paper:\s*#[0-9a-fA-F]{6}/);
  for (const layout of ['photo-one', 'photo-two', 'photo-three', 'gallery', 'video', 'text']) {
    assert.doesNotMatch(notebookCss, new RegExp(`\\.moment--${layout}[^}]*background:\\s*transparent\\s*!important`));
  }
});

test('Moments microinteractions make paper, reactions, and side filters feel alive without breaking reduced motion', () => {
  assert.match(notebookCss, /\.moment-card:hover\s*\{[\s\S]*translateY\(-2px\)/);
  assert.match(notebookCss, /\.moment-card:hover::after\s*\{[\s\S]*transform:/);
  assert.match(notebookCss, /\.moment-reaction-chip\.just-reacted\s*\{[\s\S]*animation:/);
  assert.match(notebookCss, /\.moments-side-category:hover/);
  assert.match(notebookCss, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*\.moment-card:hover/);
  assert.match(pins, /sideCategoryButtons\.forEach/);
});

test('Moments top filter uses a quiet paper-style active state instead of a solid accent block', () => {
  assert.match(baseLayout, /article-moments-followup\.css/);
  assert.match(followupCss, /\.moments-wall-filter \.pill\.active\s*\{[\s\S]*background:\s*transparent\s*!important/);
  assert.match(followupCss, /\.moments-wall-filter \.pill\.active::after\s*\{[\s\S]*background:\s*color-mix/);
  assert.doesNotMatch(followupCss, /\.moments-wall-filter \.pill\.active\s*\{[^}]*background:\s*var\(--standard-accent/);
});

test('Moments snapshots open directly from their thumbnail button without global capture interception', () => {
  assert.match(baseLayout, /MomentsSnapshotPreviewBridge/);
  assert.match(pins, /button\.dataset\.snapshotIndex\s*=\s*String\(index\)/);
  assert.match(pins, /function openSnapshotPreview\(sourceImage/);
  assert.match(pins, /sourceImage\.click\(\)/);
  assert.match(pins, /document\.getElementById\('moment-lightbox'\)/);
  assert.match(pins, /lightbox\.hidden\s*=\s*false/);
  assert.doesNotMatch(snapshotBridge, /addEventListener\(['"]click['"]/);
  assert.doesNotMatch(snapshotBridge, /stopImmediatePropagation\(\)/);
});

test('emoji and reaction pickers stay collapsed until opened', () => {
  assert.match(page, /picker\.hidden = true/);
  assert.match(css, /\.moment-reaction-panel\[hidden\][\s\S]*?display:\s*none\s*!important/);
  assert.match(css, /\.emoji-panel\.hidden[\s\S]*?display:\s*none\s*!important/);
});

test('note rhythm and reaction controls remain deterministic and accessible', () => {
  assert.match(pins, /const noteShifts = \[0, 8, -5, 11, -8, 4\]/);
  assert.match(pins, /--note-shift/);
  assert.match(page, /option\.setAttribute\('aria-label'/);
  assert.match(page, /reaction\.setAttribute\('aria-label'/);
});
