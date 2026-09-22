export function initGalleryManageEntry(doc = document, win = window) {
  let disposed = false;

  function navigateToManager() {
    if (disposed) return;
    win.location.assign('/gallery/manage');
  }

  function onKeydown(event) {
    const exactChord = event.ctrlKey && event.altKey
      && !event.metaKey && !event.shiftKey
      && String(event.key).toLowerCase() === 'g';
    if (!exactChord) return;
    event.preventDefault();
    navigateToManager();
  }

  doc.addEventListener('keydown', onKeydown);
  const initialUrl = new URL(win.location.href);
  if (initialUrl.searchParams.get('manage') === '1') navigateToManager();

  return function cleanupGalleryManageEntry() {
    if (disposed) return;
    disposed = true;
    doc.removeEventListener('keydown', onKeydown);
  };
}
