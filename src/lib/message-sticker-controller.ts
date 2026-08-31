import { MESSAGE_STICKER_BY_KEY, MESSAGE_STICKER_CATALOG, type MessageStickerCategory, type MessageStickerDefinition } from './message-sticker-catalog';
import {
  createMessageSticker,
  deleteAdminMessageSticker,
  deleteOwnedMessageSticker,
  fetchMessageStickers,
  updateAdminMessageSticker,
  updateOwnedMessageSticker,
  type MessageSticker,
} from './message-sticker-api';
import { BOARD_LOGICAL_WIDTH, logicalToRenderedPosition } from './message-board-layout.mjs';
import { HOLD_MS, createGestureState, finishGesture, updateGesture } from './message-board-gesture.mjs';

const MESSAGE_STICKER_POLL_MS = 15_000;
const OWNER_STICKER_LIMIT = 5;

type StickerCategoryFilter = 'all' | MessageStickerCategory;

const STICKER_CATEGORIES: readonly { key: StickerCategoryFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'sanrio', label: '三丽鸥' },
  { key: 'nekoha-shizuku', label: '猫羽雫' },
  { key: 'nachoneko', label: '甘城猫猫' },
  { key: 'journal', label: '手账' },
];

type StickerDragSession = {
  id: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  gesture: ReturnType<typeof createGestureState>;
  activated: boolean;
  holdTimer?: number;
};

function byId<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function friendlyStickerError(error: unknown) {
  const value = error as Error & { code?: string; status?: number };
  if (value.code === 'STICKER_LIMIT_REACHED') return '这台设备已经贴了 5 张公共贴纸，先删掉一张再来吧。';
  if (value.code === 'STICKER_RATE_LIMITED') return '刚刚贴得有点快，过一会儿再试试吧。';
  if (value.code === 'STICKER_FORBIDDEN') return '这张贴纸不是你贴的，不能移动或删除。';
  return error instanceof Error ? error.message : '贴纸操作失败，请稍后再试';
}

