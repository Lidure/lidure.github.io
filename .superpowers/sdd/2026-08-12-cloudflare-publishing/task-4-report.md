# Task 4 Report: R2 media upload and legacy moments import

Date: 2026-08-12
Worktree: `C:\Users\陈腾鑫\OneDrive\文档\ChatGPT\我的blog\.worktrees\cloudflare-publishing`
Branch: `agent/cloudflare-publishing`

## Implementation status

- Added strict upload validation in `danmaku-api/src/media.ts`.
  - Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`.
  - Image limit: 8 MB.
  - Video limit: 100 MB.
  - Empty uploads return `MEDIA_EMPTY`; unknown MIME returns `MEDIA_TYPE_NOT_ALLOWED`; oversize returns `MEDIA_TOO_LARGE`.
  - Poster uploads are accepted only as `image/jpeg` and returned as `kind: "poster"`.
- Added authenticated Worker `POST /api/media/upload`.
  - Requires existing admin session cookie.
  - Returns 401 without session.
  - Returns 415 for non-multipart requests and disallowed MIME types.
  - Returns 400 for empty/missing files.
  - Returns 413 for size-limit failures.
  - Stores R2 objects at `moments/YYYY/MM/uuid.ext`.
  - Writes `httpMetadata.contentType`.
  - Returns `{ url, key, kind }` using `PUBLIC_MEDIA_BASE_URL`.
  - Does not extract video frames in the Worker.
- Enforced moment media writes to accept only configured public media URLs or generated upload keys.
  - Generated keys are converted to `PUBLIC_MEDIA_BASE_URL/key`.
  - Media order is preserved by existing `sort_order` insertion.
- Added deterministic import script `scripts/import-moments.mjs`.
  - IDs use first 32 hex characters of SHA-256 over `date + "\0" + category + "\0" + text + "\0" + link`.
  - SQL uses `INSERT OR IGNORE`.
  - Output is repeatable.
  - Script reads no secrets and prints no secrets.
  - Legacy `r2.dev` media URLs are normalized to `https://media.lidure.xyz/...` in generated SQL.
- Added `scripts/README.md`.
- `.gitignore` did not need changes because `.tmp/` is already ignored.
- Did not change frontend files.
- Did not deploy.

## Verification evidence

### Baseline

`npm --prefix danmaku-api run check`

Result: exit 0.

`npm --prefix danmaku-api test`

Result: exit 1 before Task 4 changes due to pre-existing `tests/contracts.test.ts` failure:

```text
expected { items: [], now: 1786510688400 } to match object { items: [], nextCursor: Anything }
```

### Red test

`npm --prefix danmaku-api test -- media.test.ts`

Result before implementation: exit 1, 11 failing tests.

Observed expected failures:

- `validateUpload is not a function`
- `/api/media/upload` returned 404 instead of expected 401/415/400/413/201
- generated-key moment media normalization failed before implementation

### Focused media tests

`npm --prefix danmaku-api test -- media.test.ts`

Result after implementation: exit 0.

```text
✓ tests/media.test.ts (11 tests) 317ms
Test Files  1 passed (1)
Tests  11 passed (11)
```

### Worker type-check

`npm --prefix danmaku-api run check`

Result after implementation: exit 0.

```text
> lidure-danmaku-api@0.0.1 check
> tsc --noEmit
```

### Import script determinism

Commands run:

```powershell
node scripts/import-moments.mjs --input src/data/moments.json --output .tmp/moments-import.sql
Get-FileHash -Algorithm SHA256 -LiteralPath '.tmp\moments-import.sql'
Copy-Item -LiteralPath '.tmp\moments-import.sql' -Destination '.tmp\moments-import.first.sql' -Force
node scripts/import-moments.mjs --input src/data/moments.json --output .tmp/moments-import.sql
Get-FileHash -Algorithm SHA256 -LiteralPath '.tmp\moments-import.sql'
Compare-Object -ReferenceObject (Get-Content -LiteralPath '.tmp\moments-import.first.sql') -DifferenceObject (Get-Content -LiteralPath '.tmp\moments-import.sql')
Select-String -LiteralPath '.tmp\moments-import.sql' -Pattern 'INSERT OR IGNORE INTO moments','INSERT OR IGNORE INTO moment_media' | Measure-Object
```

