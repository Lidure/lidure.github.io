function button(doc, text, className = 'gallery-manage-button is-quiet') {
  const el = doc.createElement('button');
  el.type = 'button';
  el.className = className;
  el.textContent = text;
  return el;
}

function focusableElements(root) {
  return [...root.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
}

export function createGalleryManageDialog(root) {
  if (!root) throw new Error('Gallery dialog root is required');
  const doc = root.ownerDocument || document;
  const card = root.querySelector('.gallery-manage-dialog-card');
  const title = root.querySelector('#gallery-manage-dialog-title');
  const kicker = root.querySelector('#gallery-manage-dialog-kicker');
  const body = root.querySelector('#gallery-manage-dialog-body');
  const actions = root.querySelector('#gallery-manage-dialog-actions');
  const closeButton = root.querySelector('#gallery-manage-dialog-close');
  const dismissButtons = root.querySelectorAll('[data-dialog-dismiss]');
  let previouslyFocused = null;
  let settle = null;
  let dismissValue = null;

  function close(value = dismissValue) {
    if (root.hidden) return;
    root.hidden = true;
    doc.documentElement.classList.remove('gallery-manage-dialog-open');
    body.replaceChildren();
    actions.replaceChildren();
    const resolve = settle;
    settle = null;
    resolve?.(value);
    const target = previouslyFocused;
    previouslyFocused = null;
    try { target?.focus?.(); } catch {}
  }

  function onKeydown(event) {
    if (root.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const controls = focusableElements(card);
    if (!controls.length) {
      event.preventDefault();
      card.focus();
      return;
    }
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && doc.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && doc.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function open({ titleText, kickerText = 'Gallery', invoker = doc.activeElement, defaultValue = null } = {}) {
    if (!root.hidden) close();
    previouslyFocused = invoker;
    dismissValue = defaultValue;
    title.textContent = titleText || '图库管理';
    kicker.textContent = kickerText;
    body.replaceChildren();
    actions.replaceChildren();
    root.hidden = false;
    doc.documentElement.classList.add('gallery-manage-dialog-open');
    queueMicrotask(() => {
      const controls = focusableElements(card);
      (controls[0] || card)?.focus?.();
    });
    return new Promise(resolve => { settle = resolve; });
  }

  closeButton.addEventListener('click', () => close());
  dismissButtons.forEach(el => el.addEventListener('click', () => close()));
  doc.addEventListener('keydown', onKeydown);

  async function requestToken(invoker) {
    const promise = open({ titleText: '连接 GitHub', kickerText: 'Secure session', invoker, defaultValue: null });
    const copy = doc.createElement('p');
    copy.textContent = 'Token 只保留在当前页面内存中。刷新、离开或断开连接后会立即清空。';
    const input = doc.createElement('input');
    input.type = 'password';
    input.autocomplete = 'off';
    input.placeholder = 'github_pat_… / ghp_…';
    input.className = 'gallery-manage-dialog-input';
    input.setAttribute('aria-label', 'GitHub Token');
    body.append(copy, input);
    const cancel = button(doc, '取消');
    const connect = button(doc, '连接', 'gallery-manage-button is-primary');
    cancel.addEventListener('click', () => close(null));
    connect.addEventListener('click', () => {
      const value = input.value.trim();
      input.value = '';
      close(value || null);
    });
    actions.append(cancel, connect);
    queueMicrotask(() => input.focus());
    return promise;
  }

  async function previewImage(item, invoker) {
    const promise = open({ titleText: item?.filename || '图片预览', kickerText: item?.category || 'Preview', invoker });
    const image = doc.createElement('img');
    image.className = 'gallery-manage-dialog-preview';
    image.src = item?.imageUrl || '';
    image.alt = item?.filename || '图库图片';
    body.append(image);
    const done = button(doc, '关闭', 'gallery-manage-button is-primary');
    done.addEventListener('click', () => close(true));
    actions.append(done);
    return promise;
  }

  async function confirmDelete(item, invoker) {
    const promise = open({ titleText: '确认删除图片？', kickerText: 'Delete', invoker, defaultValue: false });
    const image = doc.createElement('img');
    image.className = 'gallery-manage-dialog-preview';
    image.src = item?.imageUrl || '';
    image.alt = item?.filename || '待删除图片';
    const detail = doc.createElement('p');
    detail.textContent = `${item?.category || ''} / ${item?.filename || ''}`;
    body.append(image, detail);
    const cancel = button(doc, '取消');
    const confirm = button(doc, '删除', 'gallery-manage-button is-danger');
    cancel.addEventListener('click', () => close(false));
    confirm.addEventListener('click', () => close(true));
    actions.append(cancel, confirm);
    return promise;
  }

  async function confirmSimilarity({ candidate, matches = [] } = {}, invoker) {
    const promise = open({ titleText: '发现相似图片', kickerText: 'Duplicate check', invoker, defaultValue: false });
    const intro = doc.createElement('p');
    intro.textContent = '请对比待上传图片与库内候选，确认是否仍然上传。';
    body.append(intro);
    for (const match of matches) {
      const grid = doc.createElement('div');
      grid.className = 'gallery-manage-compare-grid';
      for (const data of [
        { label: '库内图片', url: match.imageUrl, meta: match.meta || match.path || '' },
        { label: '待上传图片', url: candidate?.previewUrl, meta: candidate?.file?.name || '' },
      ]) {
        const cardEl = doc.createElement('article');
        cardEl.className = 'gallery-manage-compare-card';
        const strong = doc.createElement('strong');
        strong.textContent = data.label;
        const img = doc.createElement('img');
        img.src = data.url || '';
        img.alt = data.label;
        const meta = doc.createElement('p');
        meta.textContent = data.meta;
        cardEl.append(strong, img, meta);
        grid.append(cardEl);
      }
      body.append(grid);
    }
    const skip = button(doc, '跳过');
    const proceed = button(doc, '仍然上传', 'gallery-manage-button is-primary');
    skip.addEventListener('click', () => close(false));
    proceed.addEventListener('click', () => close(true));
    actions.append(skip, proceed);
    return promise;
  }

  return {
    close,
    requestToken,
    previewImage,
    confirmDelete,
    confirmSimilarity,
    destroy() {
      doc.removeEventListener('keydown', onKeydown);
      close();
    },
  };
}
