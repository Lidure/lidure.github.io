# Airi Gallery Cloud Framing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow `https://airigallery.lidure22.xyz/` to be embedded only by `https://lidure22.xyz` while preserving all existing Cloud management behavior and security controls.

**Architecture:** This is a narrowly scoped change in `Lidure/astrbot_plugin_airi_gallery`. The public Cloud app remains unchanged; only the deployed static security headers are adjusted so the canonical Blog origin may frame the page. A contract test locks the framing policy so later security-header edits cannot silently re-break the Blog integration.

**Tech Stack:** Cloudflare Pages/Workers static headers, Python pytest contract tests, existing Airi Gallery Cloud assets.

**Spec:** `Lidure/lidure.github.io/docs/superpowers/specs/2026-09-22-airi-gallery-blog-integration-design.md`

## Global Constraints

- The only allowed external frame ancestor is exactly `https://lidure22.xyz`.
- Do not use `*`, `https:`, subdomain wildcards, preview domains, or HTTP origins in `frame-ancestors`.
- Remove `X-Frame-Options: DENY`; do not replace it with `ALLOW-FROM`.
- Preserve all existing non-framing security headers and CSP directives.
- Do not change upload, delete, synchronization, manifest, duplicate detection, GitHub/Gitee configuration, or Worker proxy logic.
- Do not introduce a token bridge, `postMessage` credential transport, or parent-window dependency into Airi Gallery Cloud.

## Review Focus

- A malformed CSP edit that accidentally drops `script-src`, `connect-src`, `object-src`, `base-uri`, or `form-action` must fail the contract test.
- `frame-ancestors` must allow the apex Blog origin but must not allow arbitrary origins or wildcard subdomains.
- The legacy `X-Frame-Options: DENY` line must be absent after the change or browsers may still refuse embedding.
- Direct navigation to Airi Gallery Cloud must still work exactly as before because the page/application code is untouched.
- The large GitHub blob upload proxy same-origin protections must remain untouched and covered by the existing suite.

---

### Task 1: Lock the Cloud framing policy with a failing contract test

**Repository:** `Lidure/astrbot_plugin_airi_gallery`

**Files:**
- Create: `tests/test_cloud_framing_headers.py`
- Read: `pages/zz_cloud/_headers`

**Interfaces:**
- Consumes: the literal deployment header file at `pages/zz_cloud/_headers`.
- Produces: a pytest contract that defines the exact permitted framing policy and preserves the existing restrictive directives.

- [ ] **Step 1: Create an isolated implementation branch**

Run:

```bash
git switch main
git pull --ff-only
git switch -c codex/allow-blog-gallery-embed
```

Expected: branch starts from the current `main` head and contains no product changes.

- [ ] **Step 2: Write the failing framing-header test**

Create `tests/test_cloud_framing_headers.py` with:

```python
from pathlib import Path

HEADERS = Path(__file__).resolve().parents[1] / "pages" / "zz_cloud" / "_headers"


def _header_text() -> str:
    return HEADERS.read_text(encoding="utf-8")


def _csp(text: str) -> str:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("content-security-policy:"):
            return stripped.split(":", 1)[1].strip()
    raise AssertionError("Content-Security-Policy header is missing")


def test_cloud_allows_only_canonical_blog_origin_to_frame():
    text = _header_text()
    csp = _csp(text)

    assert "frame-ancestors https://lidure22.xyz" in csp
    assert "frame-ancestors 'none'" not in csp
    assert "frame-ancestors *" not in csp
    assert "frame-ancestors https:" not in csp
    assert "*.lidure22.xyz" not in csp
    assert "X-Frame-Options: DENY" not in text


def test_cloud_preserves_existing_restrictive_security_headers():
    text = _header_text()
    csp = _csp(text)

    for directive in (
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self'",
        "img-src 'self' data: blob:",
        "connect-src 'self' https://api.github.com https://gitee.com https://raw.githubusercontent.com",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
    ):
        assert directive in csp

    assert "X-Content-Type-Options: nosniff" in text
    assert "Referrer-Policy: strict-origin-when-cross-origin" in text
    assert "Permissions-Policy: camera=(), microphone=(), geolocation=()" in text
```

- [ ] **Step 3: Run the new test and verify RED**

Run:

```bash
pytest -q tests/test_cloud_framing_headers.py
```

Expected: FAIL because the current file still contains `frame-ancestors 'none'` and `X-Frame-Options: DENY`.

- [ ] **Step 4: Commit the RED contract**

