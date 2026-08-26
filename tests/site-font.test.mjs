import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const layout = read('src/layouts/BaseLayout.astro');
const globalCss = read('src/styles/global.css');
const articleCss = read('src/styles/article-reading.css');
const momentsCss = read('src/styles/moments-life-wall.css');
const immersiveNavCss = read('src/styles/immersive-nav.css');
const refreshCss = read('src/styles/firefly-refresh.css');

test('site loads Zen Maru Gothic as the primary everyday font', () => {
  assert.match(layout, /family=Ma\+Shan\+Zheng&family=Zen\+Maru\+Gothic:wght@400;500;600;700/);
  assert.doesNotMatch(layout, /Noto\+Sans\+SC/);
  assert.match(globalCss, /--font-body:\s*'Zen Maru Gothic'/);
  assert.match(globalCss, /body\s*\{[\s\S]*?font-family:\s*var\(--font-body\)/);
});

test('core reading and navigation surfaces inherit the unified body font', () => {
  for (const source of [articleCss, momentsCss, immersiveNavCss, refreshCss]) {
    assert.doesNotMatch(source, /font-family:\s*'Noto Sans SC'/);
  }
  assert.match(articleCss, /font-family:\s*var\(--font-body\)/);
  assert.match(momentsCss, /font-family:\s*var\(--font-body\)/);
});

test('handwritten accents remain opt-in rather than becoming the body font', () => {
  assert.match(globalCss, /--font-hand:\s*'Ma Shan Zheng'/);
  assert.doesNotMatch(globalCss, /body\s*\{[\s\S]*?font-family:\s*var\(--font-hand\)/);
});
