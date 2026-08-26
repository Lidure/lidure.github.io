import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const url = (path) => new URL(`../${path}`, import.meta.url);
const read = (path) => readFileSync(url(path), 'utf8');
const layout = () => read('src/layouts/BaseLayout.astro');

test('window-desk foundation exposes one semantic token layer and Zen Maru body font', () => {
  assert.equal(existsSync(url('src/styles/tokens.css')), true, 'tokens.css should exist');
  assert.equal(existsSync(url('src/styles/site-shell.css')), true, 'site-shell.css should exist');

  const tokens = read('src/styles/tokens.css');
  assert.match(layout(), /tokens\.css/);
  assert.match(layout(), /site-shell\.css/);
  assert.match(layout(), /family=Ma\+Shan\+Zheng&family=Zen\+Maru\+Gothic:wght@400;500;600;700/);
  assert.doesNotMatch(layout(), /Noto\+Sans\+SC/);

  for (const token of [
    '--font-body', '--font-hand', '--font-mono', '--ink', '--muted',
    '--paper', '--paper-soft', '--line', '--accent', '--accent-soft',
    '--content-max', '--reading-max',
  ]) {
    assert.match(tokens, new RegExp(token.replaceAll('-', '\\-')));
  }
  assert.match(tokens, /--accent:\s*hsl\(var\(--theme-hue(?:,\s*255)?\)/);
});

test('site header prioritizes the five human-facing sections and demotes utilities', () => {
  const header = read('src/components/SiteHeader.astro');
  for (const link of [
    "{ href: '/', label: '首页' }",
    "{ href: '/posts', label: '文章' }",
    "{ href: '/moments', label: '碎碎念' }",
    "{ href: '/archive', label: '归档' }",
    "{ href: '/about', label: '关于' }",
  ]) assert.ok(header.includes(link));

  assert.match(header, /class="site-nav-more"/);
  assert.match(header, /\/search/);
  assert.match(header, /\/messages/);
  assert.match(header, /\/tags/);
  assert.match(header, /\/player/);
  assert.match(header, /\/sekai-quest/);
  assert.match(header, /aria-expanded/);
});
