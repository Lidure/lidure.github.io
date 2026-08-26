import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const page = read('src/pages/moments.astro');
const pins = read('src/components/MomentsPinControls.astro');
const css = read('src/styles/moments.css');
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

test('moments uses a content-first life-slice visual language', () => {
  assert.match(css, /\.moments-shell/);
  assert.match(css, /\.moments-wall-filter \.pill\.active::after/);
  assert.match(css, /\.moment-card/);
  assert.match(css, /\.moment-media/);
  assert.match(css, /\.moment-actions/);
  assert.match(css, /\.moment-daypart/);
  assert.match(css, /@media \(max-width:\s*720px\)/);
  assert.doesNotMatch(css, /rotate\(/);
  assert.doesNotMatch(css, /box-shadow:\s*0 13px 30px/);
});

test('note rhythm uses a fixed sequence rather than random layout', () => {
  assert.match(pins, /const noteShifts = \[0, 8, -5, 11, -8, 4\]/);
  assert.match(pins, /--note-shift/);
});

test('reaction controls retain accessible names', () => {
  assert.match(page, /option\.setAttribute\('aria-label'/);
  assert.match(page, /reaction\.setAttribute\('aria-label'/);
});
