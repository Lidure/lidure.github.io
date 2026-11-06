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
  assert.match(html, /第一次来？试试这 4 个/);
  const quickStart = html.split('<div class="quick-grid">')[1].split('</section>')[0];
  assert.equal((quickStart.match(/class="quick-card"/g) || []).length, 4);
  assert.deepEqual([...quickStart.matchAll(/class="step">([0-9])</g)].map((m) => Number(m[1])), [1, 2, 3, 4]);
  assert.match(quickStart, /data-copy="签到"/);
  assert.ok(quickStart.includes('href="/bot-help/airi/#tool-collection"'));
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

test('Poke leaderboard guide covers all six scopes, counts and day boundary', () => {
  for (const command of [
    '/poke排行', '/poke历史排行', '/poke总排行', '/poke历史总排行',
    '/poke群排行', '/poke历史群排行', '/poke排行 20',
  ]) {
    assert.ok(has(command), 'Missing Poke guide command ' + command);
  }
  assert.match(html, /凌晨 4:00/);
  assert.match(html, /戳小浅子本人的次数/);
  assert.match(html, /「群排行」比较的是群聊/);
  assert.match(html, /实际显示上限以机器人设置为准/);
});

test('Pixiv guide gives verified search, recommendations, rankings and help', () => {
  for (const command of [
    '/pixiv 初音未来', '/pixiv_help', '/pixiv_recommended',
    '/pixiv_ranking day', '/pixiv_ranking week',
    '/pixiv_ranking month', '/pixiv_ranking help',
    '/pixiv_user_search 初音ミク', '/pixiv_trending_tags',
  ]) {
    assert.ok(has(command), 'Missing Pixiv guide command ' + command);
  }
  assert.match(html, /直接发送 \/pixiv_ranking 会先显示帮助/);
  assert.match(html, /过滤 R18/);
});

test('Pixiv artist subscriptions and ID instructions avoid fictional IDs', () => {
  assert.ok(has('/pixiv_subscribe_list'));
  assert.ok(has('/pixiv_random_status'));
  assert.match(html, /作品 ID（数字）/);
  assert.match(html, /pixiv_specific/);
  assert.match(html, /pixiv_related/);
  assert.match(html, /pixiv_subscribe_add/);
  assert.match(html, /需要你自己填写/);
  assert.ok(!copied.some((x) => /pixiv_specific \d+|pixiv_subscribe_add \d+/.test(x)));
});

