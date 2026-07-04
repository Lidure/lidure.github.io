const DEFAULT_PUBLIC_API_BASE = 'https://danmaku.lidure22.xyz/api';
export const PUBLIC_API_BASE = (import.meta.env.PUBLIC_DANMAKU_API || DEFAULT_PUBLIC_API_BASE).replace(/\/$/, '');
export const USER_ID_KEY = 'guest_user_id';
const COMMENT_REACTION_STORAGE_KEY = 'public_comment_reactions_v1';
const PUBLIC_ADMIN_TOKEN_KEY = 'moments_admin_token';

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

export type GuestMessage = {
  id: string;
  userId: string;
  text: string;
  createdAt: number;
  commentCount?: number;
};

const COMMENT_REACTION_EMOJIS = ['❤️', '😂', '😭', '👍', '👎', '✨', '🔥', '🥰', '👏', '😮', '🤔', '🎉', '💯', '😍', '😎', '🥺', '😡', '😴', '🙏', '💪', '🌟', '🍀', '🫶', '😆', '🤯', '😱', '😢', '🤣', '🤩', '🙌', '👌', '😋', '😇', '🤗', '😤', '😐', '😵', '😳', '🤓', '👀', '💔', '⚡', '🏆', '🎁', '🍻', '☕', '🌈', '💤'];
type CommentReactionMap = Record<string, string>;
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

function getStoredCommentReactions(): CommentReactionMap {
  try {
    const raw = localStorage.getItem(COMMENT_REACTION_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === 'object' && !Array.isArray(data) ? data as CommentReactionMap : {};
  } catch {
    return {};
  }
}

function getStoredCommentReaction(commentId: string) {
  return getStoredCommentReactions()[commentId] || '';
}

function setStoredCommentReaction(commentId: string, emoji: string) {
  const reactions = getStoredCommentReactions();
  if (emoji) {
    reactions[commentId] = emoji;
  } else {
    delete reactions[commentId];
  }

  try {
    localStorage.setItem(COMMENT_REACTION_STORAGE_KEY, JSON.stringify(reactions));
  } catch {}
}

function clearStoredCommentReaction(commentId: string) {
  setStoredCommentReaction(commentId, '');
}

export function normalizeUserId(userId: string) {
  return userId.replace(/\s+/g, ' ').trim().slice(0, 32);
}

export function formatPublicTime(value: number | string) {
  const date = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16).replace('T', ' ');
}

async function readApiJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = typeof data.error === 'string' ? data.error : `API 错误 (${res.status})`;
    throw new Error(message);
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

export async function deleteComment(commentId: string, adminToken: string) {
  const res = await fetch(`${PUBLIC_API_BASE}/comments`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${adminToken}`,
    },
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

export async function fetchGuestMessages() {
  const res = await fetch(`${PUBLIC_API_BASE}/messages?limit=80`, { cache: 'no-store' });
  const data = await readApiJson(res);
  return (Array.isArray(data.items) ? data.items : []) as GuestMessage[];
}

export async function createGuestMessage(userId: string, text: string) {
  const res = await fetch(`${PUBLIC_API_BASE}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ userId, text }),
  });
  const data = await readApiJson(res);
  return data.item as GuestMessage;
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

  function getAdminToken() {
    try { return localStorage.getItem(PUBLIC_ADMIN_TOKEN_KEY) || ''; } catch { return ''; }
  }

  function setAdminToken(token: string) {
    try { localStorage.setItem(PUBLIC_ADMIN_TOKEN_KEY, token); } catch {}
  }

  function clearAdminToken() {
    try { localStorage.removeItem(PUBLIC_ADMIN_TOKEN_KEY); } catch {}
  }

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

        let adminToken = getAdminToken();
        if (!adminToken) {
          adminToken = window.prompt('请输入管理密钥以删除评论')?.trim() || '';
          if (adminToken) setAdminToken(adminToken);
        }
        if (!adminToken) return;

        deleteBtn.disabled = true;
        try {
          await deleteComment(comment.id, adminToken);
          clearStoredCommentReaction(comment.id);
          allComments = allComments.filter((item) => item.id !== comment.id);
          render(allComments);
          status.hidden = false;
          status.textContent = '已删除';
        } catch (err) {
          if (err instanceof Error && err.message.toLowerCase().includes('unauthorized')) clearAdminToken();
          status.hidden = false;
          status.textContent = err instanceof Error ? err.message : '删除失败';
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
        picker.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
          button.disabled = true;
        });

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
          picker.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
            button.disabled = false;
          });
        }
      }

      COMMENT_REACTION_EMOJIS.forEach((emoji) => {
        const option = document.createElement('button');
        option.type = 'button';
        option.className = 'public-comment-reaction-choice';
        option.classList.toggle('active', selectedEmoji === emoji);
        option.style.setProperty('--index', String(COMMENT_REACTION_EMOJIS.indexOf(emoji)));
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
    } catch (err) {
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

  if (previewCount > 0) {
    refresh();
  }

  return root;
}
