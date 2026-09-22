export const UPLOAD_STATES = ['waiting', 'checking', 'confirming', 'uploading', 'committing', 'success', 'failed'];

const ALLOWED = new Map([
  ['waiting', new Set(['checking', 'failed'])],
  ['checking', new Set(['confirming', 'uploading', 'failed'])],
  ['confirming', new Set(['uploading', 'failed'])],
  ['uploading', new Set(['committing', 'failed'])],
  ['committing', new Set(['success', 'failed'])],
  ['failed', new Set(['waiting'])],
  ['success', new Set()],
]);

let nextUploadId = 1;

export function createUploadItem(file, category) {
  return {
    id: `gallery-upload-${nextUploadId++}`,
    file,
    category: String(category || '').trim(),
    state: 'waiting',
    error: null,
    blobSha: '',
    perceptualHash: '',
    remotePath: '',
  };
}

export function transitionUploadItem(item, nextState, patch = {}) {
  if (!item || !UPLOAD_STATES.includes(nextState)) throw new Error('上传状态无效');
  if (!ALLOWED.get(item.state)?.has(nextState)) {
    throw new Error(`上传状态不能从 ${item.state} 直接变为 ${nextState}`);
  }
  if (nextState === 'success' && !patch.remotePath && !item.remotePath) {
    throw new Error('上传成功状态必须包含已确认的远端路径');
  }
  return { ...item, ...patch, state: nextState, error: nextState === 'waiting' ? null : (patch.error ?? item.error) };
}

export function markUploadFailure(item, error) {
  const normalized = {
    code: error?.code || 'upload',
    message: String(error?.message || '上传失败'),
    retryable: error?.retryable !== false,
  };
  if (item.state === 'failed') return { ...item, error: normalized };
  return transitionUploadItem(item, 'failed', { error: normalized });
}

export function canRetryUpload(item) {
  return item?.state === 'failed' && item?.error?.retryable === true;
}
