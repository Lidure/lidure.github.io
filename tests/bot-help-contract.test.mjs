import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(root, '..', 'dist', 'bot-help', 'index.html'), 'utf8');
const copied = [...html.matchAll(/data-copy="([^"]+)"/g)].map((m) => m[1]);
const has = (command) => copied.includes(command);

test('bot help starts concise: quick-start and exactly six discoverable categories', () => {
  assert.equal((html.match(/class="feature" type="button"/g) || []).length, 6);
  assert.equal((html.match(/class="guide" data-guide=/g) || []).length, 6);
  assert.match(html, /第一次来？试试这 3 个/);
  assert.match(html, /data-open="games"/);
});

test('gallery has a real step-by-step browse workflow with optional slash', () => {
  for (const command of ['/查看画廊', '看airi', '看airi 10', '看全部airi', '看miku']) {
    assert.ok(has(command), 'Missing real browsing command ' + command);
  }
  assert.match(html, /看图命令可以不带/);
  assert.match(html, /看看airi/);
  assert.match(html, /\/看airi/);
  assert.match(html, /先找分类，再选图片/);
  assert.match(html, /不要直接发送“分类名”三个字/);
});

test('gallery distinguishes batch random images from overview collage, numbered images and uploads', () => {
  assert.match(html, /随机抽 10 张/);
  assert.match(html, /带编号的图片总览/);
  assert.match(html, /缩略图拼图/);
  assert.match(html, /看123/);
  assert.ok(!has('看123'), 'Unverified fictional image ID must not have a copy button');
  for (const command of ['/上传airi', '/上传 airi', '/抽表情 5', '/画廊帮助详细']) {
    assert.ok(has(command), 'Missing gallery command ' + command);
  }
  assert.match(html, /回复那条图片消息/);
});

test('six game help commands include BBBUID and correct WW alias', () => {
  for (const command of ['gs帮助', 'sr帮助', 'zzz帮助', 'bbb帮助', 'ww帮助', 'nte帮助']) {
    assert.ok(has(command), 'Missing game help command ' + command);
  }
  assert.ok(!html.includes('waves帮助'), 'Incorrect help command leaked');
});

test('UID sample is explicit but cannot bind a fictitious sample account by one click', () => {
  assert.match(html, /gs绑定uid123456789/);
  assert.match(html, /只是格式示例/);
  assert.match(html, /bbb绑定uid/);
  assert.ok(!has('gs绑定uid123456789'));
  assert.match(html, /各游戏的 UID 不能混用/);
});

test('all four HoYo community sign-in methods and authentication are documented', () => {
  for (const command of ['扫码登录', 'gs开启自动签到', 'sr开启自动签到', 'zzz开启自动签到', 'bbb开启自动签到']) {
    assert.ok(has(command), 'Missing HoYo command '+command);
  }
  assert.match(html, /原神 \/ 星铁 \/ 绝区零 \/ 崩坏 3 自动签到/);
  assert.match(html, /绑定 UID、授权米游社、开启自动签到/);
  assert.match(html, /账号安全/);
});

test('Wuthering Waves and NTE have full sign-in flows', () => {
  for (const command of ['ww登录', 'ww开启自动签到', 'nte登录', 'nte开启自动签到', 'nte签到']) {
    assert.ok(has(command), 'Missing game sign-in command '+command);
  }
  assert.equal((html.match(/<summary>.*自动签到<\/summary>/g) || []).length, 3);
});

test('voice, playful interactions and image search contain actionable commands', () => {
  for (const command of [
    '/voice.list', '/随机语音', '/voice.help',
    '/今日小猪', '/小猪图鉴', '/我的猪圈', '/小猪帮助', '/poke排行',
    '/搜图', '/天气 青岛', '/点歌 群青', '/pixiv 初音未来',
  ]) {
    assert.ok(has(command), 'Missing accessible user command '+command);
  }
  assert.match(html, /回复图片消息/);
  assert.match(html, /真正 @/);
});

test('copy buttons have no raw template placeholders or plain-text QQ @ mentions', () => {
  assert.ok(copied.length >= 35);
  const bad = /(分类名|歌名|作品ID|手机号|验证码|你的UID|@小浅子|waves帮助)/;
  for (const command of copied) {
    assert.doesNotMatch(command, bad, 'Ambiguous or unsafe copy command: '+command);
  }
});

test('mobile layout and help disclosure structure are preserved', () => {
  assert.match(html, /@media \(max-width: 580px\)/);
  assert.match(html, /class="howto-steps"/);
  assert.match(html, /class="howto-body"/);
  assert.match(html, /navigator\.clipboard\.writeText/);
  assert.match(html, /id="help-search"/);
  for (const tag of ['section','details','button']) {
    const open = (html.match(new RegExp('<'+tag+'\\b','g')) || []).length;
    const close = (html.match(new RegExp('</'+tag+'>','g')) || []).length;
    assert.equal(open, close, tag+' tags should be balanced');
  }
});
