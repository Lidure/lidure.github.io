import {
  createCommentsWidget,
  fetchGuestMessagePage,
  formatPublicTime,
  getStoredUserId,
  hasGuestMessageOwnership,
  type GuestMessage,
} from './public-interactions';
import {
  BOARD_LOGICAL_WIDTH,
  computeBoardHeight,
  logicalToRenderedPosition,
} from './message-board-layout.mjs';

const QUICK_REACTIONS = ['❤️', '😂', '✨', '👍'] as const;

type BoardState = {
  messages: Map<string, GuestMessage>;
  nextBefore?: number;
  syncCursor: number;
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

  const reactions = document.createElement('div');
  reactions.className = 'sticky-note-quick-reactions';
  reactions.setAttribute('aria-label', '快捷回应');
  QUICK_REACTIONS.forEach((emoji) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = emoji;
    button.dataset.messageReaction = emoji;
    button.setAttribute('aria-label', `用 ${emoji} 回应`);
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
  const composerUser = byId<HTMLInputElement>('message-composer-user');

  if (!root || !viewport || !stage || !status || !count) return () => {};

  const boardRoot = root;
  const boardViewport = viewport;
  const boardStage = stage;
  const boardStatus = status;
  const boardCount = count;
  const state: BoardState = { messages: new Map(), syncCursor: 0 };
  const controller = new AbortController();
  let destroyed = false;

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

  function openDrawer(message: GuestMessage) {
    if (!drawer || !drawerContent) return;
    drawerContent.innerHTML = '';
    const title = document.createElement('h3');
    title.id = 'message-drawer-title';
    title.textContent = message.userId;
    const body = document.createElement('p');
    body.className = 'message-drawer-text';
    body.textContent = message.text;
    const meta = document.createElement('p');
    meta.className = 'message-drawer-meta';
    meta.textContent = `${formatPublicTime(message.createdAt)}${hasGuestMessageOwnership(message.id) ? ' · 这是你贴的便签' : ''}`;
    const comments = createCommentsWidget('message', message.id, message.commentCount || 0);
    drawerContent.append(title, body, meta, comments);
    drawer.hidden = false;
    requestAnimationFrame(() => drawer.classList.add('open'));
  }

  function bindNote(note: HTMLElement, message: GuestMessage) {
    const open = () => openDrawer(message);
    note.addEventListener('click', (event) => {
      if ((event.target as HTMLElement).closest('button')) return;
      open();
    }, { signal: controller.signal });
    note.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    }, { signal: controller.signal });
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

  async function loadPage(before?: number) {
    try {
      const page = await fetchGuestMessagePage(before ? { limit: 100, before } : { limit: 100 });
      if (destroyed) return;
      page.items.forEach((message) => state.messages.set(message.id, message));
      state.nextBefore = page.nextBefore;
      state.syncCursor = page.nextCursor;
      renderAll();
      setStatus(state.messages.size ? '按住或拖动便签试试看，点一下可以展开详情。' : '还没有人贴便签。');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '留言板加载失败', true);
      boardStage.innerHTML = '<button type="button" class="message-board-retry">重新加载</button>';
      boardStage.querySelector<HTMLButtonElement>('.message-board-retry')?.addEventListener('click', () => loadPage(), { once: true, signal: controller.signal });
    }
  }

  composeOpen?.addEventListener('click', () => {
    if (!composer) return;
    composer.hidden = false;
    composer.querySelector<HTMLElement>('input, textarea, button')?.focus();
  }, { signal: controller.signal });

  boardRoot.querySelectorAll<HTMLElement>('[data-message-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.messageClose;
      if (target === 'drawer' && drawer) {
        drawer.classList.remove('open');
        drawer.hidden = true;
      }
      if (target === 'composer' && composer) composer.hidden = true;
    }, { signal: controller.signal });
  });

  loadOlder?.addEventListener('click', () => {
    if (!state.nextBefore) return;
    loadOlder.disabled = true;
    loadPage(state.nextBefore).finally(() => { loadOlder.disabled = false; });
  }, { signal: controller.signal });

  const resizeObserver = new ResizeObserver(() => updateStageHeight());
  resizeObserver.observe(boardViewport);
  loadPage();

  return () => {
    destroyed = true;
    controller.abort();
    resizeObserver.disconnect();
  };
}
