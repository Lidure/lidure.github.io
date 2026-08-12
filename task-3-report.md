# Task 3 Report: Admin password sessions for publishing

## Summary

- Added Worker-side password verification using PBKDF2-SHA256 password hashes.
- Added signed, HTTP-only admin session cookies with a seven-day expiry.
- Added `/api/auth/login`, `/api/auth/logout`, and `/api/auth/session` endpoints.
- Protected moment publishing and deletion behind a valid admin session.
- Added a one-off password hash helper script at `scripts/hash-admin-password.mjs`.
- Documented setup for `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` in `danmaku-api/README.md`.

## Verification

- `npm --prefix danmaku-api test -- auth.test.ts`
- `npm --prefix danmaku-api run check`

Both commands were run successfully before committing.