test('node reference keeps the six beginner cards and provides verified local services', () => {
  assert.match(html, /href="#nodes"/);
  assert.match(html, /id="nodes"/);
  for (const command of ['/个人信息', '/绑定列表', '/隐私设置', '/查曲 -help', '/sk', '/组卡 -h']) {
    assert.ok(has(command), 'Missing verified node command ' + command);
  }
  assert.match(html, /Haruki 节点/);
  assert.match(html, /GsCore 游戏服务/);
  assert.match(html, /Airi 专属节点 · 24 项功能手册/);
  assert.match(html, /Moe \/ Sakura 其他远程节点/);
  assert.match(html, /href="\/bot-help\/airi\/"/);
  assert.match(html, /当前没有拿到这些节点完整、可靠的用户命令清单/);
  assert.match(html, /https:\/\/haruki\.seiunx\.com\//);
  assert.ok(!html.includes('https://toolbox.haruki.seiunx.com/'));
});

test('node help differentiates Haruki slash commands and GsCore no-slash commands', () => {
  assert.match(html, /Haruki.*命令需要带/);
  assert.match(html, /不需要 \/<\/strong>/);
  for (const command of ['gs帮助','sr帮助','zzz帮助','bbb帮助','ww帮助','nte帮助']) {
    assert.ok(has(command));
  }
  assert.doesNotMatch(html, /AstrBot 与 SnowLuma：帮助和状态/);
  assert.doesNotMatch(html, /SnowLuma · Haruki/);
});

test('passive interaction guide accurately documents current Poke weighted responses', () => {
  assert.match(html, /id="passive"/);
  for (const value of ['53.57%', '43.45%', '1.79%', '0.60%', '40%', '20%', '10%']) {
    assert.ok(html.includes(value), 'Expected current Poke probability '+value);
  }
  for (const command of ['抽表情','看图片','看szk','看mnr','看hrk','看miku图片']) {
    assert.ok(html.includes(command), 'Expected Poke action '+command);
  }
  assert.match(html, /二次随机比例/);
  assert.match(html, /10 秒冷却/);
  assert.match(html, /2 秒冷却/);
});

test('passive guide distinguishes Qzone auto-like and profile-like reciprocation', () => {
  assert.match(html, /QQ 好友的空间动态自动点赞/);
  assert.match(html, /5 分钟/);
  assert.match(html, /无法保证每条动态都被覆盖/);
  assert.match(html, /点赞通知/);
  assert.match(html, /每天最多尝试一轮/);
  assert.match(html, /50 个赞/);
  assert.match(html, /\/订阅点赞/);
});

test('gallery includes a public, verified browser preview without losing QQ examples', () => {
  assert.match(html, /href="https:\/\/lidure22\.xyz\/gallery\/"/);
  assert.match(html, /在线画廊/);
  assert.ok(copied.includes('看airi 10'));
  assert.ok(copied.includes('看全部airi'));
});

test('gallery is prominently discoverable without adding a seventh category', () => {
  assert.match(html, /id="gallery-spotlight"/);
  assert.match(html, /href="#gallery-spotlight"/);
  assert.match(html, /data-featured="gallery" data-open="gallery"/);
  assert.match(html, /画廊与投稿指南/);
  assert.match(html, /三步就能上传/);
  assert.match(html, /发送图片，并回复它/);
  assert.match(html, /查看详细投稿步骤/);
  assert.equal((html.match(/class="feature" type="button"/g) || []).length, 6);
  assert.equal((html.match(/class="guide" data-guide=/g) || []).length, 6);
  assert.match(html, /\.gallery-spotlight\s*\{/);
  assert.match(html, /\.gallery-contribute-feedback\s*\{/);
});

test('gallery help matches v2.12.1 read, upload, and QQ contribution workflows', () => {
  const guide = html.split('id="detail-gallery"')[1].split('id="detail-games"')[0];
  assert.match(guide, /Airi Gallery v2\.12\.1/);
  assert.match(guide, /id="gallery-contribute-title"/);
  assert.match(guide, /先发图片，再回复图片消息输入上传命令/);
  assert.match(guide, /回复那条图片消息/);
  assert.match(guide, /上传必须带 \/</);
  for (const command of [
    '/查看画廊', '/上传airi', '/上传 airi', '/查看贡献',
    '看随机图片 3', '/看最近上传 5', '/强制上传',
  ]) {
    assert.ok(guide.includes('data-copy="' + command + '"'), 'Missing gallery command ' + command);
  }
  assert.match(guide, /未投稿显示 0 张/);
  assert.match(guide, /网页端上传不计入个人贡献/);
  assert.match(guide, /完全重复的图片不能强制上传/);
  assert.match(guide, /只用于确认最近一次被判定为“相似”/);
  assert.match(guide, /取决于机器人设置/);
  assert.ok(guide.indexOf('id="gallery-contribute-title"') < guide.indexOf('直接复制就能发送的示例'));
  assert.ok(guide.indexOf('id="gallery-contribute-title"') < guide.indexOf('<div class="howto">'));
});

test('homepage gallery calls to action open the existing guide and retain copy behavior', () => {
  assert.match(html, /data-open="gallery" aria-controls="detail-gallery">查看详细投稿步骤/);
  assert.match(html, /data-open="gallery" aria-controls="detail-gallery">🖼️ 画廊与投稿指南/);
  assert.match(html, /data-copy="\/上传airi"/);
  assert.match(html, /data-copy="\/查看贡献"/);
  assert.match(html, /gallery-spotlight-actions/);
  assert.match(html, /@media \(max-width: 580px\)/);
});
