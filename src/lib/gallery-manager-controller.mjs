const CLOUD_URL = 'https://airigallery.lidure22.xyz/';
const FRAME_TIMEOUT_MS = 12_000;

export function initGalleryManager(root) {
  if (!root) return () => {};

  const doc = root.ownerDocument || document;
  const win = doc.defaultView || window;
  const closeButton = root.querySelector('#gallery-manager-close');
  const failureClose = root.querySelector('#gallery-manager-failure-close');
  const retryButton = root.querySelector('#gallery-manager-retry');
  const host = root.querySelector('#gallery-manager-frame-host');
  const loading = root.querySelector('#gallery-manager-loading');
  const failure = root.querySelector('#gallery-manager-failure');
  if (!closeButton || !retryButton || !host || !loading || !failure) return () => {};

  let frame = null;
  let timeoutId = null;
  let loaded = false;
  let disposed = false;

  function clearFrameTimer() {
    if (timeoutId != null) win.clearTimeout(timeoutId);
    timeoutId = null;
  }

  function removeFrame() {
    clearFrameTimer();
    if (frame) {
      frame.remove();
      frame = null;
    }
    host.replaceChildren();
  }

  function showFailure() {
    loading.hidden = true;
    failure.hidden = false;
  }

  function createFrame() {
    removeFrame();
    if (disposed) return;
    loaded = false;
    loading.hidden = false;
    failure.hidden = true;

    frame = document.createElement('iframe');
    frame.className = 'gallery-manager-frame';
    frame.src = CLOUD_URL;
    frame.title = 'Airi Gallery Cloud 管理界面';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.loading = 'eager';
    frame.addEventListener('load', () => {
      if (!frame || disposed) return;
      loaded = true;
      clearFrameTimer();
      loading.hidden = true;
      failure.hidden = true;
    }, { once: true });
    host.append(frame);

    timeoutId = win.setTimeout(() => {
      timeoutId = null;
      if (!loaded && !disposed) showFailure();
    }, FRAME_TIMEOUT_MS);
  }

  function open() {
    if (disposed) return;
    root.hidden = false;
    root.classList.add('is-open');
    doc.documentElement.classList.add('gallery-manager-open');
    if (!frame) createFrame();
  }

  function stripManageQuery() {
    const nextUrl = new URL(win.location.href);
    if (nextUrl.searchParams.get('manage') !== '1') return;
    nextUrl.searchParams.delete('manage');
    const replacement = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`;
    win.history.replaceState(win.history.state, '', replacement);
  }

  function close({ updateUrl = true } = {}) {
    removeFrame();
    root.hidden = true;
    root.classList.remove('is-open');
    doc.documentElement.classList.remove('gallery-manager-open');
    loading.hidden = false;
    failure.hidden = true;
    if (updateUrl) stripManageQuery();
  }

  function onHotkey(event) {
    const exactChord = event.ctrlKey && event.altKey
      && !event.metaKey && !event.shiftKey
      && event.key.toLowerCase() === 'g';
    if (!exactChord) return;
    event.preventDefault();
    open();
  }

  function onRetry() {
    createFrame();
  }

  function onClose() {
    close();
  }

  closeButton.addEventListener('click', onClose);
  failureClose?.addEventListener('click', onClose);
  retryButton.addEventListener('click', onRetry);
  doc.addEventListener('keydown', onHotkey);

  const initialUrl = new URL(win.location.href);
  if (initialUrl.searchParams.get('manage') === '1') open();

  return function cleanupGalleryManager() {
    if (disposed) return;
    disposed = true;
    closeButton.removeEventListener('click', onClose);
    failureClose?.removeEventListener('click', onClose);
    retryButton.removeEventListener('click', onRetry);
    doc.removeEventListener('keydown', onHotkey);
    close({ updateUrl: false });
  };
}
