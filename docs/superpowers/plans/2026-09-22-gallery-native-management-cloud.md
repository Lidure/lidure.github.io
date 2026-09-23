# Native Gallery Management Cloud Worker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing Airi Gallery Cloud Worker large-blob route so the native Blog manager at `https://lidure22.xyz/gallery/manage` can use it safely, without turning the Worker into a general cross-origin GitHub proxy.

**Architecture:** Keep the existing `/__gallery-github-blob/<owner>/<repo>` streaming proxy and same-origin Cloud behavior. Add narrowly scoped CORS handling that permits only `https://lidure22.xyz` for the fixed `Lidure/airi-gallery-images` target, including preflight, while preserving Authorization, size, encoding, and streaming protections.

**Tech Stack:** Cloudflare Pages/Workers JavaScript, existing `worker.js`, `FixedLengthStream`, Python pytest source-contract tests, Node tests for JS streaming helpers.

**Spec:** `Lidure/lidure.github.io:docs/superpowers/specs/2026-09-22-gallery-native-management-design.md`

## Global Constraints

- Same-origin Airi Gallery Cloud uploads must continue to work.
- Cross-origin access is allowed only from exact origin `https://lidure22.xyz`.
- Blog cross-origin upload target is fixed to owner `Lidure`, repo `airi-gallery-images`.
- Arbitrary origins and arbitrary repositories remain rejected.
- `Authorization` is mandatory and is forwarded only for the upstream GitHub blob request; it is never persisted or logged.
- `X-Gallery-Content-Encoding: base64` and `X-Gallery-Blob-Size` validation remain mandatory.
- 64 MiB raw-file cap remains enforced.
- Worker must continue streaming; do not buffer the request with `arrayBuffer()`, `text()`, `blob()`, or Worker-side `btoa()`.
- CORS response headers must be emitted only for the allowed Blog origin and only for the large-blob route.
- Image proxy behavior and static asset fallback stay unchanged.

## Review Focus

1. **Preflight without Authorization:** valid Blog `OPTIONS` must succeed only for fixed route/target and must not require an actual token because browsers do not send it on preflight.
2. **Origin spoof/broadening:** `https://lidure22.xyz.evil.example`, `http://lidure22.xyz`, `https://www.lidure22.xyz`, and missing/foreign origins must not accidentally gain Blog CORS privileges.
3. **Wrong repository target:** even an allowed Blog origin and valid-looking Authorization must be rejected if owner/repo differ from `Lidure/airi-gallery-images`.
4. **Error responses:** allowed Blog-origin 4xx/5xx responses must still include the restricted CORS header so the native manager can read the error body; disallowed origins must not receive it.
5. **Streaming invariants:** CORS changes must not introduce buffering or change the fixed-length upstream blob upload semantics.

---

## File Structure

### Modify

- `pages/zz_cloud/worker.js` — add exact-origin CORS policy, fixed-target gate, preflight handling, and CORS-aware JSON/error responses for the blob route.
- `tests/test_cloud_large_upload_stream.py` — lock source-level route/CORS/streaming invariants.
- `tests/test_cloud_security_contract.py` — lock exact allowed origin and rejection rules.

### Create

- `tests/js/cloud_large_upload_cors.test.mjs` — behavior-level Worker request tests with mocked upstream fetch/Worker globals where practical.
- `tests/test_cloud_large_upload_cors_js.py` — pytest wrapper invoking the Node CORS behavior test.

---

### Task 1: Lock exact Blog-origin and fixed-target CORS policy in RED tests

**Files:**
- Modify: `tests/test_cloud_security_contract.py`
- Modify: `tests/test_cloud_large_upload_stream.py`
- Create: `tests/js/cloud_large_upload_cors.test.mjs`
- Create: `tests/test_cloud_large_upload_cors_js.py`

**Interfaces:**
- Tests consume the Worker default export `fetch(request, env)`.
- Expected policy constants: `BLOG_ORIGIN = 'https://lidure22.xyz'`, `BLOG_GITHUB_OWNER = 'Lidure'`, `BLOG_GITHUB_REPO = 'airi-gallery-images'`.

- [ ] **Step 1: Add source-contract tests that fail against current Worker**

```python
def test_large_upload_worker_scopes_blog_cors_to_exact_origin_and_repo():
    assert "const BLOG_ORIGIN = 'https://lidure22.xyz'" in WORKER
    assert "const BLOG_GITHUB_OWNER = 'Lidure'" in WORKER
    assert "const BLOG_GITHUB_REPO = 'airi-gallery-images'" in WORKER
    assert 'Access-Control-Allow-Origin' in WORKER
    assert 'OPTIONS' in WORKER
    assert 'Access-Control-Allow-Headers' in WORKER
```

