const DEFAULT_PUBLIC_API_BASE = 'https://api.lidure22.xyz/api';
export const PUBLIC_API_BASE = (import.meta.env.PUBLIC_MOMENTS_API || DEFAULT_PUBLIC_API_BASE).replace(/\/$/, '');
export const USER_ID_KEY = 'guest_user_id';
const COMMENT_REACTION_STORAGE_KEY = 'public_comment_reactions_v1';
const GUEST_MESSAGE_AUTHOR_STORAGE_KEY = 'guest_message_author_tokens_v1';
const MESSAGE_REACTION_STORAGE_KEY = 'public_message_reactions_v1';

export type CommentTargetType = 'moment' | 'message';

export type PublicComment = {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  userId: string;
  text: string;
  createdAt: number;
  reactions?: Record<string, number>;
};

export type MessageNoteMeta = {
  color: 'yellow' | 'pink' | 'blue' | 'green' | 'purple';
  size: 'small' | 'medium' | 'large';
  x: number;
  y: number;
  rotation: number;
  legacy: boolean;
};

export type GuestMessage = {
  id: string;
  userId: string;
  text: string;
  createdAt: number;
  updatedAt?: number;
  commentCount?: number;
  reactions?: Record<string, number>;
  note: MessageNoteMeta;
  legacy?: boolean;
};

export type GuestMessagePage = {
  items: GuestMessage[];
  now: number;
  nextCursor: number;
  nextBefore?: number;
};

export type GuestMessagePatch = {
  text?: string;
  noteColor?: MessageNoteMeta['color'];
  posX?: number;
  posY?: number;
};

const COMMENT_REACTION_EMOJIS = ['❤️', '😂', '😭', '👍', '👎', '✨', '🔥', '🥰', '👏', '😮', '🤔', '🎉', '💯', '😍', '😎', '🥺', '😡', '😴', '🙏', '💪', '🌟', '🍀', '🫶', '😆', '🤯', '😱', '😢', '🤣', '🤩', '🙌', '👌', '😋', '😇', '🤗', '😤', '😐', '😵', '😳', '🤓', '👀', '💔', '⚡', '🏆', '🎁', '🍻', '☕', '🌈', '💤'];
type CommentReactionMap = Record<string, string>;
type MessageAuthorTokenMap = Record<string, string>;
type MessageReactionMap = Record<string, string>;
let commentReactionOutsideListenerBound = false;

function closeCommentReactionPanel(panel: HTMLElement) {
  panel.hidden = true;
  const toggleButton = panel.parentElement?.querySelector<HTMLButtonElement>('.public-comment-reaction-add');
  toggleButton?.setAttribute('aria-expanded', 'false');
}

function ensureCommentReactionOutsideListener() {
  if (commentReactionOutsideListenerBound) return;
  commentReactionOutsideListenerBound = true;
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest?.('.public-comment-reactions')) return;
    document.querySelectorAll<HTMLElement>('.public-comment-reaction-panel').forEach(closeCommentReactionPanel);
  });
}

