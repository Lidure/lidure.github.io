# Native Gallery Management Transaction Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the proven pure Gallery upload/duplicate/index transaction behavior from Airi Gallery Cloud into focused Blog-side modules, preserving global numbering, perceptual-index consistency, conflict handling, and commit verification without copying the legacy Cloud UI controller.

**Architecture:** The Blog receives a DOM-free transaction module derived from `pages/zz_cloud/upload_transaction.mjs`, plus focused hashing/index helpers extracted from the legacy Cloud `app.js`. The native manager supplies an authenticated request adapter and optional large-blob creator; the transaction core owns safe planning, blob/tree/commit/ref ordering, manifest updates, conflict retry, and uncertain-ref verification.

**Tech Stack:** ES modules, browser Web Crypto / Canvas / createImageBitmap APIs, Node `node:test`, existing GitHub Git Data transaction semantics.

**Spec:** `docs/superpowers/specs/2026-09-22-gallery-native-management-design.md`

## Global Constraints

- Fixed target remains `Lidure/airi-gallery-images`, branch `main`, image root `gallery/`.
- Preserve GitHub single-file hard limit of 100 MiB.
- Preserve perceptual duplicate threshold semantics from the legacy Cloud transaction layer: Hamming distance <= 6 is a similar match.
- `gallery/gallery_index.json` is part of the upload/delete consistency model; image mutations and index mutations must not silently diverge.
- New image numbers remain globally unique across the entire Gallery, matching the legacy transaction conflict checks.
- Exact duplicate detection uses Git blob SHA within the target category; similar duplicate detection uses the perceptual index within the target category.
- Ref updates use `force: false`; conflicts must re-read base state before retry.
- If a ref update response is uncertain/transient, verify repository state before deciding success/failure.
- No DOM, dialog, toast, storage, or page-state code belongs in the transaction core.

## Review Focus

1. **Global numbering race:** two writers choosing the same numeric filename must be caught by remote-tree revalidation, not only by local planning.
2. **Manifest conflict:** if `gallery_index.json` changed remotely between planning and ref update, the transaction must fail closed with a sync/retry signal.
3. **Large-blob integrity:** Worker-created blob SHA must match the locally computed Git blob SHA before committing it.
4. **Perceptual-hash decode failure:** unsupported browser image decoding must surface as a file-level preparation error; it must not silently bypass duplicate checking.
5. **Delete/index consistency:** deleting an image must also remove its `gallery_index.json` entry in the same repository transaction or fail without claiming final success.

---

### Task 1: Port the pure GitHub upload transaction module with parity tests

**Files:**
- Create: `src/lib/gallery-upload-transaction.mjs`
- Create: `tests/gallery-upload-transaction.test.mjs`

**Interfaces:**
- Produces `GITHUB_MAX_BLOB_BYTES`, `exactRemoteMatch(tree, blobSha, category)`, `similarRemoteMatches(index, perceptualHashValue, category, limit = 3)`, `commitGitHubUploadTransaction(options)`.
- `commitGitHubUploadTransaction(options)` accepts `{ owner, repo, branch, request, items, manifest, concurrency, sleep, onProgress }` with the same semantics as the legacy Cloud module.

- [ ] **Step 1: Port behavior tests before implementation**

Copy/adapt the existing Cloud transaction behavior cases into Blog `node:test` form. Minimum cases:

```js
test('exact match is scoped to category and blob sha', () => {
  const tree = [
    { type: 'blob', path: 'gallery/A/1.png', sha: 'same' },
    { type: 'blob', path: 'gallery/B/2.png', sha: 'same' },
  ];
  assert.equal(exactRemoteMatch(tree, 'same', 'A').path, 'gallery/A/1.png');
});

test('similar matches keep distance <= 6 and rank nearest first', () => {
  const index = {
    'gallery/A/1.png': '0000000000000000',
    'gallery/A/2.png': '0000000000000001',
    'gallery/A/3.png': 'ffffffffffffffff',
  };
  const matches = similarRemoteMatches(index, '0000000000000000', 'A');
  assert.deepEqual(matches.map(item => item.path), ['gallery/A/1.png', 'gallery/A/2.png']);
});
```

Also port tests for:
- create-only path conflict;
- global numeric conflict across categories;
- exact duplicate after base re-read;
- manifest SHA conflict after ref conflict;
- transient ref failure verified by current remote tree;
- 100 MiB rejection;
- custom `createBlob()` path and normal Base64 blob path.

- [ ] **Step 2: Run focused tests and verify RED**

Run:
```bash
node --test tests/gallery-upload-transaction.test.mjs
```
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Port `pages/zz_cloud/upload_transaction.mjs` as a DOM-free Blog module**