Keep the existing streaming assertions (`FixedLengthStream`, no `arrayBuffer`, no Worker-side `btoa`).

- [ ] **Step 2: Add behavior tests for allowed/disallowed origins and preflight**

The Node test should build Requests for:

```js
const ALLOWED = 'https://lidure22.xyz';
const ROUTE = 'https://airigallery.lidure22.xyz/__gallery-github-blob/Lidure/airi-gallery-images';
const WRONG_REPO = 'https://airigallery.lidure22.xyz/__gallery-github-blob/Lidure/other';
```

Minimum assertions:

```js
test('allowed Blog preflight is narrowly permitted', async () => {
  const request = new Request(ROUTE, {
    method: 'OPTIONS',
    headers: {
      Origin: ALLOWED,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,x-gallery-content-encoding,x-gallery-blob-size',
    },
  });
  const response = await worker.fetch(request, { ASSETS: { fetch() { throw new Error('asset fallback not expected'); } } });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), ALLOWED);
  assert.match(response.headers.get('Access-Control-Allow-Methods') || '', /POST/);
  assert.match(response.headers.get('Access-Control-Allow-Headers') || '', /Authorization/i);
});

test('lookalike and wrong-target requests receive no Blog CORS privilege', async () => {
  for (const origin of ['https://lidure22.xyz.evil.example', 'http://lidure22.xyz', 'https://www.lidure22.xyz']) {
    const response = await worker.fetch(new Request(ROUTE, {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'POST' },
    }), env);
    assert.notEqual(response.headers.get('Access-Control-Allow-Origin'), origin);
  }
  const wrongTarget = await worker.fetch(new Request(WRONG_REPO, {
    method: 'OPTIONS',
    headers: { Origin: ALLOWED, 'Access-Control-Request-Method': 'POST' },
  }), env);
  assert.notEqual(wrongTarget.status, 204);
});
```

- [ ] **Step 3: Run focused tests and verify RED**

Run:
```bash
python -m pytest tests/test_cloud_large_upload_stream.py tests/test_cloud_security_contract.py tests/test_cloud_large_upload_cors_js.py -v
```
Expected: FAIL on missing CORS constants/OPTIONS behavior.

- [ ] **Step 4: Commit tests only**

```bash
git add tests/test_cloud_large_upload_stream.py tests/test_cloud_security_contract.py tests/js/cloud_large_upload_cors.test.mjs tests/test_cloud_large_upload_cors_js.py
git commit -m "test: lock native Blog large-upload CORS policy"
```

---

### Task 2: Implement exact-origin preflight and fixed-target gate

**Files:**
- Modify: `pages/zz_cloud/worker.js`
- Test: files from Task 1.

**Interfaces:**
- Add helpers `isAllowedBlogOrigin(origin)`, `isAllowedBlogBlobTarget(target)`, `corsHeadersFor(origin)`, `preflightResponse(request, target)`.

- [ ] **Step 1: Add policy constants and pure helpers**

```js
const BLOG_ORIGIN = 'https://lidure22.xyz';
const BLOG_GITHUB_OWNER = 'Lidure';
const BLOG_GITHUB_REPO = 'airi-gallery-images';

function isAllowedBlogOrigin(origin) {
  return origin === BLOG_ORIGIN;
}

function isAllowedBlogBlobTarget(target) {
  return target?.owner === BLOG_GITHUB_OWNER && target?.repo === BLOG_GITHUB_REPO;
}

function corsHeadersFor(origin) {
  if (!isAllowedBlogOrigin(origin)) return {};
  return {
    'Access-Control-Allow-Origin': BLOG_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Gallery-Content-Encoding, X-Gallery-Blob-Size',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}
```

- [ ] **Step 2: Handle preflight before upload authentication**

Within the blob-route branch, if method is `OPTIONS`:

```js
const origin = request.headers.get('Origin') || '';
if (!isAllowedBlogOrigin(origin) || !isAllowedBlogBlobTarget(blobTarget)) {
  return new Response('Forbidden', { status: 403 });
}
return new Response(null, { status: 204, headers: corsHeadersFor(origin) });
```

Do not require Authorization on `OPTIONS`.

- [ ] **Step 3: Keep POST cross-origin gate exact**

Replace current generic `origin !== requestUrl.origin` rejection with:

```js
const requestUrl = new URL(request.url);
const origin = request.headers.get('Origin') || '';
const sameOrigin = !origin || origin === requestUrl.origin;
const allowedBlogCrossOrigin = isAllowedBlogOrigin(origin) && isAllowedBlogBlobTarget(target);
if (!sameOrigin && !allowedBlogCrossOrigin) {
  return jsonError('跨站上传请求已拒绝', 403);
}
```

