# Firefly Native Media Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make fullscreen homepage wallpaper rendering use real `<img>` and `<video>` media surfaces like CuteLeaf/Firefly so the first viewport is not softened by the legacy background-div/canvas pipeline.

**Architecture:** Keep the existing media library, persistence, selection state, autoplay and URL handling. Replace only the presentation surface: add a persistent `.slideshow-image` `<img>` for image slides and continue using the native `.slideshow-video` for videos; stop presenting images through `.slideshow-layer` in fullscreen/overlay. Keep the legacy layer/canvas available only where compatibility still needs them.

**Tech Stack:** Astro, browser DOM/CSS, Node test runner.

**Spec:** Conversation-approved Firefly parity: real image/video media surfaces, fullscreen home top clear, existing library/rotation behavior preserved.

## Global Constraints
- Keep `backgroundBlur` maximum/default at 5px.
- Keep fullscreen homepage scroll blur lifecycle from 0px at top to configured max over the first 300px.
- Preserve existing background library, selected index, custom URL and autoplay behavior.
- Do not remove banner mode compatibility unless tests prove it is unused.

---

### Task 1: Add native-image regression coverage
- [ ] Add a failing test requiring a real `.slideshow-image` element and fullscreen CSS targeted at it.
- [ ] Verify failure before implementation.

### Task 2: Replace fullscreen image presentation surface
- [ ] Add persistent `<img class="slideshow-image" id="slideshowImage">`.
- [ ] Route image selections to its `src`/visible state while preserving existing state and settings.
- [ ] Use it for fullscreen/overlay cover + blur; stop using `.slideshow-layer` as the fullscreen image surface.
- [ ] Run focused background/video tests.

### Task 3: Verify integration and deploy
- [ ] Review final diff.
- [ ] Open PR, verify mergeability, merge.
- [ ] Require successful Pages build and deploy before completion.
