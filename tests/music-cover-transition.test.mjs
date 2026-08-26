import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('base layout installs the shared page transition enhancer', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');

  assert.match(layout, /import PageTransitionEnhancer from ['"]\.\.\/components\/PageTransitionEnhancer\.astro['"]/);
  assert.match(layout, /<PageTransitionEnhancer\s*\/>/);
});

test('global player owns music cover presentation without page-level races', () => {
  const layout = readSource('src/layouts/BaseLayout.astro');
  const player = readSource('src/components/SekaiPlayer.astro');
  const enhancer = readSource('src/components/PageTransitionEnhancer.astro');

  assert.equal(existsSync(new URL('../src/components/MusicStatusWidget.astro', import.meta.url)), false);
  assert.match(layout, /<SekaiPlayer\s*\/>/);
  assert.match(player, /id="sekaiDockCover"[^>]*class="sekai-dock-cover"/);
  assert.match(player, /class="sekai-cover"[^>]*id="sekaiCover"/);
  assert.match(player, /id="sekaiCoverFallback"/);
  assert.doesNotMatch(enhancer, /sekaiCover|sekaiDockCover|MusicStatusWidget|DEFAULT_MUSIC_COVER|__homeMusicDefaultCoverCleanup|bindDefaultMusicCover/);
});

test('page transition uses short Firefly-style compositor animations and a persistent theme progress bar', () => {
  const enhancer = readSource('src/components/PageTransitionEnhancer.astro');

  assert.match(enhancer, /id="page-transition-progress"[^>]*transition:persist/);
  assert.match(enhancer, /duration:\s*120/);
  assert.match(enhancer, /translateY\(-?2rem\)/);
  assert.match(enhancer, /will-change:\s*transform,\s*opacity/);
  assert.match(enhancer, /astro:before-preparation/);
  assert.match(enhancer, /astro:after-swap/);
  assert.match(enhancer, /data-reduce-motion="true"/);
  assert.match(enhancer, /prefers-reduced-motion:\s*reduce/);
});
