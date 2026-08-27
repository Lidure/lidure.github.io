import {
  PUBLIC_API_BASE,
  createCommentsWidget,
  createGuestMessage,
  deleteGuestMessage,
  deleteOwnedGuestMessage,
  fetchGuestMessagePage,
  formatPublicTime,
  getStoredGuestMessageReaction,
  getStoredUserId,
  hasGuestMessageOwnership,
  reactToGuestMessage,
  setStoredUserId,
  updateOwnedGuestMessage,
  type GuestMessage,
  type GuestMessagePatch,
  type MessageNoteMeta,
} from './public-interactions';
import { getSession, login, logout } from './moments-api';
import {
  BOARD_LOGICAL_WIDTH,
  computeBoardHeight,
  correctDroppedPosition,
  logicalToRenderedPosition,
} from './message-board-layout.mjs';
import {
  HOLD_MS,
  createGestureState,
  finishGesture,
  updateGesture,
} from './message-board-gesture.mjs';

const QUICK_REACTIONS = ['❤️', '😂', '✨', '👍'] as const;
const NOTE_COLORS: MessageNoteMeta['color'][] = ['yellow', 'pink', 'blue', 'green', 'purple'];
const MESSAGE_POLL_MS = 15_000;

type BoardState = {
  messages: Map<string, GuestMessage>;
  nextBefore?: number;
  syncCursor: number;
};

type DragSession = {
  id: string;
  pointerId: number;
  pointerType: string;
  startClientX: number;
  startClientY: number;
  startNoteX: number;
  startNoteY: number;
  gesture: ReturnType<typeof createGestureState>;
  activated: boolean;
  holdTimer?: number;
};

function byId<T extends HTMLElement>(id: string) {
  return document.getElementById(id) as T | null;
}

function createNoteElement(message: GuestMessage) {
  const note = document.createElement('article');
  note.className = 'sticky-note';
  note.tabIndex = 0;
  note.dataset.messageId = message.id;
  note.dataset.noteSize = message.note.size;
  note.dataset.noteColor = message.note.color;
  note.style.setProperty('--note-x', String(message.note.x));
  note.style.setProperty('--note-y', String(message.note.y));
  note.style.setProperty('--note-rotation', `${message.note.rotation}deg`);
  note.setAttribute('aria-label', `${message.userId} 的便签：${message.text.slice(0, 40)}`);

  const pin = document.createElement('span');
  pin.className = 'sticky-note-pin';
  pin.setAttribute('aria-hidden', 'true');

  const author = document.createElement('strong');
  author.className = 'sticky-note-author';
  author.textContent = message.userId;

  const text = document.createElement('p');
  text.className = 'sticky-note-text';
  text.textContent = message.text;

  const footer = document.createElement('footer');
  footer.className = 'sticky-note-footer';
  const time = document.createElement('time');
  time.dateTime = new Date(message.createdAt).toISOString();
  time.textContent = formatPublicTime(message.createdAt);
  const meta = document.createElement('span');
  meta.textContent = `${message.commentCount || 0} 条评论`;
  footer.append(time, meta);

  const selectedEmoji = getStoredGuestMessageReaction(message.id);
  const reactions = document.createElement('div');
  reactions.className = 'sticky-note-quick-reactions';
  reactions.setAttribute('aria-label', '快捷回应');
  QUICK_REACTIONS.forEach((emoji) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.messageReaction = emoji;
    button.classList.toggle('active', selectedEmoji === emoji);
    const count = message.reactions?.[emoji] || 0;
    button.textContent = count > 0 ? `${emoji} ${count}` : emoji;
    button.setAttribute('aria-label', selectedEmoji === emoji ? `取消 ${emoji} 回应` : `用 ${emoji} 回应`);
    reactions.appendChild(button);
  });

  note.append(pin, author, text, footer, reactions);
  return note;
}

