import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('src/styles/article-moments-followup.css');
const interactions = read('src/lib/public-interactions.ts');
const helpersUrl = new URL('../src/lib/moments-life-wall.mjs', import.meta.url);

test('short text-only Moments notes use compact paper widths without narrowing the main column', async () => {
  const { classifyMomentLayout } = await import(helpersUrl.href + `?t=${Date.now()}`);
  assert.equal(classifyMomentLayout({ text: '今天有点困' }), 'whisper');
  assert.equal(classifyMomentLayout({ text: '这是一条稍微长一点但依然很短的碎碎念，用来测试中等尺寸便签。'.repeat(2) }), 'compact');
  assert.match(css, /\.moment--whisper\s*\{[\s\S]*width:\s*min\(100%,\s*32rem\)\s*!important/);
  assert.match(css, /\.moment--compact\s*\{[\s\S]*width:\s*min\(100%,\s*42rem\)\s*!important/);
  assert.match(css, /\.moments-main-column\s*\{[\s\S]*width:\s*100%/);
});

test('media and long Moments notes keep the full center-column width', async () => {
  const { classifyMomentLayout } = await import(helpersUrl.href + `?t=${Date.now()}`);
  assert.equal(classifyMomentLayout({ text: '很短', imageCount: 1 }), 'photo-one');
  assert.equal(classifyMomentLayout({ text: '很短', videoCount: 1 }), 'video');
  assert.equal(classifyMomentLayout({ text: '这是一条足够长的正文。'.repeat(20) }), 'text');
  assert.match(css, /\.moment--photo-one[\s\S]*\.moment--text\s*\{[\s\S]*width:\s*100%\s*!important/);
});

test('preview comments stay hidden when a Moment has no comments', () => {
  assert.match(interactions, /const hideWhenEmpty\s*=\s*previewCount\s*>\s*0/);
  assert.match(interactions, /root\.hidden\s*=\s*hideWhenEmpty/);
  assert.match(interactions, /if\s*\(!comments\.length\)[\s\S]*root\.hidden\s*=\s*true/);
  assert.match(interactions, /root\.hidden\s*=\s*false/);
});
