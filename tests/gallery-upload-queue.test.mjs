import assert from 'node:assert/strict';
import test from 'node:test';
import {
  UPLOAD_STATES,
  canRetryUpload,
  createUploadItem,
  markUploadFailure,
  transitionUploadItem,
} from '../src/lib/gallery-upload-queue.mjs';

test('upload queue exposes the approved states and starts waiting', () => {
  assert.deepEqual(UPLOAD_STATES, ['waiting', 'checking', 'confirming', 'uploading', 'committing', 'success', 'failed']);
  const item = createUploadItem({ name: 'a.png', size: 3 }, 'Bang');
  assert.equal(item.state, 'waiting');
  assert.equal(item.category, 'Bang');
});

test('partial blob success cannot skip committing and become success', () => {
  let item = createUploadItem({ name: 'a.png', size: 3 }, 'Bang');
  item = transitionUploadItem(item, 'checking');
  item = transitionUploadItem(item, 'uploading', { blobSha: 'blob' });
  assert.throws(() => transitionUploadItem(item, 'success'), /状态/);
  item = transitionUploadItem(item, 'committing');
  item = transitionUploadItem(item, 'success', { remotePath: 'gallery/Bang/1.png' });
  assert.equal(item.state, 'success');
});

test('failed items keep a retryable error and can return to waiting', () => {
  const item = markUploadFailure(createUploadItem({ name: 'a.png', size: 3 }, 'Bang'), {
    code: 'network', message: '网络中断', retryable: true,
  });
  assert.equal(item.state, 'failed');
  assert.equal(canRetryUpload(item), true);
  assert.equal(transitionUploadItem(item, 'waiting').state, 'waiting');
});
