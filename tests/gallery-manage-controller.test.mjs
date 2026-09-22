import assert from 'node:assert/strict';
import test from 'node:test';

import { createGalleryManageSession } from '../src/lib/gallery-manage-controller.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function makeSession(overrides = {}) {
  const states = [];
  const models = [];
  const storageCalls = [];
  const clients = [];
  const session = createGalleryManageSession({
    loadManifest: async () => ({
      categories: [{ category: 'A', images: [{ path: 'gallery/A/1.png', category: 'A', filename: '1.png' }] }],
      stale: false,
    }),
    createClient: ({ token }) => {
      const client = {
        token,
        cleared: false,
        async validateWriteAccess() { return true; },
        clearToken() { this.cleared = true; },
      };
      clients.push(client);
      return client;
    },
    loadRemoteTree: async () => [{ path: 'gallery/A/2.png', type: 'blob', sha: 'sha2', size: 2 }],
    onState: state => states.push(structuredClone(state)),
    onModel: items => models.push(structuredClone(items)),
    storage: {
      localStorage: { setItem(...args) { storageCalls.push(['local', ...args]); } },
      sessionStorage: { setItem(...args) { storageCalls.push(['session', ...args]); } },
    },
    ...overrides,
  });
  return { session, states, models, storageCalls, clients };
}

test('starts read-only from public manifest and never writes token storage', async () => {
  const h = makeSession();
  await h.session.start();
  assert.equal(h.session.snapshot().status, 'readonly');
  assert.deepEqual(h.session.snapshot().items.map(item => item.path), ['gallery/A/1.png']);
  assert.deepEqual(h.storageCalls, []);
});

test('connect keeps token memory-only and disconnect discards write access', async () => {
  const h = makeSession();
  await h.session.start();
  await h.session.connect('secret-token');
  assert.equal(h.session.snapshot().status, 'connected');
  assert.equal(h.session.snapshot().connected, true);
  assert.deepEqual(h.storageCalls, []);
  h.session.disconnect();
  assert.equal(h.session.snapshot().status, 'readonly');
  assert.equal(h.session.snapshot().connected, false);
  assert.equal(h.clients[0].cleared, true);
  assert.deepEqual(h.storageCalls, []);
});

test('invalid token leaves session read-only and does not retain credential', async () => {
  const h = makeSession({
    createClient: () => ({
      async validateWriteAccess() { throw Object.assign(new Error('invalid'), { code: 'auth' }); },
      clearToken() {},
    }),
  });
  await h.session.start();
  await assert.rejects(h.session.connect('bad-token'), /invalid/);
  assert.equal(h.session.snapshot().connected, false);
  assert.equal(h.session.snapshot().status, 'readonly');
});

test('stale sync completion cannot replace newer remote state', async () => {
  const first = deferred();
  const second = deferred();
  let calls = 0;
  const h = makeSession({
    loadRemoteTree: async () => (++calls === 1 ? first.promise : second.promise),
  });
  await h.session.connect('secret-token');
  const older = h.session.sync();
  const newer = h.session.sync();
  second.resolve([{ path: 'gallery/A/22.png', type: 'blob' }]);
  await newer;
  first.resolve([{ path: 'gallery/A/11.png', type: 'blob' }]);
  await older;
  assert.deepEqual(h.session.snapshot().items.map(item => item.path), ['gallery/A/22.png']);
});

test('recoverable sync failure preserves the last usable model', async () => {
  let fail = false;
  const h = makeSession({
    loadRemoteTree: async () => {
      if (fail) throw Object.assign(new Error('offline'), { code: 'network', retryable: true });
      return [{ path: 'gallery/A/2.png', type: 'blob' }];
    },
  });
  await h.session.connect('secret-token');
  await h.session.sync();
  fail = true;
  await assert.rejects(h.session.sync(), /offline/);
  assert.deepEqual(h.session.snapshot().items.map(item => item.path), ['gallery/A/2.png']);
  assert.equal(h.session.snapshot().status, 'error');
});

test('destroy clears connected client without persisting credential', async () => {
  const h = makeSession();
  await h.session.connect('secret-token');
  h.session.destroy();
  assert.equal(h.clients[0].cleared, true);
  assert.equal(h.session.snapshot().connected, false);
  assert.deepEqual(h.storageCalls, []);
});