Preserve the existing retry constants and transaction ordering. The Blog copy must not import Cloud UI files.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-upload-transaction.mjs tests/gallery-upload-transaction.test.mjs
git commit -m "feat: port Gallery upload transaction core"
```

---

### Task 2: Extract file Git-SHA and perceptual-hash preparation into a focused module

**Files:**
- Create: `src/lib/gallery-image-hash.mjs`
- Create: `tests/gallery-image-hash.test.mjs`

**Interfaces:**
- Produces `gitBlobSha(file) -> Promise<string>`, `perceptualHash(file, deps?) -> Promise<string>` and `prepareGalleryFile(file, deps?) -> Promise<{ signature, blobSha, perceptualHash }>`.

- [ ] **Step 1: Add failing deterministic hashing tests**

```js
test('gitBlobSha matches Git blob framing', async () => {
  const file = new Blob(['hello'], { type: 'image/png' });
  const sha = await gitBlobSha(file);
  assert.equal(sha, 'b6fc4c620b67d95f953a5c1c1230aaab5db5a1b0');
});
```

For perceptual hash, inject a deterministic pixel-source dependency so Node tests do not require a real canvas:

```js
test('perceptual hash is deterministic for injected 8x8 grayscale pixels', async () => {
  const pixels = Uint8Array.from({ length: 64 }, (_, i) => i);
  const value = await perceptualHash(new Blob(['x']), { readGray8x8: async () => pixels });
  assert.match(value, /^[0-9a-f]{16}$/);
});
```

Also test decode failure rejects with code `IMAGE_DECODE_FAILED`.

- [ ] **Step 2: Run focused tests and verify RED**

Run:
```bash
node --test tests/gallery-image-hash.test.mjs
```
Expected: FAIL because module does not exist.

- [ ] **Step 3: Implement hashing helpers**

Git SHA uses the exact Git object framing:

```js
const header = new TextEncoder().encode(`blob ${file.size}\0`);
const digest = await crypto.subtle.digest('SHA-1', await new Blob([header, file]).arrayBuffer());
```

Perceptual hashing ports the legacy 8x8 grayscale algorithm and its `createImageBitmap` fallback behavior into `readGray8x8()`; browser decoding failure becomes a categorized error rather than returning a fake hash.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-image-hash.mjs tests/gallery-image-hash.test.mjs
git commit -m "feat: add Gallery image hashing helpers"
```

---

### Task 3: Add Gallery index parsing, planning, and global numbering helpers

**Files:**
- Create: `src/lib/gallery-index-transaction.mjs`
- Create: `tests/gallery-index-transaction.test.mjs`

**Interfaces:**
- Produces `GALLERY_INDEX_PATH = 'gallery/gallery_index.json'`, `parseGalleryIndex(payload)`, `serializeGalleryIndex(index)`, `nextGlobalImageNumber(tree)`, `planUploadPaths(tree, category, files)`, `addIndexEntries(index, plannedUploads)`, `removeIndexEntry(index, path)`.

- [ ] **Step 1: Add failing planning/index tests**

```js
test('next number is global across categories', () => {
  const tree = [
    { path: 'gallery/A/8.png', type: 'blob' },
    { path: 'gallery/B/12.gif', type: 'blob' },
  ];
  assert.equal(nextGlobalImageNumber(tree), 13);
});

test('planned paths preserve each file extension and increment globally', () => {
  const plans = planUploadPaths(
    [{ path: 'gallery/A/12.png', type: 'blob' }],
    'Bang',
    [{ name: 'x.gif' }, { name: 'y.webp' }],
  );
  assert.deepEqual(plans.map(x => x.path), ['gallery/Bang/13.gif', 'gallery/Bang/14.webp']);
});

test('index deletion removes only exact image path', () => {
  assert.deepEqual(removeIndexEntry({ 'gallery/A/1.png': 'aa', 'gallery/A/10.png': 'bb' }, 'gallery/A/1.png'), {
    'gallery/A/10.png': 'bb',
  });
});
```

Reject unsafe categories containing slash, backslash, `.` or `..` segments.

- [ ] **Step 2: Run focused tests and verify RED**

Run:
```bash
node --test tests/gallery-index-transaction.test.mjs
```
Expected: FAIL.

- [ ] **Step 3: Implement index and numbering helpers**