export function getStoredUserId() {
  try {
    return localStorage.getItem(USER_ID_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredUserId(userId: string) {
  try {
    localStorage.setItem(USER_ID_KEY, userId);
  } catch {}
}

function readStorageMap<T extends Record<string, string>>(key: string): T {
  try {
    const raw = localStorage.getItem(key);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' && !Array.isArray(data) ? data as T : {} as T;
  } catch {
    return {} as T;
  }
}

function writeStorageMap(key: string, data: Record<string, string>) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

function getStoredCommentReactions(): CommentReactionMap {
  return readStorageMap<CommentReactionMap>(COMMENT_REACTION_STORAGE_KEY);
}

function getStoredCommentReaction(commentId: string) {
  return getStoredCommentReactions()[commentId] || '';
}

function setStoredCommentReaction(commentId: string, emoji: string) {
  const reactions = getStoredCommentReactions();
  if (emoji) reactions[commentId] = emoji;
  else delete reactions[commentId];
  writeStorageMap(COMMENT_REACTION_STORAGE_KEY, reactions);
}

function clearStoredCommentReaction(commentId: string) {
  setStoredCommentReaction(commentId, '');
}

function getGuestMessageAuthorTokens(): MessageAuthorTokenMap {
  return readStorageMap<MessageAuthorTokenMap>(GUEST_MESSAGE_AUTHOR_STORAGE_KEY);
}

function setGuestMessageAuthorToken(messageId: string, token: string) {
  const tokens = getGuestMessageAuthorTokens();
  if (token) tokens[messageId] = token;
  else delete tokens[messageId];
  writeStorageMap(GUEST_MESSAGE_AUTHOR_STORAGE_KEY, tokens);
}

function getGuestMessageAuthorToken(messageId: string) {
  return getGuestMessageAuthorTokens()[messageId] || '';
}

export function hasGuestMessageOwnership(messageId: string) {
  return Boolean(getGuestMessageAuthorToken(messageId));
}

function getStoredMessageReactions(): MessageReactionMap {
  return readStorageMap<MessageReactionMap>(MESSAGE_REACTION_STORAGE_KEY);
}

export function getStoredGuestMessageReaction(messageId: string) {
  return getStoredMessageReactions()[messageId] || '';
}

function setStoredGuestMessageReaction(messageId: string, emoji: string) {
  const reactions = getStoredMessageReactions();
  if (emoji) reactions[messageId] = emoji;
  else delete reactions[messageId];
  writeStorageMap(MESSAGE_REACTION_STORAGE_KEY, reactions);
}

export function normalizeUserId(userId: string) {
  return userId.replace(/\s+/g, ' ').trim().slice(0, 32);
}

export function formatPublicTime(value: number | string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16).replace('T', ' ');
}

async function readApiJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data.error === 'string' ? data.error : `API 错误 (${res.status})`;
    const error = new Error(message) as Error & { code?: string; status?: number };
    error.code = typeof data.code === 'string' ? data.code : (res.status === 401 ? 'AUTH_REQUIRED' : undefined);
    error.status = res.status;
    throw error;
  }
  return data;
}

export async function fetchComments(targetType: CommentTargetType, targetId: string) {
  const url = `${PUBLIC_API_BASE}/comments?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}&limit=100`;
  const res = await fetch(url, { cache: 'no-store' });
  const data = await readApiJson(res);
  return (Array.isArray(data.items) ? data.items : []) as PublicComment[];
}

export async function createComment(targetType: CommentTargetType, targetId: string, userId: string, text: string) {
  const res = await fetch(`${PUBLIC_API_BASE}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ targetType, targetId, userId, text }),
  });
  const data = await readApiJson(res);
  return data.item as PublicComment;
}

export async function deleteComment(commentId: string) {
  const res = await fetch(`${PUBLIC_API_BASE}/comments`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: commentId }),
  });
  await readApiJson(res);
}

export async function reactToComment(commentId: string, emoji: string, previousEmoji = '') {
  const res = await fetch(`${PUBLIC_API_BASE}/comment-reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ commentId, emoji, previousEmoji }),
  });
  const data = await readApiJson(res);
  return {
    reactions: (data.reactions || {}) as Record<string, number>,
    selectedEmoji: typeof data.selectedEmoji === 'string' ? data.selectedEmoji : (previousEmoji === emoji ? '' : emoji),
  };
}

export async function fetchGuestMessagePage(options: { limit?: number; before?: number; since?: number } = {}): Promise<GuestMessagePage> {
  const params = new URLSearchParams();
  params.set('limit', String(Math.min(100, Math.max(1, options.limit || 80))));
  if (options.before && options.before > 0) params.set('before', String(options.before));
  if (options.since && options.since > 0) params.set('since', String(options.since));
  const res = await fetch(`${PUBLIC_API_BASE}/messages?${params.toString()}`, { cache: 'no-store' });
  const data = await readApiJson(res);
  return {
    items: (Array.isArray(data.items) ? data.items : []) as GuestMessage[],
    now: Number(data.now) || Date.now(),
    nextCursor: Number(data.nextCursor) || Number(data.now) || Date.now(),
    ...(Number(data.nextBefore) > 0 ? { nextBefore: Number(data.nextBefore) } : {}),
  };
}

