import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const hero = readFileSync(
  new URL('../src/components/HeroSlideshow.astro', import.meta.url),
  'utf8',
);

test('background canvas renderer survives transient video loop boundaries', () => {
  assert.match(hero, /var videoRenderActive = false/);
  assert.match(
    hero,
    /function renderVideoFrame\(\)\s*\{[\s\S]*?if \(!videoRenderActive \|\| !canvasEl \|\| !videoEl\) return;[\s\S]*?videoAnimFrame = requestAnimationFrame\(renderVideoFrame\)/,
  );
  assert.doesNotMatch(
    hero,
    /if \(!canvasEl \|\| videoEl\.paused \|\| videoEl\.ended\) return;/,
  );
  assert.match(
    hero,
    /function stopVideoRender\(\)\s*\{[\s\S]*?videoRenderActive = false/,
  );
});
