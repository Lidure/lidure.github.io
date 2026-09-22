export const UPLOAD_STATES = Object.freeze([
  'waiting',
  'deduping',
  'needs-confirmation',
  'uploading',
  'committing',
  'success',
  'failed',
]);

const TRANSITIONS = new Map([
  ['waiting', new Set(['deduping', 'failed'])],
  ['deduping', new Set(['needs-confirmation', 'uploading', 'failed'])],
  ['needs-confirmation', new Set(['uploading', 'failed'])],
  ['uploading', new Set(['committing', 'failed'])],
  ['committing', new Set(['success', 'failed'])],
  ['success', new Set()],
  ['failed', new Set()],
]);

let nextId = 1;

export function createUploadItem(file, category) {
  return {
    id: `gallery-upload-${nextId++}`,
    file,
    category: String(category || ''),
    state: 'waiting',
    progress: 0,
    blobSha: '',
    livePath: '',
    verified: false,
    error: null,
  };
}

export function transitionUploadItem(item, nextState, patch = {}) {
  if (!UPLOAD_STATES.includes(nextState)) throw new Error(`invalid upload transition target: ${nextState}`);
  if (!TRANSITIONS.get(item.state)?.has(nextState)) {
    throw new Error(`invalid upload transition: ${item.state} -> ${nextState}`);
  }
  if (nextState === 'success' && (!patch.livePath || patch.verified !== true)) {
    throw new Error('success requires verified live path');
  }
  return {
    ...item,
    ...patch,
    state: nextState,
    error: nextState === 'failed' ? patch.error ?? item.error : null,
  };
}

export function markUploadFailure(item, error) {
  if (item.state === 'success') throw new Error('invalid upload transition: success -> failed');
  return {
    ...item,
    state: 'failed',
    livePath: '',
    verified: false,
    error: error || { code: 'unknown', message: '上传失败' },
  };
}

export function canRetryUpload(item) {
  return item?.state === 'failed';
}

export function resetUploadForRetry(item) {
  if (!canRetryUpload(item)) throw new Error('upload item is not retryable');
  return {
    ...item,
    state: 'waiting',
    progress: 0,
    blobSha: '',
    livePath: '',
    verified: false,
    error: null,
  };
}
