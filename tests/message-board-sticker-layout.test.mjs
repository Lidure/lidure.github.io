import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('message board has a fuller scrapbook sticker set with spaced defaults', () => {
  const board = read('src/components/MessageBoard.astro');
  const css = read('src/styles/message-board-stickers.css');
  const expected = ['dog', 'flower', 'star', 'tape', 'rainbow', 'heart', 'blossom', 'clover'];

  for (const name of expected) {
    assert.match(board, new RegExp(`data-board-sticker="${name}"`));
    assert.match(css, new RegExp(`\\.message-board-sticker--${name}\\s*\\{`));
  }

  const stickerImages = board.match(/<img[^>]*data-sticker-image[^>]*src="https:\/\/[^\"]+"[^>]*>/g) || [];
  assert.ok(stickerImages.length >= expected.length, 'all scrapbook decorations should use third-party image assets');

  const defaults = [...board.matchAll(/data-board-sticker="([^"]+)"[^>]*data-default-x="([0-9.]+)"[^>]*data-default-y="([0-9.]+)"/g)]
    .map((match) => ({ name: match[1], x: Number(match[2]), y: Number(match[3]) }))
    .filter((item) => expected.includes(item.name));

  assert.equal(defaults.length, expected.length, 'every sticker should have an explicit default position');
  for (let i = 0; i < defaults.length; i += 1) {
    for (let j = i + 1; j < defaults.length; j += 1) {
      const dx = defaults[i].x - defaults[j].x;
      const dy = defaults[i].y - defaults[j].y;
      const distance = Math.hypot(dx, dy);
      assert.ok(distance >= 0.18, `${defaults[i].name} and ${defaults[j].name} defaults are too close (${distance.toFixed(3)})`);
    }
  }
});

test('rotated stickers drag from their translation origin instead of rotated bounding boxes', () => {
  const board = read('src/components/MessageBoard.astro');
  const dragSection = board.match(/stickers\.forEach\(\(sticker\) => \{[\s\S]*?sticker\.addEventListener\('pointerup'/)?.[0] || board;
  const persistSection = board.match(/function persistStickerPosition\(sticker: HTMLElement\) \{[\s\S]*?\n    \}/)?.[0] || '';
  const readTranslation = board.match(/function readStickerTranslation\(sticker: HTMLElement\) \{[\s\S]*?\n    \}/)?.[0] || '';

  assert.ok(readTranslation, 'dragging should read the real translate variables');
  assert.match(readTranslation, /getComputedStyle\(sticker\)/);
  assert.match(readTranslation, /getPropertyValue\('--sticker-x'\)/);
  assert.match(readTranslation, /getPropertyValue\('--sticker-y'\)/);
  assert.match(dragSection, /const current = readStickerTranslation\(sticker\)/);
  assert.doesNotMatch(dragSection, /startX\s*=\s*stickerRect\.left\s*-\s*sceneRect\.left/);
  assert.match(persistSection, /const current = readStickerTranslation\(sticker\)/);
  assert.doesNotMatch(persistSection, /stickerRect\.left\s*-\s*sceneRect\.left/);
});