```bash
git add tests/test_cloud_framing_headers.py
git commit -m "test: define Blog embedding policy for Gallery Cloud"
```

Expected: one test-only commit.

---

### Task 2: Permit only the Blog origin to frame Airi Gallery Cloud

**Repository:** `Lidure/astrbot_plugin_airi_gallery`

**Files:**
- Modify: `pages/zz_cloud/_headers`
- Test: `tests/test_cloud_framing_headers.py`

**Interfaces:**
- Consumes: Task 1's contract test.
- Produces: deployable Cloud headers that allow `https://lidure22.xyz` and no other external framing origin.

- [ ] **Step 1: Make the minimal header edit**

Change the CSP line from the existing framing clause:

```text
frame-ancestors 'none'
```

to:

```text
frame-ancestors https://lidure22.xyz
```

Delete this line entirely:

```text
X-Frame-Options: DENY
```

Do not alter any other header or CSP directive.

- [ ] **Step 2: Run the new contract test and verify GREEN**

Run:

```bash
pytest -q tests/test_cloud_framing_headers.py
```

Expected: `2 passed`.

- [ ] **Step 3: Run the existing Cloud/security regressions that protect adjacent behavior**

Run:

```bash
pytest -q \
  tests/test_repository_contract.py \
  tests/test_cloud_anonymous_manifest_read.py \
  tests/test_github_http_classification.py \
  tests/test_main_diagnostics.py
```

Expected: all selected tests PASS.

- [ ] **Step 4: Run the repository's normal regression suite**

Run the repository's documented full test command. If the repository uses plain pytest, run:

```bash
pytest -q
```

Expected: PASS with no new failures attributable to this change.

- [ ] **Step 5: Inspect the diff for scope creep**

Run:

```bash
git diff main...HEAD -- pages/zz_cloud/_headers tests/test_cloud_framing_headers.py
```

Expected: only the framing policy and its tests differ; `app.js`, `worker.js`, upload transaction files, and plugin Python runtime are untouched.

- [ ] **Step 6: Commit the implementation**

```bash
git add pages/zz_cloud/_headers tests/test_cloud_framing_headers.py
git commit -m "fix: allow canonical Blog to embed Gallery Cloud"
```

---

### Task 3: Open, verify, and deploy the Cloud PR before Blog implementation ships

**Repository:** `Lidure/astrbot_plugin_airi_gallery`

**Files:**
- No additional product files.

**Interfaces:**
- Consumes: Task 2's tested branch.
- Produces: a merged/deployed Cloud framing policy that the Blog manager iframe can rely on.

- [ ] **Step 1: Open a PR**

Use title:

```text
fix: allow Blog to embed Airi Gallery Cloud
```

PR body must state:

```markdown
## Summary
- allow `https://lidure22.xyz` as the sole external frame ancestor
- remove `X-Frame-Options: DENY`, which conflicts with the CSP allowlist
- preserve all other Cloud security headers and application behavior

## Verification
- framing-header contract tests pass
- existing Cloud/security regressions pass
- full repository regression suite passes
```

- [ ] **Step 2: Review the PR diff before merge**

Confirm all of the following:

```text
pages/zz_cloud/_headers
  frame-ancestors https://lidure22.xyz
  no X-Frame-Options: DENY
  no wildcard frame ancestor

tests/test_cloud_framing_headers.py
  exact-origin allowlist assertions
  preserved-security-header assertions
```

Expected: no unrelated files changed.

- [ ] **Step 3: Merge only after CI is green**

Preferred merge method: squash.

Expected resulting commit title:

```text
fix: allow Blog to embed Airi Gallery Cloud
```

- [ ] **Step 4: Verify the production response headers after deployment**

Run:

```bash
curl -sSI https://airigallery.lidure22.xyz/ | tr -d '\r'
```

Expected response includes a CSP containing:

```text
frame-ancestors https://lidure22.xyz
```

and does not include:

```text
X-Frame-Options: DENY
```

Also verify that `default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, and `form-action 'none'` remain present.

- [ ] **Step 5: Verify direct Cloud management remains functional**

Open `https://airigallery.lidure22.xyz/` directly and confirm:

```text
public gallery loads
settings panel opens
repository connection can be tested
upload controls remain gated by token
```

Do not perform destructive delete/upload smoke tests unless a disposable test image is explicitly available.

- [ ] **Step 6: Record the production verification in the PR or implementation notes**

Include the deployed commit SHA and the observed CSP framing clause so the Blog plan has a known-good prerequisite.
