# Native Gallery Management Blog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the iframe-based Gallery manager with a native `/gallery/manage` workspace that manages the fixed `Lidure/airi-gallery-images/main` repository while keeping GitHub credentials ephemeral.

**Architecture:** The public `/gallery` remains read-only and keeps its existing manifest/image-proxy browser. A new native management route composes focused modules for GitHub API access, upload queue state, duplicate checking, dialogs, and remote reconciliation. Normal GitHub operations run from the browser; only large blob creation calls the Airi Gallery Cloud Worker route prepared by the companion Cloud plan.

**Tech Stack:** Astro 6, TypeScript/ES modules, browser Fetch API, GitHub REST/Git Data API, Node `node:test`, existing Blog design tokens and Gallery modules.

**Spec:** `docs/superpowers/specs/2026-09-22-gallery-native-management-design.md`

## Global Constraints

- Manage only GitHub repository `Lidure/airi-gallery-images`, branch `main`, image root `gallery/`.
- Do not expose platform, owner, repository, or branch configuration in the management UI.
- GitHub token lives only in current JavaScript runtime memory; never store it in localStorage, sessionStorage, cookies, URL state, rendered markup, or logs.
- `/gallery` stays read-oriented; `/gallery/manage` is a standalone page, never an overlay, iframe, drawer, or nested app.
- `/gallery?manage=1` and exact `Ctrl+Alt+G` on `/gallery` navigate to `/gallery/manage`.
- Keep legacy Cloud UI available independently, but Blog must not iframe or depend on its DOM/UI.
- Public reads continue to reject unsafe paths and `.airi-renumber-*` staging paths.
- Large files use the Cloud Worker route only after the Cloud companion plan is deployed.
- One Blog-owned dialog foundation handles token connection, image preview, delete confirmation, and duplicate comparison.
- No document-level horizontal overflow at desktop or mobile widths.
- Effective production connection policy must permit only required GitHub/Cloud origins; do not introduce wildcard CSP allowances.

## Review Focus

1. **Token lifecycle:** refresh, navigation, Astro swaps, and disconnect must discard the token; tests must prove no Web Storage write occurs.
2. **Concurrent sync/write races:** an older sync response must never replace a newer successful state; upload/delete reconciliation must remain authoritative.
3. **Partial upload failure:** successful blob creation without final ref update must remain failed/pending, never appear as live Gallery content.
4. **Touch/mobile action access:** preview/delete/connect/upload controls must not depend on hover and must fit without horizontal overflow.
5. **Remote conflict/rate-limit/network errors:** UI must preserve current usable state, categorize the error, and present a retry/reconnect path without leaking Authorization data.

---

## File Structure

### Create

- `src/pages/gallery/manage.astro` — standalone management route composition.
- `src/components/GalleryManageWorkspace.astro` — static native management DOM and lifecycle bootstrap.
- `src/components/GalleryManageDialog.astro` — single Blog-owned accessible dialog surface.
- `src/lib/gallery-manage-config.mjs` — fixed repository constants, endpoint builders, safe path/category helpers.
- `src/lib/gallery-github-client.mjs` — authenticated GitHub REST/Git Data operations for fixed repository.
- `src/lib/gallery-manage-model.mjs` — normalize manifest/tree records into categories/pages; reconcile upload/delete results.
- `src/lib/gallery-upload-queue.mjs` — upload item state machine, retry eligibility, progress updates.
- `src/lib/gallery-duplicate-check.mjs` — adapter for exact/similar matching data and comparison view models.
- `src/lib/gallery-large-upload-client.mjs` — streamed Base64 upload request to Cloud Worker.
- `src/lib/gallery-manage-dialog-controller.mjs` — single active dialog, focus trap/restore, Escape handling.
- `src/lib/gallery-manage-controller.mjs` — page orchestration, token-in-memory lifecycle, sync, upload/delete commands.
- `src/lib/gallery-manage-entry.mjs` — `/gallery?manage=1` and `Ctrl+Alt+G` navigation compatibility only.
- `src/styles/gallery-manage.css` — management-workspace-only responsive styling.
- `tests/gallery-manage-config.test.mjs`
- `tests/gallery-github-client.test.mjs`
- `tests/gallery-manage-model.test.mjs`
- `tests/gallery-upload-queue.test.mjs`
- `tests/gallery-duplicate-check.test.mjs`
- `tests/gallery-large-upload-client.test.mjs`
- `tests/gallery-manage-dialog.test.mjs`
- `tests/gallery-manage-controller.test.mjs`
- `tests/gallery-manage-page.test.mjs`