Same-origin behavior remains unchanged. A Blog-origin request to any other owner/repo is rejected.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:
```bash
python -m pytest tests/test_cloud_large_upload_stream.py tests/test_cloud_security_contract.py tests/test_cloud_large_upload_cors_js.py -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pages/zz_cloud/worker.js tests
git commit -m "feat: allow fixed Blog origin for large Gallery uploads"
```

---

### Task 3: Make allowed-origin success and error responses readable without broadening CORS

**Files:**
- Modify: `pages/zz_cloud/worker.js`
- Modify: `tests/js/cloud_large_upload_cors.test.mjs`

**Interfaces:**
- `jsonError(message, status, extraHeaders = {})` accepts restricted CORS headers.
- `proxyGitHubBlob(request, target)` attaches CORS headers only for exact allowed Blog origin.

- [ ] **Step 1: Add failing behavior tests for allowed-origin 401/413/upstream errors**

```js
test('allowed Blog origin can read authentication error without exposing CORS to others', async () => {
  const response = await worker.fetch(new Request(ROUTE, {
    method: 'POST',
    headers: { Origin: ALLOWED },
    body: 'abc',
  }), env);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), ALLOWED);
});

test('foreign origin receives no allow-origin header on rejection', async () => {
  const response = await worker.fetch(new Request(ROUTE, {
    method: 'POST',
    headers: { Origin: 'https://evil.example' },
    body: 'abc',
  }), env);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
});
```

Also cover 413 oversized declaration and an upstream non-2xx response.

- [ ] **Step 2: Run Node behavior test and verify RED**

Run:
```bash
node --test tests/js/cloud_large_upload_cors.test.mjs
```
Expected: FAIL because POST error/success responses do not yet attach restricted CORS headers.

- [ ] **Step 3: Implement CORS-aware response helpers**

```js
function withCors(headers, origin) {
  const result = new Headers(headers);
  for (const [name, value] of Object.entries(corsHeadersFor(origin))) result.set(name, value);
  return result;
}

function jsonError(message, status, origin = '') {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: withCors({
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    }, origin),
  });
}
```

Pass the exact allowed origin to errors and final upstream response only when `allowedBlogCrossOrigin` is true.

- [ ] **Step 4: Run focused behavior and Python wrappers**

Run:
```bash
node --test tests/js/cloud_large_upload_cors.test.mjs
python -m pytest tests/test_cloud_large_upload_stream.py tests/test_cloud_security_contract.py tests/test_cloud_large_upload_cors_js.py -v
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add pages/zz_cloud/worker.js tests/js/cloud_large_upload_cors.test.mjs
git commit -m "fix: expose restricted CORS responses to Blog manager"
```

---

### Task 4: Full Cloud regression verification

**Files:**
- No product changes unless verification finds a defect.

**Interfaces:** none.

- [ ] **Step 1: Run the complete Cloud Python suite**

```bash
python -m pytest tests -v
```
Expected: all tests PASS.

- [ ] **Step 2: Run the focused Node streaming/CORS suites directly**

```bash
node --test tests/js/cloud_blob_stream.test.mjs tests/js/cloud_large_upload_stream.test.mjs tests/js/cloud_large_upload_cors.test.mjs
```
Expected: all tests PASS.

- [ ] **Step 3: Re-check streaming invariants in final diff**

Confirm `worker.js` still contains:

```text
FixedLengthStream
createGitHubBlobJsonStream
X-Gallery-Content-Encoding
X-Gallery-Blob-Size
```

and still does **not** contain:

```text
request.arrayBuffer(
request.text(
request.blob(
btoa(
```

- [ ] **Step 4: Open PR and require existing CI matrix**

The PR must pass:
- Python 3.10;
- Python 3.12;
- dependency-floor 3.10;
- AstrBot runtime smoke.

- [ ] **Step 5: After merge/deploy, verify production preflight without a real token**

Safe production check:

```bash
curl -i -X OPTIONS \
  'https://airigallery.lidure22.xyz/__gallery-github-blob/Lidure/airi-gallery-images' \
  -H 'Origin: https://lidure22.xyz' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,x-gallery-content-encoding,x-gallery-blob-size'
```

Expected:
- HTTP 204;
- `Access-Control-Allow-Origin: https://lidure22.xyz`;
- allowed methods include POST;
- allowed headers include Authorization and the two Gallery headers;
- no wildcard allow-origin.

Also issue a foreign-origin preflight and confirm it is rejected and does not return `Access-Control-Allow-Origin` for that origin.

---

## Handoff to Blog Plan

Only after Task 4 production preflight is verified should the Blog plan enable its large-file client against the cross-origin Worker route. Small/normal GitHub API work can be implemented earlier, but the final Blog browser verification must run against the deployed Cloud prerequisite.