Result: exit 0.

Both runs printed:

```text
Wrote 15 moments and 6 media rows to .tmp/moments-import.sql
```

Both hashes matched:

```text
SHA256 29DEF5A5EBB5DEEC0EB0E3ECD7DB35DE984611EED5DA3991AE4A28EADB93972C
```

`Compare-Object` produced no differences.

`Measure-Object` reported 21 `INSERT OR IGNORE` statements: 15 moment rows and 6 media rows.

## Notes

- No local D1 execution was performed for the import because the bounded Task 4 instruction requested focused media tests, Worker check, and import script twice/inspect deterministic output.
- Full `npm --prefix danmaku-api test` was not used as completion evidence because it had a pre-existing unrelated failure in `tests/contracts.test.ts` before Task 4 changes.

## Follow-up fix: generated media URL enforcement

After commit `7f09e87`, audit found that `normalizeMomentMediaInput()` accepted any URL under `PUBLIC_MEDIA_BASE_URL`. Task 4 requires moment media URLs to be constrained to upload-generated keys, so a follow-up fix now rejects same-base URLs unless their path matches `moments/YYYY/MM/uuid.ext`.

Scoped changes:

- Tightened submitted moment media URL validation in `danmaku-api/src/media.ts`.
- Added media regression coverage for same-base non-generated URLs in `danmaku-api/tests/media.test.ts`.
- Updated only auth/moments test fixtures that submit media through create paths so they use generated-key URLs.
- Restored and preserved `danmaku-api/tests/contracts.test.ts` exactly as it was at `209dffc`; Task 4 did not change `/api/danmaku`.

Fresh verification on 2026-08-12 after the follow-up fix:

### Focused media tests

`npm run test -- media.test.ts` from `danmaku-api`

Result: exit 0.

```text
✓ tests/media.test.ts (12 tests) 258ms
Test Files  1 passed (1)
Tests  12 passed (12)
```

### Worker type-check

`npm run check` from `danmaku-api`

Result: exit 0.

```text
> lidure-danmaku-api@0.0.1 check
> tsc --noEmit
```

### All Worker-focused tests

`npm run test` from `danmaku-api`

Result: exit 1, with the restored Task 1 contract failure unchanged:

```text
Test Files  1 failed | 3 passed (4)
Tests  1 failed | 45 passed (46)

FAIL tests/contracts.test.ts > danmaku API contracts > returns items and nextCursor for public list responses
expected { items: [], now: 1786511686664 } to match object { items: [], nextCursor: Anything }
```

Task 4-relevant suites passed in that run:

```text
✓ tests/moments.test.ts (13 tests)
✓ tests/media.test.ts (12 tests)
✓ tests/auth.test.ts (19 tests)
```

### Import script determinism

Commands:

```powershell
node scripts/import-moments.mjs --input src/data/moments.json --output .tmp/moments-import.sql
Get-FileHash -Algorithm SHA256 -LiteralPath '.tmp\moments-import.sql'
Copy-Item -LiteralPath '.tmp\moments-import.sql' -Destination '.tmp\moments-import.first.sql' -Force
node scripts/import-moments.mjs --input src/data/moments.json --output .tmp/moments-import.sql
Get-FileHash -Algorithm SHA256 -LiteralPath '.tmp\moments-import.sql'
Compare-Object -ReferenceObject (Get-Content -LiteralPath '.tmp\moments-import.first.sql') -DifferenceObject (Get-Content -LiteralPath '.tmp\moments-import.sql')
Select-String -LiteralPath '.tmp\moments-import.sql' -Pattern 'INSERT OR IGNORE INTO moments','INSERT OR IGNORE INTO moment_media' | Measure-Object
```

Result: exit 0.