### Modify

- `src/pages/gallery.astro` — remove `<GalleryManager />`, install compatibility entry bootstrap.
- `src/lib/gallery-data.mjs` — export/reuse safe image path logic if needed by manager rather than duplicating rules.
- `src/lib/gallery-manifest-client.mjs` — keep public fetch API reusable by management read-only mode.
- `src/styles/gallery.css` — delete obsolete manager overlay styles only after route migration is green.
- `package.json` — replace old manager test entry with native-management test files.
- `tests/gallery-manager.test.mjs` — replace iframe-era expectations with compatibility-navigation contract, or delete after equivalent permanent test exists.
- `tests/gallery-integration.test.mjs` — assert public Gallery no longer renders iframe manager and management route exists.
- `tests/gallery-page.test.mjs` — assert public page contains no old overlay and no iframe-management CSS contract.

### Delete after migration is green

- `src/components/GalleryManager.astro`
- `src/lib/gallery-manager-controller.mjs`

---

### Task 1: Lock the route migration and compatibility entry behavior

**Files:**
- Create: `src/lib/gallery-manage-entry.mjs`
- Modify: `src/pages/gallery.astro`
- Test: `tests/gallery-manager.test.mjs`
- Test: `tests/gallery-integration.test.mjs`

**Interfaces:**
- Consumes: browser `location`, `history/navigation`, `KeyboardEvent`.
- Produces: `initGalleryManageEntry(doc = document, win = window) -> cleanupFn`.

- [ ] **Step 1: Rewrite the old manager test into a failing navigation contract**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { initGalleryManageEntry } from '../src/lib/gallery-manage-entry.mjs';

function makeHarness(href = 'https://lidure22.xyz/gallery') {
  const listeners = new Map();
  const doc = {
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); },
  };
  const win = {
    location: { href },
    __navigatedTo: '',
  };
  Object.defineProperty(win.location, 'assign', { value: (url) => { win.__navigatedTo = url; } });
  return { doc, win, listeners };
}

test('manage=1 redirects to the standalone native manager', () => {
  const { doc, win } = makeHarness('https://lidure22.xyz/gallery?manage=1');
  const cleanup = initGalleryManageEntry(doc, win);
  assert.equal(win.__navigatedTo, '/gallery/manage');
  cleanup();
});

