import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const rootPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'bot-help');
const home = readFileSync(path.join(rootPath, 'index.html'), 'utf8');
const airi = readFileSync(path.join(rootPath, 'airi/index.html'), 'utf8');
const controller = readFileSync(path.join(rootPath, 'theme.js'), 'utf8');
const css = readFileSync(path.join(rootPath, 'theme.css'), 'utf8');
const key = 'bot-help-theme-preference';

function boot({ initial = null, dark = false, denyStorage = false } = {}) {
  const values = new Map(initial ? [[key, initial]] : []);
  const root = { dataset: {} };
  const control = { value: 'auto', handlers: {}, addEventListener(type, handler) { this.handlers[type] = handler; } };
  const meta = { content: '', setAttribute(name, value) { if (name === 'content') this.content = value; } };
  const media = {
    matches: dark,
    listeners: {},
    addEventListener(type, callback) { this.listeners[type] = callback; },
  };
  const localStorage = {
    getItem(key) { if (denyStorage) throw new Error('storage blocked'); return values.get(key) ?? null; },
    setItem(key, value) { if (denyStorage) throw new Error('storage blocked'); values.set(key, value); },
    removeItem(key) { if (denyStorage) throw new Error('storage blocked'); values.delete(key); },
  };
  const window = {
    localStorage,
    matchMedia(query) { assert.equal(query, '(prefers-color-scheme: dark)'); return media; },
    listeners: {},
    addEventListener(type, callback) { this.listeners[type] = callback; },
  };
  const document = {
    documentElement: root,
    readyState: 'complete',
    querySelector(selector) { assert.equal(selector, 'meta[name="theme-color"]'); return meta; },
    getElementById(id) { return id === 'bot-help-theme' ? control : null; },
  };
  vm.runInNewContext(controller, { window, document });
  return {
    root, control, meta, media, values, window,
    select(value) { control.value = value; control.handlers.change(); },
    system(dark) { media.matches = dark; media.listeners.change(); },
    storage(value) { if (value === null) values.delete(key); else values.set(key, value); window.listeners.storage({ key }); },
  };
}

test('both Bot Help pages use one shared theme controller and selector', () => {
  for (const page of [home, airi]) {
    assert.match(page, /<script src="\/bot-help\/theme\.js"><\/script>/);
    assert.match(page, /<link rel="stylesheet" href="\/bot-help\/theme\.css">/);
    assert.match(page, /id="bot-help-theme" aria-label="外观主题"/);
    for (const choice of ['auto', 'light', 'dark']) {
      assert.ok(page.includes('<option value="' + choice + '">'), choice + ' option is missing');
    }
    assert.ok(page.indexOf('/bot-help/theme.js') < page.indexOf('<style>'), 'theme initialized before first paint');
  }
});

test('default is automatic: system dark/light both apply and update live', () => {
  for (const initialDark of [false, true]) {
    const state = boot({ dark: initialDark });
    assert.equal(state.root.dataset.themeMode, 'auto');
    assert.equal(state.root.dataset.theme, initialDark ? 'dark' : 'light');
    assert.equal(state.control.value, 'auto');
    assert.equal(state.meta.content, initialDark ? '#17141e' : '#fff6fa');
    state.system(!initialDark);
    assert.equal(state.root.dataset.theme, initialDark ? 'light' : 'dark');
  }
});

test('manual override persists and switching back to auto restores live system theme', () => {
  const state = boot({ dark: true });
  state.select('light');
  assert.equal(state.root.dataset.theme, 'light');
  assert.equal(state.root.dataset.themeMode, 'light');
  assert.equal(state.values.get(key), 'light');
  state.system(false);
  state.system(true);
  assert.equal(state.root.dataset.theme, 'light', 'system change must not override a manual choice');
  state.select('dark');
  assert.equal(state.root.dataset.theme, 'dark');
  assert.equal(state.values.get(key), 'dark');
  state.select('auto');
  assert.equal(state.values.has(key), false);
  assert.equal(state.root.dataset.themeMode, 'auto');
  assert.equal(state.root.dataset.theme, 'dark');
  state.system(false);
  assert.equal(state.root.dataset.theme, 'light');
});

test('both pages share saved mode; cross-tab changes and invalid preference are safe', () => {
  const restored = boot({ initial: 'dark', dark: false });
  assert.equal(restored.root.dataset.theme, 'dark');
  restored.storage('light');
  assert.equal(restored.root.dataset.theme, 'light');
  assert.equal(restored.control.value, 'light');
  restored.storage(null);
  assert.equal(restored.root.dataset.themeMode, 'auto');
  const invalid = boot({ initial: 'surprise', dark: true });
  assert.equal(invalid.root.dataset.themeMode, 'auto');
  assert.equal(invalid.root.dataset.theme, 'dark');
});

test('theme switch still works in privacy mode when localStorage is blocked', () => {
  const state = boot({ dark: true, denyStorage: true });
  assert.equal(state.root.dataset.themeMode, 'auto');
  state.select('light');
  assert.equal(state.root.dataset.theme, 'light');
});

test('dark palette covers both pages, and mobile controls remain accessible', () => {
  assert.match(css, /:root\[data-theme="dark"\]/);
  for (const selector of ['.gallery-spotlight', '.gallery-contribute', '.command-item', '.faq details', '.tool', '.popular-link', '.category', '.tool-expand', '.theme-control']) {
    assert.ok(css.includes(selector), 'Missing dark styling for ' + selector);
  }
  assert.match(css, /color-scheme:\s*dark/);
  assert.match(css, /@media \(max-width: 580px\)/);
  assert.match(css, /\.topbar-inner \.brand > span:not\(\.brand-mark\)/);
});
