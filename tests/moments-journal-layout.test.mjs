import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/moments.astro');
const baseLayout = read('src/layouts/BaseLayout.astro');
const pins = read('src/components/MomentsPinControls.astro');
const css = read('src/styles/moments-life-wall.css');
const notebookCssUrl = new URL('../src/styles/moments-notebook-refresh.css', import.meta.url);
const notebookCss = existsSync(notebookCssUrl) ? readFileSync(notebookCssUrl, 'utf8') : '';
const helpersUrl = new URL('../src/lib/moments-life-wall.mjs', import.meta.url);

test('legacy journal enhancer stays retired', () => {
  assert.doesNotMatch(pins, /installMomentsJournalEnhancer/);
  assert.equal(existsSync(new URL('../src/lib/moments-journal-enhancer.mjs', import.meta.url)), false);
  assert.equal(existsSync(new URL('../src/styles/moments-journal.css', import.meta.url)), false);
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

test('sunlit notes derives time-of-day metadata from real timestamps', async () => {
  const { getMomentDaypart } = await import(helpersUrl.href + `?p=${Date.now()}`);
  assert.deepEqual(getMomentDaypart(new Date(2026, 7, 25, 6, 30)), { key: 'morning', label: '清晨', mark: '☼' });
  assert.deepEqual(getMomentDaypart(new Date(2026, 7, 25, 12)), { key: 'day', label: '白昼', mark: '·' });
  assert.deepEqual(getMomentDaypart(new Date(2026, 7, 25, 18, 30)), { key: 'evening', label: '黄昏', mark: '◐' });
  assert.deepEqual(getMomentDaypart(new Date(2026, 7, 25, 23)), { key: 'night', label: '深夜', mark: '☾' });
  assert.match(pins, /getMomentDaypart/);
  assert.match(pins, /className = 'moment-daypart'/);
  assert.match(pins, /dataset\.daypart = daypart\.key/);
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

test('emoji and reaction pickers stay collapsed until opened', () => {
  assert.match(page, /picker\.hidden = true/);
  assert.match(css, /\.moment-reaction-panel\[hidden\][\s\S]*?display:\s*none\s*!important/);
  assert.match(css, /\.emoji-panel\.hidden[\s\S]*?display:\s*none\s*!important/);
});

test('sunlit notes uses a paper-note visual language', () => {
  assert.match(css, /--note-paper:/);
  assert.match(css, /--note-paper-soft:/);
  assert.match(css, /\.moments-wall-head::after[\s\S]*?background:/);
  assert.match(css, /\.moments-wall-filter \.pill\.active::after/);
  assert.match(css, /\.moment-day-mark[\s\S]*?border-radius:/);
  assert.match(css, /\.moment-card::after[\s\S]*?content:\s*['"]/);
  assert.match(css, /\.moment-card[\s\S]*?transform:\s*translateX\(var\(--note-shift/);
  assert.match(css, /\.moment-category::before[\s\S]*?width:\s*18px/);
  assert.match(css, /\.moment-daypart\[data-daypart="morning"\]/);
  assert.match(css, /\.moment-daypart\[data-daypart="evening"\]/);
  assert.match(css, /@media \(max-width:\s*720px\)[\s\S]*?--note-shift:\s*0px\s*!important/);
  assert.doesNotMatch(css, /box-shadow:\s*0 13px 30px/);
});

test('moments notebook gives every text and media moment the same paper-note material', () => {
  assert.match(baseLayout, /moments-notebook-refresh\.css/);
  assert.match(notebookCss, /--moment-paper:/);
  assert.match(notebookCss, /--moment-paper-border:/);
  assert.match(notebookCss, /\.moments-list\s*\{[\s\S]*repeating-linear-gradient/);
  assert.match(notebookCss, /\.moments-list::before\s*\{[\s\S]*background:/);
  assert.match(notebookCss, /\.moment-card\s*\{[\s\S]*background:[\s\S]*var\(--moment-paper\)/);
  assert.match(notebookCss, /\.moment-card::after\s*\{[\s\S]*display:\s*block\s*!important/);
  assert.match(notebookCss, /\.moment--whisper\s*\{[\s\S]*background:[\s\S]*var\(--sticky-paper\)/);
  for (const layout of ['photo-one', 'photo-two', 'photo-three', 'gallery', 'video', 'text']) {
    assert.doesNotMatch(notebookCss, new RegExp(`\\.moment--${layout}[^}]*background:\\s*transparent\\s*!important`));
  }
  assert.match(notebookCss, /\.moment--photo-one[\s\S]*\.moment--video[\s\S]*--moment-card-paper:/);
  assert.match(notebookCss, /\.publish-panel\s*\{[\s\S]*box-shadow:/);
});

test('dark Moments uses a warm neutral paper palette instead of accent-tinted blue cards', () => {
  assert.match(notebookCss, /html\[data-theme="dark"\][\s\S]*--notebook-paper:\s*#[0-9a-fA-F]{6}/);
  assert.match(notebookCss, /html\[data-theme="dark"\][\s\S]*--moment-paper:\s*#[0-9a-fA-F]{6}/);
  assert.match(notebookCss, /html\[data-theme="dark"\][\s\S]*--sticky-paper:\s*#[0-9a-fA-F]{6}/);
  assert.match(notebookCss, /html\[data-theme="dark"\][\s\S]*--moment-paper-border:/);
  assert.match(notebookCss, /html\[data-theme="dark"\][\s\S]*--moment-tape:/);
  assert.doesNotMatch(notebookCss, /html\[data-theme="dark"\][\s\S]*--sticky-paper:\s*color-mix\([^;]*var\(--standard-accent/);
});

test('note rhythm uses a fixed sequence rather than random layout', () => {
  assert.match(pins, /const noteShifts = \[0, 8, -5, 11, -8, 4\]/);
  assert.match(pins, /--note-shift/);
});

test('reaction controls retain accessible names', () => {
  assert.match(page, /option\.setAttribute\('aria-label'/);
  assert.match(page, /reaction\.setAttribute\('aria-label'/);
});
