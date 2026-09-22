import assert from 'node:assert/strict';
import test from 'node:test';

import {
  canRetryUpload,
  createUploadItem,
  markUploadFailure,
  resetUploadForRetry,
  transitionUploadItem,
} from '../src/lib/gallery-upload-queue.mjs';

test('blob success without final ref verification never becomes live success', () => {
  let item = createUploadItem({ name: 'a.png', size: 10, type: 'image/png' }, 'Bang');
  item = transitionUploadItem(item, 'deduping');
  item = transitionUploadItem(item, 'uploading');
  item = transitionUploadItem(item, 'committing', { blobSha: 'abc' });
  item = markUploadFailure(item, { code: 'ref-conflict', message: 'conflict' });
  assert.equal(item.state, 'failed');
  assert.equal(item.livePath, '');
  assert.equal(canRetryUpload(item), true);
});

test('success requires verified live path and cannot be jumped to from waiting', () => {
  const waiting = createUploadItem({ name: 'a.png', size: 10, type: 'image/png' }, 'Bang');
  assert.throws(() => transitionUploadItem(waiting, 'success', { livePath: 'gallery/Bang/1.png' }), /invalid upload transition/i);
  let item = transitionUploadItem(waiting, 'deduping');
  item = transitionUploadItem(item, 'uploading');
  item = transitionUploadItem(item, 'committing');
  assert.throws(() => transitionUploadItem(item, 'success'), /live path/i);
  item = transitionUploadItem(item, 'success', { livePath: 'gallery/Bang/1.png', verified: true });
  assert.equal(item.state, 'success');
});

test('similar match can pause for confirmation and resume upload', () => {
  let item = createUploadItem({ name: 'a.png', size: 10, type: 'image/png' }, 'Bang');
  item = transitionUploadItem(item, 'deduping');
  item = transitionUploadItem(item, 'needs-confirmation');
  item = transitionUploadItem(item, 'uploading');
  assert.equal(item.state, 'uploading');
});

test('retry resets failed item without retaining live result', () => {
  let item = createUploadItem({ name: 'a.png', size: 10, type: 'image/png' }, 'Bang');
  item = markUploadFailure(item, { code: 'network', message: 'offline' });
  const retried = resetUploadForRetry(item);
  assert.equal(retried.state, 'waiting');
  assert.equal(retried.livePath, '');
  assert.equal(retried.error, null);
});
