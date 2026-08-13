# Music and Performance Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make QQ playlist playback on-demand and more reliable, then reduce first-load and navigation jank without changing the blog’s visual identity.

**Architecture:** Keep the Astro frontend and existing music proxy boundary. Refactor the player so playlist metadata loads first and an individual audio URL is resolved only when a song is selected. Optimize the global layout by deferring heavy player work, limiting background-video preloading, and making long-lived animation resources lifecycle-aware.

**Tech Stack:** Astro 6, inline browser JavaScript, GitHub Pages, existing music proxy, Node built-in tests, Astro check/build.

## Global Constraints

- Do not commit real QQ Cookies, API tokens, or secrets.
- Do not claim to bypass QQ Music membership, region, or copyright restrictions.
- Preserve current player controls, local audio import, NetEase import, background settings, and Astro navigation.
- Every production behavior change must have a failing regression check before implementation.
- Verify with `npm run check`, `npm run build`, and focused `node --test tests/site-build.test.mjs` checks before publishing.

## File Map

- Modify `src/components/SekaiPlayer.astro`: lazy player initialization, on-demand online URL resolution, unavailable-track state and retry UI.
- Modify `src/components/HeroSlideshow.astro`: stop unnecessary next-video preloading and ensure background timers/frames are cleaned on visibility and navigation.
- Modify `src/components/SekaiParticles.astro`: pause its interval and animation creation while disabled or hidden, resume only when enabled.
- Modify `src/layouts/BaseLayout.astro`: keep only lightweight global lifecycle hooks in the initial document and avoid duplicate third-party work.
- Modify `tests/site-build.test.mjs`: regression assertions for lazy initialization, on-demand URL fetching and lifecycle cleanup.
- Create `docs/superpowers/verification/2026-08-13-music-performance.md`: record commands, results, known third-party limitations, and deployment status.

### Task 1: Add the on-demand music data contract

**Files:**
- Modify: `src/components/SekaiPlayer.astro`
- Test: `tests/site-build.test.mjs`

**Interface:** `fetchOnlineSongUrl(platform, songId, cookie)` resolves `{ url, error }`; the existing playlist fetch returns metadata without requiring every song URL.

- [ ] Write a failing source regression test requiring `fetchOnlineSongUrl`, a per-song URL state, and no full-playlist `fetchQQUrls` call during import.
- [ ] Run `node --test --test-name-pattern='on-demand music' tests/site-build.test.mjs`; confirm the new assertion fails for the current eager batch implementation.
- [ ] Implement the smallest contract: retain imported songs with `audioState: 'unknown'`, resolve a URL when the song is selected, cache successful and failed results by platform/song ID, and pass the saved complete Cookie unchanged to the proxy.
- [ ] Update playlist-row rendering so unknown songs show `待获取`, resolved songs show normal play state, and failed songs show `暂不可播放` with a retry action.
- [ ] Run the focused test and verify it passes.
- [ ] Commit: `git add src/components/SekaiPlayer.astro tests/site-build.test.mjs && git commit -m "feat: resolve online songs on demand"`

### Task 2: Make QQ authentication feedback actionable

**Files:**
- Modify: `src/components/SekaiPlayer.astro`
- Test: `tests/site-build.test.mjs`

**Interface:** QQ import must distinguish missing/incomplete Cookie, expired authorization, unavailable copyright, and network failure without exposing Cookie content.

- [ ] Write a failing regression assertion for the four user-facing states and the `authed` response handling.
- [ ] Run the focused test and confirm failure.
- [ ] Implement validation for full Cookie shape (`uin/euin` plus `qm_keyst/qqmusic_key`), map `mid/songmid/song_mid/id`, and display a retryable message when the proxy returns no URL.
- [ ] Verify that no Cookie value is written to DOM text, logs, tests, or build output.
- [ ] Run focused tests and `npm run check`.
- [ ] Commit: `git add src/components/SekaiPlayer.astro tests/site-build.test.mjs && git commit -m "fix: clarify online music authorization states"`

### Task 3: Defer heavy player work

**Files:**
- Modify: `src/components/SekaiPlayer.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Test: `tests/site-build.test.mjs`

**Interface:** The player button remains visible immediately, while catalog loading, remote metadata, audio context, and visualizer setup happen only after first interaction.

- [ ] Write a failing regression assertion that the player bootstrap is guarded by a user-activation flag and that audio visualizer setup is not executed during initial layout evaluation.
- [ ] Run the focused test and confirm failure.
- [ ] Split the current one-shot initializer into a lightweight DOM binding and `initializeSekaiPlayer()` called from the first open/play interaction; preserve `transition:persist` audio continuity after initialization.
- [ ] Add an abort/cleanup path for pending catalog fetches when the user navigates away before initialization completes.
- [ ] Run focused tests, `npm run check`, and a production build.
- [ ] Commit: `git add src/components/SekaiPlayer.astro src/layouts/BaseLayout.astro tests/site-build.test.mjs && git commit -m "perf: defer music player initialization"`

### Task 4: Reduce background and particle work

**Files:**
- Modify: `src/components/HeroSlideshow.astro`
- Modify: `src/components/SekaiParticles.astro`
- Test: `tests/site-build.test.mjs`

**Interface:** Only the visible background consumes animation work; hidden tabs, disabled effects, and completed navigation swaps do not keep timers or animation frames alive.

- [ ] Write failing assertions for no eager next-video preload, paused particle scheduling while disabled/hidden, and cleanup on `astro:before-swap`/`visibilitychange`.
- [ ] Run focused tests and confirm failure.
- [ ] Remove or delay `warmVideo()`/next-slide preloading until after the first stable paint and only when the current slide is a video; cancel pending preload timers on cleanup.
- [ ] Make Sakura interval creation conditional on `enabled`, clear it when disabled or hidden, and restart it when the setting is enabled again.
- [ ] Keep the existing `🌸`, `💮`, and `❀` visual style and maximum particle count.
- [ ] Run focused tests, `npm run check`, and `npm run build`.
- [ ] Commit: `git add src/components/HeroSlideshow.astro src/components/SekaiParticles.astro tests/site-build.test.mjs && git commit -m "perf: reduce background animation work"`

### Task 5: Verify the integrated result

**Files:**
- Create: `docs/superpowers/verification/2026-08-13-music-performance.md`

- [ ] Run `npm run check` and record the exit status and diagnostic count.
- [ ] Run `npm run build` and record the exit status.
- [ ] Run focused site tests for music, player lifecycle, background lifecycle, and navigation.
- [ ] Inspect `git diff --check`, `git status --short`, and the final commit list.
- [ ] Run a cold-load and navigation smoke check against `https://lidure22.xyz/` without recording cookies or personal data.
- [ ] Record third-party QQ limitations separately from code defects.
- [ ] Commit: `git add docs/superpowers/verification/2026-08-13-music-performance.md && git commit -m "docs: record music and performance verification"`

## Review Checklist

- [ ] QQ playlist import no longer requests every playback URL eagerly.
- [ ] One-song playback performs at most one cached URL resolution at a time.
- [ ] Missing/expired/unsupported QQ playback is distinguishable to the user.
- [ ] Player and visualizer are not initialized on first paint.
- [ ] Background video and Sakura work stop when not needed.
- [ ] Existing navigation, clock, visitor counter, local audio, and NetEase flows remain intact.
- [ ] Build and focused regression checks pass.