export async function fetchGuestMessages() {
  return (await fetchGuestMessagePage({ limit: 80 })).items;
}

export async function createGuestMessage(userId: string, text: string, noteColor: MessageNoteMeta['color'] = 'yellow') {
  const res = await fetch(`${PUBLIC_API_BASE}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userId, text, noteColor }),
  });
  const data = await readApiJson(res);
  const item = data.item as GuestMessage;
  const authorToken = typeof data.authorToken === 'string' ? data.authorToken : '';
  if (item?.id && authorToken) setGuestMessageAuthorToken(item.id, authorToken);
  return item;
}

async function withOwnedMessageToken<T>(messageId: string, operation: (token: string) => Promise<T>): Promise<T> {
  const token = getGuestMessageAuthorToken(messageId);
  if (!token) {
    const error = new Error('当前浏览器没有这张便签的编辑凭证') as Error & { code?: string; status?: number };
    error.code = 'MESSAGE_FORBIDDEN';
    error.status = 403;
    throw error;
  }
  try {
    return await operation(token);
  } catch (error) {
    const apiError = error as Error & { status?: number };
    if (apiError.status === 401 || apiError.status === 403) setGuestMessageAuthorToken(messageId, '');
    throw error;
  }
}

export async function updateOwnedGuestMessage(messageId: string, patch: GuestMessagePatch) {
  return withOwnedMessageToken(messageId, async (authorToken) => {
    const res = await fetch(`${PUBLIC_API_BASE}/messages`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ id: messageId, authorToken, ...patch }),
    });
    const data = await readApiJson(res);
    return data.item as GuestMessage;
  });
}

export async function deleteOwnedGuestMessage(messageId: string) {
  await withOwnedMessageToken(messageId, async (authorToken) => {
    const res = await fetch(`${PUBLIC_API_BASE}/messages`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ id: messageId, authorToken }),
    });
    await readApiJson(res);
  });
  setGuestMessageAuthorToken(messageId, '');
  setStoredGuestMessageReaction(messageId, '');
}

export async function deleteGuestMessage(messageId: string) {
  const res = await fetch(`${PUBLIC_API_BASE}/messages`, {
    method: 'DELETE',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ id: messageId }),
  });
  await readApiJson(res);
}

export async function reactToGuestMessage(messageId: string, emoji: string) {
  const previousEmoji = getStoredGuestMessageReaction(messageId);
  const res = await fetch(`${PUBLIC_API_BASE}/message-reactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ messageId, emoji, previousEmoji }),
  });
  const data = await readApiJson(res);
  const selectedEmoji = typeof data.selectedEmoji === 'string' ? data.selectedEmoji : (previousEmoji === emoji ? '' : emoji);
  setStoredGuestMessageReaction(messageId, selectedEmoji);
  return {
    reactions: (data.reactions || {}) as Record<string, number>,
    selectedEmoji,
  };
}

