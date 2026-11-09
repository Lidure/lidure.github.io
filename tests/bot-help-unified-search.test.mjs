import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'bot-help');
const home = readFileSync(path.join(root, 'index.html'), 'utf8');
const manual = readFileSync(path.join(root, 'airi/index.html'), 'utf8');
const data = JSON.parse(readFileSync(path.join(root, 'airi-search-index.json'), 'utf8'));
const inlineScript = [...home.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].at(-1)?.[1];

test('generated Airi index reflects each of the 24 tool cards in the manual', () => {
  assert.equal(data.version, 1);
  assert.equal(data.tools.length, 24);
  const ids = data.tools.map(x => x.id);
  assert.equal(new Set(ids).size, 24);
  for (const tool of data.tools) {
    assert.match(tool.id, /^tool-[a-z0-9-]+$/);
    assert.ok(manual.includes('id="' + tool.id + '"'), 'Missing deep-link anchor: ' + tool.id);
    assert.ok(tool.title.length > 1);
    assert.ok(tool.keywords.length > 5);
    assert.ok(Array.isArray(tool.commands));
    for (const command of tool.commands) {
      assert.ok(manual.includes('data-copy="' + command.replaceAll('&', '&amp;') + '"') ||
        manual.includes('data-copy="' + command + '"'), 'Outdated Airi command: ' + command);
    }
  }
  const mano = data.tools.find(x => x.id === 'tool-manosaba');
  const memes = data.tools.find(x => x.id === 'tool-memes');
  assert.ok(mano.commands.includes('manohelp'));
  assert.ok(memes.keywords.includes('玩@xx'));
  assert.ok(memes.commands.includes('玩'));
  assert.ok(memes.commands.includes('抱抱'));
});

test('every Airi tool deep link can be handled by the manual hash-navigation script', () => {
  assert.match(manual, /function revealToolFromHash/);
  assert.match(manual, /node\.closest\('\[data-category\]'\)/);
  assert.match(manual, /cat\.open=true/);
  for (const tool of data.tools) {
    assert.equal((manual.match(new RegExp('id="' + tool.id + '"', 'g')) || []).length, 1);
  }
});

function launch() {
  const events = {};
  const list = {
    children: [], _text: '',
    get textContent() { return this._text; },
    set textContent(value) { this._text = value; this.children = []; },
    appendChild(node) { this.children.push(node); }
  };
  function makeElement(tag) {
    return {
      tagName: tag.toUpperCase(), dataset: {}, children: [], textContent: '',
      appendChild(node) { this.children.push(node); }
    };
  }
  const input = { value: '', addEventListener(name, fn) { events[name] = fn; } };
  const target = {
    parentElement: null,
    querySelector(selector) {
      return selector === '.command-title' ? { textContent: '查询个人累计贡献' } : null;
    },
    classList: { add() {}, remove() {} },
    scrollIntoView() {}
  };
  const guide = {
    dataset: { guide: 'gallery' },
    textContent: '/查看贡献 QQ 投稿查询',
    hidden: true,
    querySelectorAll() {
      return [{ dataset: { copy: '/查看贡献' },
        closest(selector) { return selector.includes('command-item') ? target : null; } }];
    }
  };
  target.parentElement = guide;
  const card = {
    dataset: { open: 'gallery', keywords: '画廊 QQ 图片 贡献' },
    hidden: false, textContent: '图片画廊',
    querySelector() { return { textContent: '图片画廊' }; },
    setAttribute() {}, getAttribute() { return 'false'; }
  };
  const shell = { hidden: true, scrollIntoView() {} };
  const panel = { hidden: true };
  const status = { textContent: '' };
  const noResults = { hidden: true };
  const document = {
    createElement: makeElement,
    querySelectorAll(selector) {
      if (selector === '.feature[data-open]') return [card];
      if (selector === '[data-guide]') return [guide];
      throw new Error('Unexpected selector: ' + selector);
    },
    getElementById(id) {
      if (id === 'help-search') return input;
      if (id === 'no-results') return noResults;
      if (id === 'command-search-results') return panel;
      if (id === 'command-search-list') return list;
      if (id === 'command-search-status') return status;
      if (id === 'detail-shell') return shell;
      if (id === 'toast') return { classList: { add() {}, remove() {} } };
      return null;
    },
    addEventListener() {}
  };
  const window = {
    location: { hash: '' },
    matchMedia() { return { matches: false }; },
    fetch: async url => {
      assert.equal(url, '/bot-help/airi-search-index.json');
      return { ok: true, json: async () => data };
    }
  };
  vm.runInNewContext(inlineScript, { document, window });
  return {
    input, list, panel, status, noResults, shell,
    async search(value) {
      input.value = value;
      events.input();
      await new Promise(resolve => setImmediate(resolve));
    }
  };
}

test('homepage search finds Airi commands and returns working hand-book links', async () => {
  const page = launch();
  await page.search('manohelp');
  assert.equal(page.panel.hidden, false);
  assert.ok(page.list.children.some(node => node.href === '/bot-help/airi/#tool-manosaba'));
  const manosaba = page.list.children.find(node => node.href === '/bot-help/airi/#tool-manosaba');
  assert.equal(manosaba.children[0].textContent, 'manohelp');
  assert.match(manosaba.children[1].textContent, /Airi 节点/);

  await page.search('玩@xx');
  assert.ok(page.list.children.some(node => node.href === '/bot-help/airi/#tool-memes'));
  assert.ok(page.list.children.every(node => !node.href || node.href.startsWith('/bot-help/airi/#tool-')));
});

test('local commands still work when Airi index exists', async () => {
  const page = launch();
  await page.search('/查看贡献');
  const found = page.list.children.find(node => node.children[0].textContent === '/查看贡献');
  assert.ok(found);
  assert.equal(found.dataset.commandResult, '0');
  assert.equal(page.noResults.hidden, true);

  await page.search('unknown-no-match-query');
  assert.equal(page.panel.hidden, true);
  assert.equal(page.noResults.hidden, false);
});

test('small-screen layout keeps controls legible and dark Airi results covered', () => {
  const css = readFileSync(path.join(root, 'theme.css'), 'utf8');
  assert.match(home, /@media \(max-width: 580px\)/);
  assert.match(home, /min-height:\s*42px;\s*min-width:\s*50px/);
  assert.match(home, /\.command-search-list/);
  assert.match(home, /id="mobile-help-nav"/);
  assert.match(css, /@media \(max-width: 580px\)/);
  assert.match(css, /:root\[data-theme="dark"\] \.command-search-result/);
  assert.match(css, /:root\[data-theme="dark"\] \.mobile-nav summary/);
  assert.match(css, /\.topbar ~ main \.copy \{ min-height: 42px; min-width: 52px/);
  assert.match(css, /\.topbar ~ main \.tool-desc/);
  assert.match(css, /\.tool:target \{ outline: 2px solid/);
});