test('Ctrl+Alt+G navigates to the standalone manager', () => {
  const { doc, win, listeners } = makeHarness();
  const cleanup = initGalleryManageEntry(doc, win);
  listeners.get('keydown')({ ctrlKey: true, altKey: true, metaKey: false, shiftKey: false, key: 'g', preventDefault() {} });
  assert.equal(win.__navigatedTo, '/gallery/manage');
  cleanup();
});
```

Also add a source contract asserting `src/pages/gallery.astro` no longer imports `GalleryManager` and contains no `gallery-manager-overlay` or `iframe` manager structure.

- [ ] **Step 2: Run focused tests and verify RED**

Run:
```bash
node --test tests/gallery-manager.test.mjs tests/gallery-integration.test.mjs
```
Expected: FAIL because `gallery-manage-entry.mjs` and the native route do not exist and `gallery.astro` still renders `GalleryManager`.

- [ ] **Step 3: Implement the minimal compatibility entry**

```js
export function initGalleryManageEntry(doc = document, win = window) {
  let disposed = false;
  const go = () => {
    if (disposed) return;
    win.location.assign('/gallery/manage');
  };
  const onKeydown = (event) => {
    const exact = event.ctrlKey && event.altKey && !event.metaKey && !event.shiftKey
      && String(event.key).toLowerCase() === 'g';
    if (!exact) return;
    event.preventDefault();
    go();
  };
  doc.addEventListener('keydown', onKeydown);
  const url = new URL(win.location.href);
  if (url.searchParams.get('manage') === '1') go();
  return () => {
    disposed = true;
    doc.removeEventListener('keydown', onKeydown);
  };
}
```

Modify `gallery.astro` to remove `GalleryManager` and mount only the compatibility entry script with the existing Astro lifecycle pattern.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:
```bash
node --test tests/gallery-manager.test.mjs tests/gallery-integration.test.mjs
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/gallery.astro src/lib/gallery-manage-entry.mjs tests/gallery-manager.test.mjs tests/gallery-integration.test.mjs
git commit -m "refactor: route Gallery management to native workspace"
```

---

### Task 2: Define fixed repository configuration and safe management data model

**Files:**
- Create: `src/lib/gallery-manage-config.mjs`
- Create: `src/lib/gallery-manage-model.mjs`
- Test: `tests/gallery-manage-config.test.mjs`
- Test: `tests/gallery-manage-model.test.mjs`
- Modify: `src/lib/gallery-data.mjs` only if exporting existing safety helpers prevents duplication.

**Interfaces:**
- Produces `GALLERY_REPOSITORY`, `GALLERY_BRANCH`, `GALLERY_ROOT`, `githubApi(path)`, `isSafeManagedImagePath(path)`, `normalizeRemoteItems(items)`, `groupManagedItems(items)`, `paginateManagedItems(items, page, pageSize)`, `reconcileDelete(items, path, remotePaths)`.

- [ ] **Step 1: Add failing pure-function tests**

```js
test('management endpoints are fixed to the Airi image repository', () => {
  assert.equal(GALLERY_REPOSITORY, 'Lidure/airi-gallery-images');
  assert.equal(GALLERY_BRANCH, 'main');
  assert.equal(githubApi('/git/refs/heads/main'), 'https://api.github.com/repos/Lidure/airi-gallery-images/git/refs/heads/main');
});

test('managed image paths reject traversal, nesting and staging names', () => {
  assert.equal(isSafeManagedImagePath('gallery/Bang/12.gif'), true);
  assert.equal(isSafeManagedImagePath('gallery/Bang/.airi-renumber-1.gif'), false);
  assert.equal(isSafeManagedImagePath('gallery/Bang/nested/12.gif'), false);
  assert.equal(isSafeManagedImagePath('gallery/../12.gif'), false);
});

