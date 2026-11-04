import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(root, '..', 'dist', 'bot-help', 'index.html'), 'utf8');
const copied = [...html.matchAll(/data-copy="([^"]+)"/g)].map((m) => m[1]);

test('bot help page ships six categories and the quick-start section', () => {
  assert.equal((html.match(/class="feature" type="button"/g) || []).length, 6);
  assert.equal((html.match(/class="guide" data-guide=/g) || []).length, 6);
  assert.match(html, /第一次来？试试这 3 个/);
  assert.match(html, /data-open="games"/);
});

test('gallery examples are real, copyable commands rather than parameter placeholders', () => {
  for (const command of ['/查看画廊', '/看airi', '/看miku', '/抽表情', '/上传airi']) {
    assert.ok(copied.includes(command), 'Missing gallery command ' + command);
  }
  assert.match(html, /不要直接发送“分类名”三个字/);
  assert.match(html, /回复这张图片/);
});

test('game help prefixes are correct', () => {
  for (const command of ['gs帮助', 'sr帮助', 'zzz帮助', 'ww帮助', 'nte帮助']) {
    assert.ok(copied.includes(command), 'Missing game help ' + command);
  }
  assert.ok(!html.includes('waves帮助'), 'Incorrect legacy help command must be absent');
});

test('community auto-sign is explained step-by-step for every confirmed community', () => {
  for (const command of [
    '扫码登录', 'gs开启自动签到', 'sr开启自动签到',
    'zzz开启自动签到', 'ww登录', 'ww开启自动签到',
    'nte登录', 'nte开启自动签到', 'nte签到',
  ]) {
    assert.ok(copied.includes(command), 'Missing sign-in command ' + command);
  }
  assert.equal((html.match(/<summary>(米游社|库街区|异环)/g) || []).length, 3);
  assert.match(html, /绑定游戏 UID/);
  assert.match(html, /登录米游社/);
  assert.match(html, /已开启自动签到/);
});

test('copy buttons never expose unfilled placeholders or invalid plain @ mentions', () => {
  assert.ok(copied.length >= 20);
  const bad = /(分类名|歌名|作品ID|手机号|验证码|你的UID|@小浅子|waves帮助)/;
  for (const command of copied) {
    assert.doesNotMatch(command, bad, 'Ambiguous copy command: ' + command);
  }
});

test('responsive design and readable foldable tutorials are present', () => {
  assert.match(html, /@media \(max-width: 580px\)/);
  assert.match(html, /class="howto-steps"/);
  assert.match(html, /class="howto-body"/);
  assert.match(html, /navigator\.clipboard\.writeText/);
  assert.match(html, /id="help-search"/);
});
