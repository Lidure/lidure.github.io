const MODE_COPY = {
  connect: {
    kicker: 'GitHub Access',
    title: '连接 GitHub',
    description: '输入具有图库写入权限的 GitHub Token。凭据只在当前页面内存中使用。',
    confirm: '连接',
    cancel: '取消',
  },
  preview: {
    kicker: 'Preview',
    title: '图片预览',
    description: '',
    confirm: '关闭',
    cancel: '',
  },
  delete: {
    kicker: 'Delete',
    title: '确认删除',
    description: '删除后会同时更新图库图片和感知查重索引。',
    confirm: '删除图片',
    cancel: '取消',
  },
  duplicate: {
    kicker: 'Duplicate Check',
    title: '发现相似图片',
    description: '请对比库内图片与待上传图片，再决定是否继续上传。',
    confirm: '仍然上传',
    cancel: '跳过',
  },
};

function focusableElements(root) {
  return [...root.querySelectorAll(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  )].filter(element => !element.hidden && element.getAttribute?.('aria-hidden') !== 'true');
}

function safeText(value) {
  return value == null ? '' : String(value);
}

export function initGalleryManageDialog(root) {
  if (!root) return { open: () => Promise.resolve(false), close: () => {}, destroy: () => {} };
  const doc = root.ownerDocument || document;
  const dialog = root.matches?.('#gallery-manage-dialog') ? root : root.querySelector('#gallery-manage-dialog');
  if (!dialog) return { open: () => Promise.resolve(false), close: () => {}, destroy: () => {} };

  const backdrop = doc.getElementById('gallery-manage-dialog-backdrop');
  const panel = dialog.querySelector('.gallery-manage-dialog-panel');
  const kicker = dialog.querySelector('#gallery-manage-dialog-kicker');
  const title = dialog.querySelector('#gallery-manage-dialog-title');
  const description = dialog.querySelector('#gallery-manage-dialog-description');
  const message = dialog.querySelector('#gallery-manage-dialog-message');
  const tokenField = dialog.querySelector('#gallery-manage-token-field');
  const tokenInput = dialog.querySelector('#gallery-manage-token-input');
  const media = dialog.querySelector('#gallery-manage-dialog-media');
  const image = dialog.querySelector('#gallery-manage-dialog-image');
  const comparisons = dialog.querySelector('#gallery-manage-dialog-comparisons');
  const closeButton = dialog.querySelector('#gallery-manage-dialog-close');
  const cancelButton = dialog.querySelector('#gallery-manage-dialog-cancel');
  const confirmButton = dialog.querySelector('#gallery-manage-dialog-confirm');

  let activeMode = '';
  let previouslyFocused = null;
  let resolver = null;
  let disposed = false;

  function setHidden(element, hidden) {
    if (element) element.hidden = hidden;
  }

  function clearComparisons() {
    if (comparisons) comparisons.replaceChildren();
  }

  function renderComparisons(payload) {
    clearComparisons();
    const pending = payload?.comparison?.pending;
    const matches = payload?.comparison?.matches || [];
    if (!comparisons || (!pending && !matches.length)) {
      setHidden(comparisons, true);
      return;
    }
    if (pending) {
      const pendingCard = doc.createElement('article');
      pendingCard.className = 'gallery-manage-compare-card';
      const heading = doc.createElement('strong');
      heading.textContent = '待上传图片';
      pendingCard.append(heading);
      if (pending.imageUrl) {
        const img = doc.createElement('img');
        img.src = pending.imageUrl;
        img.alt = pending.name || '待上传图片';
        pendingCard.append(img);
      }
      comparisons.append(pendingCard);
    }
    for (const match of matches) {
      const card = doc.createElement('article');
      card.className = 'gallery-manage-compare-card';
      const heading = doc.createElement('strong');
      heading.textContent = match.meta || match.path || '库内图片';
      card.append(heading);
      if (match.imageUrl) {
        const img = doc.createElement('img');
        img.src = match.imageUrl;
        img.alt = match.path || '库内图片';
        card.append(img);
      }
      comparisons.append(card);
    }
    setHidden(comparisons, false);
  }

  function render(mode, payload = {}) {
    const copy = MODE_COPY[mode] || MODE_COPY.preview;
    if (kicker) kicker.textContent = payload.kicker || copy.kicker;
    if (title) title.textContent = payload.title || copy.title;
    if (description) description.textContent = payload.description ?? copy.description;
    if (message) message.textContent = '';
    if (confirmButton) confirmButton.textContent = payload.confirmText || copy.confirm;
    if (cancelButton) {
      cancelButton.textContent = payload.cancelText || copy.cancel || '取消';
      cancelButton.hidden = mode === 'preview' || payload.hideCancel === true;
    }
    setHidden(tokenField, mode !== 'connect');
    if (tokenInput) tokenInput.value = '';

    const imageUrl = payload.imageUrl || '';
    if (image) {
      image.removeAttribute('src');
      image.alt = payload.imageAlt || '';
      if (imageUrl) image.src = imageUrl;
    }
    setHidden(media, !imageUrl);
    renderComparisons(payload);
  }

  function finish(value) {
    if (dialog.hidden) return;
    dialog.hidden = true;
    if (backdrop) backdrop.hidden = true;
    doc.documentElement?.classList.remove('gallery-manage-dialog-open');
    activeMode = '';
    clearComparisons();
    if (image) image.removeAttribute('src');
    const resolve = resolver;
    resolver = null;
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus();
    }
    previouslyFocused = null;
    if (resolve) resolve(value);
  }

  function resultForConfirm() {
    if (activeMode === 'connect') return { confirmed: true, token: tokenInput?.value || '' };
    return { confirmed: true };
  }

  function onConfirm() {
    finish(resultForConfirm());
  }

  function onCancel() {
    finish({ confirmed: false });
  }

  function onKeydown(event) {
    if (dialog.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = focusableElements(dialog);
    if (!focusables.length) {
      event.preventDefault();
      panel?.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  closeButton?.addEventListener('click', onCancel);
  cancelButton?.addEventListener('click', onCancel);
  confirmButton?.addEventListener('click', onConfirm);
  backdrop?.addEventListener('click', onCancel);
  doc.addEventListener('keydown', onKeydown);

  return {
    open(mode, payload = {}, invoker = doc.activeElement) {
      if (disposed) return Promise.resolve({ confirmed: false });
      if (resolver) finish({ confirmed: false });
      activeMode = mode;
      previouslyFocused = invoker || null;
      render(mode, payload);
      dialog.hidden = false;
      if (backdrop) backdrop.hidden = false;
      doc.documentElement?.classList.add('gallery-manage-dialog-open');
      queueMicrotask(() => {
        if (mode === 'connect') tokenInput?.focus();
        else (confirmButton || panel)?.focus();
      });
      return new Promise(resolve => { resolver = resolve; });
    },
    close(result = { confirmed: false }) {
      finish(result);
    },
    setMessage(text) {
      if (message) message.textContent = safeText(text);
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      closeButton?.removeEventListener('click', onCancel);
      cancelButton?.removeEventListener('click', onCancel);
      confirmButton?.removeEventListener('click', onConfirm);
      backdrop?.removeEventListener('click', onCancel);
      doc.removeEventListener('keydown', onKeydown);
      finish({ confirmed: false });
    },
  };
}
