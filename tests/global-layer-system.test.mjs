import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const TOKEN_NAMES = [
  '--z-decoration',
  '--z-content',
  '--z-floating',
  '--z-nav',
  '--z-overlay',
  '--z-modal',
  '--z-toast',
];

function tokenValue(css, token) {
  const match = css.match(new RegExp(`${token.replaceAll('-', '\\-')}\\s*:\\s*(\\d+)\\s*;`));
  return match ? Number(match[1]) : null;
}

test('global layer tokens exist once and are strictly ordered', async () => {
  const globalCss = await read('src/styles/global.css');
  const values = TOKEN_NAMES.map((token) => {
    const matches = [...globalCss.matchAll(new RegExp(`${token.replaceAll('-', '\\-')}\\s*:`, 'g'))];
    assert.equal(matches.length, 1, `${token} must be defined exactly once`);
    const value = tokenValue(globalCss, token);
    assert.notEqual(value, null, `${token} must have an integer value`);
    return value;
  });

  for (let index = 1; index < values.length; index += 1) {
    assert.ok(values[index] > values[index - 1], `${TOKEN_NAMES[index]} must be above ${TOKEN_NAMES[index - 1]}`);
  }
});

test('global surfaces consume semantic layer tokens', async () => {
  const [waves, immersiveNav, standardNav, floatingControls, player, settings, messages, transition] = await Promise.all([
    read('src/components/BannerWaves.astro'),
    read('src/styles/immersive-nav.css'),
    read('src/styles/firefly-refresh.css'),
    read('src/components/FloatingControls.astro'),
    read('src/components/SekaiPlayer.astro'),
    read('src/components/VisualSettingsPanel.astro'),
    read('src/styles/message-board.css'),
    read('src/components/PageTransitionEnhancer.astro'),
  ]);

  assert.match(waves, /\.banner-waves[\s\S]*?z-index:\s*var\(--z-decoration\)/);
  assert.match(immersiveNav, /\.site-header[\s\S]*?z-index:\s*var\(--z-nav\)/);
  assert.match(standardNav, /body\.layout-standard \.site-header[\s\S]*?z-index:\s*var\(--z-nav\)/);
  assert.match(floatingControls, /\.site-floating-controls[\s\S]*?z-index:\s*var\(--z-floating\)/);
  assert.match(immersiveNav, /\.site-floating-controls[\s\S]*?z-index:\s*var\(--z-floating\)/);

  assert.match(player, /\.sekai-player-btn[\s\S]*?z-index:\s*var\(--z-floating\)/);
  assert.match(player, /\.sekai-player-panel[\s\S]*?z-index:\s*var\(--z-overlay\)/);

  assert.match(settings, /\.hero-settings-btn[\s\S]*?z-index:\s*var\(--z-floating\)/);
  assert.match(settings, /\.hero-settings-panel[\s\S]*?z-index:\s*var\(--z-overlay\)/);

  assert.match(messages, /\.message-drawer[\s\S]*?z-index:\s*var\(--z-overlay\)/);
  assert.match(messages, /\.message-composer-backdrop[\s\S]*?z-index:\s*var\(--z-modal\)/);

  assert.match(transition, /#page-transition-progress[\s\S]*?z-index:\s*var\(--z-toast\)/);
  assert.match(transition, /#page-transition-progress[\s\S]*?pointer-events:\s*none/);
});

test('migrated global surfaces no longer depend on legacy magic z-index values', async () => {
  const files = await Promise.all([
    read('src/styles/immersive-nav.css'),
    read('src/styles/firefly-refresh.css'),
    read('src/components/FloatingControls.astro'),
    read('src/components/SekaiPlayer.astro'),
    read('src/components/VisualSettingsPanel.astro'),
    read('src/styles/message-board.css'),
    read('src/components/PageTransitionEnhancer.astro'),
  ]);
  const joined = files.join('\n');
  for (const value of ['9998', '9999', '10000', '10010', '10020', '10050']) {
    assert.doesNotMatch(joined, new RegExp(`z-index:\\s*${value}\\b`));
  }
});