export function initMessageStickerBoard() {
  const root = byId<HTMLElement>('message-board-root')!;
  const stage = byId<HTMLElement>('message-board-stage')!;
  const viewport = byId<HTMLElement>('message-board-viewport')!;
  const openButton = byId<HTMLButtonElement>('message-sticker-open')!;
  const panel = byId<HTMLElement>('message-sticker-panel')!;
  const grid = byId<HTMLElement>('message-sticker-grid')!;
  const categories = byId<HTMLElement>('message-sticker-categories')!;
  const quota = byId<HTMLElement>('message-sticker-quota')!;
  const placementBar = byId<HTMLElement>('message-sticker-placement-bar')!;
  const placementText = byId<HTMLElement>('message-sticker-placement-text');
  const adminStatus = byId<HTMLElement>('message-admin-status');
  const boardStatus = byId<HTMLElement>('message-board-status');

  if (!root || !stage || !viewport || !openButton || !panel || !grid || !categories || !quota || !placementBar) return () => {};

  const controller = new AbortController();
  const { signal } = controller;
  const stickers = new Map<string, MessageSticker>();
  let ownedIds = new Set<string>();
  let ownedCount = 0;
  let adminMode = false;
  let activeStickerCategory: StickerCategoryFilter = 'all';
  let placingStickerKey = '';
  let selectedStickerId = '';
  let dragSession: StickerDragSession | null = null;
  let suppressClickId = '';
  let mutationInFlight = false;
  let pollTimer = 0;
  let destroyed = false;
  let previewLogical: { x: number; y: number } | null = null;

  function setBoardStatus(text: string, error = false) {
    if (!boardStatus) return;
    boardStatus.textContent = text;
    boardStatus.classList.toggle('error', error);
  }

  function ensureStickerLayer() {
    let layer = stage.querySelector<HTMLElement>('#message-public-sticker-layer');
    if (layer) return layer;
    layer = document.createElement('div');
    layer.id = 'message-public-sticker-layer';
    layer.className = 'message-public-sticker-layer';
    layer.setAttribute('aria-label', '大家贴在留言墙上的公共贴纸');
    stage.appendChild(layer);
    return layer;
  }

  function renderedWidth() {
    return Math.max(720, stage.clientWidth || 720);
  }

  function definitionFor(key: string) {
    return MESSAGE_STICKER_BY_KEY.get(key) as MessageStickerDefinition | undefined;
  }

  function logicalBounds(definition: MessageStickerDefinition) {
    const width = renderedWidth();
    const scale = width / BOARD_LOGICAL_WIDTH;
    const logicalHeight = Math.max(720 / scale, stage.clientHeight / scale);
    return {
      maxX: BOARD_LOGICAL_WIDTH - definition.width,
      maxY: Math.max(0, logicalHeight - definition.height),
    };
  }

  function setStickerPosition(element: HTMLElement, sticker: Pick<MessageSticker, 'x' | 'y' | 'rotation'>, definition: MessageStickerDefinition) {
    const { x, y, scale } = logicalToRenderedPosition({ x: sticker.x, y: sticker.y }, renderedWidth());
    element.style.width = `${definition.width}px`;
    element.style.height = `${definition.height}px`;
    element.style.setProperty('--public-sticker-x', `${x}px`);
    element.style.setProperty('--public-sticker-y', `${y}px`);
    element.style.setProperty('--public-sticker-rotation', `${sticker.rotation || 0}deg`);
    element.style.setProperty('--public-sticker-scale', String(scale));
  }

  function makeImage(definition: MessageStickerDefinition, parent: HTMLElement) {
    const image = document.createElement('img');
    image.src = definition.imageUrl;
    image.alt = definition.character;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.draggable = false;
    image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => { parent.hidden = true; }, { once: true });
    return image;
  }

  function canManage(id: string) {
    return adminMode || ownedIds.has(id);
  }

  function updateQuotaUi() {
    quota.textContent = adminMode ? `我的贴纸 ${ownedCount} / 5 · 管理员不限` : `我的贴纸 ${ownedCount} / 5`;
    quota.classList.toggle('is-full', !adminMode && ownedCount >= OWNER_STICKER_LIMIT);
    grid.querySelectorAll<HTMLButtonElement>('[data-sticker-choice]').forEach((button) => {
      button.disabled = !adminMode && ownedCount >= OWNER_STICKER_LIMIT;
    });
  }

  function closePanel() {
    panel.hidden = true;
    openButton.setAttribute('aria-expanded', 'false');
  }

  function openPanel() {
    cancelPlacement();
    panel.hidden = false;
    openButton.setAttribute('aria-expanded', 'true');
    updateQuotaUi();
    panel.querySelector<HTMLButtonElement>('[data-sticker-panel-close]')?.focus();
  }

  function buildStickerCategories() {
    categories.replaceChildren();
    STICKER_CATEGORIES.forEach(({ key, label }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-sticker-category';
      button.dataset.stickerCategory = key;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', String(activeStickerCategory === key));
      const count = key === 'all'
        ? MESSAGE_STICKER_CATALOG.length
        : MESSAGE_STICKER_CATALOG.filter((definition) => definition.category === key).length;
      button.append(document.createTextNode(label));
      const badge = document.createElement('span');
      badge.className = 'message-sticker-category-count';
      badge.textContent = String(count);
      button.appendChild(badge);
      button.addEventListener('click', () => {
        if (activeStickerCategory === key) return;
        activeStickerCategory = key;
        buildStickerCategories();
        buildStickerChoices();
      }, { signal });
      categories.appendChild(button);
    });
  }

  function buildStickerChoices() {
    grid.replaceChildren();
    const visibleDefinitions = activeStickerCategory === 'all'
      ? MESSAGE_STICKER_CATALOG
      : MESSAGE_STICKER_CATALOG.filter((definition) => definition.category === activeStickerCategory);
    visibleDefinitions.forEach((definition) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-sticker-choice';
      button.dataset.stickerChoice = definition.key;
      button.setAttribute('aria-label', `选择${definition.character}贴纸：${definition.label}`);
      const image = makeImage(definition, button);
      const label = document.createElement('span');
      label.textContent = definition.character;
      const note = document.createElement('small');
      note.textContent = definition.label;
      label.appendChild(note);
      button.append(image, label);
      button.addEventListener('click', () => {
        if (button.disabled) return;
        startPlacement(definition.key);
      }, { signal });
      grid.appendChild(button);
    });
    updateQuotaUi();
  }
  function createActionMenu(sticker: MessageSticker) {
    const actions = document.createElement('span');
    actions.className = 'message-public-sticker-actions';
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'danger';
    remove.textContent = '删除';
    remove.addEventListener('pointerdown', (event) => event.stopPropagation());
    remove.addEventListener('click', (event) => {
      event.stopPropagation();
      void removeSticker(sticker.id);
    }, { signal });
    actions.append(remove);
    return actions;
  }

  function bindStickerDrag(element: HTMLButtonElement, sticker: MessageSticker, definition: MessageStickerDefinition) {
    if (!canManage(sticker.id)) return;

    element.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('.message-public-sticker-actions')) return;
      if (event.button !== 0) return;
      const gesture = createGestureState({ pointerType: event.pointerType, startX: event.clientX, startY: event.clientY, now: performance.now() });
      dragSession = {
        id: sticker.id,
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startX: sticker.x,
        startY: sticker.y,
        gesture,
        activated: false,
      };
      if (event.pointerType === 'touch') {
        dragSession.holdTimer = window.setTimeout(() => {
          if (!dragSession || dragSession.id !== sticker.id || dragSession.pointerId !== event.pointerId) return;
          activateDrag(dragSession, element, definition, dragSession.startClientX, dragSession.startClientY);
          if (navigator.vibrate) navigator.vibrate(12);
        }, HOLD_MS);
      }
    }, { signal });

    element.addEventListener('pointermove', (event) => {
      const session = dragSession;
      if (!session || session.id !== sticker.id || session.pointerId !== event.pointerId) return;
      const result = updateGesture(session.gesture, { x: event.clientX, y: event.clientY, now: performance.now() });
      session.gesture = result.state;
      if (result.decision === 'scroll') {
        if (session.holdTimer) window.clearTimeout(session.holdTimer);
        dragSession = null;
        return;
      }
      if (result.decision === 'drag-start') activateDrag(session, element, definition, event.clientX, event.clientY);
      if (session.activated) {
        event.preventDefault();
        updateDraggedSticker(session, element, definition, event.clientX, event.clientY);
      }
    }, { signal });

    const finish = (event: PointerEvent) => {
      const session = dragSession;
      if (!session || session.id !== sticker.id || session.pointerId !== event.pointerId) return;
      finishGesture(session.gesture, { x: event.clientX, y: event.clientY, now: performance.now() });
      dragSession = null;
      void finalizeDrop(session, element, definition);
    };
    element.addEventListener('pointerup', finish, { signal });
    element.addEventListener('pointercancel', finish, { signal });
  }

  function activateDrag(session: StickerDragSession, element: HTMLElement, definition: MessageStickerDefinition, clientX: number, clientY: number) {
    if (session.activated) return;
    session.activated = true;
    session.gesture = { ...session.gesture, phase: 'dragging' };
    suppressClickId = session.id;
    selectedStickerId = '';
    element.classList.add('is-dragging');
    element.setPointerCapture?.(session.pointerId);
    updateDraggedSticker(session, element, definition, clientX, clientY);
  }

  function updateDraggedSticker(session: StickerDragSession, element: HTMLElement, definition: MessageStickerDefinition, clientX: number, clientY: number) {
    const sticker = stickers.get(session.id);
    if (!sticker) return;
    const scale = renderedWidth() / BOARD_LOGICAL_WIDTH;
    const bounds = logicalBounds(definition);
    sticker.x = clamp(session.startX + (clientX - session.startClientX) / scale, 0, bounds.maxX);
    sticker.y = clamp(session.startY + (clientY - session.startClientY) / scale, 0, bounds.maxY);
    setStickerPosition(element, sticker, definition);
  }

  async function finalizeDrop(session: StickerDragSession, element: HTMLElement, definition: MessageStickerDefinition) {
    if (session.holdTimer) window.clearTimeout(session.holdTimer);
    if (!session.activated) return;
    if (element.hasPointerCapture?.(session.pointerId)) element.releasePointerCapture(session.pointerId);
    element.classList.remove('is-dragging');
    const sticker = stickers.get(session.id);
    if (!sticker) return;
    const rollback = { x: session.startX, y: session.startY };
    mutationInFlight = true;
    try {
      const saved = adminMode && !ownedIds.has(session.id)
        ? await updateAdminMessageSticker(session.id, sticker.x, sticker.y)
        : await updateOwnedMessageSticker(session.id, sticker.x, sticker.y);
      stickers.set(saved.id, saved);
      setStickerPosition(element, saved, definition);
      setBoardStatus('贴纸位置已经保存啦。');
    } catch (error) {
      sticker.x = rollback.x;
      sticker.y = rollback.y;
      setStickerPosition(element, sticker, definition);
      setBoardStatus(`${friendlyStickerError(error)}，贴纸回到原来的位置了。`, true);
    } finally {
      mutationInFlight = false;
    }
  }

  function renderPublicStickers() {
    const layer = ensureStickerLayer();
    layer.replaceChildren();
    const ordered = [...stickers.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    ordered.forEach((sticker) => {
      const definition = definitionFor(sticker.stickerKey);
      if (!definition) return;
      const element = document.createElement('button');
      element.type = 'button';
      element.className = 'message-public-sticker';
      element.dataset.messageStickerId = sticker.id;
      const manageable = canManage(sticker.id);
      element.classList.toggle('is-manageable', manageable);
      element.classList.toggle('is-selected', selectedStickerId === sticker.id);
      element.tabIndex = manageable ? 0 : -1;
      element.setAttribute('aria-label', manageable ? `${definition.character}公共贴纸，可点击删除或直接拖动` : definition.character);
      setStickerPosition(element, sticker, definition);
      element.appendChild(makeImage(definition, element));
      if (manageable && selectedStickerId === sticker.id) element.appendChild(createActionMenu(sticker));
      if (manageable) {
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          if (suppressClickId === sticker.id) {
            suppressClickId = '';
            return;
          }
          selectedStickerId = selectedStickerId === sticker.id ? '' : sticker.id;
          renderPublicStickers();
        }, { signal });
        bindStickerDrag(element, sticker, definition);
      }
      layer.appendChild(element);
    });
    renderPlacementPreview();
  }

  function pointToLogical(clientX: number, clientY: number, definition: MessageStickerDefinition) {
    const rect = stage.getBoundingClientRect();
    const scale = renderedWidth() / BOARD_LOGICAL_WIDTH;
    const bounds = logicalBounds(definition);
    return {
      x: clamp((clientX - rect.left) / scale - definition.width / 2, 0, bounds.maxX),
      y: clamp((clientY - rect.top) / scale - definition.height / 2, 0, bounds.maxY),
    };
  }

  function renderPlacementPreview() {
    if (!placingStickerKey || !previewLogical) return;
    const definition = definitionFor(placingStickerKey);
    if (!definition) return;
    const layer = ensureStickerLayer();
    const preview = document.createElement('span');
    preview.className = 'message-public-sticker message-public-sticker-preview';
    preview.setAttribute('aria-hidden', 'true');
    const draft = { ...previewLogical, rotation: 0 };
    setStickerPosition(preview, draft, definition);
    preview.appendChild(makeImage(definition, preview));
    layer.appendChild(preview);
  }

  function startPlacement(stickerKey: string) {
    if (!adminMode && ownedCount >= OWNER_STICKER_LIMIT) {
      setBoardStatus('这台设备已经贴了 5 张公共贴纸，先删掉一张再来吧。', true);
      return;
    }
    placingStickerKey = stickerKey;
    selectedStickerId = '';
    previewLogical = null;
    closePanel();
    stage.classList.add('is-placing-sticker');
    placementBar.hidden = false;
    const definition = definitionFor(stickerKey);
    if (placementText) placementText.textContent = definition ? `拿着 ${definition.character} 啦，在木板空白处点一下` : '在木板空白处点一下';
  }

  function cancelPlacement() {
    placingStickerKey = '';
    previewLogical = null;
    stage.classList.remove('is-placing-sticker');
    placementBar.hidden = true;
    ensureStickerLayer().querySelector('.message-public-sticker-preview')?.remove();
  }

  async function placeSelectedSticker(clientX: number, clientY: number) {
    const key = placingStickerKey;
    const definition = definitionFor(key);
    if (!key || !definition || mutationInFlight) return;
    const position = pointToLogical(clientX, clientY, definition);
    mutationInFlight = true;
    cancelPlacement();
    try {
      const result = await createMessageSticker(key, position.x, position.y);
      stickers.set(result.item.id, result.item);
      ownedIds.add(result.item.id);
      ownedCount = result.ownedCount;
      renderPublicStickers();
      updateQuotaUi();
      setBoardStatus('啪——贴纸也贴到大家的留言墙上啦。');
    } catch (error) {
      setBoardStatus(friendlyStickerError(error), true);
      if ((error as Error & { code?: string }).code === 'STICKER_LIMIT_REACHED') {
        ownedCount = OWNER_STICKER_LIMIT;
        updateQuotaUi();
      }
    } finally {
      mutationInFlight = false;
    }
  }

  async function removeSticker(id: string) {
    const sticker = stickers.get(id);
    if (!sticker) return;
    const definition = definitionFor(sticker.stickerKey);
    const label = definition?.character || '这张贴纸';
    if (!window.confirm(`要把 ${label} 从留言墙上揭下来吗？`)) return;
    mutationInFlight = true;
    try {
      if (adminMode && !ownedIds.has(id)) await deleteAdminMessageSticker(id);
      else await deleteOwnedMessageSticker(id);
      const wasOwned = ownedIds.delete(id);
      if (wasOwned) ownedCount = Math.max(0, ownedCount - 1);
      stickers.delete(id);
      selectedStickerId = '';
      renderPublicStickers();
      updateQuotaUi();
      setBoardStatus('贴纸已经揭下来啦。');
    } catch (error) {
      setBoardStatus(friendlyStickerError(error), true);
    } finally {
      mutationInFlight = false;
    }
  }

  async function refreshStickers(silent = false) {
    if (destroyed || dragSession || mutationInFlight) return;
    try {
      const page = await fetchMessageStickers(signal);
      if (destroyed) return;
      stickers.clear();
      page.items.forEach((item) => stickers.set(item.id, item));
      ownedIds = new Set(page.ownedIds);
      ownedCount = page.ownedCount;
      if (selectedStickerId && !stickers.has(selectedStickerId)) selectedStickerId = '';
      renderPublicStickers();
      updateQuotaUi();
    } catch (error) {
      if (!silent && !destroyed) setBoardStatus(`公共贴纸暂时没加载出来：${friendlyStickerError(error)}`, true);
    }
  }

  function stopPolling() {
    if (!pollTimer) return;
    window.clearInterval(pollTimer);
    pollTimer = 0;
  }

  function startPolling() {
    stopPolling();
    if (document.hidden) return;
    pollTimer = window.setInterval(() => void refreshStickers(true), MESSAGE_STICKER_POLL_MS);
  }

  function applyAdminMode(authenticated: boolean) {
    if (authenticated === adminMode) return;
    adminMode = authenticated;
    selectedStickerId = '';
    renderPublicStickers();
    updateQuotaUi();
  }

  function syncAdminMode() {
    applyAdminMode(Boolean(adminStatus?.textContent?.includes('已登录')));
  }

  function handleAdminChange(event: Event) {
    const detail = (event as CustomEvent<{ authenticated?: boolean }>).detail;
    applyAdminMode(Boolean(detail?.authenticated));
  }

  buildStickerCategories();
  buildStickerChoices();
  ensureStickerLayer();
  void refreshStickers();
  startPolling();

  window.addEventListener('message-board-admin-change', handleAdminChange, { signal });
  openButton.addEventListener('click', () => panel.hidden ? openPanel() : closePanel(), { signal });
  panel.querySelector<HTMLButtonElement>('[data-sticker-panel-close]')?.addEventListener('click', closePanel, { signal });
  placementBar.querySelector<HTMLButtonElement>('[data-sticker-placement-cancel]')?.addEventListener('click', cancelPlacement, { signal });

  stage.addEventListener('pointermove', (event) => {
    if (!placingStickerKey) return;
    const definition = definitionFor(placingStickerKey);
    if (!definition || event.pointerType === 'touch') return;
    previewLogical = pointToLogical(event.clientX, event.clientY, definition);
    ensureStickerLayer().querySelector('.message-public-sticker-preview')?.remove();
    renderPlacementPreview();
  }, { signal });

  stage.addEventListener('click', (event) => {
    if (!placingStickerKey) return;
    const target = event.target as HTMLElement;
    if (target.closest('.sticky-note') || target.closest('.message-public-sticker.is-manageable')) return;
    event.preventDefault();
    event.stopPropagation();
    void placeSelectedSticker(event.clientX, event.clientY);
  }, { signal });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (placingStickerKey) cancelPlacement();
      else if (!panel.hidden) closePanel();
      else if (selectedStickerId) { selectedStickerId = ''; renderPublicStickers(); }
    }
  }, { signal });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopPolling();
    else { void refreshStickers(true); startPolling(); }
  }, { signal });

  const stageObserver = new MutationObserver(() => {
    if (!stage.querySelector('#message-public-sticker-layer')) {
      ensureStickerLayer();
      renderPublicStickers();
    }
  });
  stageObserver.observe(stage, { childList: true });

  const adminObserver = adminStatus ? new MutationObserver(syncAdminMode) : null;
  adminObserver?.observe(adminStatus!, { childList: true, characterData: true, subtree: true });
  syncAdminMode();

  const resizeObserver = new ResizeObserver(() => renderPublicStickers());
  resizeObserver.observe(stage);

  return () => {
    destroyed = true;
    stopPolling();
    controller.abort();
    stageObserver.disconnect();
    adminObserver?.disconnect();
    resizeObserver.disconnect();
    cancelPlacement();
  };
}
