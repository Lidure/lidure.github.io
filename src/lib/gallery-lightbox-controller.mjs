import { galleryProxyUrl } from './gallery-data.mjs';

export function initGalleryLightbox(root) {
  if (!root) return () => {};

  const doc = root.ownerDocument || document;
  const win = doc.defaultView || window;
  const image = root.querySelector('#gallery-lightbox-image');
  const caption = root.querySelector('#gallery-lightbox-caption');
  const closeButton = root.querySelector('#gallery-lightbox-close');
  const prevButton = root.querySelector('#gallery-lightbox-prev');
  const nextButton = root.querySelector('#gallery-lightbox-next');
  const backdrop = root.querySelector('[data-gallery-lightbox-close]');
  if (!image || !caption || !closeButton || !prevButton || !nextButton) return () => {};

  let images = [];
  let index = 0;
  let touchStartX = null;
  let previouslyFocused = null;
  const preloads = new Set();

  function releasePreloads() {
    preloads.clear();
  }

  function preloadAdjacent() {
    releasePreloads();
    if (images.length < 2) return;
    const previousIndex = (index - 1 + images.length) % images.length;
    const nextIndex = (index + 1) % images.length;
    const adjacent = new Set([previousIndex, nextIndex]);
    for (const adjacentIndex of adjacent) {
      if (adjacentIndex === index) continue;
      const candidate = images[adjacentIndex];
      if (!candidate) continue;
      const preload = new win.Image();
      preloads.add(preload);
      const release = () => preloads.delete(preload);
      preload.addEventListener('load', release, { once: true });
      preload.addEventListener('error', release, { once: true });
      preload.decoding = 'async';
      preload.src = galleryProxyUrl(candidate.path);
    }
  }

  function render() {
    const item = images[index];
    if (!item) return;
    image.src = galleryProxyUrl(item.path);
    image.alt = item.filename || '画廊图片';
    caption.textContent = `${item.filename || '图片'} · ${index + 1} / ${images.length}`;
    preloadAdjacent();
  }

  function open(detail, trigger) {
    if (!Array.isArray(detail?.images) || !detail.images.length) return;
    images = detail.images;
    index = Math.min(images.length - 1, Math.max(0, Number(detail.index) || 0));
    previouslyFocused = trigger instanceof win.HTMLElement ? trigger : doc.activeElement;
    root.hidden = false;
    root.classList.add('is-open');
    doc.documentElement.classList.add('gallery-modal-open');
    render();
    closeButton.focus();
  }

  function close() {
    if (root.hidden) return;
    root.hidden = true;
    root.classList.remove('is-open');
    doc.documentElement.classList.remove('gallery-modal-open');
    image.removeAttribute('src');
    caption.textContent = '';
    releasePreloads();
    const target = previouslyFocused;
    previouslyFocused = null;
    if (target?.isConnected && typeof target.focus === 'function') target.focus();
  }

  function move(delta) {
    if (root.hidden || !images.length) return;
    index = (index + delta + images.length) % images.length;
    render();
  }

  function focusables() {
    return [closeButton, prevButton, nextButton].filter((el) => !el.disabled && !el.hidden);
  }

  function onKeydown(event) {
    if (root.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      move(-1);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      move(1);
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = focusables();
    if (!controls.length) return;
    const current = controls.indexOf(doc.activeElement);
    if (event.shiftKey && current <= 0) {
      event.preventDefault();
      controls.at(-1)?.focus();
    } else if (!event.shiftKey && current === controls.length - 1) {
      event.preventDefault();
      controls[0]?.focus();
    }
  }

  function onOpen(event) {
    open(event.detail, event.target);
  }

  function onTouchStart(event) {
    touchStartX = event.changedTouches?.[0]?.clientX ?? null;
  }

  function onTouchEnd(event) {
    if (touchStartX == null) return;
    const endX = event.changedTouches?.[0]?.clientX;
    if (typeof endX !== 'number') {
      touchStartX = null;
      return;
    }
    const delta = endX - touchStartX;
    touchStartX = null;
    if (Math.abs(delta) < 48) return;
    move(delta > 0 ? -1 : 1);
  }

  function onPrevClick() {
    move(-1);
  }

  function onNextClick() {
    move(1);
  }

  closeButton.addEventListener('click', close);
  backdrop?.addEventListener('click', close);
  prevButton.addEventListener('click', onPrevClick);
  nextButton.addEventListener('click', onNextClick);
  doc.addEventListener('gallery:image-open', onOpen);
  doc.addEventListener('keydown', onKeydown);
  root.addEventListener('touchstart', onTouchStart, { passive: true });
  root.addEventListener('touchend', onTouchEnd, { passive: true });

  return function cleanupGalleryLightbox() {
    closeButton.removeEventListener('click', close);
    backdrop?.removeEventListener('click', close);
    prevButton.removeEventListener('click', onPrevClick);
    nextButton.removeEventListener('click', onNextClick);
    doc.removeEventListener('gallery:image-open', onOpen);
    doc.removeEventListener('keydown', onKeydown);
    root.removeEventListener('touchstart', onTouchStart);
    root.removeEventListener('touchend', onTouchEnd);
    close();
    releasePreloads();
  };
}
