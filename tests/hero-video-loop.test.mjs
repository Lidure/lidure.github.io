import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const guardUrl = new URL('../src/lib/hero-video-loop-guard.mjs', import.meta.url);

test('background loop guard detects a wrap and reuses the player recovery handler', async () => {
  assert.ok(existsSync(guardUrl), 'background loop guard module should exist');

  const { didVideoLoop, recoverLoopAfterWrap } = await import(guardUrl);

  assert.equal(didVideoLoop(9.8, 0.1), true);
  assert.equal(didVideoLoop(3.0, 3.2), false);
  assert.equal(didVideoLoop(0.2, 0.05), false);

  let recoveries = 0;
  const video = {
    ended: false,
    onended() {
      recoveries += 1;
    },
  };

  assert.equal(recoverLoopAfterWrap(video, 9.8, 0.1), true);
  assert.equal(recoveries, 1);

  video.ended = true;
  assert.equal(recoverLoopAfterWrap(video, 9.8, 0.1), false);
  assert.equal(recoveries, 1);
});

test('base layout installs the background loop guard', () => {
  const layout = readFileSync(
    new URL('../src/layouts/BaseLayout.astro', import.meta.url),
    'utf8',
  );

  assert.match(layout, /hero-video-loop-guard\.mjs/);
  assert.match(layout, /installHeroVideoLoopGuard\(\)/);
});
