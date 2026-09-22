export function initGalleryManageEntry(doc = document, win = window) {
  let disposed = false;

  const navigate = () => {
    if (disposed) return;
    win.location.assign('/gallery/manage');
  };

  const onKeydown = (event) => {
    const exact = event.ctrlKey && event.altKey
      && !event.metaKey && !event.shiftKey
      && String(event.key || '').toLowerCase() === 'g';
    if (!exact) return;
    event.preventDefault();
    navigate();
  };

  doc.addEventListener('keydown', onKeydown);
  const url = new URL(win.location.href);
  if (url.searchParams.get('manage') === '1') navigate();

  return () => {
    disposed = true;
    doc.removeEventListener('keydown', onKeydown);
  };
}