export function createCommentsWidget(targetType: CommentTargetType, targetId: string, initialCount?: number, previewCount = 0) {
  const root = document.createElement('section');
  root.className = 'public-comments';
  root.dataset.targetType = targetType;
  root.dataset.targetId = targetId;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'public-comments-toggle';
  toggle.textContent = previewCount > 0
    ? (initialCount && initialCount > 0 ? `查看全部评论 ${initialCount}` : '查看全部评论')
    : (initialCount && initialCount > 0 ? `评论 ${initialCount}` : '评论');

  const body = document.createElement('div');
  body.className = 'public-comments-body';
  body.hidden = previewCount <= 0;

  const list = document.createElement('div');
  list.className = 'public-comments-list';
  list.textContent = '加载评论中...';

  const form = document.createElement('form');
  form.className = 'public-comment-form';
  form.hidden = previewCount > 0;

  const userInput = document.createElement('input');
  userInput.name = 'userId';
  userInput.placeholder = '你的 ID';
  userInput.maxLength = 32;
  userInput.value = getStoredUserId();
  userInput.required = true;

  const textInput = document.createElement('input');
  textInput.name = 'text';
  textInput.placeholder = '写一条评论...';
  textInput.maxLength = 500;
  textInput.required = true;

  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.textContent = '评论';

  const status = document.createElement('p');
  status.className = 'public-comment-status';
  status.hidden = previewCount > 0;

  form.append(userInput, textInput, submit);
  body.append(list, form, status);
  root.append(toggle, body);

  let loaded = false;
  let expanded = previewCount <= 0;
  let allComments: PublicComment[] = [];

  function closeReactionPanels(except?: HTMLElement) {
    root.querySelectorAll<HTMLElement>('.public-comment-reaction-panel').forEach((panel) => {
      if (except && panel === except) return;
      closeCommentReactionPanel(panel);
    });
  }

  function render(comments: PublicComment[]) {
    list.innerHTML = '';
    allComments = comments;
    if (!comments.length) {
      const empty = document.createElement('p');
      empty.className = 'public-comment-empty';
      empty.textContent = '还没有评论';
      list.appendChild(empty);
      toggle.textContent = '评论';
      return;
    }

    const visibleComments = expanded ? comments : comments.slice(0, previewCount);
    visibleComments.forEach((comment) => {
      const item = document.createElement('article');
      item.className = 'public-comment-item';
      const meta = document.createElement('div');
      meta.className = 'public-comment-meta';
      const user = document.createElement('strong');
      user.textContent = comment.userId;
      const time = document.createElement('time');
      time.dateTime = new Date(comment.createdAt).toISOString();
      time.textContent = formatPublicTime(comment.createdAt);
      const metaActions = document.createElement('span');
      metaActions.className = 'public-comment-meta-actions';
      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'public-comment-delete';
      deleteBtn.textContent = '删除';
      deleteBtn.title = '删除这条评论';
      deleteBtn.setAttribute('aria-label', '删除这条评论');
      deleteBtn.addEventListener('click', async () => {
        const label = comment.text ? `「${comment.text.slice(0, 18)}${comment.text.length > 18 ? '...' : ''}」` : '这条评论';
        if (!window.confirm(`确定删除 ${label} 吗？删除后不可恢复。`)) return;
        deleteBtn.disabled = true;
        try {
          await deleteComment(comment.id);
          clearStoredCommentReaction(comment.id);
          allComments = allComments.filter((entry) => entry.id !== comment.id);
          render(allComments);
          status.hidden = false;
          status.textContent = '已删除';
        } catch (err) {
          const apiError = err as Error & { code?: string; status?: number };
          status.hidden = false;
          status.textContent = apiError.code === 'AUTH_REQUIRED' || apiError.status === 401
            ? '需要先在管理入口登录后才能删除评论'
            : (err instanceof Error ? err.message : '删除失败');
          deleteBtn.disabled = false;
        }
      });
      metaActions.append(time, deleteBtn);
      meta.append(user, metaActions);
      const text = document.createElement('p');
      text.textContent = comment.text;
      const reactions = document.createElement('div');
      reactions.className = 'public-comment-reactions';
      const selectedEmoji = getStoredCommentReaction(comment.id);
      const chips = document.createElement('div');
      chips.className = 'public-comment-reaction-chips';
      const pickerToggle = document.createElement('button');
      pickerToggle.type = 'button';
      pickerToggle.className = 'public-comment-reaction-add';
      pickerToggle.classList.toggle('active', Boolean(selectedEmoji));
      pickerToggle.title = selectedEmoji ? '更换或取消表情' : '贴表情';
      pickerToggle.setAttribute('aria-label', selectedEmoji ? '更换或取消表情' : '贴表情');
      pickerToggle.setAttribute('aria-expanded', 'false');
      pickerToggle.innerHTML = '<span class="public-comment-reaction-add-icon" aria-hidden="true">☺</span><span class="public-comment-reaction-add-plus" aria-hidden="true">+</span>';
      const picker = document.createElement('div');
      picker.className = 'public-comment-reaction-panel';
      picker.hidden = true;

      function togglePicker(event: MouseEvent) {
        event.stopPropagation();
        const shouldOpen = picker.hidden;
        closeReactionPanels(picker);
        picker.hidden = !shouldOpen;
        pickerToggle.setAttribute('aria-expanded', String(shouldOpen));
      }

      async function chooseReaction(emoji: string) {
        pickerToggle.disabled = true;
        picker.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = true; });
        try {
          const currentEmoji = getStoredCommentReaction(comment.id);
          const result = await reactToComment(comment.id, emoji, currentEmoji);
          comment.reactions = result.reactions;
          setStoredCommentReaction(comment.id, result.selectedEmoji);
          render(allComments);
        } catch (err) {
          status.hidden = false;
          status.textContent = err instanceof Error ? err.message : '回应失败';
        } finally {
          pickerToggle.disabled = false;
          picker.querySelectorAll<HTMLButtonElement>('button').forEach((button) => { button.disabled = false; });
        }
      }

      COMMENT_REACTION_EMOJIS.forEach((emoji, index) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'public-comment-reaction-choice';
        option.classList.toggle('active', selectedEmoji === emoji);
        option.style.setProperty('--index', String(index));
        option.textContent = emoji;
        option.title = selectedEmoji === emoji ? `取消 ${emoji}` : `贴 ${emoji}`;
        option.setAttribute('aria-label', selectedEmoji === emoji ? `取消 ${emoji} 回应` : `用 ${emoji} 回应这条评论`);
        option.addEventListener('click', () => chooseReaction(emoji));
        picker.appendChild(option);
      });

      COMMENT_REACTION_EMOJIS.forEach((emoji) => {
        const count = comment.reactions?.[emoji] || 0;
        if (count <= 0 && selectedEmoji !== emoji) return;
        const reaction = document.createElement('button');
        reaction.type = 'button';
        reaction.className = 'public-comment-reaction-chip';
        reaction.classList.toggle('active', selectedEmoji === emoji);
        reaction.textContent = count > 0 ? `${emoji} ${count}` : emoji;
        reaction.title = selectedEmoji === emoji ? `取消 ${emoji}` : `回应 ${emoji}`;
        reaction.setAttribute('aria-label', selectedEmoji === emoji ? `取消 ${emoji} 回应` : `用 ${emoji} 回应这条评论`);
        reaction.addEventListener('click', () => chooseReaction(emoji));
        chips.appendChild(reaction);
      });

      pickerToggle.addEventListener('click', togglePicker);
      chips.appendChild(pickerToggle);
      reactions.append(chips, picker);
      item.append(meta, text, reactions);
      list.appendChild(item);
    });

    if (previewCount > 0 && comments.length > previewCount) {
      toggle.textContent = expanded ? '收起评论' : `查看全部评论 ${comments.length}`;
    } else {
      toggle.textContent = comments.length > 0 ? `评论 ${comments.length}` : '评论';
    }
  }

  ensureCommentReactionOutsideListener();

  async function refresh() {
    try {
      render(await fetchComments(targetType, targetId));
      loaded = true;
    } catch {
      list.textContent = '评论加载失败';
    }
  }

  toggle.addEventListener('click', () => {
    if (previewCount > 0 && loaded) {
      expanded = !expanded;
      form.hidden = !expanded;
      status.hidden = !expanded;
      toggle.classList.toggle('open', expanded);
      render(allComments);
      return;
    }
    body.hidden = !body.hidden;
    expanded = !body.hidden;
    toggle.classList.toggle('open', !body.hidden);
    if (!body.hidden && !loaded) refresh();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const userId = normalizeUserId(userInput.value);
    const text = textInput.value.trim();
    if (!userId || !text) return;
    setStoredUserId(userId);
    submit.disabled = true;
    status.textContent = '';
    try {
      const comment = await createComment(targetType, targetId, userId, text);
      textInput.value = '';
      const existing = await fetchComments(targetType, targetId).catch(() => null);
      render(existing || [comment]);
      loaded = true;
      status.textContent = '已发送';
    } catch (err) {
      status.textContent = err instanceof Error ? err.message : '发送失败';
    } finally {
      submit.disabled = false;
    }
  });

  if (previewCount > 0) refresh();
  return root;
}
