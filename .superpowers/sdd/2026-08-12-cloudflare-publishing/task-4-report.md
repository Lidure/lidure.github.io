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
