export function didVideoLoop(previousTime, currentTime) {
  const previous = Number(previousTime);
  const current = Number(currentTime);

  if (!Number.isFinite(previous) || !Number.isFinite(current)) return false;

  // Hidden background videos have no seek controls, so a substantial backwards
  // jump is the native `loop` wrap rather than a user-initiated seek.
  return previous > 0.75 && current + 0.25 < previous;
}

export function recoverLoopAfterWrap(video, previousTime, currentTime) {
  if (!video || video.ended || !didVideoLoop(previousTime, currentTime)) return false;

  // HeroSlideshow owns the actual recovery routine. Reuse it instead of
  // duplicating its source/load/play/canvas state machine here.
  const recovery = video.onended;
  if (typeof recovery !== 'function') return false;

  recovery.call(video);
  return true;
}

export function installHeroVideoLoopGuard(
  doc = globalThis.document,
  win = globalThis.window,
) {
  if (!doc || !win || win.__heroVideoLoopGuardBound) return;
  win.__heroVideoLoopGuardBound = true;

  let boundVideo = null;
  let timeUpdateHandler = null;
  let endedHandler = null;

  function detach() {
    if (!boundVideo) return;
    if (timeUpdateHandler) boundVideo.removeEventListener('timeupdate', timeUpdateHandler);
    if (endedHandler) boundVideo.removeEventListener('ended', endedHandler);
    boundVideo = null;
    timeUpdateHandler = null;
    endedHandler = null;
  }

  function bindVideo() {
    const video = doc.getElementById('slideshowVideo');
    if (!video || video === boundVideo) return;

    detach();
    boundVideo = video;
    let lastTime = Number(video.currentTime) || 0;

    endedHandler = function () {
      // Native ended recovery already ran (or is about to run), so do not
      // interpret its reset to zero as another loop wrap.
      lastTime = 0;
    };

    timeUpdateHandler = function () {
      const currentTime = Number(video.currentTime) || 0;
      const previousTime = lastTime;
      lastTime = currentTime;

      if (recoverLoopAfterWrap(video, previousTime, currentTime)) {
        lastTime = Number(video.currentTime) || 0;
      }
    };

    video.addEventListener('ended', endedHandler);
    video.addEventListener('timeupdate', timeUpdateHandler);
  }

  doc.addEventListener('astro:page-load', bindVideo);
  bindVideo();
}
