import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOARD_LOGICAL_WIDTH,
  classifyBoardNoteSize,
  computeBoardHeight,
  correctDroppedPosition,
  deriveLegacyBoardNote,
  overlapRatio,
} from '../src/lib/message-board-layout.mjs';

test('layout contract is deterministic', () => {
  assert.equal(BOARD_LOGICAL_WIDTH, 1200);
  assert.equal(classifyBoardNoteSize('a'.repeat(64)), 'small');
  assert.equal(classifyBoardNoteSize('a'.repeat(65)), 'medium');
  assert.equal(classifyBoardNoteSize('a'.repeat(221)), 'large');
  assert.deepEqual(deriveLegacyBoardNote('x', 'hello'), deriveLegacyBoardNote('x', 'hello'));
});

test('drop correction clamps and removes severe overlap', () => {
  const other = { x: 100, y: 100, size: 'medium' };
  const corrected = correctDroppedPosition({ x: 100, y: 100, size: 'medium' }, [other]);
  assert.ok(corrected.x >= 0 && corrected.y >= 0);
  assert.ok(overlapRatio({ ...corrected, size: 'medium' }, other) <= 0.22);
});

test('board height keeps a bottom buffer', () => {
  assert.ok(computeBoardHeight([{ x: 0, y: 900, size: 'small' }]) >= 1300);
});
