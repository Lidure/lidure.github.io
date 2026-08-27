export const HOLD_MS = 350;
export const CANCEL_DISTANCE = 8;

export function createGestureState({ pointerType, startX, startY, now }) {
  return {
    pointerType,
    startX,
    startY,
    lastX: startX,
    lastY: startY,
    startedAt: now,
    phase: pointerType === 'touch' ? 'waiting' : 'dragging',
  };
}

function distance(state, x, y) {
  return Math.hypot(x - state.startX, y - state.startY);
}

export function updateGesture(state, { x, y, now }) {
  if (state.phase === 'cancelled') return { state, decision: 'scroll' };
  const next = { ...state, lastX: x, lastY: y };
  if (state.phase === 'dragging') return { state: next, decision: 'drag-move' };
  if (distance(state, x, y) > CANCEL_DISTANCE && now - state.startedAt < HOLD_MS) {
    return { state: { ...next, phase: 'cancelled' }, decision: 'scroll' };
  }
  if (now - state.startedAt >= HOLD_MS && distance(state, x, y) <= CANCEL_DISTANCE) {
    return { state: { ...next, phase: 'dragging' }, decision: 'drag-start' };
  }
  return { state: next, decision: 'waiting' };
}

export function finishGesture(state, { x, y, now }) {
  const updated = updateGesture(state, { x, y, now });
  if (state.phase === 'dragging' || updated.state.phase === 'dragging') {
    return { state: { ...updated.state, phase: 'finished' }, decision: 'drop' };
  }
  return { state: { ...updated.state, phase: 'finished' }, decision: updated.decision === 'scroll' ? 'scroll' : 'waiting' };
}
