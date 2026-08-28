import assert from 'node:assert/strict';
import test from 'node:test';
import { createGestureState, updateGesture, finishGesture } from '../src/lib/message-board-gesture.mjs';

test('mouse click stays waiting so the note click can open details', () => {
  const state = createGestureState({ pointerType: 'mouse', startX: 0, startY: 0, now: 0 });
  assert.equal(state.phase, 'waiting');
  const result = finishGesture(state, { x: 1, y: 1, now: 80 });
  assert.equal(result.decision, 'waiting');
});

test('mouse movement beyond threshold starts drag', () => {
  const state = createGestureState({ pointerType: 'mouse', startX: 0, startY: 0, now: 0 });
  const next = updateGesture(state, { x: 12, y: 0, now: 80 });
  assert.equal(next.decision, 'drag-start');
  assert.equal(next.state.phase, 'dragging');
});

test('touch movement before 350ms yields scroll intent', () => {
  const state = createGestureState({ pointerType: 'touch', startX: 0, startY: 0, now: 0 });
  const next = updateGesture(state, { x: 0, y: 12, now: 100 });
  assert.equal(next.decision, 'scroll');
});

test('touch hold reaches drag after 350ms without movement', () => {
  const state = createGestureState({ pointerType: 'touch', startX: 0, startY: 0, now: 0 });
  const next = updateGesture(state, { x: 2, y: 2, now: 351 });
  assert.equal(next.decision, 'drag-start');
  assert.equal(next.state.phase, 'dragging');
});

test('mouse drag finish yields one drop decision', () => {
  const state = createGestureState({ pointerType: 'mouse', startX: 0, startY: 0, now: 0 });
  const dragging = updateGesture(state, { x: 20, y: 30, now: 40 });
  const result = finishGesture(dragging.state, { x: 20, y: 30, now: 50 });
  assert.equal(result.decision, 'drop');
});
