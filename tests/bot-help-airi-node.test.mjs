import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir=path.dirname(fileURLToPath(import.meta.url));
const page=readFileSync(path.join(dir,'..','dist','bot-help','airi','index.html'),'utf8');
const home=readFileSync(path.join(dir,'..','dist','bot-help','index.html'),'utf8');
const copies=[...page.matchAll(/data-copy="([^"]+)"/g)].map(x=>x[1]);

test('Airi manual is independently reachable from bot-help nodes',()=>{
  assert.match(home,/href="\/bot-help\/airi\/"/);
  assert.match(page,/<link rel="canonical" href="https:\/\/lidure22\.xyz\/bot-help\/airi\/"/);
  assert.match(page,/返回帮助中心/);
  assert.match(page,/<meta name="viewport"/);
});
test('Airi manual has exactly 24 unique functions across four expandable categories',()=>{
  const ids=[...page.matchAll(/data-tool="([^"]+)"/g)].map(x=>x[1]);
  assert.equal(ids.length,24);
  assert.equal(new Set(ids).size,24);
  const cats=[...page.matchAll(/class="category" id="([^"]+)"/g)].map(x=>x[1]);
  assert.deepEqual(cats,['games','entertainment','utilities','board']);
  for(const [category,size] of [['games',5],['entertainment',8],['utilities',8],['board',3]]){
    const section=page.split('data-category="'+category+'"')[1].split('</div>\n </details>')[0];
    assert.equal((section.match(/data-tool="/g)||[]).length,size,category);
  }
});
test('the full user supplied game command catalog is included',()=>{
  for(const command of ['计算倍率','单人pt','协力pt','挑战pt','wws help','wws','astral help','manohelp','/help']){
    assert.ok(copies.includes(command),'Game command missing: '+command);
  }
  assert.match(page,/仅群白名单可用/);
  assert.match(page,/仅部分群聊开放/);
  assert.match(page,/Airi Cobblemon/);
});
test('entertainment module contains eight plugins and all specified commands',()=>{
  for(const cmd of ['签到','签到帮助','心愿瓶帮助','海龟汤','jrys','占卜','jrlp','hlp','强娶','今天吃什么','今天喝什么','扫雷帮助']){
    assert.ok(copies.includes(cmd),'Entertainment command missing '+cmd);
  }
  assert.match(page,/开局 300 积分/);
  assert.match(page,/强娶：100 积分/);
  assert.match(page,/开局 100 积分/);
});
test('utility commands and special message requirements are explicit',()=>{
  for(const cmd of ['点歌 群青','choicehelp','roll help','CPU是什么','packpic','表情包制作','pjskbq','arcbq']){
    assert.ok(copies.includes(cmd),'Utility command missing '+cmd);
  }
  assert.match(page,/回复一条合并转发消息/);
  assert.match(page,/真正 @Airi/);
  assert.match(page,/QQ 自带表情不是系统 Emoji/);
});
test('chess help is safe: valid openings, instructions, and fees',()=>{
  for(const cmd of ['五子棋','黑白棋','围棋','悔棋','跳过回合','显示棋盘','结束下棋','象棋对战','炮二平五','b2e2',',sl rl']){
    assert.ok(copies.includes(cmd),'Board-game command missing '+cmd);
  }
  assert.match(page,/仅玩家对战/);
  assert.match(page,/象棋人机lvX/);
  assert.match(page,/X 必须替换成/);
  assert.match(page,/开局 200 积分/);
});
test('copy buttons avoid fictional @ mentions or placeholder parameters',()=>{
  assert.ok(copies.length>=40);
  for(const cmd of copies){
    assert.doesNotMatch(cmd,/@Airi|歌曲名|坐标|lvX|xxx|QQ号|<|>/);
  }
  assert.match(page,/未注明积分不等于保证免费/);
});
test('responsive layout and live search + accessible copy controls remain functional',()=>{
  assert.match(page,/@media\(max-width:540px\)/);
  assert.match(page,/id="catalog-search"/);
  assert.match(page,/data-search=/);
  assert.match(page,/input\.addEventListener\('input'/);
  assert.match(page,/navigator\.clipboard/);
  assert.match(page,/role="status"/);
  assert.equal((page.match(/<details\b/g)||[]).length,(page.match(/<\/details>/g)||[]).length);
  assert.equal((page.match(/<button\b/g)||[]).length,(page.match(/<\/button>/g)||[]).length);
});

test('Airi node highlights four popular experiences and deep links open real cards', () => {
  for(const id of ['collection','memes','manosaba','salad']){
    assert.match(page,new RegExp('href="#tool-'+id+'"'));
    assert.match(page,new RegExp('id="tool-'+id+'"'));
  }
  assert.match(page,/function revealToolFromHash/);
  assert.match(page,/scrollIntoView/);
});

test('Airi daily check-in collection tutorial includes all documented progression rules', () => {
  for(const item of ['收藏信息','查看收藏','收藏抽卡','收藏抽卡10','收藏主题','今日运势','今日挑战','购买提示']){
    assert.ok(page.includes(item), 'Collection feature missing '+item);
  }
  assert.match(page,/100 种收藏品/);
  assert.match(page,/95 种/);
  assert.match(page,/5 种隐藏收藏/);
  assert.match(page,/重复收藏会返还/);
  assert.match(page,/十连保底至少 1 个新收藏/);
  assert.match(page,/转出.*200 积分/);
  assert.match(page,/10%（向上取整）/);
  assert.match(page,/重开存档/);
});

test('popular Airi memes describe real QQ mentions, not a fake at-string', () => {
  assert.match(page,/玩@群友/);
  assert.match(page,/抱抱@群友/);
  assert.match(page,/QQ 的真实/);
  assert.ok(copies.includes('玩'));
  assert.ok(copies.includes('抱抱'));
  assert.ok(!copies.some(x=>/@xx|@群友/.test(x)));
});

test('Manosaba example, screenshot and MMJ official tutorial are included', () => {
  assert.match(page,/魔裁对话 @BG018 #JXL024 \*雪莉/);
  assert.match(page,/data-copy-source="manosaba-input"/);
  assert.match(page,/manosaba-example\.webp/);
  assert.match(page,/https:\/\/www\.airi\.asia\/posts\/aps_help\//);
  assert.ok(copies.includes(',sl rl'));
});

test('user-provided Manosaba screenshot is actually shipped as a valid WebP asset', () => {
  const image = readFileSync(path.join(dir, '..', 'dist', 'bot-help', 'airi', 'manosaba-example.webp'));
  assert.ok(image.byteLength > 2000, 'Screenshot should not be empty');
  assert.equal(image.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(image.subarray(8, 12).toString('ascii'), 'WEBP');
  assert.match(page, /src="\/bot-help\/airi\/manosaba-example\.webp"/);
});