test('older delete optimism cannot override authoritative remote presence', () => {
  const item = { path: 'gallery/Bang/12.gif' };
  assert.deepEqual(reconcileDelete([item], item.path, new Set([item.path])), [item]);
  assert.deepEqual(reconcileDelete([item], item.path, new Set()), []);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:
```bash
node --test tests/gallery-manage-config.test.mjs tests/gallery-manage-model.test.mjs
```
Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement minimal fixed-config and model modules**

Use one canonical safe-path function and reuse the public Gallery image-extension set. Do not expose a setter for repository/branch values.

```js
export const GALLERY_REPOSITORY = 'Lidure/airi-gallery-images';
export const GALLERY_BRANCH = 'main';
export const GALLERY_ROOT = 'gallery';
export const GITHUB_API_ROOT = `https://api.github.com/repos/${GALLERY_REPOSITORY}`;
export const githubApi = (path) => `${GITHUB_API_ROOT}${path.startsWith('/') ? path : `/${path}`}`;
```

`normalizeRemoteItems()` must discard unsafe/staging paths before grouping.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the command from Step 2; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-manage-config.mjs src/lib/gallery-manage-model.mjs src/lib/gallery-data.mjs tests/gallery-manage-config.test.mjs tests/gallery-manage-model.test.mjs
git commit -m "feat: add fixed Gallery management data model"
```

---

### Task 3: Build the authenticated GitHub client with categorized errors

**Files:**
- Create: `src/lib/gallery-github-client.mjs`
- Test: `tests/gallery-github-client.test.mjs`

**Interfaces:**
- Consumes: ephemeral token passed per call; fixed endpoint builders from Task 2.
- Produces: `createGalleryGitHubClient({ fetchImpl, token })` with methods `validateWriteAccess()`, `getBranchHead()`, `getTree(treeSha)`, `createBlob(base64)`, `createTree(baseTreeSha, entries)`, `createCommit(message, treeSha, parentSha)`, `updateRef(commitSha, expectedOldSha?)`, `getContentSha(path)`, `deletePath(path, message)`, and `classifyGitHubError(response, body)`.

- [ ] **Step 1: Add failing client tests using a fake fetch**

```js
test('client sends Authorization but never exposes token in returned errors', async () => {
  const calls = [];
  const client = createGalleryGitHubClient({
    token: 'secret-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({ message: 'Bad credentials secret-token' }), { status: 401 });
    },
  });
  await assert.rejects(client.validateWriteAccess(), (error) => {
    assert.equal(error.code, 'auth');
    assert.doesNotMatch(error.message, /secret-token/);
    return true;
  });
  assert.match(calls[0].init.headers.Authorization, /^Bearer secret-token$/);
});

test('rate limit is categorized without destroying current UI state', async () => {
  const client = createGalleryGitHubClient({
    token: 'x',
    fetchImpl: async () => new Response('{"message":"rate limit"}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }),
  });
  await assert.rejects(client.getBranchHead(), (error) => error.code === 'rate-limit');
});
```

Also test permission 403 with remaining quota, 409/422 ref conflict, and network exception.

- [ ] **Step 2: Run focused test and verify RED**

Run:
```bash
node --test tests/gallery-github-client.test.mjs
```
Expected: FAIL because the client does not exist.

- [ ] **Step 3: Implement minimal client**

Use headers:

```js
const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
};
```

Sanitize all thrown messages so neither raw Authorization headers nor the token string are included. Keep `fetchImpl` injectable for tests.

- [ ] **Step 4: Run focused test and verify GREEN**

Run the Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-github-client.mjs tests/gallery-github-client.test.mjs
git commit -m "feat: add fixed Gallery GitHub client"
```

---

### Task 4: Add upload queue state machine and partial-failure semantics

**Files:**
- Create: `src/lib/gallery-upload-queue.mjs`
- Test: `tests/gallery-upload-queue.test.mjs`

**Interfaces:**
- Produces `createUploadItem(file, category)`, `transitionUploadItem(item, nextState, patch?)`, `canRetryUpload(item)`, `markUploadFailure(item, error)`, `UPLOAD_STATES`.

- [ ] **Step 1: Add failing state-machine tests**

```js
test('blob success without final ref update never becomes success', () => {
  let item = createUploadItem({ name: 'a.png', size: 10, type: 'image/png' }, 'Bang');
  item = transitionUploadItem(item, 'uploading');
  item = transitionUploadItem(item, 'committing', { blobSha: 'abc' });
  item = markUploadFailure(item, { code: 'ref-conflict', message: 'conflict' });
  assert.equal(item.state, 'failed');
  assert.equal(item.livePath, '');
  assert.equal(canRetryUpload(item), true);
});

test('state machine rejects invalid success jump', () => {
  const item = createUploadItem({ name: 'a.png', size: 10, type: 'image/png' }, 'Bang');
  assert.throws(() => transitionUploadItem(item, 'success'), /invalid upload transition/i);
});
```

Cover waiting → deduping → needs-confirmation/uploading → committing → success/failed and independent retry reset.

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node --test tests/gallery-upload-queue.test.mjs
```
Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement explicit transitions**

Use immutable returned records; never infer success solely from `blobSha`. Require `livePath` and verified remote presence before `success`.

- [ ] **Step 4: Run and verify GREEN**

Run Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-upload-queue.mjs tests/gallery-upload-queue.test.mjs
git commit -m "feat: model Gallery upload task states"
```

---

### Task 5: Add duplicate-check adapter and native comparison view model

**Files:**
- Create: `src/lib/gallery-duplicate-check.mjs`
- Test: `tests/gallery-duplicate-check.test.mjs`

**Interfaces:**
- Consumes: current manifest/index match data, pending file preview URL, library proxy URL builder.
- Produces: `rankDuplicateMatches(matches)`, `duplicateDecision(matches)`, `buildDuplicateComparison({ pending, matches, imageUrlForPath })`.

- [ ] **Step 1: Add failing tests for exact vs similar matches**

```js
test('exact match is blocking while similar matches are ranked for confirmation', () => {
  assert.equal(duplicateDecision([{ exact: true, path: 'gallery/A/1.png' }]).kind, 'exact-block');
  const result = duplicateDecision([
    { exact: false, similarity: 0.91, path: 'gallery/A/2.png' },
    { exact: false, similarity: 0.96, path: 'gallery/A/3.png' },
  ]);
  assert.equal(result.kind, 'confirm-similar');
  assert.equal(result.matches[0].path, 'gallery/A/3.png');
});
```

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node --test tests/gallery-duplicate-check.test.mjs
```
Expected: FAIL.

- [ ] **Step 3: Implement adapter without copying legacy DOM code**

Keep it pure: it returns labels, metadata, URLs, and decisions only. The dialog controller owns rendering.

- [ ] **Step 4: Run and verify GREEN**

Run Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-duplicate-check.mjs tests/gallery-duplicate-check.test.mjs
git commit -m "feat: add Gallery duplicate decision model"
```

---

### Task 6: Add the Cloud large-upload client

**Files:**
- Create: `src/lib/gallery-large-upload-client.mjs`
- Test: `tests/gallery-large-upload-client.test.mjs`

**Interfaces:**
- Consumes: ephemeral token, file/ReadableStream, fixed Cloud route `https://airigallery.lidure22.xyz/__gallery-github-blob/Lidure/airi-gallery-images`.
- Produces: `uploadLargeBlob({ file, token, fetchImpl }) -> { sha }`.

- [ ] **Step 1: Add failing request-contract tests**

```js
test('large upload uses only the fixed Cloud route and forwards ephemeral auth', async () => {
  const calls = [];
  await uploadLargeBlob({
    file: new Blob(['abc'], { type: 'image/png' }),
    token: 'secret',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response('{"sha":"blob123"}', { status: 201 });
    },
  });
  assert.equal(calls[0].url, 'https://airigallery.lidure22.xyz/__gallery-github-blob/Lidure/airi-gallery-images');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret');
  assert.equal(calls[0].init.headers['X-Gallery-Content-Encoding'], 'base64');
});
```

Add failure sanitization test proving response errors cannot include the token.

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node --test tests/gallery-large-upload-client.test.mjs
```
Expected: FAIL.

- [ ] **Step 3: Implement streamed Base64 upload**

Reuse the same chunked Base64 stream semantics as Cloud `blob_stream.mjs`; do not call `file.arrayBuffer()` for the large-file path. Set `duplex: 'half'` where required and include declared raw size.

- [ ] **Step 4: Run and verify GREEN**

Run Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-large-upload-client.mjs tests/gallery-large-upload-client.test.mjs
git commit -m "feat: add Gallery large-upload client"
```

---

### Task 7: Build the single native dialog foundation

**Files:**
- Create: `src/components/GalleryManageDialog.astro`
- Create: `src/lib/gallery-manage-dialog-controller.mjs`
- Test: `tests/gallery-manage-dialog.test.mjs`

**Interfaces:**
- Produces `initGalleryManageDialog(root) -> { open(mode, payload, invoker), close(result?), destroy() }`.
- Supported modes: `connect`, `preview`, `delete`, `duplicate`.

- [ ] **Step 1: Add failing source/controller tests**

Assert one dialog root with `role="dialog"`, `aria-modal="true"`, a single backdrop, no nested `modal-mask`, no iframe, and controller behavior for Escape/focus restore.

```js
test('dialog restores focus to the invoking control', () => {
  const invoker = { focused: false, focus() { this.focused = true; } };
  const dialog = createDialogHarness();
  const api = initGalleryManageDialog(dialog.root);
  api.open('delete', { path: 'gallery/A/1.png' }, invoker);
  api.close(false);
  assert.equal(invoker.focused, true);
});
```

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node --test tests/gallery-manage-dialog.test.mjs
```
Expected: FAIL.

- [ ] **Step 3: Implement one active dialog layer**

Render mode-specific content inside one panel. Use named listeners, a bounded focus trap, one document scroll-lock class, Escape close for non-committing states, and cleanup on Astro swap.

- [ ] **Step 4: Run and verify GREEN**

Run Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/GalleryManageDialog.astro src/lib/gallery-manage-dialog-controller.mjs tests/gallery-manage-dialog.test.mjs
git commit -m "feat: add native Gallery management dialog"
```

---

### Task 8: Build the management workspace route and responsive static UI

**Files:**
- Create: `src/pages/gallery/manage.astro`
- Create: `src/components/GalleryManageWorkspace.astro`
- Create: `src/styles/gallery-manage.css`
- Test: `tests/gallery-manage-page.test.mjs`

**Interfaces:**
- Static DOM IDs/classes consumed by Task 9 controller: `gallery-manage-root`, `gallery-manage-status`, `gallery-manage-connect`, `gallery-manage-sync`, `gallery-manage-disconnect`, `gallery-manage-dropzone`, `gallery-manage-file-input`, `gallery-manage-category-select`, `gallery-manage-new-category`, `gallery-manage-upload-list`, `gallery-manage-tabs`, `gallery-manage-grid`, `gallery-manage-pager`.

- [ ] **Step 1: Add failing page/source layout tests**

Assert route uses `BaseLayout`, imports `gallery-manage.css`, contains the required controls/regions and `GalleryManageDialog`, contains no iframe/Cloud UI markup, and CSS uses desktop two-region layout with mobile single-column fallback and wrapped categories.

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node --test tests/gallery-manage-page.test.mjs
```
Expected: FAIL because route/components do not exist.

- [ ] **Step 3: Implement static workspace and Blog-native styling**

Use existing `--standard-*` tokens. Desktop: upload/task rail plus main Gallery region; mobile <= 720px: single column and 2-column grid. Touch media query must keep image actions visible.

- [ ] **Step 4: Run and verify GREEN**

Run Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/gallery/manage.astro src/components/GalleryManageWorkspace.astro src/styles/gallery-manage.css tests/gallery-manage-page.test.mjs
git commit -m "feat: add native Gallery management workspace"
```

---

### Task 9: Implement management controller, ephemeral token lifecycle, and race-safe sync

**Files:**
- Create: `src/lib/gallery-manage-controller.mjs`
- Modify: `src/components/GalleryManageWorkspace.astro`
- Test: `tests/gallery-manage-controller.test.mjs`

**Interfaces:**
- Consumes modules from Tasks 2–7.
- Produces `initGalleryManageController(root, deps?) -> cleanupFn`.

- [ ] **Step 1: Add failing controller tests**

Cover read-only initial manifest load, connect validation, disconnect, sync generation race, storage prohibition, and error preservation.

```js
test('token is memory-only and cleanup discards write access', async () => {
  const storageCalls = [];
  const deps = makeDeps({
    localStorage: { setItem(...args) { storageCalls.push(args); } },
    sessionStorage: { setItem(...args) { storageCalls.push(args); } },
  });
  const controller = initGalleryManageController(deps.root, deps);
  await deps.connectWithToken('secret');
  assert.equal(deps.status(), 'connected');
  controller();
  assert.deepEqual(storageCalls, []);
  assert.equal(deps.inspectToken(), undefined);
});

test('stale sync completion cannot replace newer state', async () => {
  const deps = makeDeferredSyncDeps();
  initGalleryManageController(deps.root, deps);
  const first = deps.triggerSync();
  const second = deps.triggerSync();
  deps.resolveSecond([{ path: 'gallery/A/2.png' }]);
  await second;
  deps.resolveFirst([{ path: 'gallery/A/1.png' }]);
  await first;
  assert.deepEqual(deps.renderedPaths(), ['gallery/A/2.png']);
});
```

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node --test tests/gallery-manage-controller.test.mjs
```
Expected: FAIL.

- [ ] **Step 3: Implement controller in small orchestration functions**

Keep token in a closure variable only. Use `syncGeneration += 1` and apply results only when generation matches. Disconnected sync calls `loadGalleryManifest({ force: true })`; connected sync uses GitHub branch/tree APIs. Preserve prior rendered model on recoverable sync failure.

- [ ] **Step 4: Run and verify GREEN**

Run Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-manage-controller.mjs src/components/GalleryManageWorkspace.astro tests/gallery-manage-controller.test.mjs
git commit -m "feat: orchestrate native Gallery management state"
```

---

### Task 10: Implement upload orchestration with duplicate confirmation and remote verification

**Files:**
- Modify: `src/lib/gallery-manage-controller.mjs`
- Modify: `src/lib/gallery-github-client.mjs`
- Modify: `src/lib/gallery-upload-queue.mjs`
- Test: `tests/gallery-manage-controller.test.mjs`
- Test: `tests/gallery-upload-queue.test.mjs`

**Interfaces:**
- Adds controller commands for file selection/drop, category assignment, `uploadPendingItem(id)`, `retryUpload(id)`.

- [ ] **Step 1: Add failing orchestration tests**

Test equivalent file-picker/drop queue entries, exact duplicate block, similar-match dialog path, small vs large blob route selection, ref-update failure, independent retry, and final remote verification requirement.

```js
test('upload is only marked success after remote sync confirms target path', async () => {
  const deps = makeUploadDeps({ remoteAfterCommit: [] });
  await deps.controller.uploadPendingItem('item-1');
  assert.equal(deps.item('item-1').state, 'failed');
  assert.match(deps.item('item-1').error.message, /remote verification/i);
});
```

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node --test tests/gallery-manage-controller.test.mjs tests/gallery-upload-queue.test.mjs
```
Expected: new cases FAIL.

- [ ] **Step 3: Implement upload transaction orchestration**

Sequence:

```text
validate file/category
→ dedupe exact/similar
→ user confirmation if needed
→ create blob (GitHub direct or Cloud large-upload client)
→ create tree
→ create commit
→ update main ref with conflict protection
→ authenticated sync
→ mark success only if target path exists remotely
```

Never expose `blobSha` as success. Keep failed items retryable.

- [ ] **Step 4: Run and verify GREEN**

Run Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-manage-controller.mjs src/lib/gallery-github-client.mjs src/lib/gallery-upload-queue.mjs tests/gallery-manage-controller.test.mjs tests/gallery-upload-queue.test.mjs
git commit -m "feat: add verified native Gallery uploads"
```

---

### Task 11: Implement delete confirmation and authoritative reconciliation

**Files:**
- Modify: `src/lib/gallery-manage-controller.mjs`
- Modify: `src/lib/gallery-github-client.mjs`
- Test: `tests/gallery-manage-controller.test.mjs`
- Test: `tests/gallery-manage-model.test.mjs`

**Interfaces:**
- Adds controller command `requestDelete(path, invoker)` and client transaction helpers as needed.

- [ ] **Step 1: Add failing delete tests**

```js
test('delete card is removed only after remote tree confirms absence', async () => {
  const deps = makeDeleteDeps({ remoteAfterDelete: ['gallery/A/1.png'] });
  await deps.controller.requestDelete('gallery/A/1.png', deps.invoker);
  assert.deepEqual(deps.renderedPaths(), ['gallery/A/1.png']);
  assert.equal(deps.cardState('gallery/A/1.png'), 'error');
});
```

Also test cancel does not call GitHub, thumbnail/category/filename appear in dialog payload, and ref conflict restores the card.

- [ ] **Step 2: Run and verify RED**

Run:
```bash
node --test tests/gallery-manage-controller.test.mjs tests/gallery-manage-model.test.mjs
```
Expected: new cases FAIL.

- [ ] **Step 3: Implement delete transaction and reconciliation**

Use the latest remote branch/tree state. Mark card `deleting` locally, commit deletion, sync, and only remove after absence is confirmed. On error, restore card and render scoped action.

- [ ] **Step 4: Run and verify GREEN**

Run Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-manage-controller.mjs src/lib/gallery-github-client.mjs tests/gallery-manage-controller.test.mjs tests/gallery-manage-model.test.mjs
git commit -m "feat: add verified native Gallery deletion"
```

---

### Task 12: Remove obsolete iframe manager implementation and styles

**Files:**
- Delete: `src/components/GalleryManager.astro`
- Delete: `src/lib/gallery-manager-controller.mjs`
- Modify: `src/styles/gallery.css`
- Modify: `tests/gallery-page.test.mjs`
- Modify: `tests/gallery-integration.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Public Gallery compatibility now comes solely from `gallery-manage-entry.mjs`.

- [ ] **Step 1: Add/strengthen failing no-legacy-manager tests before deletion**

Assert repository source references contain none of:

```text
gallery-manager-overlay
gallery-manager-frame-host
document.createElement('iframe')
https://airigallery.lidure22.xyz/ as an iframe src
html.gallery-manager-open
```

Keep legitimate Cloud URLs for image/large-upload clients excluded from this assertion by scoping it to deleted manager files/public page CSS.

- [ ] **Step 2: Run focused tests and verify RED against the legacy files**

Run:
```bash
node --test tests/gallery-page.test.mjs tests/gallery-integration.test.mjs
```
Expected: FAIL until legacy files/styles are removed.

- [ ] **Step 3: Delete legacy files and obsolete CSS blocks; update test script list**

Remove only manager-overlay CSS selectors. Do not remove public lightbox styles.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/GalleryManager.astro src/lib/gallery-manager-controller.mjs src/styles/gallery.css tests/gallery-page.test.mjs tests/gallery-integration.test.mjs package.json
git commit -m "refactor: remove legacy Gallery iframe manager"
```

---

### Task 13: Full automated verification and real-browser layout regression

**Files:**
- Modify only if verification finds a defect; otherwise no product changes.
- Optional temporary PR-only workflow must be deleted before merge.

**Interfaces:** none.

- [ ] **Step 1: Run full Blog verification**

```bash
npm ci
npm test
```

Expected:
- `astro check`: 0 errors, 0 warnings;
- static build succeeds including `/gallery/manage/index.html`;
- all site tests pass.

- [ ] **Step 2: Run a real headless Chrome verification at 1440px**

Serve `dist` and verify via browser DOM/computed layout:

```js
const result = {
  iframeCount: document.querySelectorAll('iframe').length,
  oldOverlayCount: document.querySelectorAll('.gallery-manager-overlay').length,
  manageRoot: Boolean(document.querySelector('#gallery-manage-root')),
  pageScrollWidth: document.documentElement.scrollWidth,
  viewportWidth: innerWidth,
  dialogCount: document.querySelectorAll('[role="dialog"][aria-modal="true"]').length,
};
```

Expected on `/gallery/manage`:
- `iframeCount === 0`;
- `oldOverlayCount === 0`;
- `manageRoot === true`;
- `pageScrollWidth <= viewportWidth + 1`;
- at most one active dialog layer.

- [ ] **Step 3: Repeat browser verification at a mobile width such as 390x844**

Assert two-column image grid where space permits, controls are visible without hover, dialogs fit viewport, and no document-level horizontal overflow.

- [ ] **Step 4: Verify effective production-shaped connection policy**

Inspect built/deployed response headers and ensure required requests can target only:
- `https://api.github.com`;
- `https://raw.githubusercontent.com`;
- `https://airigallery.lidure22.xyz`.

Do not broaden a CSP to `connect-src *`.

- [ ] **Step 5: Commit any verification-only permanent test improvements**

```bash
git add tests package.json
# only if permanent tests changed
git commit -m "test: verify native Gallery management workspace"
```

---

## Final Merge Order

1. Merge and deploy the companion Cloud plan first so the allowed cross-origin large-upload route exists.
2. Rebase/update the Blog implementation branch onto current `main` if needed.
3. Run Task 13 again on the final Blog head.
4. Merge Blog PR.
5. Verify GitHub Pages deployment succeeds.
6. Verify live `/gallery`, `/gallery?manage=1`, and `/gallery/manage` behavior without using real CI secrets.