Serialization must preserve the repository's existing top-level manifest shape `{ files: { ... } }` and produce stable UTF-8 JSON before Base64 encoding in the caller.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-index-transaction.mjs tests/gallery-index-transaction.test.mjs
git commit -m "feat: add Gallery index transaction helpers"
```

---

### Task 4: Add atomic delete transaction for image plus perceptual index

**Files:**
- Create: `src/lib/gallery-delete-transaction.mjs`
- Create: `tests/gallery-delete-transaction.test.mjs`

**Interfaces:**
- Produces `commitGitHubDeleteTransaction({ owner, repo, branch, request, imagePath, manifest, sleep }) -> { commitSha }`.
- `manifest` contains `{ path: GALLERY_INDEX_PATH, contentBase64, expectedSha }` representing the index after removing `imagePath`.

- [ ] **Step 1: Add failing delete transaction tests**

Minimum cases:
- image path must exist as a blob before deletion;
- index manifest SHA must still match the base tree before commit;
- new tree contains `{ path: imagePath, mode: '100644', type: 'blob', sha: null }` and the new index blob;
- ref update uses `force: false`;
- ref conflict re-reads base; changed manifest SHA fails with `MANIFEST_CONFLICT`;
- transient ref error verifies final tree before deciding failure.

Example:

```js
test('delete transaction removes image and updates index in one commit', async () => {
  const calls = makeGitRequestHarness();
  const result = await commitGitHubDeleteTransaction({
    owner: 'Lidure', repo: 'airi-gallery-images', branch: 'main', request: calls.request,
    imagePath: 'gallery/A/1.png',
    manifest: { path: 'gallery/gallery_index.json', contentBase64: 'e30=', expectedSha: 'manifest-old' },
  });
  assert.ok(result.commitSha);
  assert.equal(calls.createdTreeEntries.some(x => x.path === 'gallery/A/1.png' && x.sha === null), true);
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run:
```bash
node --test tests/gallery-delete-transaction.test.mjs
```
Expected: FAIL.

- [ ] **Step 3: Implement atomic delete transaction**

Mirror the upload transaction's base-read, conflict retry, and uncertain-ref verification semantics. Do not use the Contents API as a separate image-only deletion because that would allow `gallery_index.json` to diverge.

- [ ] **Step 4: Run focused test and verify GREEN**

Run Step 2 command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gallery-delete-transaction.mjs tests/gallery-delete-transaction.test.mjs
git commit -m "feat: add atomic Gallery delete transaction"
```

---

### Task 5: Integrate transaction core into the native manager plan

**Files:**
- Modify during Blog-plan execution: `src/lib/gallery-manage-controller.mjs`, `src/lib/gallery-github-client.mjs`, `src/lib/gallery-upload-queue.mjs`.
- Test during Blog-plan execution: `tests/gallery-manage-controller.test.mjs`.

**Interfaces:**
- Upload orchestration consumes `prepareGalleryFile`, `parseGalleryIndex`, `planUploadPaths`, `exactRemoteMatch`, `similarRemoteMatches`, `commitGitHubUploadTransaction`.
- Delete orchestration consumes `removeIndexEntry`, `serializeGalleryIndex`, `commitGitHubDeleteTransaction`.

- [ ] **Step 1: Replace any ad-hoc numbering/commit/delete logic from the Blog plan with these core APIs**

Upload sequence becomes exactly:

```text
prepareGalleryFile
→ authenticated remote tree + gallery_index read
→ exactRemoteMatch / similarRemoteMatches
→ planUploadPaths
→ addIndexEntries + serialize manifest
→ commitGitHubUploadTransaction
→ authenticated sync verification
```

Delete sequence becomes exactly:

```text
native delete confirmation
→ authenticated remote tree + gallery_index read
→ removeIndexEntry + serialize manifest
→ commitGitHubDeleteTransaction
→ authenticated sync verification
```

- [ ] **Step 2: Add integration tests proving manager delegates to the transaction core**

Use injected transaction functions/spies; assert the controller does not perform independent tree/commit/ref ordering.

- [ ] **Step 3: Run all transaction-core tests plus management controller tests**

```bash
node --test \
  tests/gallery-upload-transaction.test.mjs \
  tests/gallery-image-hash.test.mjs \
  tests/gallery-index-transaction.test.mjs \
  tests/gallery-delete-transaction.test.mjs \
  tests/gallery-manage-controller.test.mjs
```
Expected: PASS.

- [ ] **Step 4: Commit integration changes in the Blog implementation branch**

```bash
git add src/lib tests
git commit -m "feat: wire Gallery manager to transaction core"
```

---

## Handoff

This plan is a prerequisite/refinement for the Blog management plan's upload/delete tasks. During implementation, complete Tasks 1–4 before the Blog controller's final upload/delete orchestration, then use Task 5 as the integration gate. The Cloud Worker plan remains independently first in deployment order because large-file uploads depend on its production CORS support.