```text
Wrote 15 moments and 6 media rows to .tmp/moments-import.sql
SHA256 29DEF5A5EBB5DEEC0EB0E3ECD7DB35DE984611EED5DA3991AE4A28EADB93972C
Wrote 15 moments and 6 media rows to .tmp/moments-import.sql
SHA256 29DEF5A5EBB5DEEC0EB0E3ECD7DB35DE984611EED5DA3991AE4A28EADB93972C
Compare-Object: no differences
Count    : 21
```

## Follow-up fix: import media boundary alignment

Review 2 found that `scripts/import-moments.mjs` could still preserve arbitrary external `http(s)` image URLs, while `normalizeMomentMediaInput()` only accepts generated upload keys or generated-key URLs under `PUBLIC_MEDIA_BASE_URL`.

Scoped changes:

- Updated only `scripts/import-moments.mjs` so legacy import media uses the same trusted generated upload boundary as the API.
- Safe policy: keep URLs only when they are already under `https://media.lidure.xyz/` with a `moments/YYYY/MM/uuid.ext` generated upload key, or when they are under the known legacy R2 host and rewrite to that same generated-key path.
- Unsupported or untrusted legacy media URLs are skipped, not imported, with a deterministic warning count.
- `sort_order` is compacted after skips, and media IDs are still derived from stable normalized URL/order inputs.
- Added focused Node test coverage in `tests/import-moments.test.mjs`.
- Did not change `danmaku-api/src/media.ts` validation or frontend files.

### TDD evidence

RED before importer change:

```powershell
node --test tests/import-moments.test.mjs
```

Result: exit 1.

```text
✖ importer skips media URLs that the moments API would reject
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /Wrote 1 moments and 2 media rows/.
Input:
'Wrote 1 moments and 4 media rows ...'
```

GREEN after importer change:

```powershell
node --test tests/import-moments.test.mjs
```

Result: exit 0.

```text
✔ importer skips media URLs that the moments API would reject (82.722ms)
tests 1
pass 1
fail 0
```

### API media boundary regression check

```powershell
npm --prefix danmaku-api test -- tests/media.test.ts
```

Result: exit 0.

```text
✓ tests/media.test.ts (12 tests) 288ms
Test Files  1 passed (1)
Tests  12 passed (12)
```

### Import script determinism after boundary fix

Commands:

```powershell
node scripts/import-moments.mjs --input src/data/moments.json --output .tmp/moments-import.sql
Get-FileHash -Algorithm SHA256 -LiteralPath '.tmp\moments-import.sql'
Copy-Item -LiteralPath '.tmp\moments-import.sql' -Destination '.tmp\moments-import.first.sql' -Force
node scripts/import-moments.mjs --input src/data/moments.json --output .tmp/moments-import.sql
Get-FileHash -Algorithm SHA256 -LiteralPath '.tmp\moments-import.sql'
Compare-Object -ReferenceObject (Get-Content -LiteralPath '.tmp\moments-import.first.sql') -DifferenceObject (Get-Content -LiteralPath '.tmp\moments-import.sql')
Select-String -LiteralPath '.tmp\moments-import.sql' -Pattern 'INSERT OR IGNORE INTO moments','INSERT OR IGNORE INTO moment_media' | Measure-Object
Select-String -LiteralPath '.tmp\moments-import.sql' -Pattern 'https?://'
```

Result: exit 0.

```text
Wrote 15 moments and 0 media rows to .tmp/moments-import.sql
Skipped 6 unsupported media URLs outside the trusted generated upload boundary.
SHA256 AED19455D0330D3B1BD56D28BDD1F8EC993D801290B5417D3C509AA0E3F22F06
Wrote 15 moments and 0 media rows to .tmp/moments-import.sql
Skipped 6 unsupported media URLs outside the trusted generated upload boundary.
SHA256 AED19455D0330D3B1BD56D28BDD1F8EC993D801290B5417D3C509AA0E3F22F06
Compare-Object: no differences
Count    : 15
Select-String 'https?://': no matches
```