function applyRenderedPositions(stage: HTMLElement) {
  const renderedWidth = Math.max(720, stage.clientWidth || 720);
  stage.querySelectorAll<HTMLElement>('.sticky-note').forEach((element) => {
    const x = Number(element.style.getPropertyValue('--note-x')) || 0;
    const y = Number(element.style.getPropertyValue('--note-y')) || 0;
    const { x: renderedX, y: renderedY, scale } = logicalToRenderedPosition({ x, y }, renderedWidth);
    element.style.setProperty('--render-x', `${renderedX}px`);
    element.style.setProperty('--render-y', `${renderedY}px`);
    element.style.setProperty('--board-scale', String(scale));
  });
}

function friendlyError(error: unknown) {
  const value = error as Error & { status?: number };
  if (value?.status === 429) return '操作太频繁，请稍后再试';
  return error instanceof Error ? error.message : '操作失败，请稍后再试';
}

async function updateAdminGuestMessage(messageId: string, patch: GuestMessagePatch) {
  const response = await fetch(`${PUBLIC_API_BASE}/messages`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: messageId, ...patch }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(typeof data.error === 'string' ? data.error : `API 错误 (${response.status})`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data.item as GuestMessage;
}

export function initMessageBoard() {
  const root = byId<HTMLElement>('message-board-root');
  const viewport = byId<HTMLElement>('message-board-viewport');
  const stage = byId<HTMLElement>('message-board-stage');
  const status = byId<HTMLElement>('message-board-status');
  const count = byId<HTMLElement>('message-board-count');
  const loadOlder = byId<HTMLButtonElement>('message-board-load-older');
  const drawer = byId<HTMLElement>('message-drawer');
  const drawerContent = byId<HTMLElement>('message-drawer-content');
  const composer = byId<HTMLElement>('message-composer');
  const composeOpen = byId<HTMLButtonElement>('message-compose-open');
  const composerForm = byId<HTMLFormElement>('message-composer-form');
  const composerUser = byId<HTMLInputElement>('message-composer-user');
  const composerText = byId<HTMLTextAreaElement>('message-composer-text');
  const composerStatus = byId<HTMLElement>('message-composer-status');
  const composerSubmit = byId<HTMLButtonElement>('message-composer-submit');
  const colorOptions = byId<HTMLElement>('message-color-options');
  const adminStatus = byId<HTMLElement>('message-admin-status');
  const adminPassword = byId<HTMLInputElement>('message-admin-password');
  const adminLogin = byId<HTMLButtonElement>('message-admin-login');
  const adminLogout = byId<HTMLButtonElement>('message-admin-logout');

  if (!root || !viewport || !stage || !status || !count) return () => {};

  const boardRoot = root;
  const boardViewport = viewport;
  const boardStage = stage;
  const boardStatus = status;
  const boardCount = count;
  const state: BoardState = { messages: new Map(), syncCursor: 0 };
  const serverConfirmed = new Map<string, { x: number; y: number }>();
  const interactionLocks = new Set<string>();
  const deferredRemote = new Map<string, GuestMessage>();
  const controller = new AbortController();
  const suppressClick = new Set<string>();
  let dragSession: DragSession | null = null;
  let destroyed = false;
  let adminMode = false;
  let pollTimer = 0;
  let lastFocus: HTMLElement | null = null;
  let selectedColor: MessageNoteMeta['color'] = NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
  let editingMessageId = '';

  if (composerUser) composerUser.value = getStoredUserId();

  function setStatus(message: string, error = false) {
    boardStatus.textContent = message;
    boardStatus.classList.toggle('error', error);
  }

  function updateStageHeight() {
    const notes = [...state.messages.values()].map((message) => ({ x: message.note.x, y: message.note.y, size: message.note.size }));
    const logicalHeight = computeBoardHeight(notes);
    const renderedWidth = Math.max(720, boardStage.clientWidth || 720);
    const scale = renderedWidth / BOARD_LOGICAL_WIDTH;
    boardStage.style.height = `${Math.max(720, logicalHeight * scale)}px`;
    applyRenderedPositions(boardStage);
  }

  function setSelectedColor(color: MessageNoteMeta['color']) {
    selectedColor = color;
    colorOptions?.querySelectorAll<HTMLButtonElement>('[data-note-color-choice]').forEach((button) => {
      const active = button.dataset.noteColorChoice === color;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  }

  function buildColorOptions() {
    if (!colorOptions || colorOptions.childElementCount) return;
    NOTE_COLORS.forEach((color) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'message-color-choice';
      button.dataset.noteColorChoice = color;
      button.title = color;
      button.setAttribute('aria-label', `选择${color}便签`);
      button.addEventListener('click', () => setSelectedColor(color), { signal: controller.signal });
      colorOptions.appendChild(button);
    });
    setSelectedColor(selectedColor);
  }

  function reconcileDeferred(messageId: string) {
    interactionLocks.delete(messageId);
    const deferred = deferredRemote.get(messageId);
    if (!deferred) return;
    deferredRemote.delete(messageId);
    state.messages.set(messageId, deferred);
    serverConfirmed.set(messageId, { x: deferred.note.x, y: deferred.note.y });
    renderAll();
  }

  function closeComposer() {
    if (!composer) return;
    const lockedId = editingMessageId;
    composer.hidden = true;
    editingMessageId = '';
    if (composerUser) composerUser.disabled = false;
    if (composerSubmit) composerSubmit.textContent = '贴到墙上';
    if (lockedId) reconcileDeferred(lockedId);
  }

  function openComposer(message?: GuestMessage) {
    if (!composer) return;
    editingMessageId = message?.id || '';
    if (editingMessageId) interactionLocks.add(editingMessageId);
    if (composerUser) {
      composerUser.value = message?.userId || getStoredUserId();
      composerUser.disabled = Boolean(message);
    }
    if (composerText) composerText.value = message?.text || '';
    setSelectedColor(message?.note.color || NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)]);
    if (composerStatus) composerStatus.textContent = '';
    if (composerSubmit) composerSubmit.textContent = message ? '保存修改' : '贴到墙上';
    composer.hidden = false;
    requestAnimationFrame(() => (message ? composerText : composerUser)?.focus());
  }

  function closeDrawer(restoreFocus = true) {
    if (!drawer || drawer.hidden) return;
    drawer.classList.remove('open');
    drawer.hidden = true;
    drawer.dataset.messageId = '';
    if (restoreFocus) lastFocus?.focus();
    lastFocus = null;
  }

  function removeMessage(id: string) {
    state.messages.delete(id);
    serverConfirmed.delete(id);
    deferredRemote.delete(id);
    interactionLocks.delete(id);
    renderAll();
    closeDrawer(false);
  }

  async function chooseReaction(messageId: string, emoji: string) {
    const current = state.messages.get(messageId);
    if (!current) return;
    interactionLocks.add(messageId);
    try {
      const result = await reactToGuestMessage(messageId, emoji);
      current.reactions = result.reactions;
      state.messages.set(messageId, current);
      renderAll();
      if (drawer && !drawer.hidden) openDrawer(current, false);
    } catch (error) {
      setStatus(friendlyError(error), true);
    } finally {
      reconcileDeferred(messageId);
    }
  }

  function createReactionStrip(message: GuestMessage) {
    const strip = document.createElement('div');
    strip.className = 'message-drawer-reactions';
    strip.setAttribute('aria-label', '回应这张便签');
    const selectedEmoji = getStoredGuestMessageReaction(message.id);
    QUICK_REACTIONS.forEach((emoji) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.classList.toggle('active', selectedEmoji === emoji);
      const reactionCount = message.reactions?.[emoji] || 0;
      button.textContent = reactionCount > 0 ? `${emoji} ${reactionCount}` : emoji;
      button.setAttribute('aria-label', selectedEmoji === emoji ? `取消 ${emoji} 回应` : `用 ${emoji} 回应`);
      button.addEventListener('click', () => void chooseReaction(message.id, emoji), { signal: controller.signal });
      strip.appendChild(button);
    });
    return strip;
  }

  function openDrawer(message: GuestMessage, rememberFocus = true) {
    if (!drawer || !drawerContent) return;
    if (rememberFocus && document.activeElement instanceof HTMLElement) lastFocus = document.activeElement;
    drawer.dataset.messageId = message.id;
    drawerContent.innerHTML = '';
    const title = document.createElement('h3');
    title.id = 'message-drawer-title';
    title.textContent = message.userId;
    const body = document.createElement('p');
    body.className = 'message-drawer-text';
    body.textContent = message.text;
    const meta = document.createElement('p');
    meta.className = 'message-drawer-meta';
    const owned = hasGuestMessageOwnership(message.id);
    meta.textContent = `${formatPublicTime(message.createdAt)}${owned ? ' · 这是你贴的便签' : ''}${adminMode ? ' · 管理模式' : ''}`;
    drawerContent.append(title, body, meta, createReactionStrip(message));

    if (owned || adminMode) {
      const actions = document.createElement('div');
      actions.className = 'message-drawer-actions';
      const edit = document.createElement('button');
      edit.type = 'button';
      edit.textContent = '编辑便签';
      edit.addEventListener('click', () => openComposer(state.messages.get(message.id) || message), { signal: controller.signal });
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'danger';
      remove.textContent = '删除便签';
      remove.addEventListener('click', async () => {
        if (!window.confirm('确定删除这张便签吗？删除后不可恢复。')) return;
        remove.disabled = true;
        interactionLocks.add(message.id);
        try {
          if (adminMode) await deleteGuestMessage(message.id);
          else await deleteOwnedGuestMessage(message.id);
          removeMessage(message.id);
          setStatus('便签已取下。');
        } catch (error) {
          remove.disabled = false;
          setStatus(friendlyError(error), true);
          reconcileDeferred(message.id);
        }
      }, { signal: controller.signal });
      actions.append(edit, remove);
      drawerContent.appendChild(actions);
    }

    const comments = createCommentsWidget('message', message.id, message.commentCount || 0);
    drawerContent.appendChild(comments);
    drawer.hidden = false;
    requestAnimationFrame(() => {
      drawer.classList.add('open');
      drawer.querySelector<HTMLButtonElement>('[data-message-close="drawer"]')?.focus();
    });
  }

  function logicalDelta(clientDelta: number) {
    const renderedWidth = Math.max(720, boardStage.clientWidth || 720);
    return clientDelta / (renderedWidth / BOARD_LOGICAL_WIDTH);
  }

  function updateDraggedMessage(session: DragSession, clientX: number, clientY: number) {
    const message = state.messages.get(session.id);
    if (!message) return;
    message.note.x = session.startNoteX + logicalDelta(clientX - session.startClientX);
    message.note.y = session.startNoteY + logicalDelta(clientY - session.startClientY);
    const element = boardStage.querySelector<HTMLElement>(`.sticky-note[data-message-id="${CSS.escape(session.id)}"]`);
    if (element) {
      element.style.setProperty('--note-x', String(message.note.x));
      element.style.setProperty('--note-y', String(message.note.y));
      element.classList.add('dragging');
    }
    applyRenderedPositions(boardStage);
    updateStageHeight();
  }

  function activateDrag(session: DragSession, element: HTMLElement, clientX: number, clientY: number) {
    if (session.activated) return;
    session.activated = true;
    session.gesture = { ...session.gesture, phase: 'dragging' };
    interactionLocks.add(session.id);
    suppressClick.add(session.id);
    element.classList.add('dragging');
    element.setPointerCapture?.(session.pointerId);
    updateDraggedMessage(session, clientX, clientY);
  }

  async function finalizeDrop(session: DragSession, element: HTMLElement) {
    if (session.holdTimer) window.clearTimeout(session.holdTimer);
    element.classList.remove('dragging');
    if (!session.activated) return;
    const message = state.messages.get(session.id);
    if (!message) {
      reconcileDeferred(session.id);
      return;
    }
    const occupied = [...state.messages.values()]
      .filter((item) => item.id !== session.id)
      .map((item) => ({ x: item.note.x, y: item.note.y, size: item.note.size }));
    const corrected = correctDroppedPosition({ x: message.note.x, y: message.note.y, size: message.note.size }, occupied);
    message.note.x = corrected.x;
    message.note.y = corrected.y;
    renderAll();

    const owned = hasGuestMessageOwnership(session.id);
    if (!owned && !adminMode) {
      setStatus('已在当前浏览器临时挪动；只有作者的位置会保存到公共留言板。');
      reconcileDeferred(session.id);
      return;
    }

    const rollback = serverConfirmed.get(session.id) || { x: session.startNoteX, y: session.startNoteY };
    try {
      const saved = adminMode && !owned
        ? await updateAdminGuestMessage(session.id, { posX: corrected.x, posY: corrected.y })
        : await updateOwnedGuestMessage(session.id, { posX: corrected.x, posY: corrected.y });
      state.messages.set(saved.id, saved);
      serverConfirmed.set(saved.id, { x: saved.note.x, y: saved.note.y });
      renderAll();
      setStatus('便签位置已保存。');
    } catch (error) {
      message.note.x = rollback.x;
      message.note.y = rollback.y;
      renderAll();
      setStatus(`${friendlyError(error)}，已恢复原来的位置。`, true);
    } finally {
      reconcileDeferred(session.id);
    }
  }

  function bindNote(note: HTMLElement, message: GuestMessage) {
    const open = () => openDrawer(state.messages.get(message.id) || message);
    note.querySelectorAll<HTMLButtonElement>('[data-message-reaction]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const emoji = button.dataset.messageReaction;
        if (emoji) void chooseReaction(message.id, emoji);
      }, { signal: controller.signal });
    });
    note.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      if (suppressClick.delete(message.id)) return;
      open();
    }, { signal: controller.signal });
    note.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    }, { signal: controller.signal });

    note.addEventListener('pointerdown', (event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      if (event.button !== 0) return;
      const current = state.messages.get(message.id);
      if (!current) return;
      const gesture = createGestureState({ pointerType: event.pointerType, startX: event.clientX, startY: event.clientY, now: performance.now() });
      dragSession = {
        id: message.id,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        startClientX: event.clientX,
        startClientY: event.clientY,
        startNoteX: current.note.x,
        startNoteY: current.note.y,
        gesture,
        activated: gesture.phase === 'dragging',
      };
      if (dragSession.activated) {
        interactionLocks.add(message.id);
        suppressClick.add(message.id);
        note.classList.add('dragging');
        note.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      } else {
        dragSession.holdTimer = window.setTimeout(() => {
          if (!dragSession || dragSession.id !== message.id || dragSession.pointerId !== event.pointerId) return;
          activateDrag(dragSession, note, dragSession.startClientX, dragSession.startClientY);
          if (navigator.vibrate) navigator.vibrate(12);
        }, HOLD_MS);
      }
    }, { signal: controller.signal });

    note.addEventListener('pointermove', (event) => {
      const session = dragSession;
      if (!session || session.pointerId !== event.pointerId || session.id !== message.id) return;
      const result = updateGesture(session.gesture, { x: event.clientX, y: event.clientY, now: performance.now() });
      session.gesture = result.state;
      if (result.decision === 'scroll') {
        if (session.holdTimer) window.clearTimeout(session.holdTimer);
        dragSession = null;
        reconcileDeferred(message.id);
        return;
      }
      if (result.decision === 'drag-start') activateDrag(session, note, event.clientX, event.clientY);
      if (session.activated) {
        event.preventDefault();
        updateDraggedMessage(session, event.clientX, event.clientY);
      }
    }, { signal: controller.signal });

    const finish = (event: PointerEvent) => {
      const session = dragSession;
      if (!session || session.pointerId !== event.pointerId || session.id !== message.id) return;
      finishGesture(session.gesture, { x: event.clientX, y: event.clientY, now: performance.now() });
      dragSession = null;
      void finalizeDrop(session, note);
    };
    note.addEventListener('pointerup', finish, { signal: controller.signal });
    note.addEventListener('pointercancel', finish, { signal: controller.signal });
  }

  function renderAll() {
    boardStage.innerHTML = '';
    const messages = [...state.messages.values()].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    if (!messages.length) {
      const empty = document.createElement('p');
      empty.className = 'message-board-empty';
      empty.textContent = '这面墙还空着，来贴第一张便签吧。';
      boardStage.appendChild(empty);
    } else {
      messages.forEach((message) => {
        const note = createNoteElement(message);
        bindNote(note, message);
        boardStage.appendChild(note);
      });
    }
    boardCount.textContent = String(messages.length);
    if (loadOlder) loadOlder.hidden = !state.nextBefore;
    updateStageHeight();
  }

  function acceptRemoteMessage(message: GuestMessage) {
    if (interactionLocks.has(message.id)) {
      deferredRemote.set(message.id, message);
      return false;
    }
    state.messages.set(message.id, message);
    serverConfirmed.set(message.id, { x: message.note.x, y: message.note.y });
    return true;
  }

  async function loadPage(before?: number) {
    try {
      const page = await fetchGuestMessagePage(before ? { limit: 100, before } : { limit: 100 });
      if (destroyed) return;
      page.items.forEach(acceptRemoteMessage);
      state.nextBefore = page.nextBefore;
      state.syncCursor = Math.max(state.syncCursor, page.nextCursor);
      renderAll();
      setStatus(state.messages.size ? '拖一拖便签试试看，点一下可以展开详情。手机端长按后再拖动。' : '还没有人贴便签。');
    } catch (error) {
      setStatus(friendlyError(error), true);
      boardStage.innerHTML = '<button type="button" class="message-board-retry">重新加载</button>';
      boardStage.querySelector<HTMLButtonElement>('.message-board-retry')?.addEventListener('click', () => loadPage(), { once: true, signal: controller.signal });
    }
  }

  async function pollMessages() {
    if (destroyed || document.hidden || !state.syncCursor) return;
    try {
      const page = await fetchGuestMessagePage({ since: state.syncCursor, limit: 100 });
      if (destroyed) return;
      let changed = false;
      page.items.forEach((message) => {
        changed = acceptRemoteMessage(message) || changed;
      });
      state.syncCursor = Math.max(state.syncCursor, page.nextCursor);
      if (changed) renderAll();
    } catch {
      // Polling is deliberately quiet; the next interval will retry.
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
    pollTimer = window.setInterval(() => void pollMessages(), MESSAGE_POLL_MS);
  }

  function syncAdminUi(authenticated: boolean) {
    adminMode = authenticated;
    if (adminStatus) adminStatus.textContent = authenticated ? '已登录，可移动和删除任意便签。' : '未登录';
    if (adminLogin) adminLogin.hidden = authenticated;
    if (adminLogout) adminLogout.hidden = !authenticated;
    if (adminPassword) adminPassword.hidden = authenticated;
    if (drawer && !drawer.hidden) {
      const id = drawer.dataset.messageId;
      const message = id ? state.messages.get(id) : undefined;
      if (message) openDrawer(message, false);
    }
  }

  async function refreshAdminSession() {
    try {
      const session = await getSession({ signal: controller.signal });
      if (!destroyed) syncAdminUi(session.authenticated);
    } catch {
      if (!destroyed) syncAdminUi(false);
    }
  }

  buildColorOptions();
  composeOpen?.addEventListener('click', () => openComposer(), { signal: controller.signal });

  composerForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = composerText?.value.trim() || '';
    const userId = composerUser?.value.trim() || '';
    if (!text || (!editingMessageId && !userId)) return;
    if (composerSubmit) composerSubmit.disabled = true;
    if (composerStatus) composerStatus.textContent = editingMessageId ? '正在保存…' : '正在贴上去…';
    const messageId = editingMessageId;
    try {
      if (messageId) {
        const owned = hasGuestMessageOwnership(messageId);
        const saved = adminMode && !owned
          ? await updateAdminGuestMessage(messageId, { text, noteColor: selectedColor })
          : await updateOwnedGuestMessage(messageId, { text, noteColor: selectedColor });
        state.messages.set(saved.id, saved);
        serverConfirmed.set(saved.id, { x: saved.note.x, y: saved.note.y });
        setStatus('便签已经更新。');
      } else {
        setStoredUserId(userId);
        const created = await createGuestMessage(userId, text, selectedColor);
        state.messages.set(created.id, created);
        serverConfirmed.set(created.id, { x: created.note.x, y: created.note.y });
        state.syncCursor = Math.max(state.syncCursor, created.updatedAt || created.createdAt || 0);
        setStatus('啪——便签贴上去了。');
      }
      renderAll();
      closeComposer();
      if (composerText) composerText.value = '';
    } catch (error) {
      if (composerStatus) composerStatus.textContent = friendlyError(error);
    } finally {
      if (composerSubmit) composerSubmit.disabled = false;
      if (messageId && editingMessageId === messageId) interactionLocks.add(messageId);
    }
  }, { signal: controller.signal });

  boardRoot.querySelectorAll<HTMLElement>('[data-message-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.messageClose;
      if (target === 'drawer') closeDrawer();
      if (target === 'composer') closeComposer();
    }, { signal: controller.signal });
  });

  adminLogin?.addEventListener('click', async () => {
    const password = adminPassword?.value || '';
    if (!password) return;
    adminLogin.disabled = true;
    if (adminStatus) adminStatus.textContent = '正在登录…';
    try {
      const session = await login(password, { signal: controller.signal });
      if (adminPassword) adminPassword.value = '';
      syncAdminUi(session.authenticated);
    } catch (error) {
      if (adminStatus) adminStatus.textContent = friendlyError(error);
    } finally {
      adminLogin.disabled = false;
    }
  }, { signal: controller.signal });

  adminLogout?.addEventListener('click', async () => {
    adminLogout.disabled = true;
    try {
      await logout({ signal: controller.signal });
      syncAdminUi(false);
    } catch (error) {
      if (adminStatus) adminStatus.textContent = friendlyError(error);
    } finally {
      adminLogout.disabled = false;
    }
  }, { signal: controller.signal });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (composer && !composer.hidden) closeComposer();
    else closeDrawer();
  }, { signal: controller.signal });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
      return;
    }
    void pollMessages();
    startPolling();
  }, { signal: controller.signal });

  loadOlder?.addEventListener('click', () => {
    if (!state.nextBefore) return;
    loadOlder.disabled = true;
    loadPage(state.nextBefore).finally(() => { loadOlder.disabled = false; });
  }, { signal: controller.signal });

  const resizeObserver = new ResizeObserver(() => updateStageHeight());
  resizeObserver.observe(boardViewport);
  void loadPage().then(startPolling);
  void refreshAdminSession();

  return () => {
    destroyed = true;
    stopPolling();
    if (dragSession?.holdTimer) window.clearTimeout(dragSession.holdTimer);
    controller.abort();
    resizeObserver.disconnect();
  };
}
